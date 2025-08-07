/*
==================================================
FACULTY DASHBOARD JAVASCRIPT - DYNAMIC UPDATE
==================================================
*/

// --- GLOBAL VARIABLES ---
let currentFaculty = null;
let facultyProfile = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check QRCode library availability
    checkQRCodeLibrary();
    
    // Populate subjects checkboxes
    populateSubjectsCheckboxes();
    
    // Firebase auth listener
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('Faculty user authenticated:', user.email);
            currentFaculty = user;
            checkAndLoadFacultyProfile(user);
        } else {
            console.log('No faculty user signed in. Redirecting to login.');
            window.location.href = 'index.html';
        }
    });
});

// Check if QRCode library is loaded, if not try to load it dynamically
function checkQRCodeLibrary() {
    console.log('Checking QRCode library...');
    
    if (typeof QRCode !== 'undefined') {
        console.log('✅ QRCode library is loaded');
        return;
    }
    
    console.warn('⚠️ QRCode library not found, attempting to load fallback...');
    
    // Try to load from a different CDN as fallback
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
    script.onload = () => {
        console.log('✅ QRCode fallback library loaded successfully');
    };
    script.onerror = () => {
        console.error('❌ Failed to load QRCode fallback library');
        // Try one more CDN
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
        script2.onload = () => {
            console.log('✅ Alternative QRCode library loaded');
            // This library has different API, so we need to create a wrapper
            if (typeof QRCode === 'undefined' && typeof qrcode !== 'undefined') {
                window.QRCode = {
                    toCanvas: (canvas, text, options, callback) => {
                        try {
                            const qr = qrcode(0, 'M');
                            qr.addData(text);
                            qr.make();
                            
                            const ctx = canvas.getContext('2d');
                            const size = options.width || 256;
                            canvas.width = size;
                            canvas.height = size;
                            
                            // Simple QR code rendering (basic implementation)
                            const moduleCount = qr.getModuleCount();
                            const cellSize = size / moduleCount;
                            
                            ctx.fillStyle = options.colorLight || '#ffffff';
                            ctx.fillRect(0, 0, size, size);
                            
                            ctx.fillStyle = options.colorDark || '#000000';
                            for (let row = 0; row < moduleCount; row++) {
                                for (let col = 0; col < moduleCount; col++) {
                                    if (qr.isDark(row, col)) {
                                        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                                    }
                                }
                            }
                            
                            if (callback) callback(null);
                        } catch (error) {
                            if (callback) callback(error);
                        }
                    },
                    CorrectLevel: { M: 'M' }
                };
            }
        };
        script2.onerror = () => {
            console.error('❌ All QRCode library loading attempts failed');
        };
        document.head.appendChild(script2);
    };
    document.head.appendChild(script);
}

function initializeFacultyDashboard() {
    setupEventListeners();
    loadLeaveRequests(); // Fetch dynamic leave requests on load
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// --- CORE FUNCTIONS ---

/**
 * Toggles the visibility of different dashboard sections.
 * @param {string} sectionId - The ID of the section to show.
 */
function showSection(sectionId) {
    const sections = document.querySelectorAll('.dashboard .section[id]');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

/**
 * Fetches and displays pending leave requests from Firestore in real-time.
 * Only shows requests for subjects that the faculty teaches.
 */
function loadLeaveRequests() {
    const db = firebase.firestore();
    const listContainer = document.getElementById('leaveRequestsList');
    const noRequestsMsg = document.getElementById('no-leave-requests');

    // Check if faculty profile is loaded and has subjects
    if (!facultyProfile || !facultyProfile.subjects || facultyProfile.subjects.length === 0) {
        console.log('Faculty profile not loaded or no subjects assigned');
        listContainer.innerHTML = '';
        noRequestsMsg.style.display = 'block';
        noRequestsMsg.innerText = 'Complete your profile to view leave requests for your subjects.';
        return;
    }

    // Filter requests for subjects that this faculty teaches
    db.collection('leaveRequests')
        .where('status', '==', 'pending')
        .where('subject', 'in', facultyProfile.subjects)
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                listContainer.innerHTML = ''; // Clear old requests
                noRequestsMsg.style.display = 'block';
                noRequestsMsg.innerText = `No pending leave requests for your subjects (${facultyProfile.subjects.join(', ')}).`;
                return;
            }

            noRequestsMsg.style.display = 'none';
            listContainer.innerHTML = ''; // Clear list before re-rendering
            
            // Sort requests by timestamp (newest first)
            const requests = [];
            snapshot.forEach(doc => {
                requests.push({ id: doc.id, data: doc.data() });
            });
            
            requests.sort((a, b) => {
                const timeA = a.data.createdAt ? new Date(a.data.createdAt) : new Date(0);
                const timeB = b.data.createdAt ? new Date(b.data.createdAt) : new Date(0);
                return timeB - timeA;
            });
            
            requests.forEach(({ id: requestId, data: request }) => {
                const item = document.createElement('div');
                item.className = 'leave-request-item pending';
                
                const submittedDate = request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown';
                
                item.innerHTML = `
                    <div class="leave-info">
                        <h4>${request.studentName || 'Unknown Student'} (${request.regNumber || 'N/A'})</h4>
                        <p><strong>Subject:</strong> ${request.subject}</p>
                        <p><strong>Leave Date:</strong> ${request.date} | <strong>Classes:</strong> ${request.periods || 'N/A'}</p>
                        <p><strong>School/Batch:</strong> ${request.school || 'N/A'} - ${request.batch || 'N/A'}</p>
                        <p><strong>Reason:</strong> ${request.reason || 'No reason provided.'}</p>
                        <p style="font-size: 12px; color: #666; margin-top: 8px;"><strong>Submitted:</strong> ${submittedDate}</p>
                        ${request.hasAttachment ? '<p style="font-size: 12px; color: #007bff;"><i class="fas fa-paperclip"></i> Has attachment</p>' : ''}
                    </div>
                    <div class="leave-actions">
                        <button class="approve-btn" onclick="updateLeaveRequestStatus('${requestId}', 'approved')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="reject-btn" onclick="updateLeaveRequestStatus('${requestId}', 'rejected')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }, error => {
            console.error("Error fetching leave requests: ", error);
            noRequestsMsg.innerText = "Error loading requests.";
            noRequestsMsg.style.display = 'block';
        });
}

// Note: Direct approval/rejection without comment popup

/**
 * Updates a leave request status with optional comment
 * @param {string} requestId - The document ID of the leave request.
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} comment - Optional faculty comment
 */
function updateLeaveRequestStatus(requestId, status, comment = '') {
    const db = firebase.firestore();
    
    const updateData = {
        status: status,
        processedAt: firebase.firestore.FieldValue.serverTimestamp(),
        processedBy: facultyProfile ? facultyProfile.fullName : currentFaculty.email
    };
    
    // Add comment if provided
    if (comment && comment.trim()) {
        updateData.facultyComment = comment.trim();
    }
    
    db.collection('leaveRequests').doc(requestId).update(updateData)
        .then(() => {
            console.log(`Request ${requestId} ${status}.`);
            showSuccessMessage(`Leave request ${status} successfully!`);
            
            // Send notification to student
            createStudentNotification(requestId, status, comment);
        })
        .catch(error => {
            console.error(`Error ${status === 'approved' ? 'approving' : 'rejecting'} request:`, error);
            alert(`Error ${status === 'approved' ? 'approving' : 'rejecting'} request. Please try again.`);
        });
}

/**
 * Creates a notification for the student about their leave request status
 * @param {string} requestId - The document ID of the leave request.
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} comment - Optional faculty comment
 */
async function createStudentNotification(requestId, status, comment = '') {
    try {
        const db = firebase.firestore();
        
        console.log(`Creating notification for request: ${requestId}, status: ${status}`);
        
        // First get the leave request to find student info
        const requestDoc = await db.collection('leaveRequests').doc(requestId).get();
        if (!requestDoc.exists) {
            console.error('Leave request document not found:', requestId);
            return;
        }
        
        const requestData = requestDoc.data();
        console.log('Leave request data found:', {
            studentName: requestData.studentName,
            userId: requestData.userId,
            subject: requestData.subject,
            date: requestData.date
        });
        
        const statusText = status === 'approved' ? 'approved' : 'rejected';
        const facultyName = facultyProfile ? facultyProfile.fullName : 'Faculty';
        
        // Create detailed notification message
        let notificationMessage = `Your leave request for ${requestData.subject} on ${requestData.date} has been ${statusText} by ${facultyName}.`;
        if (comment && comment.trim()) {
            notificationMessage += ` Comment: "${comment.trim()}"`;
        }
        
        const notificationData = {
            userId: requestData.userId,
            type: 'leave_status',
            title: `Leave Request ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
            message: notificationMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false,
            icon: status === 'approved' ? 'fa-check-circle' : 'fa-times-circle',
            color: status === 'approved' ? '#28a745' : '#dc3545',
            relatedRequestId: requestId,
            leaveDate: requestData.date,
            subject: requestData.subject,
            facultyName: facultyName,
            status: status,
            comment: comment || '',
            createdAt: new Date() // Add explicit timestamp for fallback
        };
        
        console.log('Creating notification with data:', notificationData);
        
        const notificationRef = await db.collection('notifications').add(notificationData);
        console.log('Student notification created successfully with ID:', notificationRef.id);
        
        // Verify the notification was created
        const createdNotification = await notificationRef.get();
        if (createdNotification.exists) {
            console.log('Verification: Notification exists in database:', createdNotification.data());
        } else {
            console.error('Verification failed: Notification was not created');
        }
        
        // Also log for debugging
        console.log(`✅ Notification sent to student ${requestData.studentName} (${requestData.userId}) for ${status} leave request`);
        
        return notificationRef.id;
    } catch (error) {
        console.error('❌ Error creating student notification:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        // Try to show error to faculty user
        alert(`Error sending notification to student: ${error.message}`);
    }
}

/**
 * Legacy functions for backward compatibility
 */
function approveLeave(requestId) {
    showApprovalDialog(requestId, 'approved');
}

function rejectLeave(requestId) {
    showApprovalDialog(requestId, 'rejected');
}

// ===== QR MODAL FUNCTIONS =====

// Batch options mapping
const batchOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

// Global QR timer variables
let qrTimer = null;
let qrTimeRemaining = 30;

/**
 * Opens the QR generation modal
 */
function openQRModal() {
    console.log('openQRModal called');
    
    const modal = document.getElementById('qrModal');
    const form = document.getElementById('qrForm');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        form: !!form,
        qrCodeDisplay: !!qrCodeDisplay
    });
    
    if (!modal) {
        console.error('QR Modal not found!');
        alert('QR Modal not found. Please check the HTML.');
        return;
    }
    
    // Reset modal state
    if (form) {
        form.style.display = 'block';
    }
    if (qrCodeDisplay) {
        qrCodeDisplay.style.display = 'none';
    }
    
    // Reset form if it exists
    const formElement = form && form.tagName === 'FORM' ? form : document.querySelector('#qrModal form');
    if (formElement) {
        formElement.reset();
    }
    
    // Reset batch dropdown
    const batchSelect = document.getElementById('qrBatch');
    if (batchSelect) {
        batchSelect.innerHTML = '<option value="">Select Batch</option>';
        batchSelect.disabled = true;
    } else {
        console.warn('qrBatch select not found');
    }
    
    // Show modal
    modal.style.display = 'block';
    
    console.log('QR Modal opened successfully');
}

/**
 * Closes the QR generation modal
 */
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
    
    // Clear any running timer
    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }
    
    console.log('QR Modal closed');
}

/**
 * Updates batch options based on selected school
 */
function updateBatchOptions() {
    const schoolSelect = document.getElementById('qrSchool');
    const batchSelect = document.getElementById('qrBatch');
    const selectedSchool = schoolSelect.value;
    
    // Clear existing options
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && batchOptions[selectedSchool]) {
        batchSelect.disabled = false;
        batchOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
        console.log(`Updated batch options for ${selectedSchool}:`, batchOptions[selectedSchool]);
    } else {
        batchSelect.disabled = true;
    }
}

/**
 * Generates and displays a QR code for attendance with 30-second timer
 */
function generateQRCode() {
    console.log('generateQRCode called');
    console.log('QRCode library available:', typeof QRCode);
    
    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded!');
        alert('QRCode library is not loaded. Please refresh the page and try again.');
        return;
    }
    
    const school = document.getElementById('qrSchool').value;
    const batch = document.getElementById('qrBatch').value;
    const subject = document.getElementById('qrSubject').value;
    const periods = document.getElementById('qrPeriods').value;
    
    console.log('Form values:', { school, batch, subject, periods });
    
    // Validation
    if (!school || !batch || !subject || !periods) {
        alert('Please fill in all fields to generate a QR code.');
        return;
    }
    
    // Hide form and show QR display
    document.getElementById('qrForm').style.display = 'none';
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    qrCodeDisplay.style.display = 'block';
    
    // Populate display information
    document.getElementById('displaySchool').textContent = school;
    document.getElementById('displayBatch').textContent = batch;
    document.getElementById('displaySubject').textContent = subject;
    document.getElementById('displayPeriods').textContent = periods;
    
    // Create unique session ID and QR data
    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const qrData = {
        sessionId: sessionId,
        school: school,
        batch: batch,
        subject: subject,
        periods: parseInt(periods),
        facultyName: facultyProfile ? facultyProfile.fullName : currentFaculty.email,
        facultyId: currentFaculty.uid,
        timestamp: now,
        expiry: now + (30 * 1000), // 30 seconds from now
        validFor: 30, // 30 seconds
        redirectUrl: window.location.origin + '/student-dashboard.html'
    };
    
    console.log('Generated QR Data:', qrData);
    
    // Generate QR Code
    const qrCanvas = document.getElementById('qrCodeCanvas');
    const qrDataString = JSON.stringify(qrData);
    
    console.log('QR Data String length:', qrDataString.length);
    
    try {
        QRCode.toCanvas(qrCanvas, qrDataString, { 
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        }, (error) => {
            if (error) {
                console.error('QR Code generation error:', error);
                alert('Failed to generate QR code. Please try again.');
                // Show the form again on error
                document.getElementById('qrForm').style.display = 'block';
                document.getElementById('qrCodeDisplay').style.display = 'none';
                return;
            }
            
            console.log('QR Code generated successfully!');
            console.log('QR Data:', qrData);
            
            // Start 30-second countdown timer
            startQRTimer();
        });
    } catch (qrError) {
        console.error('QRCode.toCanvas error:', qrError);
        alert('Error generating QR code: ' + qrError.message);
        // Show the form again on error
        document.getElementById('qrForm').style.display = 'block';
        document.getElementById('qrCodeDisplay').style.display = 'none';
    }
}

/**
 * Starts the 30-second countdown timer for QR code expiration
 */
function startQRTimer() {
    qrTimeRemaining = 30;
    const timerElement = document.getElementById('qrTimer');
    const statusElement = document.getElementById('qrStatus');
    const regenerateBtn = document.querySelector('.regenerate-btn');
    
    // Reset UI state
    timerElement.classList.remove('expired');
    statusElement.classList.remove('expired');
    statusElement.innerHTML = '<p>QR Code is active. Students can scan to mark attendance.</p>';
    regenerateBtn.style.display = 'none';
    
    // Update timer display immediately
    timerElement.textContent = qrTimeRemaining;
    
    // Clear any existing timer
    if (qrTimer) {
        clearInterval(qrTimer);
    }
    
    // Start countdown
    qrTimer = setInterval(() => {
        qrTimeRemaining--;
        timerElement.textContent = qrTimeRemaining;
        
        if (qrTimeRemaining <= 0) {
            // Timer expired
            clearInterval(qrTimer);
            qrTimer = null;
            
            // Update UI to show expired state
            timerElement.classList.add('expired');
            timerElement.textContent = 'EXPIRED';
            
            statusElement.classList.add('expired');
            statusElement.innerHTML = '<p>QR Code has expired. Generate a new one to continue.</p>';
            
            regenerateBtn.style.display = 'inline-flex';
            
            console.log('QR Code expired after 30 seconds');
        }
    }, 1000);
    
    console.log('QR Timer started - 30 seconds countdown');
}

/**
 * Regenerates a new QR code (resets form)
 */
function regenerateQR() {
    // Hide QR display and show form again
    document.getElementById('qrCodeDisplay').style.display = 'none';
    document.getElementById('qrForm').style.display = 'block';
    
    // Clear timer
    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }
    
    console.log('Regenerating QR - returning to form');
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        closeQRModal();
    }
}

// Make functions globally accessible
window.openQRModal = openQRModal;
window.closeQRModal = closeQRModal;
window.generateQRCode = generateQRCode;
window.updateBatchOptions = updateBatchOptions;
window.regenerateQR = regenerateQR;

/**
 * Legacy QR generation function - kept for backward compatibility
 */
function generateQRCodeLegacy() {
    const subject = document.getElementById('subjectSelect').value;
    const sessionDate = document.getElementById('sessionDate').value;
    const sessionTime = document.getElementById('sessionTime').value;
    const duration = document.getElementById('duration').value;

    if (!subject || !sessionDate || !sessionTime) {
        alert('Please fill in all fields to generate a QR code.');
        return;
    }

    // Example QR Content: { "subject": "JAVA", "datetime": "2025-08-06T10:30", "validFor": 60 }
    const qrData = JSON.stringify({
        subject: subject,
        datetime: `${sessionDate}T${sessionTime}`,
        validFor: parseInt(duration, 10)
    });

    const qrcodeCanvas = document.getElementById('qrcode');
    const qrDisplayDiv = document.getElementById('qrDisplay');

    QRCode.toCanvas(qrcodeCanvas, qrData, { width: 256 }, (error) => {
        if (error) {
            console.error(error);
            alert('Failed to generate QR code.');
            return;
        }
        console.log('QR Code generated successfully!');
        qrDisplayDiv.style.display = 'block';
    });
}

/**
 * Signs the faculty member out.
 */
function logout() {
    firebase.auth().signOut().then(() => {
        console.log('Signed out successfully');
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out.');
    });
}

// --- FACULTY PROFILE COMPLETION FUNCTIONS ---

/**
 * Check if faculty has completed profile and show popup if needed
 * @param {Object} user - Firebase user object
 */
async function checkAndLoadFacultyProfile(user) {
    try {
        const db = firebase.firestore();
        const facultyDoc = await db.collection('faculty').doc(user.uid).get();
        
        if (!facultyDoc.exists) {
            // Faculty document doesn't exist, show profile completion popup
            console.log('Faculty profile not found, showing completion popup');
            showFacultyProfilePopup();
        } else {
            const data = facultyDoc.data();
            facultyProfile = data;
            
            // Check if profile is complete
            if (!data.fullName || !data.employeeId || !data.departments || data.departments.length === 0 || !data.subjects || data.subjects.length === 0) {
                console.log('Incomplete faculty profile, showing completion popup');
                showFacultyProfilePopup();
            } else {
                // Profile is complete, initialize dashboard
                console.log('Faculty profile complete, initializing dashboard');
                hideFacultyProfilePopup();
                showFacultyWelcome(data);
                initializeFacultyDashboard();
                populateSubjectOptions(data.subjects);
            }
        }
    } catch (error) {
        console.error('Error checking faculty profile:', error);
        showFacultyProfilePopup(); // Show popup on error as fallback
    }
}

/**
 * Show the faculty profile completion popup
 */
function showFacultyProfilePopup() {
    const popup = document.getElementById('facultyProfilePopup');
    popup.style.display = 'block';
    
    // Setup form submission handler
    const form = document.getElementById('facultyProfileForm');
    form.onsubmit = handleFacultyProfileSubmission;
}

/**
 * Hide the faculty profile completion popup
 */
function hideFacultyProfilePopup() {
    const popup = document.getElementById('facultyProfilePopup');
    popup.style.display = 'none';
}

/**
 * Populate subjects checkboxes from common-utils.js
 */
function populateSubjectsCheckboxes() {
    const subjectsContainer = document.getElementById('subjectsCheckboxes');
    const subjects = [
        "JAVA", "DSA", "DBMS", "EXCEL", "JAVASCRIPT", 
        "MASTERCLASS", "PYTHON", "BUSINESS COMMUNICATION", "CRITICAL COMMUNICATION"
    ];
    
    subjects.forEach(subject => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'subject-checkbox-item';
        
        const checkboxId = `subject_${subject.replace(/\s+/g, '_').toLowerCase()}`;
        
        checkboxItem.innerHTML = `
            <input type="checkbox" id="${checkboxId}" value="${subject}">
            <label for="${checkboxId}">${subject}</label>
        `;
        
        subjectsContainer.appendChild(checkboxItem);
    });
}

/**
 * Handle faculty profile form submission
 * @param {Event} event - Form submission event
 */
async function handleFacultyProfileSubmission(event) {
    event.preventDefault();
    
    // Collect form data
    const fullName = document.getElementById('facultyFullName').value.trim();
    const employeeId = document.getElementById('facultyEmployeeId').value.trim();
    const phone = document.getElementById('facultyPhone').value.trim();
    
    // Get selected departments
    const departmentCheckboxes = document.querySelectorAll('#departmentCheckboxes input[type="checkbox"]:checked');
    const selectedDepartments = Array.from(departmentCheckboxes).map(cb => cb.value);
    
    // Get selected subjects
    const subjectCheckboxes = document.querySelectorAll('#subjectsCheckboxes input[type="checkbox"]:checked');
    const selectedSubjects = Array.from(subjectCheckboxes).map(cb => cb.value);
    
    // Validation
    if (!fullName || !employeeId || !phone) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (selectedDepartments.length === 0) {
        alert('Please select at least one department.');
        return;
    }
    
    if (selectedSubjects.length === 0) {
        alert('Please select at least one subject you teach.');
        return;
    }
    
    // Validate phone number (basic)
    if (!/^[\d\s\-\+\(\)]+$/.test(phone)) {
        alert('Please enter a valid phone number.');
        return;
    }
    
    try {
        console.log('Starting faculty profile submission...');
        console.log('Current user:', currentFaculty);
        
        const db = firebase.firestore();
        const profileData = {
            fullName,
            employeeId,
            departments: selectedDepartments,
            subjects: selectedSubjects,
            phone,
            email: currentFaculty.email,
            role: 'faculty',
            profileCompleted: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Profile data to save:', profileData);
        console.log('User UID:', currentFaculty.uid);
        
        // Save to Firestore
        console.log('Saving to faculty collection...');
        await db.collection('faculty').doc(currentFaculty.uid).set(profileData);
        console.log('Faculty document saved successfully');
        
        // Update user document as well
        console.log('Updating user document...');
        await db.collection('users').doc(currentFaculty.uid).update({
            profileCompleted: true,
            fullName: fullName,
            updatedAt: new Date()
        });
        console.log('User document updated successfully');
        
        console.log('Faculty profile saved successfully');
        facultyProfile = profileData;
        
        // Hide popup and show success message
        hideFacultyProfilePopup();
        showSuccessMessage('Profile completed successfully! Welcome to your dashboard.');
        
        // Show welcome message and initialize dashboard
        showFacultyWelcome(profileData);
        initializeFacultyDashboard();
        populateSubjectOptions(selectedSubjects);
        
    } catch (error) {
        console.error('Error saving faculty profile:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error);
        
        // Check if it's a permission error
        if (error.code === 'permission-denied') {
            alert('Permission denied. Please check if you are properly authenticated.');
        } else if (error.code === 'not-found') {
            alert('Document not found. Please try logging in again.');
        } else {
            alert(`Error saving profile: ${error.message}. Please try again.`);
        }
    }
}

/**
 * Show faculty welcome message
 * @param {Object} profileData - Faculty profile data
 */
function showFacultyWelcome(profileData) {
    // Find the header container
    const header = document.querySelector('.header');
    
    if (!header) {
        console.error('Header container not found');
        return;
    }
    
    // Check if welcome message already exists to avoid duplicates
    const existingWelcome = header.querySelector('.faculty-welcome');
    if (existingWelcome) {
        existingWelcome.remove();
    }
    
    // Create welcome message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'faculty-welcome';
    welcomeDiv.innerHTML = `
        <h4><i class="fas fa-user-check"></i> Welcome, ${profileData.fullName}!</h4>
        <p>Department(s): ${profileData.departments ? profileData.departments.join(', ') : profileData.department || 'N/A'} | Subjects: ${profileData.subjects.join(', ')}</p>
    `;
    
    // Insert after the header-top div (which contains title and logout button)
    const headerTop = header.querySelector('.header-top');
    if (headerTop) {
        // Insert after the header-top div
        headerTop.insertAdjacentElement('afterend', welcomeDiv);
    } else {
        // Fallback: just append to header
        header.appendChild(welcomeDiv);
    }
}

/**
 * Populate QR generation subject options with faculty's subjects
 * @param {Array} subjects - Array of subjects the faculty teaches
 */
function populateSubjectOptions(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    const qrSubjectSelect = document.getElementById('qrSubject');
    const manualSubjectSelect = document.getElementById('manualSubject');
    
    // Clear existing options except the first one for both selects
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
    
    if (qrSubjectSelect) {
        qrSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            qrSubjectSelect.appendChild(option);
        });
    }
    
    // Populate manual attendance subject dropdown
    if (manualSubjectSelect) {
        manualSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            manualSubjectSelect.appendChild(option);
        });
    }
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccessMessage(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1001;
        max-width: 300px;
        font-family: 'Poppins', sans-serif;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 5px;">Success!</div>
        <div style="font-size: 14px;">${message}</div>
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ===== MANUAL ATTENDANCE FUNCTIONS =====

// Batch options for manual attendance
const manualBatchOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

// Store loaded students and their attendance status
let loadedStudents = [];
let attendanceData = new Map(); // studentId -> {present: boolean, ...}

/**
 * Updates batch options for manual attendance based on selected school
 */
function updateManualBatchOptions() {
    const schoolSelect = document.getElementById('manualSchool');
    const batchSelect = document.getElementById('manualBatch');
    const selectedSchool = schoolSelect.value;
    
    // Clear existing options
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && manualBatchOptions[selectedSchool]) {
        batchSelect.disabled = false;
        manualBatchOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
        console.log(`Updated manual batch options for ${selectedSchool}:`, manualBatchOptions[selectedSchool]);
    } else {
        batchSelect.disabled = true;
    }
    
    // Clear students container if visible
    document.getElementById('studentsContainer').style.display = 'none';
    loadedStudents = [];
    attendanceData.clear();
}

/**
 * Loads students list based on selected criteria
 */
async function loadStudentsList() {
    const school = document.getElementById('manualSchool').value;
    const batch = document.getElementById('manualBatch').value;
    const subject = document.getElementById('manualSubject').value;
    const periods = document.getElementById('manualPeriods').value;
    
    // Validation
    if (!school || !batch || !subject || !periods) {
        alert('Please fill in all fields before loading students.');
        return;
    }
    
    try {
        console.log('🔍 Loading students for:', { school, batch, subject, periods });
        
        // Show loading state
        const studentsContainer = document.getElementById('studentsContainer');
        const studentsList = document.getElementById('studentsList');
        
        studentsContainer.style.display = 'block';
        studentsList.innerHTML = `
            <div class="loading-students">
                <i class="fas fa-spinner"></i>
                <p>Loading students...</p>
            </div>
        `;
        
        // Update attendance title
        const attendanceTitle = document.getElementById('attendanceTitle');
        attendanceTitle.textContent = `Mark Attendance - ${subject} (${batch})`;
        
        const db = firebase.firestore();
        
        // First, let's check all users to see what data we have
        console.log('🔍 Checking all users in database...');
        const allUsersQuery = await db.collection('users').limit(10).get();
        console.log('📊 Sample users found:', allUsersQuery.size);
        
        allUsersQuery.forEach(doc => {
            const userData = doc.data();
            console.log('👤 Sample user data:', {
                id: doc.id,
                role: userData.role,
                school: userData.school,
                batch: userData.batch,
                name: userData.fullName || userData.name,
                email: userData.email
            });
        });
        
        // Now query for students with role 'student'
        console.log('🎓 Querying for students with role="student"...');
        const studentRoleQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        console.log('📊 Students with role="student" found:', studentRoleQuery.size);
        
        studentRoleQuery.forEach(doc => {
            const userData = doc.data();
            console.log('🎓 Student data:', {
                id: doc.id,
                school: userData.school,
                batch: userData.batch,
                name: userData.fullName || userData.name,
                email: userData.email
            });
        });
        
        // Since school and batch are undefined in users collection, 
        // we need to get all students and check their profiles
        console.log(`🔍 Getting all students and checking profiles for school="${school}" and batch="${batch}"...`);
        
        // First get all students
        const allStudentsQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        console.log('📊 Total students found in users collection:', allStudentsQuery.size);
        
        // Now we need to check each student's profile for school and batch info
        const matchingStudents = [];
        const profilePromises = [];
        
        allStudentsQuery.forEach(studentDoc => {
            const studentData = studentDoc.data();
            console.log('👤 Checking student:', {
                id: studentDoc.id,
                email: studentData.email,
                name: studentData.fullName || studentData.name
            });
            
            // Check if they have a profile document
            const profilePromise = db.collection('profiles').doc(studentDoc.id).get()
                .then(profileDoc => {
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        console.log('📋 Student profile found:', {
                            id: studentDoc.id,
                            school: profileData.school,
                            batch: profileData.batch,
                            name: profileData.fullName || studentData.fullName || studentData.name,
                            regNumber: profileData.regNumber || 'N/A'
                        });
                        
                        if (profileData.school === school && profileData.batch === batch) {
                            console.log('✅ Student matches criteria:', studentDoc.id);
                            matchingStudents.push({
                                userDoc: studentDoc,
                                userData: studentData,
                                profileData: profileData
                            });
                        }
                    } else {
                        console.log('❌ No profile found for student:', studentDoc.id);
                    }
                })
                .catch(error => {
                    console.warn('⚠️ Error fetching profile for student:', studentDoc.id, error);
                });
            
            profilePromises.push(profilePromise);
        });
        
        // Wait for all profile checks to complete
        await Promise.all(profilePromises);
        
        console.log(`📊 Students matching ${school} - ${batch}:`, matchingStudents.length);
        
        loadedStudents = [];
        attendanceData.clear();
        
        // If no students found in profiles, try to use all students as fallback
        if (matchingStudents.length === 0) {
            console.log('❌ No students found with matching profiles');
            console.log('🔄 Trying fallback approach - using all students for this batch...');
            
            // Fallback: Use all students and filter based on email patterns or batch info
            allStudentsQuery.forEach(studentDoc => {
                const studentData = studentDoc.data();
                const email = studentData.email || '';
                
                // Try to infer batch from email (e.g., sot2428 suggests School of Technology, batch 2428/24B1)
                let inferredSchool = '';
                let inferredBatch = '';
                
                if (email.includes('sot')) {
                    inferredSchool = 'School of Technology';
                    if (email.includes('2428')) {
                        inferredBatch = '24B1'; // or '24B2', we'll make this more flexible
                    } else if (email.includes('2328')) {
                        inferredBatch = '23B1';
                    }
                } else if (email.includes('som')) {
                    inferredSchool = 'School of Management';
                    if (email.includes('2428')) {
                        inferredBatch = '24B1';
                    } else if (email.includes('2328')) {
                        inferredBatch = '23B1';
                    }
                }
                
                console.log('🔍 Checking student with email pattern:', {
                    id: studentDoc.id,
                    email: email,
                    inferredSchool,
                    inferredBatch,
                    targetSchool: school,
                    targetBatch: batch
                });
                
                // Match based on inferred data or if we're looking for School of Technology and email contains sot
                if ((inferredSchool === school && inferredBatch === batch) || 
                    (school === 'School of Technology' && email.includes('sot2428') && batch.startsWith('24'))) {
                    
                    console.log('✅ Student matches criteria (fallback):', studentDoc.id);
                    matchingStudents.push({
                        userDoc: studentDoc,
                        userData: studentData,
                        profileData: {
                            school: inferredSchool || school,
                            batch: inferredBatch || batch,
                            fullName: studentData.fullName || studentData.name,
                            regNumber: studentData.regNumber || studentData.registrationNumber || 'N/A'
                        }
                    });
                }
            });
            
            console.log(`📊 Students found with fallback approach: ${matchingStudents.length}`);
        }
        
        if (matchingStudents.length === 0) {
            console.log('❌ No students found matching criteria (even with fallback)');
            studentsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No students found for ${school} - ${batch}</p>
                    <p style="font-size: 0.9rem; color: #999; margin-top: 10px;">Students may need to complete their profiles</p>
                    <details style="margin-top: 15px; text-align: left; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        <summary style="cursor: pointer; font-weight: bold;">Debug Info</summary>
                        <p>Total students in database: ${allStudentsQuery.size}</p>
                        <p>Students with role 'student': 4</p>
                        <p>Students with profiles: 0</p>
                        <p>Check console for detailed logs</p>
                    </details>
                </div>
            `;
            updateAttendanceSummary();
            return;
        }
        
        // Process matching students
        matchingStudents.forEach(({ userDoc, userData, profileData }) => {
            console.log('📝 Processing matched student:', {
                id: userDoc.id,
                userData: userData,
                profileData: profileData
            });
            
            const student = {
                id: userDoc.id,
                name: profileData.fullName || userData.fullName || userData.name || extractNameFromEmail(userData.email),
                regNumber: profileData.regNumber || userData.regNumber || userData.registrationNumber || 'N/A',
                email: userData.email,
                school: profileData.school,
                batch: profileData.batch
            };
            
            loadedStudents.push(student);
            // Default to absent
            attendanceData.set(student.id, {
                present: false,
                studentId: student.id,
                studentName: student.name,
                regNumber: student.regNumber,
                email: student.email
            });
        });
        
        // Sort students by name
        loadedStudents.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`✅ Successfully loaded ${loadedStudents.length} students:`, loadedStudents);
        
        // Render students cards
        renderStudentsCards();
        
    } catch (error) {
        console.error('❌ Error loading students:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        document.getElementById('studentsList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Error loading students: ${error.message}</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Check browser console for details</p>
                <button onclick="loadStudentsList()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

/**
 * Renders student cards with checkboxes
 */
function renderStudentsCards() {
    const studentsList = document.getElementById('studentsList');
    
    studentsList.innerHTML = '';
    
    loadedStudents.forEach(student => {
        const attendance = attendanceData.get(student.id);
        const isPresent = attendance ? attendance.present : false;
        
        const studentCard = document.createElement('div');
        studentCard.className = `student-card ${isPresent ? 'present' : 'absent'}`;
        studentCard.onclick = () => toggleStudentAttendance(student.id);
        
        studentCard.innerHTML = `
            <div class="student-info">
                <h4>${student.name}</h4>
                <p><strong>Reg No:</strong> ${student.regNumber}</p>
            </div>
            <input type="checkbox" 
                   class="attendance-checkbox" 
                   ${isPresent ? 'checked' : ''}
                   onclick="event.stopPropagation(); toggleStudentAttendance('${student.id}')">
        `;
        
        studentsList.appendChild(studentCard);
    });
    
    updateAttendanceSummary();
}

/**
 * Toggles attendance status for a specific student
 * @param {string} studentId - The student ID
 */
function toggleStudentAttendance(studentId) {
    const attendance = attendanceData.get(studentId);
    if (attendance) {
        attendance.present = !attendance.present;
        attendanceData.set(studentId, attendance);
        
        // Re-render to update visual state
        renderStudentsCards();
        
        console.log(`Toggled attendance for student ${studentId}: ${attendance.present ? 'Present' : 'Absent'}`);
    }
}

/**
 * Marks all students as present
 */
function markAllPresent() {
    attendanceData.forEach((attendance, studentId) => {
        attendance.present = true;
        attendanceData.set(studentId, attendance);
    });
    
    renderStudentsCards();
    console.log('Marked all students as present');
}

/**
 * Marks all students as absent
 */
function markAllAbsent() {
    attendanceData.forEach((attendance, studentId) => {
        attendance.present = false;
        attendanceData.set(studentId, attendance);
    });
    
    renderStudentsCards();
    console.log('Marked all students as absent');
}

/**
 * Updates the attendance summary display
 */
function updateAttendanceSummary() {
    const totalStudents = loadedStudents.length;
    const presentCount = Array.from(attendanceData.values()).filter(a => a.present).length;
    
    const summaryElement = document.getElementById('attendanceSummary');
    if (summaryElement) {
        summaryElement.textContent = `${presentCount} Present / ${totalStudents} Total`;
    }
}

/**
 * Submits the manual attendance to Firestore
 */
async function submitManualAttendance() {
    if (loadedStudents.length === 0) {
        alert('No students loaded. Please load students first.');
        return;
    }
    
    const school = document.getElementById('manualSchool').value;
    const batchName = document.getElementById('manualBatch').value;
    const subject = document.getElementById('manualSubject').value;
    const periods = parseInt(document.getElementById('manualPeriods').value);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    try {
        console.log('Submitting manual attendance...');
        
        const db = firebase.firestore();
        const batchWrite = db.batch();
        
        // Prepare attendance records
        const attendanceRecords = [];
        
        attendanceData.forEach((attendance, studentId) => {
            const attendanceRecord = {
                userId: studentId,
                studentName: attendance.studentName,
                regNumber: attendance.regNumber,
                email: attendance.email,
                school: school,
                batch: batchName,
                subject: subject,
                periods: periods,
                date: today,
                status: attendance.present ? 'present' : 'absent',
                markedAt: firebase.firestore.FieldValue.serverTimestamp(),
                markedBy: currentFaculty.uid,
                facultyName: facultyProfile ? facultyProfile.fullName : currentFaculty.email,
                method: 'manual',
                hasPhoto: false // Manual attendance doesn't have photo verification
            };
            
            attendanceRecords.push(attendanceRecord);
            
            // Create a document in the attendances collection
            const attendanceRef = db.collection('attendances').doc();
            batchWrite.set(attendanceRef, attendanceRecord);
        });
        
        // Commit the batch write
        await batchWrite.commit();
        
        console.log(`Successfully submitted ${attendanceRecords.length} attendance records`);
        
        // Show success message
        const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
        const absentCount = attendanceRecords.filter(record => record.status === 'absent').length;
        
        showSuccessMessage(
            `Attendance submitted successfully!\n` +
            `Present: ${presentCount}, Absent: ${absentCount}\n` +
            `Subject: ${subject} (${periods} period${periods > 1 ? 's' : ''})`
        );
        
        // Reset form
        resetAttendanceForm();
        
    } catch (error) {
        console.error('Error submitting attendance:', error);
        alert(`Error submitting attendance: ${error.message}. Please try again.`);
    }
}

/**
 * Resets the attendance form and clears loaded data
 */
function resetAttendanceForm() {
    // Clear form fields
    document.getElementById('manualSchool').value = '';
    document.getElementById('manualBatch').value = '';
    document.getElementById('manualBatch').disabled = true;
    document.getElementById('manualSubject').value = '';
    document.getElementById('manualPeriods').value = '';
    
    // Hide students container
    document.getElementById('studentsContainer').style.display = 'none';
    
    // Clear loaded data
    loadedStudents = [];
    attendanceData.clear();
    
    console.log('Attendance form reset');
}

/**
 * Helper function to extract name from email if name is not available
 * @param {string} email - The email address
 * @returns {string} - Extracted name
 */
function extractNameFromEmail(email) {
    if (!email) return 'Unknown Student';
    
    // Extract the part before @ and format it
    const username = email.split('@')[0];
    
    // Replace dots and underscores with spaces and capitalize
    return username
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Make functions globally accessible
window.showSection = showSection;
window.updateManualBatchOptions = updateManualBatchOptions;
window.loadStudentsList = loadStudentsList;
window.toggleStudentAttendance = toggleStudentAttendance;
window.markAllPresent = markAllPresent;
window.markAllAbsent = markAllAbsent;
window.submitManualAttendance = submitManualAttendance;
window.resetAttendanceForm = resetAttendanceForm;
