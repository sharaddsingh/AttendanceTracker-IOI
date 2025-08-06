/*
==================================================
STUDENT DASHBOARD JAVASCRIPT
==================================================
Author: Attendance Tracker System
Description: Comprehensive functionality for student dashboard
Last Updated: 2024
==================================================
*/

/*
==================================================
STUDENT DASHBOARD JAVASCRIPT - CLEANED VERSION
==================================================
*/

/* ===== ATTENDANCE DATA & CHART FUNCTIONS ===== */
// Attendance Data - will be populated from Firebase
let subjectData = {};

// Function to fetch real-time attendance data
function fetchAttendanceData() {
  db.collection('attendances').where('userId', '==', auth.currentUser.uid)
    .onSnapshot(snapshot => {
      let data = {};
      snapshot.forEach(doc => {
        const { subject, percentage } = doc.data();
        data[subject] = percentage;
      });
      subjectData = data;
      updateCharts();
      showLowAttendanceWarnings();
    });
}

// Show low attendance warning if below 75% and data is available
function showLowAttendanceWarnings() {
  // First, ensure there is data to process
  if (!subjectData || Object.keys(subjectData).length === 0) {
    document.getElementById("lowAttendanceWarning").style.display = "none";
    return;
  }

  const lowSubjects = Object.entries(subjectData).filter(([_, val]) => val < 75);
  const warningDiv = document.getElementById("lowAttendanceWarning");

  if (lowSubjects.length > 0) {
    warningDiv.style.display = "block";
    warningDiv.innerText = `Warning: Low attendance in ${lowSubjects.map(([sub]) => sub).join(", ")}`;
  } else {
    warningDiv.style.display = "none";
  }
}

// Function to update all charts with current data
function updateCharts() {
  // Subject-wise chart
  new Chart(document.getElementById("subjectChart"), {
    type: 'bar',
    data: {
      labels: Object.keys(subjectData),
      datasets: [{
        label: 'Attendance %',
        data: Object.values(subjectData),
        backgroundColor: Object.values(subjectData).map(p => p < 75 ? 'red' : p < 85 ? 'yellow' : 'green')
      }]
    },
    options: { responsive: true }
  });

  // Overall attendance chart
  new Chart(document.getElementById("overallChart"), {
    type: 'doughnut',
    data: {
      labels: ["Attended", "Missed"],
      datasets: [{
        data: [80, 20],
        backgroundColor: ["green", "red"]
      }]
    }
  });
}


// Today's attendance status (initially all pending)
let todayAttendanceStatus = {};

// Get current day name
function getCurrentDay() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

// Populate today's classes
function populateTodayClasses() {
  const todayClassesList = document.getElementById('todayClassesList');
  const currentDay = getCurrentDay();
  const todayClasses = todayClassSchedule[currentDay] || [];
  
  todayClassesList.innerHTML = '';
  
  if (todayClasses.length === 0) {
    todayClassesList.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #999;">
        <i class="fas fa-calendar-times" style="font-size: 48px; margin-bottom: 15px;"></i>
        <h3>No Classes Today</h3>
        <p>Enjoy your ${currentDay}! No scheduled classes for today.</p>
      </div>
    `;
    return;
  }
  
  todayClasses.forEach((classInfo, index) => {
    const classId = `${classInfo.subject}_${index}`;
    const currentStatus = todayAttendanceStatus[classId] || 'pending';
    const currentTime = new Date();
    const [startTime] = classInfo.time.split('-');
    const classDateTime = new Date();
    const [hours, minutes] = startTime.split(':');
    classDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // Determine if class is active (within 30 minutes of start time)
    const timeDiff = Math.abs(currentTime - classDateTime) / (1000 * 60); // difference in minutes
    const isActive = timeDiff <= 30;
    const isPast = currentTime > classDateTime && timeDiff > 30;
    
    const statusColor = currentStatus === 'present' ? '#28a745' : 
                       currentStatus === 'absent' ? '#dc3545' : 
                       isActive ? '#ffc107' : '#6c757d';
    
    const statusText = currentStatus === 'present' ? '✓ Present' : 
                      currentStatus === 'absent' ? '✗ Absent' : 
                      isActive ? '⏰ Active Now' : 
                      isPast ? '⏰ Ended' : '⏳ Upcoming';
    
    const classCard = document.createElement('div');
    classCard.style.cssText = `
      background: rgba(255,255,255,0.05);
      border: 2px solid ${statusColor}20;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.3s ease;
    `;
    
    classCard.innerHTML = `
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span class="subject-tag ${classInfo.subject.toLowerCase()}" style="margin-right: 10px;">${classInfo.subject}</span>
          <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
        </div>
        <div style="font-size: 14px; color: #ccc; margin-bottom: 5px;">
          <i class="fas fa-clock"></i> ${classInfo.time} | 
          <i class="fas fa-map-marker-alt"></i> ${classInfo.room} | 
          <i class="fas fa-user-tie"></i> ${classInfo.faculty}
        </div>
        <div style="font-size: 13px; color: #aaa;">
          <i class="fas fa-book"></i> ${classInfo.topic}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${currentStatus === 'pending' ? `
          <button onclick="markTodayAttendance('${classId}', 'present')" 
                  style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                  ${!isActive ? 'disabled title="Can only mark during class hours"' : ''}>
            <i class="fas fa-check"></i> Present
          </button>
          <button onclick="markTodayAttendance('${classId}', 'absent')" 
                  style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            <i class="fas fa-times"></i> Absent
          </button>
        ` : `
          <button onclick="changeTodayAttendance('${classId}')" 
                  style="background: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            <i class="fas fa-edit"></i> Change
          </button>
        `}
      </div>
    `;
    
    // Add hover effect
    classCard.addEventListener('mouseenter', () => {
      classCard.style.transform = 'translateY(-2px)';
      classCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });
    
    classCard.addEventListener('mouseleave', () => {
      classCard.style.transform = 'translateY(0)';
      classCard.style.boxShadow = 'none';
    });
    
    todayClassesList.appendChild(classCard);
  });
}

// Mark today's attendance
function markTodayAttendance(classId, status) {
  todayAttendanceStatus[classId] = status;
  
  // Get class info for notification
  const [subject] = classId.split('_');
  const statusText = status === 'present' ? 'marked present' : 'marked absent';
  const statusIcon = status === 'present' ? 'success' : 'warning';
  
  // Add notification
  addNotification(statusIcon, `Attendance ${statusText} for ${subject}`, 'Just now');
  
  // Update the display
  populateTodayClasses();
  
  // Update overall attendance data
  if (status === 'present' && subjectData[subject]) {
    // Simulate slight increase in attendance percentage
    subjectData[subject] = Math.min(100, subjectData[subject] + 1);
    updateCharts();
    showLowAttendanceWarnings();
  }
  
  console.log(`Today's attendance marked: ${subject} - ${status}`);
}

// Change today's attendance (allow modification)
function changeTodayAttendance(classId) {
  const currentStatus = todayAttendanceStatus[classId];
  const newStatus = currentStatus === 'present' ? 'absent' : 'present';
  markTodayAttendance(classId, newStatus);
}


/* ===== FIREBASE SERVICES (from firebase-config.js) ===== */
// Firebase services are initialized in firebase-config.js

// Fetch today's attendance from Firebase
async function fetchTodayAttendance(user) {
  const todayAttendanceList = document.getElementById('todayAttendanceList');
  const noTodayAttendance = document.getElementById('noTodayAttendance');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const attendanceRef = db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today);

    const snapshot = await attendanceRef.get();

    if (snapshot.empty) {
      noTodayAttendance.style.display = 'block';
      todayAttendanceList.innerHTML = ''; // Clear existing entries
      return;
    }

    noTodayAttendance.style.display = 'none';
    todayAttendanceList.innerHTML = ''; // Clear existing entries

    snapshot.forEach(doc => {
      const { subject, status } = doc.data();
      const statusText = status === 'present' ? 'Present' : 'Absent';
      const statusColor = status === 'present' ? '#28a745' : '#dc3545';
      
      const attendanceItem = `
        <div class="attendance-item" style="border-left-color: ${statusColor};">
          <span class="subject-name">${subject}</span>
          <span class="attendance-status" style="color: ${statusColor};">${statusText}</span>
        </div>
      `;
      todayAttendanceList.innerHTML += attendanceItem;
    });

  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    noTodayAttendance.style.display = 'block';
    todayAttendanceList.innerHTML = '';
  }
}

// Update `onAuthStateChanged` to call the new function
auth.onAuthStateChanged(user => {
  if (user) {
    console.log('User authenticated:', user.email);
    
    // First check if profile is complete before loading dashboard
    if (checkUserProfile()) {
      console.log('Profile incomplete, redirecting...');
      return; // Stop execution if redirecting to profile completion
    }
    
    // Only load dashboard data if profile is complete
    loadUserProfile(user);
    fetchTodayAttendance(user); // Fetch today's attendance
    fetchAttendanceData(); // Fetch all attendance data for charts and warnings
    fetchNotificationsFromServer(); // Fetch real notifications from Firebase
  } else {
    window.location.href = 'index.html';
  }
});

// Show profile popup only for new signups
window.onload = function() {
  initializePage();
}

// Check if user's profile is incomplete
function checkUserProfile() {
  console.log('=== Profile Check Started ===');
  
  const profileCompleted = localStorage.getItem('profileCompleted');
  const savedProfile = localStorage.getItem('studentProfile');
  const profileSkipped = localStorage.getItem('profileSkipped');
  
  console.log('Profile status:', {
    profileCompleted: profileCompleted,
    savedProfile: savedProfile ? 'exists' : 'null',
    profileSkipped: profileSkipped
  });
  
  // Check if profile was completed
  if (!profileCompleted || profileCompleted !== 'true') {
    console.log('Profile not marked as completed, checking saved profile...');
    
    // If no saved profile exists at all
    if (!savedProfile) {
      console.log('No saved profile found, redirecting to complete-profile.html');
      window.location.href = 'complete-profile.html';
      return true;
    }
  }
  
  // Parse and validate saved profile if it exists
  if (savedProfile) {
    try {
      const profileData = JSON.parse(savedProfile);
      console.log('Parsed profile data:', profileData);
      
      const requiredFields = ['fullName', 'regNumber', 'school', 'batch', 'phone'];
      const fieldStatus = {};
      
      // Check each required field
      requiredFields.forEach(field => {
        const value = profileData[field];
        fieldStatus[field] = {
          exists: value !== undefined && value !== null,
          notEmpty: value && typeof value === 'string' && value.trim() !== ''
        };
      });
      
      console.log('Field validation status:', fieldStatus);
      
      const isComplete = requiredFields.every(field => 
        fieldStatus[field].exists && fieldStatus[field].notEmpty
      );
      
      if (!isComplete) {
        const missingFields = requiredFields.filter(field => 
          !fieldStatus[field].exists || !fieldStatus[field].notEmpty
        );
        console.log('Profile incomplete. Missing/empty fields:', missingFields);
        console.log('Redirecting to complete-profile.html');
        window.location.href = 'complete-profile.html';
        return true;
      }
      
    } catch (error) {
      console.error('Error parsing saved profile:', error);
      console.log('Corrupted profile data, redirecting to complete-profile.html');
      localStorage.removeItem('studentProfile'); // Clear corrupted data
      localStorage.removeItem('profileCompleted');
      window.location.href = 'complete-profile.html';
      return true;
    }
  }
  
  console.log('Profile validation passed, no redirect needed');
  console.log('=== Profile Check Completed ===');
  return false;
}

// Call this function upon completing the profile setup
function completeProfile() {
  localStorage.setItem('profileCompleted', 'true');
  closeProfilePopup();
}

// Update notifications section dynamically
function updateNotifications(notifications) {
  const notificationsSection = document.getElementById('notificationsSection');
  const notificationsList = document.getElementById('notificationsList');
  const notificationCount = document.getElementById('notificationCount');
  const noNotifications = document.getElementById('noNotifications');
  
  // Clear current notifications
  notificationsList.innerHTML = '';

  if (notifications.length > 0) {
    notificationsSection.style.display = 'block';
    noNotifications.style.display = 'none';
    notifications.forEach(notification => {
      const notificationItem = document.createElement('div');
      notificationItem.className = 'notification-item';
      notificationItem.innerHTML = `
        <i class="fas ${notification.icon}" style="color: ${notification.color};"></i>
        <span>${notification.message}</span>
        <small>${notification.time}</small>
      `;
      notificationsList.appendChild(notificationItem);
    });
    notificationCount.textContent = notifications.length;
  } else {
    notificationsSection.style.display = 'none';
    noNotifications.style.display = 'block';
  }
}

// Global notifications array
let notifications = [];

// Add notification function (can be called from anywhere)
function addNotification(type, message, timeAgo = 'Just now') {
  const iconMap = {
    'warning': { icon: 'fa-exclamation-triangle', color: '#ffc107' },
    'success': { icon: 'fa-check-circle', color: '#28a745' },
    'info': { icon: 'fa-info-circle', color: '#17a2b8' },
    'error': { icon: 'fa-times-circle', color: '#dc3545' },
    'attendance': { icon: 'fa-calendar-check', color: '#007bff' },
    'leave': { icon: 'fa-file-alt', color: '#6c757d' }
  };
  
  const notificationData = {
    id: Date.now(), // Simple ID based on timestamp
    icon: iconMap[type]?.icon || 'fa-bell',
    color: iconMap[type]?.color || '#6c757d',
    message: message,
    time: timeAgo,
    timestamp: new Date()
  };
  
  notifications.unshift(notificationData); // Add to beginning
  updateNotifications(notifications);
  return notificationData.id;
}

// Remove notification function
function removeNotification(notificationId) {
  notifications = notifications.filter(n => n.id !== notificationId);
  updateNotifications(notifications);
}

// Clear all notifications
function clearAllNotifications() {
  notifications = [];
  updateNotifications(notifications);
}

// Fetch notifications from server/database (placeholder)
function fetchNotificationsFromServer() {
  // This would typically make an API call to fetch notifications
  // For now, we'll simulate with some sample data
  db.collection('notifications')
    .where('userId', '==', auth.currentUser?.uid)
    .where('read', '==', false)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      const serverNotifications = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        serverNotifications.push({
          id: doc.id,
          icon: data.icon || 'fa-bell',
          color: data.color || '#6c757d',
          message: data.message,
          time: getTimeAgo(data.timestamp.toDate()),
          timestamp: data.timestamp.toDate()
        });
      });
      notifications = serverNotifications;
      updateNotifications(notifications);
    });
}

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Initialize page with dynamic data only
function initializePage() {
  // Only populate today's classes - notifications are now handled by Firebase
  populateTodayClasses();
}

// Profile popup functions
function closeProfilePopup() {
  document.getElementById('profilePopup').style.display = 'none';
}



// Notification system
function showNotification(title, message) {
  // Create notification popup
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ff4d4d, #cc0000);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 300px;
    font-family: 'Poppins', sans-serif;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 5px;">${title}</div>
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
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}


/* ===== PROFILE & FORM HANDLING ===== */
// School and batch options mapping
const batchOptions = {
  "School of Technology": [
    "24B1",
    "24B2",
    "23B1"
  ],
  "School of Management": [
    "23B1",
    "24B1"
  ]
};

// Update batch options based on selected school
function updateBatchOptions() {
  const schoolSelect = document.getElementById('school');
  const batchSelect = document.getElementById('batch');
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
  } else {
    batchSelect.disabled = true;
  }
}

// Handle profile form submission - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const profileData = {
        fullName: document.getElementById('fullName').value,
        regNumber: document.getElementById('regNumber').value,
        school: document.getElementById('school').value,
        batch: document.getElementById('batch').value,
        phone: document.getElementById('phone').value,
        completedAt: new Date().toISOString()
      };
      
      // Simulate saving profile to database
      console.log('Profile completed:', profileData);
      
      // Mark profile as completed
      localStorage.setItem('profileCompleted', 'true');
      localStorage.setItem('studentProfile', JSON.stringify(profileData));
      
      
      // Close popup and show success message
      closeProfilePopup();
      showNotification('Profile Completed!', 'Your profile has been successfully completed. You can now access all dashboard features.');
      
      // Update welcome message with student name and registration number
      updateWelcomeMessage(profileData.fullName, profileData.regNumber);
      
      // Update today's status with student name
      const todaySection = document.querySelector('.section');
      if (todaySection) {
        todaySection.innerHTML = `
          <h2>Welcome, ${profileData.fullName}!</h2>
          <p><strong>Status:</strong> Ready for attendance</p>
          <p><strong>Registration:</strong> ${profileData.regNumber}</p>
          <p><strong>Batch:</strong> ${profileData.batch}</p>
        `;
      }
    });
  }
});

// Skip profile for now function
function skipProfile() {
  localStorage.setItem('profileSkipped', 'true');
  closeProfilePopup();
  showNotification('Profile Skipped', 'You can complete your profile later from the settings.');
}

// Debug function to force show profile popup (for testing)
function showProfilePopupForced() {
  console.log('Forcing profile popup to show');
  document.getElementById('profilePopup').style.display = 'flex';
}

// Debug function to clear profile data (for testing)
function clearProfileData() {
  localStorage.removeItem('profileCompleted');
  localStorage.removeItem('studentProfile');
  localStorage.removeItem('profileSkipped');
  console.log('Profile data cleared');
  location.reload();
}

// Enhanced leave form submission
document.getElementById("leaveForm").addEventListener("submit", function (e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const leaveData = {
    date: formData.get('leaveDate'),
    periods: formData.get('periods'),
    subject: formData.get('subject'),
    reason: formData.get('reason'),
    attachment: formData.get('attachment'),
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  // Simulate saving to database and notifying faculty
  console.log('Leave request submitted:', leaveData);
  
  alert(`Leave request submitted successfully!\n\nSubject: ${leaveData.subject}\nDate: ${leaveData.date}\nPeriods: ${leaveData.periods}\n\nYour request has been sent to the subject faculty for approval.`);
  
  // Reset form
  e.target.reset();
});



// Photo upload handler
function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('profilePhoto').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

// Extract name from email address
function extractNameFromEmail(email) {
  if (!email) return 'Student';
  
  try {
    // Get the part before @ symbol
    const localPart = email.split('@')[0];
    
    // Remove numbers and special characters, split by dots/underscores/hyphens
    const nameParts = localPart
      .replace(/[0-9]/g, '') // Remove numbers
      .split(/[._-]+/) // Split by dots, underscores, hyphens
      .filter(part => part.length > 0) // Remove empty parts
      .map(part => {
        // Capitalize first letter of each part
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      });
    
    // Join the parts with space
    const extractedName = nameParts.join(' ');
    
    // Return the extracted name or fallback
    return extractedName.length > 0 ? extractedName : 'Student';
  } catch (error) {
    console.error('Error extracting name from email:', error);
    return 'Student';
  }
}

// Load user profile and populate welcome message
async function loadUserProfile(user) {
  console.log('loadUserProfile called for:', user.email);
  
  try {
    // Check if profile exists in localStorage first
    const savedProfile = localStorage.getItem('studentProfile');
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile);
        console.log('Found saved profile:', profileData);
        
        // Ensure profile is marked as completed when we have valid saved data
        const requiredFields = ['fullName', 'regNumber', 'school', 'batch', 'phone'];
        const isComplete = requiredFields.every(field => 
          profileData[field] && typeof profileData[field] === 'string' && profileData[field].trim() !== ''
        );
        
        if (isComplete && !localStorage.getItem('profileCompleted')) {
          console.log('Profile data complete but not marked as completed, fixing...');
          localStorage.setItem('profileCompleted', 'true');
        }
        
        // Populate welcome message with student name
        updateWelcomeMessage(profileData.fullName || extractNameFromEmail(user.email), profileData.regNumber);
        
        return;
      } catch (parseError) {
        console.error('Error parsing saved profile, removing corrupted data:', parseError);
        localStorage.removeItem('studentProfile');
        localStorage.removeItem('profileCompleted');
      }
    }
    
    // Try to fetch user profile from Firebase
    const profileRef = db.collection('profiles').doc(user.uid);
    try {
      const profileDoc = await profileRef.get();
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        console.log('Found Firebase profile:', profileData);
        
        // Validate Firebase profile data
        const requiredFields = ['fullName', 'regNumber', 'school', 'batch', 'phone'];
        const isComplete = requiredFields.every(field => 
          profileData[field] && typeof profileData[field] === 'string' && profileData[field].trim() !== ''
        );
        
        if (isComplete) {
          localStorage.setItem('studentProfile', JSON.stringify(profileData));
          localStorage.setItem('profileCompleted', 'true');
          
          // Populate welcome message with student name
          updateWelcomeMessage(profileData.fullName || extractNameFromEmail(user.email), profileData.regNumber);
          
          return;
        } else {
          console.log('Firebase profile incomplete, user needs to complete profile');
        }
      }
    } catch (profileError) {
      console.log('No profile document found in Firebase');
    }
    
    // Fallback to name extracted from email (this should only happen if profile is incomplete)
    const nameFromEmail = extractNameFromEmail(user.email);
    updateWelcomeMessage(nameFromEmail);
    console.log('Using name extracted from email (profile incomplete):', nameFromEmail);
    
  } catch (error) {
    console.error('Error loading user profile:', error);
    // Fallback to name extracted from email even on error
    const nameFromEmail = extractNameFromEmail(user?.email);
    updateWelcomeMessage(nameFromEmail);
  }
}

// Update welcome message with student name
function updateWelcomeMessage(studentName, regNumber = null) {
  const studentNameElement = document.getElementById('studentName');
  if (studentNameElement) {
    // Create a more personalized welcome message
    let welcomeText = `Welcome, ${studentName}`;
    if (regNumber) {
      welcomeText += ` (${regNumber})`;
    }
    studentNameElement.textContent = welcomeText;
    
    // Add a subtle animation when updating
    studentNameElement.style.opacity = '0';
    setTimeout(() => {
      studentNameElement.style.opacity = '1';
      studentNameElement.style.transition = 'opacity 0.5s ease';
    }, 100);
    
    console.log('Welcome message updated:', welcomeText);
  }
}

// Calculate overall attendance percentage
function calculateOverallAttendance() {
  const attendanceValues = Object.values(subjectData);
  if (attendanceValues.length === 0) return 0;
  const total = attendanceValues.reduce((sum, val) => sum + val, 0);
  return Math.round(total / attendanceValues.length);
}

// Count subjects with low attendance (below 75%)
function countLowAttendanceSubjects() {
  return Object.values(subjectData).filter(percentage => percentage < 75).length;
}

// Generate achievement badges based on performance
function generateAchievementBadges(overallAttendance, lowSubjectsCount) {
  let badges = [];
  
  if (overallAttendance >= 90) {
    badges.push('<div class="achievement-badge">🏆 Excellence Award</div>');
  }
  if (overallAttendance >= 85) {
    badges.push('<div class="achievement-badge">📈 High Achiever</div>');
  }
  if (lowSubjectsCount === 0) {
    badges.push('<div class="achievement-badge">🎯 Perfect Record</div>');
  }
  if (overallAttendance >= 75) {
    badges.push('<div class="achievement-badge">✅ Attendance Goal</div>');
  }
  
  // Default badge if no achievements
  if (badges.length === 0) {
    badges.push('<div class="achievement-badge">📚 Keep Going!</div>');
  }
  
  return badges.join('');
}

// Edit profile function
function editProfile() {
  // Show the profile popup again for editing
  const savedProfile = localStorage.getItem('studentProfile');
  if (savedProfile) {
    const profileData = JSON.parse(savedProfile);
    
    // Pre-fill the form with existing data
    document.getElementById('fullName').value = profileData.fullName || '';
    document.getElementById('regNumber').value = profileData.regNumber || '';
    document.getElementById('school').value = profileData.school || '';
    document.getElementById('phone').value = profileData.phone || '';
    
    // Update batch options and select the saved batch
    updateBatchOptions();
    if (profileData.batch) {
      document.getElementById('batch').value = profileData.batch;
    }
  }
  
  document.getElementById('profilePopup').style.display = 'flex';
  showNotification('Edit Mode', 'You can now update your profile information.');
}




/* ===== REPORT FUNCTIONS ===== */

// Download report function
function downloadReport() {
  showNotification('Report Generated', 'Your attendance report is being prepared for download.');
  
  // Simulate report generation
  setTimeout(() => {
    const overallAttendance = calculateOverallAttendance();
    const reportData = {
      studentName: JSON.parse(localStorage.getItem('studentProfile') || '{}').fullName || 'Student',
      overallAttendance: `${overallAttendance}%`,
      subjects: subjectData,
      todayStatus: todayAttendanceStatus,
      generatedOn: new Date().toLocaleDateString()
    };
    
    const reportContent = `
ATTENDANCE REPORT
=================
Student: ${reportData.studentName}
Generated: ${reportData.generatedOn}
Overall Attendance: ${reportData.overallAttendance}

SUBJECT-WISE BREAKDOWN:
${Object.entries(reportData.subjects).map(([subject, percentage]) => 
  `${subject}: ${percentage}%`
).join('\n')}

TODAY'S ATTENDANCE:
${Object.keys(reportData.todayStatus).length > 0 ? 
  Object.entries(reportData.todayStatus).map(([classId, status]) => {
    const [subject] = classId.split('_');
    return `${subject}: ${status}`;
  }).join('\n') : 'No attendance marked today'
}
    `;
    
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-report.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Download Complete', 'Your attendance report has been downloaded.');
  }, 2000);
}


/* ===== PAGE INITIALIZATION ===== */
// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Note: Logout function is already defined in HTML head section
  updateCharts();
  showLowAttendanceWarnings();
});

