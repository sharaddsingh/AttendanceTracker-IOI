/**
 * ROBUST CAMERA INITIALIZATION - FIXES RACE CONDITION BUG
 * 
 * This solution addresses the common issue where video element appears blank
 * on first load but works after tab switching (visibility change events).
 */

class RobustCameraInitializer {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.isInitializing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Main function to initialize camera with race condition protection
   */
  async initializeCamera(videoElementId, constraints = {}) {
    if (this.isInitializing) {
      console.log('🔄 Camera initialization already in progress...');
      return;
    }

    this.isInitializing = true;
    this.videoElement = document.getElementById(videoElementId);
    
    if (!this.videoElement) {
      throw new Error(`Video element with ID '${videoElementId}' not found`);
    }

    try {
      // STEP 1: Wait for DOM to be fully ready
      await this.ensureDOMReady();
      
      // STEP 2: Request camera permission and get stream
      const stream = await this.getCameraStream(constraints);
      
      // STEP 3: Initialize video element with proper timing
      await this.setupVideoElement(stream);
      
      // STEP 4: Verify camera is actually working
      await this.verifyCameraWorking();
      
      console.log('✅ Camera initialized successfully');
      return stream;
      
    } catch (error) {
      console.error('❌ Camera initialization failed:', error);
      
      // Retry logic for transient failures
      if (this.retryCount < this.maxRetries && this.shouldRetry(error)) {
        this.retryCount++;
        console.log(`🔄 Retrying camera initialization (${this.retryCount}/${this.maxRetries})...`);
        await this.delay(1000 * this.retryCount); // Exponential backoff
        return this.initializeCamera(videoElementId, constraints);
      }
      
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * RACE CONDITION FIX #1: Ensure DOM is fully ready
   */
  async ensureDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        // DOM already ready, but wait one more frame to be safe
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      } else {
        // Wait for DOM to be ready
        const handler = () => {
          document.removeEventListener('DOMContentLoaded', handler);
          // Double RAF to ensure we're past any pending DOM updates
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        };
        document.addEventListener('DOMContentLoaded', handler);
      }
    });
  }

  /**
   * RACE CONDITION FIX #2: Proper camera stream acquisition
   */
  async getCameraStream(userConstraints) {
    const defaultConstraints = {
      video: {
        facingMode: 'environment', // Rear camera for QR scanning
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 }
      },
      audio: false
    };

    const constraints = { ...defaultConstraints, ...userConstraints };
    
    console.log('📱 Requesting camera access with constraints:', constraints);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Camera stream obtained:', {
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });
      
      this.stream = stream;
      return stream;
      
    } catch (error) {
      console.error('❌ Failed to get camera stream:', error);
      throw error;
    }
  }

  /**
   * RACE CONDITION FIX #3: Proper video element setup with timing
   */
  async setupVideoElement(stream) {
    return new Promise((resolve, reject) => {
      console.log('📺 Setting up video element...');
      
      // Configure video element properties
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.controls = false;
      
      // Apply styling for better UX
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = '100%';
      this.videoElement.style.objectFit = 'cover';
      this.videoElement.style.backgroundColor = '#000';
      
      // Set up event listeners BEFORE assigning stream
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('⚠️ Video setup timeout, but continuing...');
          resolve();
        }
      }, 10000); // 10 second timeout
      
      const onSuccess = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.log('✅ Video element ready');
          resolve();
        }
      };
      
      const onError = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.error('❌ Video element error:', error);
          reject(error);
        }
      };
      
      // Multiple event listeners to catch different ready states
      this.videoElement.addEventListener('loadedmetadata', () => {
        console.log('📹 Video metadata loaded');
        if (this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
          onSuccess();
        }
      }, { once: true });
      
      this.videoElement.addEventListener('canplay', () => {
        console.log('📹 Video can play');
        onSuccess();
      }, { once: true });
      
      this.videoElement.addEventListener('playing', () => {
        console.log('📹 Video is playing');
        onSuccess();
      }, { once: true });
      
      this.videoElement.addEventListener('error', onError, { once: true });
      
      // CRITICAL: Clear any existing srcObject first
      this.videoElement.srcObject = null;
      
      // Wait a frame before setting the new stream
      requestAnimationFrame(() => {
        try {
          this.videoElement.srcObject = stream;
          
          // Force play after a short delay
          setTimeout(() => {
            this.videoElement.play()
              .then(() => {
                console.log('✅ Video.play() succeeded');
              })
              .catch(err => {
                console.warn('⚠️ Video.play() failed, but stream may still work:', err);
                // Don't reject here - video might still work
              });
          }, 100);
          
        } catch (error) {
          onError(error);
        }
      });
    });
  }

  /**
   * RACE CONDITION FIX #4: Verify camera is actually working
   */
  async verifyCameraWorking() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds worth of checks
      
      const checkVideo = () => {
        attempts++;
        
        const isWorking = (
          this.videoElement.videoWidth > 0 &&
          this.videoElement.videoHeight > 0 &&
          this.videoElement.readyState >= 2 &&
          !this.videoElement.paused
        );
        
        console.log(`📊 Video check ${attempts}/${maxAttempts}:`, {
          videoWidth: this.videoElement.videoWidth,
          videoHeight: this.videoElement.videoHeight,
          readyState: this.videoElement.readyState,
          paused: this.videoElement.paused,
          isWorking
        });
        
        if (isWorking) {
          console.log('✅ Camera verification successful');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ Camera verification failed after maximum attempts');
          reject(new Error('Camera stream verification failed'));
        } else {
          // Check again in 100ms
          setTimeout(checkVideo, 100);
        }
      };
      
      // Start verification after a brief delay
      setTimeout(checkVideo, 200);
    });
  }

  /**
   * RACE CONDITION FIX #5: Handle visibility changes (tab switching)
   */
  setupVisibilityChangeHandler() {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && this.stream) {
        console.log('👁️ Tab became visible, refreshing video...');
        
        // Small delay to let the browser settle
        setTimeout(() => {
          if (this.videoElement && this.stream) {
            // Force refresh the video element
            this.videoElement.srcObject = null;
            requestAnimationFrame(() => {
              this.videoElement.srcObject = this.stream;
              this.videoElement.play().catch(err => {
                console.warn('Video play after visibility change failed:', err);
              });
            });
          }
        }, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  /**
   * Determine if error is worth retrying
   */
  shouldRetry(error) {
    // Don't retry permission errors
    if (error.name === 'NotAllowedError') return false;
    
    // Don't retry if no camera hardware
    if (error.name === 'NotFoundError') return false;
    
    // Retry transient errors
    return true;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Camera track stopped');
      });
      this.stream = null;
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    
    this.retryCount = 0;
    this.isInitializing = false;
  }
}

// USAGE EXAMPLE:
async function initializeQRScanner() {
  const cameraInitializer = new RobustCameraInitializer();
  
  try {
    // Set up visibility change handler for tab switching
    const cleanupVisibility = cameraInitializer.setupVisibilityChangeHandler();
    
    // Initialize camera with custom constraints
    const stream = await cameraInitializer.initializeCamera('qrReaderVideo', {
      video: {
        facingMode: 'environment', // Rear camera for QR scanning
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 }
      }
    });
    
    console.log('🎉 QR Scanner camera ready!');
    
    // Store references for later cleanup
    window.cameraCleanup = () => {
      cameraInitializer.cleanup();
      cleanupVisibility();
    };
    
    return stream;
    
  } catch (error) {
    console.error('Failed to initialize QR scanner camera:', error);
    
    // Show user-friendly error message
    const errorMessages = {
      'NotAllowedError': 'Camera permission denied. Please allow camera access.',
      'NotFoundError': 'No camera found. Please check your camera connection.',
      'NotReadableError': 'Camera is busy. Please close other apps using the camera.',
      'OverconstrainedError': 'Camera settings not supported. Trying alternative configuration...'
    };
    
    const message = errorMessages[error.name] || 'Camera initialization failed. Please try again.';
    alert(message); // Replace with your notification system
    
    throw error;
  }
}

// INTEGRATION WITH HTML5-QRCODE LIBRARY:
async function startQRScannerWithRobustCamera() {
  try {
    // First, initialize the camera properly
    await initializeQRScanner();
    
    // Small delay to ensure video is completely ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now start the QR scanner
    const html5QrCode = new Html5Qrcode("qrReaderVideo");
    
    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        disableFlip: false
      },
      onScanSuccess,
      onScanError
    );
    
    console.log('✅ QR Scanner started successfully with robust camera initialization');
    
  } catch (error) {
    console.error('❌ Failed to start QR scanner:', error);
  }
}

function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code scanned:', decodedText);
  // Handle successful scan
}

function onScanError(error) {
  // Handle scan errors (usually just "no QR found")
}

export { RobustCameraInitializer, initializeQRScanner, startQRScannerWithRobustCamera };
