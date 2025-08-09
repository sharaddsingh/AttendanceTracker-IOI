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

// Function to fetch real-time attendance data and calculate percentages
function fetchAttendanceData() {
  if (!auth.currentUser) {
    console.log('No authenticated user for attendance data fetch');
    return;
  }

  db.collection('attendances').where('userId', '==', auth.currentUser.uid)
    .onSnapshot(snapshot => {
      console.log(`Fetching attendance data: ${snapshot.size} records found`);
      
      // Calculate attendance percentages by subject
      const subjectStats = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const { subject, status } = data;
        
        if (!subject) return; // Skip if no subject
        
        // Initialize subject stats if not exists
        if (!subjectStats[subject]) {
          subjectStats[subject] = {
            total: 0,
            present: 0
          };
        }
        
        // Count total classes and present classes
        subjectStats[subject].total++;
        if (status === 'present') {
          subjectStats[subject].present++;
        }
      });
      
      // Calculate percentages
      const data = {};
      Object.keys(subjectStats).forEach(subject => {
        const stats = subjectStats[subject];
        const percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
        data[subject] = percentage;
        console.log(`${subject}: ${stats.present}/${stats.total} = ${percentage}%`);
      });
      
      subjectData = data;
      updateCharts();
      showLowAttendanceWarnings();
      
      // Update charts visibility based on data availability
      updateChartsVisibility();
    }, error => {
      console.error('Error fetching attendance data:', error);
      // Don't break the app, just log the error
      subjectData = {};
      updateChartsVisibility();
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

// Store chart instances globally to manage them properly
let subjectChart = null;
let overallChart = null;

// QR Scanner variables
let html5QrCode = null;
let currentScannedData = null;
let currentUser = null;
let studentProfile = null;

// Function to update all charts with current data
function updateCharts() {
  // Destroy existing charts before creating new ones
  if (subjectChart) {
    subjectChart.destroy();
  }
  if (overallChart) {
    overallChart.destroy();
  }

  // Only create charts if we have data
  if (Object.keys(subjectData).length === 0) {
    console.log('No attendance data available for charts');
    return;
  }

  // Subject-wise chart
  const subjectChartCanvas = document.getElementById("subjectChart");
  if (subjectChartCanvas) {
    subjectChart = new Chart(subjectChartCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(subjectData),
        datasets: [{
          label: 'Attendance %',
          data: Object.values(subjectData),
          backgroundColor: Object.values(subjectData).map(p => p < 75 ? 'red' : p < 85 ? 'yellow' : 'green')
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  // Calculate overall attendance for the doughnut chart
  const overallAttendance = calculateOverallAttendance();
  const missedPercentage = 100 - overallAttendance;

  // Overall attendance chart
  const overallChartCanvas = document.getElementById("overallChart");
  if (overallChartCanvas) {
    overallChart = new Chart(overallChartCanvas, {
      type: 'doughnut',
      data: {
        labels: ["Attended", "Missed"],
        datasets: [{
          data: [overallAttendance, missedPercentage],
          backgroundColor: ["#28a745", "#dc3545"]
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

// Update charts visibility based on data availability
function updateChartsVisibility() {
  const hasData = Object.keys(subjectData).length > 0;
  
  // Subject-wise chart section
  const subjectChartCanvas = document.getElementById("subjectChart");
  const noSubjectData = document.getElementById("noSubjectData");
  
  if (subjectChartCanvas && noSubjectData) {
    if (hasData) {
      subjectChartCanvas.style.display = 'block';
      noSubjectData.style.display = 'none';
    } else {
      subjectChartCanvas.style.display = 'none';
      noSubjectData.style.display = 'block';
    }
  }
  
  // Overall attendance chart section
  const overallChartCanvas = document.getElementById("overallChart");
  const noOverallData = document.getElementById("noOverallData");
  
  if (overallChartCanvas && noOverallData) {
    if (hasData) {
      overallChartCanvas.style.display = 'block';
      noOverallData.style.display = 'none';
    } else {
      overallChartCanvas.style.display = 'none';
      noOverallData.style.display = 'block';
    }
  }
  
  console.log(`Charts visibility updated: ${hasData ? 'showing' : 'hiding'} charts`);
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

// Fetch yesterday's attendance from Firebase
async function fetchYesterdayAttendance(user) {
  const yesterdayList = document.getElementById('yesterdayList');
  const noYesterdayData = document.getElementById('noYesterdayData');
  
  // Calculate yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const attendanceRef = db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', yesterdayDate);

    const snapshot = await attendanceRef.get();

    if (snapshot.empty) {
      noYesterdayData.style.display = 'block';
      yesterdayList.style.display = 'none';
      yesterdayList.innerHTML = ''; // Clear existing entries
      console.log('No attendance data found for yesterday:', yesterdayDate);
      return;
    }

    noYesterdayData.style.display = 'none';
    yesterdayList.style.display = 'block';
    yesterdayList.innerHTML = ''; // Clear existing entries

    console.log(`Found ${snapshot.size} attendance records for yesterday (${yesterdayDate})`);

    snapshot.forEach(doc => {
      const data = doc.data();
      const { subject, status, periods } = data;
      const statusText = status === 'present' ? 'Present' : 'Absent';
      const statusColor = status === 'present' ? '#28a745' : '#dc3545';
      const statusIcon = status === 'present' ? 'fa-check-circle' : 'fa-times-circle';
      
      const attendanceItem = document.createElement('li');
      attendanceItem.className = 'attendance-item';
      attendanceItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 4px solid ${statusColor};
        border-radius: 8px;
        transition: all 0.3s ease;
      `;
      
      attendanceItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas ${statusIcon}" style="color: ${statusColor}; font-size: 16px;"></i>
          <span class="subject-name" style="font-weight: 600; color: #fff;">${subject}</span>
          ${periods ? `<span style="font-size: 12px; color: #aaa;">(${periods} periods)</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="attendance-status" style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
          ${data.hasPhoto ? '<i class="fas fa-camera" style="color: #17a2b8; font-size: 12px;" title="Photo verified"></i>' : ''}
        </div>
      `;
      
      // Add hover effect
      attendanceItem.addEventListener('mouseenter', () => {
        attendanceItem.style.transform = 'translateX(5px)';
        attendanceItem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      });
      
      attendanceItem.addEventListener('mouseleave', () => {
        attendanceItem.style.transform = 'translateX(0)';
        attendanceItem.style.boxShadow = 'none';
      });
      
      yesterdayList.appendChild(attendanceItem);
    });

  } catch (error) {
    console.error('Error fetching yesterday\'s attendance:', error);
    noYesterdayData.style.display = 'block';
    yesterdayList.style.display = 'none';
    yesterdayList.innerHTML = '';
  }
}

// Update `onAuthStateChanged` to call the new function
auth.onAuthStateChanged(async user => {
  if (user) {
    console.log('User authenticated:', user.email);
    
    // Check if this is a new signup that needs profile completion
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      const data = doc.data();
      
      if (doc.exists && data.isNewSignup && data.role === "student") {
        // Mark as no longer new signup and redirect to profile completion
        await db.collection("users").doc(user.uid).update({
          isNewSignup: false
        });
        console.log('New student signup detected, redirecting to complete-profile.html');
        window.location.href = "complete-profile.html";
        return;
      }
    } catch (error) {
      console.error('Error checking signup status:', error);
    }
    
    // Load dashboard data for existing users
    loadUserProfile(user);
    fetchTodayAttendance(user); // Fetch today's attendance
    fetchYesterdayAttendance(user); // Fetch yesterday's attendance
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
      let itemClass = 'notification-item';
      
      // Add special classes for leave status notifications
      if (notification.type === 'leave_status') {
        itemClass += notification.status === 'approved' ? ' leave-approved' : ' leave-rejected';
      }
      
      notificationItem.className = itemClass;
      notificationItem.innerHTML = `
        <i class="fas ${notification.icon} notification-icon" style="color: ${notification.color};"></i>
        <div class="notification-content">
          <div class="notification-title">${notification.title || 'Notification'}</div>
          <div class="notification-message">${notification.message}</div>
          ${notification.comment && notification.comment.trim() ? `
            <div style="margin-top: 6px; padding: 6px 10px; background: rgba(0,0,0,0.05); border-radius: 4px; font-size: 12px; color: #666;">
              <i class="fas fa-comment" style="margin-right: 4px;"></i>
              <strong>Faculty Comment:</strong> ${notification.comment}
            </div>
          ` : ''}
          <div class="notification-time">
            <i class="fas fa-clock" style="margin-right: 3px;"></i>
            ${notification.time}
            ${notification.subject ? ` • ${notification.subject}` : ''}
            ${notification.facultyName ? ` • by ${notification.facultyName}` : ''}
          </div>
        </div>
      `;
      
      // Add click handler to mark as read
      notificationItem.addEventListener('click', () => {
        console.log('Notification clicked:', { id: notification.id, type: typeof notification.id });
        markNotificationAsRead(notification.id);
      });
      
      notificationsList.appendChild(notificationItem);
    });
    
    notificationCount.textContent = notifications.length;
    notificationCount.style.display = 'inline-flex';
  } else {
    notificationsSection.style.display = 'none';
    noNotifications.style.display = 'block';
    notificationCount.style.display = 'none';
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
  
  // Generate a more unique string ID to avoid Firebase issues
  const uniqueId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const notificationData = {
    id: uniqueId, // Use string ID to match Firebase document IDs
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

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  try {
    if (!auth.currentUser) {
      console.log('No current user to mark notification as read');
      return;
    }

    // Ensure notificationId is a string
    const docId = String(notificationId);
    console.log('Marking notification as read:', { originalId: notificationId, docId: docId });

    // Validate the document ID format
    if (!docId || docId.trim() === '' || docId === 'undefined' || docId === 'null') {
      console.error('Invalid notification ID:', notificationId);
      return;
    }

    // Update the notification in Firebase
    await db.collection('notifications').doc(docId).update({
      read: true,
      readAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('Notification marked as read successfully:', docId);

    // Update local notifications array
    notifications = notifications.filter(n => String(n.id) !== docId);
    updateNotifications(notifications);

  } catch (error) {
    console.error('Error marking notification as read:', error);
    console.error('Error details:', {
      notificationId: notificationId,
      type: typeof notificationId,
      stringified: String(notificationId)
    });
  }
}

// Fetch notifications from server/database with real-time leave status updates
function fetchNotificationsFromServer() {
  // Listen for real-time notifications from Firebase
  if (!auth.currentUser) {
    console.log('No current user for notifications');
    return;
  }
  
  console.log('🔔 Setting up real-time notifications listener for user:', auth.currentUser.uid);
  
  // Store previous notification count to detect new notifications
  let previousNotificationCount = 0;
  
  // First try the main query with timestamp ordering
  let query = db.collection('notifications')
    .where('userId', '==', auth.currentUser.uid)
    .where('read', '==', false);
    
  // Try to order by timestamp, but catch index errors
  try {
    query = query.orderBy('timestamp', 'desc');
    console.log('📋 Using timestamp-ordered query');
  } catch (error) {
    console.log('⚠️ Timestamp ordering not available, using basic query');
    // Fallback to basic query without ordering
    query = db.collection('notifications')
      .where('userId', '==', auth.currentUser.uid)
      .where('read', '==', false);
  }
  
  query.onSnapshot(snapshot => {
      console.log('Notification snapshot received:', {
        size: snapshot.size,
        empty: snapshot.empty,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
      
      const serverNotifications = [];
      const newNotifications = [];
      
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          console.log('New notification added:', {
            id: change.doc.id,
            type: data.type,
            status: data.status,
            message: data.message
          });
          
          const notification = {
            id: change.doc.id,
            icon: data.icon || 'fa-bell',
            color: data.color || '#6c757d',
            message: data.message,
            title: data.title || 'Notification',
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
            type: data.type || 'general',
            status: data.status || '',
            subject: data.subject || '',
            leaveDate: data.leaveDate || '',
            facultyName: data.facultyName || '',
            comment: data.comment || ''
          };
          
          newNotifications.push(notification);
        }
      });
      
      // Process all current notifications
      snapshot.forEach(doc => {
        const data = doc.data();
        const notification = {
          id: doc.id,
          icon: data.icon || 'fa-bell',
          color: data.color || '#6c757d',
          message: data.message,
          title: data.title || 'Notification',
          timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
          type: data.type || 'general',
          status: data.status || '',
          subject: data.subject || '',
          leaveDate: data.leaveDate || '',
          facultyName: data.facultyName || '',
          comment: data.comment || ''
        };
        
        notification.time = getTimeAgo(notification.timestamp);
        serverNotifications.push(notification);
        
        // Log leave status notifications for debugging
        if (data.type === 'leave_status') {
          console.log('Received leave status notification:', {
            id: doc.id,
            status: data.status,
            subject: data.subject,
            message: data.message,
            facultyName: data.facultyName,
            timestamp: notification.timestamp
          });
        }
      });
      
      // Update the global notifications array
      notifications = serverNotifications;
      updateNotifications(notifications);
      
      // Show toast notification for new leave status updates only
      newNotifications.forEach(notification => {
        if (notification.type === 'leave_status') {
          console.log('Showing toast for new leave status notification:', notification.subject);
          showLeaveStatusToast(notification);
        }
      });
      
      console.log(`Loaded ${serverNotifications.length} total notifications, ${newNotifications.length} new notifications`);
      previousNotificationCount = serverNotifications.length;
    }, error => {
      console.error('Error fetching notifications:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Only log error, don't show error notification to user
      // The system will work fine without real-time notifications
      console.log('Notifications will not be real-time due to connection issues, but basic functionality remains available.');
      
      // Try a simple fallback query without complex conditions
      console.log('🔄 Attempting fallback notification query...');
      tryFallbackNotificationQuery();
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
  // Set min date for leave date input to prevent past dates
  const leaveDateInput = document.getElementById('leaveDate');
  if (leaveDateInput) {
    // Compute local date components to avoid UTC offset issues on iOS Safari
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${yyyy}-${mm}-${dd}`;
    // Set both min and default value so iPhone doesn’t preselect yesterday
    leaveDateInput.min = todayLocal;
    if (!leaveDateInput.value) {
      leaveDateInput.value = todayLocal;
    }
  }

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

// Enhanced leave form submission with Firebase integration
document.getElementById("leaveForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  
  try {
    // Get current user and profile data
    const user = auth.currentUser;
    if (!user) {
      alert('Please log in to submit a leave request.');
      return;
    }
    
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    const formData = new FormData(e.target);

    // Validate leave date is not in the past (local date)
    const leaveDateStr = formData.get('leaveDate');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (leaveDateStr && leaveDateStr < todayStr) {
      const dateInput = document.getElementById('leaveDate') || e.target.querySelector('input[name="leaveDate"]');
      if (dateInput) {
        dateInput.setCustomValidity('Leave date cannot be in the past.');
        dateInput.reportValidity();
        // Clear custom validity after a short delay so future attempts work
        setTimeout(() => dateInput.setCustomValidity(''), 1500);
      } else {
        alert('Leave date cannot be in the past.');
      }
      return;
    }

    const leaveData = {
      userId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: studentProfile.school || 'N/A',
      batch: studentProfile.batch || 'N/A',
      date: leaveDateStr,
      periods: parseInt(formData.get('periods')),
      subject: formData.get('subject'),
      reason: formData.get('reason'),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      createdAt: new Date()
    };
    
    // Handle file attachment if present
    const attachmentFile = formData.get('attachment');
    if (attachmentFile && attachmentFile.size > 0) {
      // For now, we'll just note that there's an attachment
      // In a full implementation, you'd upload to Firebase Storage
      leaveData.hasAttachment = true;
      leaveData.attachmentName = attachmentFile.name;
    }
    
    // Save to Firebase Firestore
    const docRef = await db.collection('leaveRequests').add(leaveData);
    console.log('Leave request submitted with ID:', docRef.id);
    
    // Show success message
    showNotification('Leave Request Submitted!', 
      `Your leave request for ${leaveData.subject} on ${leaveData.date} has been sent to the faculty for approval.`);
    
    // Add notification to local notifications
    addNotification('leave', 
      `Leave request submitted for ${leaveData.subject} - ${leaveData.date}`, 
      'Just now');
    
    // Reset form
    e.target.reset();
    
  } catch (error) {
    console.error('Error submitting leave request:', error);
    alert('Error submitting leave request. Please try again.');
  }
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



/* ===== LEAVE STATUS TOAST NOTIFICATIONS ===== */
// Show toast notification for leave status updates
function showLeaveStatusToast(notification) {
  // Only show toast for recent notifications (within last 2 minutes)
  const timeDiff = (new Date() - notification.timestamp) / (1000 * 60);
  if (timeDiff > 2) return;
  
  const toast = document.createElement('div');
  const isApproved = notification.status === 'approved';
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, ${isApproved ? '#28a745, #20c997' : '#dc3545, #c82333'});
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    z-index: 1002;
    max-width: 400px;
    font-family: 'Poppins', sans-serif;
    animation: slideIn 0.5s ease-out;
    border-left: 5px solid ${isApproved ? '#1e7e34' : '#bd2130'};
  `;
  
  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <i class="fas ${notification.icon}" style="font-size: 24px; margin-top: 2px; opacity: 0.9;"></i>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">
          ${notification.title}
        </div>
        <div style="font-size: 14px; line-height: 1.4; margin-bottom: 8px;">
          ${notification.message}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          <i class="fas fa-clock"></i> ${notification.time}
        </div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; color: white; font-size: 18px; 
                     cursor: pointer; opacity: 0.7; padding: 0; width: 20px; height: 20px;"
              onmouseover="this.style.opacity='1'" 
              onmouseout="this.style.opacity='0.7'">
        ×
      </button>
    </div>
  `;
  
  // Add animation CSS if not already added
  if (!document.querySelector('#toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Auto-remove after 8 seconds with slide out animation
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, 8000);
  
  // Log the toast for debugging
  console.log(`Showing toast for ${notification.status} leave request:`, notification.subject);
}

/* ===== DEBUG FUNCTIONS (for testing) ===== */
// Debug function to manually test notification creation
window.debugCreateTestNotification = async function(status = 'approved') {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user for debug test');
      alert('Please log in first');
      return;
    }
    
    console.log('🧪 Creating test notification for user:', user.uid);
    
    const testNotificationData = {
      userId: user.uid,
      type: 'leave_status',
      title: `Leave Request ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your leave request for JAVA on 2025-01-15 has been ${status} by Prof. Test Faculty.`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      read: false,
      icon: status === 'approved' ? 'fa-check-circle' : 'fa-times-circle',
      color: status === 'approved' ? '#28a745' : '#dc3545',
      relatedRequestId: 'test-request-id',
      leaveDate: '2025-01-15',
      subject: 'JAVA',
      facultyName: 'Prof. Test Faculty',
      status: status,
      comment: 'This is a test notification for debugging.',
      createdAt: new Date()
    };
    
    console.log('📝 Test notification data:', testNotificationData);
    
    const notificationRef = await db.collection('notifications').add(testNotificationData);
    console.log('✅ Test notification created with ID:', notificationRef.id);
    
    // Verify the notification was created
    const createdDoc = await notificationRef.get();
    if (createdDoc.exists) {
      console.log('✅ Verification: Notification exists:', createdDoc.data());
      alert(`✅ Test notification created successfully! ID: ${notificationRef.id}`);
    } else {
      console.error('❌ Verification failed: Notification was not created');
      alert('❌ Test notification creation failed!');
    }
    
    return notificationRef.id;
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    alert(`❌ Error: ${error.message}`);
    return null;
  }
};

// Debug function to test Firebase connection
window.debugTestFirebaseConnection = async function() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user');
      return false;
    }
    
    console.log('🧪 Testing Firebase connection...');
    
    // Test write access
    const testData = {
      test: true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userId: user.uid
    };
    
    const testRef = await db.collection('test').add(testData);
    console.log('✅ Write test successful, doc ID:', testRef.id);
    
    // Test read access
    const readDoc = await testRef.get();
    if (readDoc.exists) {
      console.log('✅ Read test successful:', readDoc.data());
    }
    
    // Clean up
    await testRef.delete();
    console.log('✅ Cleanup successful');
    
    alert('✅ Firebase connection test successful!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    alert(`❌ Firebase connection test failed: ${error.message}`);
    return false;
  }
};

// Debug function to check notification permissions
window.debugCheckNotificationPermissions = async function() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user');
      return;
    }
    
    console.log('🔐 Testing notification collection permissions...');
    
    // Test read permissions
    try {
      const readTest = await db.collection('notifications')
        .where('userId', '==', user.uid)
        .limit(1)
        .get();
      console.log('✅ Read permission test successful, docs found:', readTest.size);
    } catch (readError) {
      console.error('❌ Read permission test failed:', readError);
    }
    
    // Test write permissions
    try {
      const writeTestData = {
        userId: user.uid,
        type: 'test',
        message: 'Permission test',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      };
      
      const writeTest = await db.collection('notifications').add(writeTestData);
      console.log('✅ Write permission test successful, doc ID:', writeTest.id);
      
      // Clean up
      await writeTest.delete();
      console.log('✅ Cleanup successful');
      
      alert('✅ Notification permissions test successful!');
    } catch (writeError) {
      console.error('❌ Write permission test failed:', writeError);
      alert(`❌ Write permission test failed: ${writeError.message}`);
    }
  } catch (error) {
    console.error('❌ Permission test error:', error);
    alert(`❌ Permission test error: ${error.message}`);
  }
};

// Debug function to check current user and notification listener status
window.debugNotificationStatus = function() {
  console.log('=== NOTIFICATION DEBUG STATUS ===');
  console.log('Current user:', auth.currentUser ? {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email
  } : 'None');
  console.log('Current notifications count:', notifications.length);
  console.log('Notifications array:', notifications);
  
  if (auth.currentUser) {
    // Test read access to notifications collection
    db.collection('notifications')
      .where('userId', '==', auth.currentUser.uid)
      .limit(1)
      .get()
      .then(snapshot => {
        console.log('Notification read test:', {
          success: true,
          size: snapshot.size,
          empty: snapshot.empty
        });
      })
      .catch(error => {
        console.error('Notification read test failed:', error);
      });
  }
};

// Fallback notification query (simpler query without complex conditions)
async function tryFallbackNotificationQuery() {
  if (!auth.currentUser) {
    console.log('❌ No current user for fallback query');
    return;
  }
  
  try {
    console.log('🔍 Trying simple fallback notification query...');
    
    // Very basic query - just get notifications for this user
    const snapshot = await db.collection('notifications')
      .where('userId', '==', auth.currentUser.uid)
      .limit(10)
      .get();
    
    console.log('📊 Fallback query results:', {
      size: snapshot.size,
      empty: snapshot.empty
    });
    
    if (!snapshot.empty) {
      const fallbackNotifications = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('📄 Found notification doc:', {
          id: doc.id,
          type: data.type,
          status: data.status,
          read: data.read,
          message: data.message?.substring(0, 50) + '...'
        });
        
        // Only include unread notifications
        if (!data.read) {
          const notification = {
            id: doc.id,
            icon: data.icon || 'fa-bell',
            color: data.color || '#6c757d',
            message: data.message || 'No message',
            title: data.title || 'Notification',
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
            type: data.type || 'general',
            status: data.status || '',
            subject: data.subject || '',
            leaveDate: data.leaveDate || '',
            facultyName: data.facultyName || '',
            comment: data.comment || ''
          };
          
          notification.time = getTimeAgo(notification.timestamp);
          fallbackNotifications.push(notification);
        }
      });
      
      console.log(`📥 Fallback found ${fallbackNotifications.length} unread notifications`);
      
      if (fallbackNotifications.length > 0) {
        // Update the global notifications array and display
        notifications = fallbackNotifications;
        updateNotifications(notifications);
        console.log('✅ Fallback notifications loaded successfully');
      }
    } else {
      console.log('📭 No notifications found in fallback query');
    }
    
  } catch (fallbackError) {
    console.error('❌ Fallback notification query also failed:', fallbackError);
    console.log('💡 You can test notification creation using debugCreateTestNotification()');
  }
}

// Make debug functions available globally
if (typeof window !== 'undefined') {
  window.debugCreateTestNotification = window.debugCreateTestNotification;
  window.debugNotificationStatus = window.debugNotificationStatus;
  window.tryFallbackNotificationQuery = tryFallbackNotificationQuery;
}

/* ===== QR SCANNER FUNCTIONS ===== */
// Global camera permission state
let frontCameraPermissionGranted = false;

// Test front camera access (browser will show native permission dialog)
async function testFrontCameraAccess() {
  console.log('🎥 Testing front camera access...');
  
  try {
    // Request front camera access - browser shows native permission dialog
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'user', // Front camera
        width: { ideal: 640, min: 320 },
        height: { ideal: 480, min: 240 }
      },
      audio: false
    });
    
    console.log('✅ Front camera access granted');
    frontCameraPermissionGranted = true;
    
    // Stop the test stream immediately - we just needed to check permission
    stream.getTracks().forEach(track => track.stop());
    
    return true;
    
  } catch (error) {
    console.error('❌ Front camera access denied:', error);
    frontCameraPermissionGranted = false;
    throw error;
  }
}

// Open QR Scanner Modal (with native browser permission check)
function openQRScanner() {
  console.log('🚀 Starting attendance marking process...');
  
  // Directly test front camera access - browser will show native permission dialog
  testFrontCameraAccess()
    .then(() => {
      console.log('✅ Front camera permission granted, opening QR scanner');
      showNotification('Permission Granted', 'You can now scan the QR code to mark attendance.');
      initializeQRScanner();
    })
    .catch((error) => {
      console.log('❌ Front camera permission denied, cannot proceed');
      
      let errorMessage = 'Front camera access is required to mark attendance.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow front camera access to continue.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No front camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application. Please close other apps and try again.';
      }
      
      showNotification('Permission Required', errorMessage);
    });
}

// Initialize QR Scanner (separated from permission logic)
function initializeQRScanner() {
  const modal = document.getElementById('scannerModal');
  const videoElement = document.getElementById('qrReader');
  
  console.log('📱 Initializing QR Scanner...');
  
  if (!modal || !videoElement) {
    console.error('QR Scanner modal or video element not found');
    showNotification('Scanner Error', 'QR Scanner is not properly configured.');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Update status to show camera permission granted
  const scannerStatus = document.getElementById('scannerStatus');
  if (scannerStatus) {
    scannerStatus.textContent = 'Camera permission granted ✅ Initializing scanner...';
    scannerStatus.style.color = '#28a745';
  }
  
  // Initialize the QR code scanner
  try {
    html5QrCode = new Html5Qrcode("qrReader");
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };
    
    // Start scanning with back camera for QR codes
    html5QrCode.start(
      { facingMode: "environment" }, // Use back camera for QR scanning
      config,
      onScanSuccess,
      onScanError
    ).then(() => {
      console.log('📷 QR Scanner started successfully');
      if (scannerStatus) {
        scannerStatus.textContent = 'Scanner active - Point camera at QR code';
        scannerStatus.style.color = '#007bff';
      }
    }).catch(err => {
      console.warn('Back camera failed, trying front camera for QR scanning:', err);
      // Fallback to front camera if back camera fails
      return html5QrCode.start(
        { facingMode: "user" },
        config,
        onScanSuccess,
        onScanError
      );
    }).then(() => {
      if (scannerStatus) {
        scannerStatus.textContent = 'Scanner active - Point camera at QR code';
        scannerStatus.style.color = '#007bff';
      }
    }).catch(err => {
      console.error('Error starting QR scanner:', err);
      if (scannerStatus) {
        scannerStatus.textContent = 'Scanner failed to start';
        scannerStatus.style.color = '#dc3545';
      }
      showNotification('Scanner Error', 'Unable to start QR scanner. Please try again.');
    });
  } catch (error) {
    console.error('Error initializing QR scanner:', error);
    showNotification('Scanner Error', 'Failed to initialize QR scanner.');
  }
}

// Close QR Scanner Modal
function closeQRScanner() {
  const modal = document.getElementById('scannerModal');
  
  console.log('Closing QR Scanner...');
  
  // Stop the scanner if it's running
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      console.log('QR Scanner stopped successfully');
      html5QrCode = null;
    }).catch(err => {
      console.error('Error stopping QR scanner:', err);
      html5QrCode = null;
    });
  }
  
  // Hide the modal
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Reset UI elements (only if they exist)
  const scannerStatus = document.getElementById('scannerStatus');
  if (scannerStatus) {
    scannerStatus.textContent = 'Scanner inactive';
    scannerStatus.style.color = '#6c757d';
  }
  
  // Clear any scanned data
  currentScannedData = null;
}

// Handle successful QR scan
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code scanned successfully:', decodedText);
  
  try {
    // Parse the QR code data
    const qrData = JSON.parse(decodedText);
    
    // Validate QR code structure
    if (!qrData.school || !qrData.batch || !qrData.subject || !qrData.periods || !qrData.timestamp || !qrData.expiry) {
      throw new Error('Invalid QR code format');
    }
    
    // Check if QR code has expired
    const now = Date.now();
    if (now > qrData.expiry) {
      showNotification('QR Expired', 'This QR code has expired. Ask your faculty to generate a new one.');
      return;
    }
    
    // Store scanned data in both variable and localStorage for backup
    currentScannedData = qrData;
    localStorage.setItem('currentQrData', JSON.stringify(qrData));
    console.log('✅ QR data stored:', qrData);
    console.log('✅ QR data backed up to localStorage');
    
    // Close QR scanner
    closeQRScanner();
    
    // Show success notification with details
    const timeLeft = Math.ceil((qrData.expiry - now) / 1000);
    showNotification(
      'QR Scanned Successfully!',
      `Subject: ${qrData.subject} | Batch: ${qrData.batch} | Periods: ${qrData.periods} | Now capturing photo...`
    );
    
    console.log('QR Data:', qrData);
    
    // Open photo capture modal for verification
    setTimeout(() => {
      openPhotoCapture();
    }, 1000); // Small delay to show the success message
    
  } catch (error) {
    console.error('Error processing QR code:', error);
    showNotification('Invalid QR Code', 'The scanned QR code is not valid for attendance marking.');
  }
}

// Handle scan errors (don't show for every frame)
function onScanError(error) {
  // Only log errors, don't show notifications for scanning errors
  // as they happen frequently during normal scanning
  if (error.includes('NotFoundException')) {
    // This is normal - no QR code found in frame
    return;
  }
  console.log('QR Scan error:', error);
}

// Mark attendance based on scanned QR data
async function markAttendance(qrData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    // Get student profile data
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    // Validate student belongs to the same batch/school as QR code
    if (studentProfile.school && studentProfile.school !== qrData.school) {
      showNotification('Invalid QR Code', 'This QR code is not for your school.');
      return;
    }
    
    if (studentProfile.batch && studentProfile.batch !== qrData.batch) {
      showNotification('Invalid QR Code', 'This QR code is not for your batch.');
      return;
    }
    
    // Check if already marked attendance for this session
    const today = new Date().toISOString().slice(0, 10);
    const attendanceQuery = await db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .get();
    
    if (!attendanceQuery.empty) {
      showNotification('Already Marked', `Attendance already recorded for ${qrData.subject} today.`);
      return;
    }
    
    // Create attendance record
    const attendanceData = {
      userId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'present',
      markedAt: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp
    };
    
    // Save to Firebase
    const docRef = await db.collection('attendances').add(attendanceData);
    console.log('Attendance marked with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      'Attendance Marked! ✓',
      `Present for ${qrData.subject} (${qrData.periods} periods) - ${today}`
    );
    
    // Add to local notifications
    addNotification(
      'attendance',
      `Attendance marked for ${qrData.subject} - ${qrData.periods} periods`,
      'Just now'
    );
    
    // Update local attendance data (simulate increase)
    if (subjectData[qrData.subject]) {
      subjectData[qrData.subject] = Math.min(100, subjectData[qrData.subject] + 2);
      updateCharts();
      showLowAttendanceWarnings();
    }
    
    // Refresh today's attendance display
    if (auth.currentUser) {
      fetchTodayAttendance(auth.currentUser);
    }
    
  } catch (error) {
    console.error('Error marking attendance:', error);
    showNotification('Error', 'Failed to mark attendance. Please try again.');
  }
}

// Photo capture variables
let photoCaptureStream = null;
let capturedPhotoData = null;
let autoCaptureTimer = null;
let countdownInterval = null;

/* ===== PHOTO CAPTURE FUNCTIONS ===== */

// Initialize video stream with proper error handling
function initializeVideoStream() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🎥 Requesting front camera access...');
      
      // Request front camera access with enhanced constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera only
          width: { ideal: 1920, min: 640, max: 1920 },
          height: { ideal: 1080, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 30 }
        },
        audio: false
      });
      
      console.log('✅ Camera stream obtained successfully');
      console.log('Stream details:', {
        active: stream.active,
        tracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });
      
      resolve(stream);
      
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      reject(error);
    }
  });
}

// Setup video element properly
function setupVideoElement(video, stream) {
  return new Promise((resolve, reject) => {
    console.log('📺 Setting up video element...');
    
    // Configure video element
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    
    // Apply mirror effect and styling
    video.style.transform = 'scaleX(-1)';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.backgroundColor = '#000';
    
    // Handle video events
    video.onloadedmetadata = () => {
      console.log('📹 Video metadata loaded:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
    };
    
    video.oncanplay = () => {
      console.log('📹 Video can play');
    };
    
    video.onplaying = () => {
      console.log('📹 Video is playing');
      resolve(true);
    };
    
    video.onerror = (error) => {
      console.error('❌ Video error:', error);
      reject(error);
    };
    
    // Force play the video
    video.play().then(() => {
      console.log('✅ Video play() succeeded');
    }).catch(err => {
      console.error('❌ Video play() failed:', err);
      // Don't reject here, onplaying event will handle success
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        console.log('⏰ Video ready via timeout fallback');
        resolve(true);
      } else {
        reject(new Error('Video failed to initialize within timeout'));
      }
    }, 5000);
  });
}

// Open Photo Capture Modal
function openPhotoCapture() {
  const modal = document.getElementById('photoCaptureModal');
  const video = document.getElementById('photoCaptureVideo');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Opening Photo Capture modal...');
  
  if (!modal || !video) {
    console.error('Photo capture elements not found');
    showNotification('Photo Capture Error', 'Photo capture components not properly configured.');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Reset UI first
  if (captureBtn) captureBtn.style.display = 'none';
  photoStatus.textContent = 'Requesting camera permission...';
  photoStatus.style.color = '#007bff';
  photoStatus.style.fontSize = '16px';
  photoStatus.style.fontWeight = 'normal';
  
  // Check if mediaDevices is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia is not supported in this browser');
    photoStatus.textContent = 'Camera not supported in this browser';
    photoStatus.style.color = '#dc3545';
    showNotification('Camera Error', 'Your browser does not support camera access.');
    return;
  }

  // Directly request front camera access - this will show the browser's native permission dialog
  console.log('🎥 Requesting camera access...');
  navigator.mediaDevices.getUserMedia({ 
    video: { 
      facingMode: 'user', // Front camera
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      frameRate: { ideal: 30, min: 15 }
    },
    audio: false
  }).then(stream => {
    console.log('✅ Camera permission granted, stream obtained:', {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      trackSettings: stream.getVideoTracks()[0]?.getSettings()
    });
    
    photoCaptureStream = stream;
    photoStatus.textContent = 'Initializing camera...';
    photoStatus.style.color = '#ffc107';
    
    // Clear any existing srcObject first
    video.srcObject = null;
    
    // Set up video element with proper event handling
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    
    // Apply styling
    video.style.transform = 'scaleX(-1)'; // Mirror effect
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.backgroundColor = '#000';
    
    // Set up event listeners before assigning stream
    const onVideoReady = () => {
      console.log('📹 Video ready event triggered:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        currentTime: video.currentTime
      });
      
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        photoStatus.textContent = 'Camera ready! Position your face and tap Capture Photo';
        photoStatus.style.color = '#28a745';
        
        // Show the manual capture button
        if (captureBtn) {
          captureBtn.style.display = 'flex';
        }
      }
    };
    
    // Multiple event listeners to catch video ready state
    video.addEventListener('loadedmetadata', () => {
      console.log('📹 Video metadata loaded');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('canplay', () => {
      console.log('📹 Video can play');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('playing', () => {
      console.log('📹 Video is playing');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('error', (err) => {
      console.error('❌ Video element error:', err);
      photoStatus.textContent = 'Video error occurred';
      photoStatus.style.color = '#dc3545';
    });
    
    // Now set the stream
    video.srcObject = stream;
    
    // Force play the video
    setTimeout(() => {
      video.play().then(() => {
        console.log('✅ Video.play() succeeded');
      }).catch(err => {
        console.error('❌ Video.play() failed:', err);
        // Try to trigger ready check anyway
        setTimeout(onVideoReady, 500);
      });
    }, 100);
    
    // Safety timeout - force ready after reasonable time
    setTimeout(() => {
      console.log('⏰ Safety timeout check:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused
      });
      
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        console.log('✅ Video ready via safety timeout');
        onVideoReady();
      } else {
        console.log('⚠️ Video still not ready, starting anyway');
        photoStatus.textContent = 'Camera initializing... Please wait';
        photoStatus.style.color = '#ffc107';
        
        // Final attempt after longer delay
        setTimeout(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onVideoReady();
          } else {
            console.log('🔧 Showing manual capture button despite video not fully ready');
            photoStatus.textContent = 'Camera ready! Position your face and tap Capture Photo';
            photoStatus.style.color = '#28a745';
            if (captureBtn) {
              captureBtn.style.display = 'flex';
            }
          }
        }, 2000);
      }
    }, 3000);
    
  }).catch(error => {
    console.error('❌ Camera permission denied or error:', error);
    photoStatus.style.color = '#dc3545';

    let errorMessage = 'Camera access failed';
    let notificationTitle = 'Camera Error';
    let notificationMessage = 'Unable to access camera';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera permission denied';
      notificationTitle = 'Permission Denied';
      notificationMessage = 'Please allow camera access to continue';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera found';
      notificationTitle = 'No Camera';
      notificationMessage = 'No camera detected on this device';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera in use by another app';
      notificationTitle = 'Camera Busy';
      notificationMessage = 'Close other apps using the camera';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Camera constraints not supported';
      notificationTitle = 'Camera Issue';
      notificationMessage = 'Camera settings not compatible';
    }

    photoStatus.textContent = errorMessage;
    showNotification(notificationTitle, notificationMessage);
    
    // Add retry button
    setTimeout(() => {
      photoStatus.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">📷</div>
          <h3 style="color: #dc3545; margin-bottom: 10px;">Camera Access Required</h3>
          <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            ${notificationMessage}
          </p>
          <button onclick="requestCameraPermission()" 
                  style="background: #007bff; color: white; border: none; padding: 12px 24px; 
                         border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;">
            🔄 Try Again
          </button>
        </div>
      `;
    }, 1000);
  });
}

// Close Photo Capture Modal
function closePhotoCaptureModal() {
  const modal = document.getElementById('photoCaptureModal');
  
  console.log('Closing Photo Capture modal...');
  console.log('Before closing - capturedPhotoData exists:', !!capturedPhotoData);
  console.log('Before closing - currentScannedData exists:', !!currentScannedData);
  
  // Stop camera stream
  if (photoCaptureStream) {
    photoCaptureStream.getTracks().forEach(track => track.stop());
    photoCaptureStream = null;
  }
  
  // Reset UI
  resetPhotoCaptureUI();
  
  // Hide modal
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Only clear captured data if attendance was successfully marked
  // This preserves the photo data in case the modal needs to be reopened
  // Note: Data will be cleared in markAttendanceWithPhoto after successful submission
}

// Capture student photo
function captureStudentPhoto() {
  const video = document.getElementById('photoCaptureVideo');
  const canvas = document.getElementById('photoCaptureCanvas');
  const capturedImg = document.getElementById('capturedPhotoImg');
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Capture photo attempt - video ready check:', {
    videoExists: !!video,
    canvasExists: !!canvas,
    videoWidth: video?.videoWidth || 0,
    videoHeight: video?.videoHeight || 0,
    videoReadyState: video?.readyState
  });
  
  if (!video || !canvas) {
    showNotification('Capture Error', 'Video or canvas elements not found.');
    return;
  }
  
  // More comprehensive video readiness check
  if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
    console.log('Video not ready yet, waiting...');
    photoStatus.textContent = 'Video is loading, please wait...';
    photoStatus.style.color = '#007bff';
    
    // Try again after a short delay
    setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        console.log('Video ready after delay, trying capture again');
        captureStudentPhoto();
      } else {
        showNotification('Camera Error', 'Video stream is not ready. Please refresh the page and try again.');
      }
    }, 1000);
    return;
  }
  
  console.log('Capturing student photo...');
  
  // Set canvas dimensions to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Capture frame from video
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convert to base64 data URL
  capturedPhotoData = canvas.toDataURL('image/jpeg', 0.8);
  
  // Show captured photo preview
  capturedImg.src = capturedPhotoData;
  capturedPreview.style.display = 'flex';
  
  // Update UI buttons
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'flex';
  confirmBtn.style.display = 'flex';
  
  // Update status
  photoStatus.textContent = 'Photo captured! Review and confirm or retake';
  photoStatus.style.color = '#007bff';
  
  console.log('Photo captured successfully');
}

// Retake photo
function retakePhoto() {
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Retaking photo...');
  
  // Hide captured photo preview
  capturedPreview.style.display = 'none';
  
  // Reset UI buttons
  captureBtn.style.display = 'flex';
  retakeBtn.style.display = 'none';
  confirmBtn.style.display = 'none';
  
  // Update status
  photoStatus.textContent = 'Position your face in the frame and capture again';
  photoStatus.style.color = '#28a745';
  
  // Clear captured data
  capturedPhotoData = null;
}

// Confirm photo and mark attendance
function confirmPhotoAndMarkAttendance() {
  console.log('=== CONFIRM PHOTO AND MARK ATTENDANCE DEBUG ===');
  console.log('capturedPhotoData exists:', !!capturedPhotoData);
  console.log('currentScannedData exists:', !!currentScannedData);
  console.log('capturedPhotoData length:', capturedPhotoData ? capturedPhotoData.length : 'null');
  console.log('currentScannedData details:', currentScannedData);
  
  // Check localStorage backup for QR data
  const backupQrData = localStorage.getItem('currentQrData');
  console.log('Backup QR data in localStorage:', backupQrData);
  
  if (!capturedPhotoData) {
    console.error('Missing captured photo data');
    showNotification('Photo Error', 'No photo captured. Please capture a photo first.');
    return;
  }
  
  // Try to recover QR data from localStorage if main variable is lost
  if (!currentScannedData && backupQrData) {
    try {
      currentScannedData = JSON.parse(backupQrData);
      console.log('✅ Recovered QR data from localStorage:', currentScannedData);
    } catch (e) {
      console.error('❌ Failed to parse backup QR data:', e);
    }
  }
  
  if (!currentScannedData) {
    console.error('❌ Missing QR scan data - both main variable and backup are empty');
    showNotification('QR Error', 'No QR data available. Please scan QR code again.');
    
    // Close the photo modal and redirect user to scan QR again
    setTimeout(() => {
      closePhotoCaptureModal();
      showNotification('Please Start Over', 'Please scan the QR code first, then take your photo.');
    }, 2000);
    return;
  }
  
  console.log('Confirming photo and marking attendance...');
  
  // Show processing notification first
  showNotification(
    'Processing Attendance...',
    'Saving photo and marking attendance. Please wait...'
  );
  
  // Mark attendance with photo
  markAttendanceWithPhoto(currentScannedData, capturedPhotoData);
  
  // Close photo capture modal after starting the process
  setTimeout(() => {
    closePhotoCaptureModal();
  }, 1000);
}

// Reset photo capture UI
function resetPhotoCaptureUI() {
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  if (capturedPreview) capturedPreview.style.display = 'none';
  if (captureBtn) captureBtn.style.display = 'none';
  if (retakeBtn) retakeBtn.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';
  
  if (photoStatus) {
    photoStatus.textContent = 'Camera inactive';
    photoStatus.style.color = '#6c757d';
  }
}

// Mark attendance with photo verification
async function markAttendanceWithPhoto(qrData, photoData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    // Get student profile data
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    // Validate student belongs to the same batch/school as QR code
    if (studentProfile.school && studentProfile.school !== qrData.school) {
      showNotification('Invalid QR Code', 'This QR code is not for your school.');
      return;
    }
    
    if (studentProfile.batch && studentProfile.batch !== qrData.batch) {
      showNotification('Invalid QR Code', 'This QR code is not for your batch.');
      return;
    }
    
    // Check if already marked attendance for this session
    const today = new Date().toISOString().slice(0, 10);
    const attendanceQuery = await db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .get();
    
    if (!attendanceQuery.empty) {
      showNotification('Already Marked', `Attendance already recorded for ${qrData.subject} today.`);
      return;
    }
    
    // Create attendance record with photo
    const attendanceData = {
      userId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'present',
      markedAt: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      hasPhoto: true,
      photoTimestamp: new Date(),
      verificationMethod: 'qr_and_photo'
    };
    
    // For now, we'll store photo data as a field (in production, use Firebase Storage)
    // Note: This is simplified - in production, upload to Firebase Storage and store URL
    attendanceData.photoData = photoData; // Base64 encoded photo
    
    // Save to Firebase
    const docRef = await db.collection('attendances').add(attendanceData);
    console.log('Attendance with photo marked with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      '✅ Attendance Verified!',
      `Present for ${qrData.subject} (${qrData.periods} periods) with photo verification - ${today}`
    );
    
    // Add to local notifications
    addNotification(
      'success',
      `✅ Verified attendance for ${qrData.subject} - ${qrData.periods} periods (with photo)`,
      'Just now'
    );
    
    // Update local attendance data (simulate increase)
    if (subjectData[qrData.subject]) {
      subjectData[qrData.subject] = Math.min(100, subjectData[qrData.subject] + 2);
      updateCharts();
      showLowAttendanceWarnings();
    }
    
    // Refresh today's attendance display
    if (auth.currentUser) {
      fetchTodayAttendance(auth.currentUser);
    }
    
    // Clear the scanned data and localStorage backup
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    console.log('✅ QR data cleared after successful attendance marking');
    
  } catch (error) {
    console.error('Error marking attendance with photo:', error);
    showNotification('Error', 'Failed to mark attendance with photo. Please try again.');
  }
}

// Request camera permission function
function requestCameraPermission() {
  console.log('Requesting camera permission...');
  const photoStatus = document.getElementById('photoStatus');
  
  if (photoStatus) {
    photoStatus.textContent = 'Requesting camera permission...';
    photoStatus.style.color = '#ffc107';
  }
  
  // Try to open photo capture again
  openPhotoCapture();
}

// Global functions to be called from HTML
window.openQRScanner = openQRScanner;
window.closeQRScanner = closeQRScanner;
window.openPhotoCapture = openPhotoCapture;
window.closePhotoCaptureModal = closePhotoCaptureModal;
window.captureStudentPhoto = captureStudentPhoto;
window.retakePhoto = retakePhoto;
window.confirmPhotoAndMarkAttendance = confirmPhotoAndMarkAttendance;
window.requestCameraPermission = requestCameraPermission;

/* ===== PAGE INITIALIZATION ===== */
// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Note: Logout function is already defined in HTML head section
  
  // Only initialize charts after a small delay to ensure DOM is ready
  setTimeout(() => {
    updateCharts();
    showLowAttendanceWarnings();
  }, 100);
  
  // Add debug info to console
  console.log('Student dashboard loaded. Debug functions available:');
  console.log('- debugCreateTestNotification(status) - Create test notification');
  console.log('- debugNotificationStatus() - Check notification system status');
  console.log('- debugTestFirebaseConnection() - Test Firebase connection');
  console.log('- debugCheckNotificationPermissions() - Test notification permissions');
});