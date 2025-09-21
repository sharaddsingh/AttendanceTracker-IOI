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
// Track overall weighted periods across all subjects for accurate overall %
let overallTotalPeriods = 0;
let overallPresentPeriods = 0;

// Function to fetch real-time attendance data and calculate percentages using FAIR EVALUATION (same as faculty dashboard)
async function fetchAttendanceData() {
  console.log('🔄 STUDENT DASHBOARD: Starting fetchAttendanceData...');
  
  if (!auth.currentUser) {
    console.error('❌ No authenticated user for attendance data fetch');
    // Set empty data and update UI
    window.subjectData = {};
    window.overallTotalPeriods = 0;
    window.overallPresentPeriods = 0;
    updateCharts();
    showLowAttendanceWarnings();
    updateChartsVisibility();
    return;
  }

  // Set academic start date - September 16, 2025
  const academicStartDate = '2025-09-16';
  const currentDate = new Date().toISOString().split('T')[0];
  console.log(`📅 STUDENT DASHBOARD: Using FAIR EVALUATION from ${academicStartDate} to ${currentDate}`);
  console.log(`👤 Current user: ${auth.currentUser.uid} (${auth.currentUser.email})`);

  try {
    console.log('📋 Step 1: Getting all student attendance records...');
    // Get all subjects this student has attended
    const studentSnapshot = await db.collection('attendances')
      .where('userId', '==', auth.currentUser.uid)
      .get();
    
    console.log(`📊 Found ${studentSnapshot.size} total student attendance records`);
    
    if (studentSnapshot.size === 0) {
      console.log('⚠️ No attendance records found for this student at all');
      console.log('⚠️ This means the student has never marked any attendance');
      window.subjectData = {};
      window.overallTotalPeriods = 0;
      window.overallPresentPeriods = 0;
      updateCharts();
      showLowAttendanceWarnings();
      updateChartsVisibility();
      return;
    }
    
    // Test: Check if ANY records exist without date filtering
    let hasAnyValidRecords = false;
    studentSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.subject && data.date) {
        hasAnyValidRecords = true;
      }
    });
    
    if (!hasAnyValidRecords) {
      console.log('⚠️ No valid records found (missing subject or date fields)');
      await fallbackAttendanceCalculation();
      return;
    }
    
    // Debug: Log all student records
    console.log('📋 All student records:');
    studentSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  Record ${index + 1}: ${data.date} | ${data.subject} | ${data.status} | ${data.periods}`);
    });
    
    // Get unique subjects for this student (with date filtering)
    const studentSubjects = new Set();
    let filteredRecordsCount = 0;
    
    studentSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`🔍 Checking record: date=${data.date}, academicStart=${academicStartDate}, current=${currentDate}`);
      
      if (data.date && data.date >= academicStartDate && data.date <= currentDate && data.subject) {
        studentSubjects.add(data.subject);
        filteredRecordsCount++;
        console.log(`✅ Included: ${data.subject} on ${data.date}`);
      } else {
        console.log(`❌ Excluded: date=${data.date}, subject=${data.subject}`);
      }
    });
    
    console.log(`📋 Academic period filtering: ${filteredRecordsCount}/${studentSnapshot.size} records included`);
    console.log(`📚 Student subjects (academic period): ${Array.from(studentSubjects).join(', ')}`);
    
    if (studentSubjects.size === 0) {
      console.log('⚠️ No subjects found in academic period');
      window.subjectData = {};
      window.overallTotalPeriods = 0;
      window.overallPresentPeriods = 0;
      updateCharts();
      showLowAttendanceWarnings();
      updateChartsVisibility();
      return;
    }
    
    // FAIR CALCULATION: For each subject, calculate total classes held vs student's attendance
    const subjectData = {};
    let overallTotalClasses = 0;
    let overallPresentClasses = 0;
    
    for (const subject of studentSubjects) {
      console.log(`📈 FAIR CALCULATION for subject: ${subject}`);
      
      // Step 1: Get ALL classes held for this subject (across all students) - FAIR DENOMINATOR
      const allSubjectClassesQuery = await db.collection('attendances')
        .where('subject', '==', subject)
        .get();
      
      // Calculate total classes held for this subject by unique sessions
      const subjectSessionPeriods = new Map();
      allSubjectClassesQuery.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date >= academicStartDate && data.date <= currentDate) {
          const sessionId = data.sessionId || data.qrSessionId || `${data.date}_${data.subject}`;
          if (sessionId && data.periods) {
            subjectSessionPeriods.set(sessionId, data.periods);
          }
        }
      });
      
      const subjectTotalClasses = Array.from(subjectSessionPeriods.values()).reduce((sum, periods) => sum + periods, 0);
      console.log(`🎯 TOTAL CLASSES for ${subject}: ${subjectTotalClasses} (from ${subjectSessionPeriods.size} unique sessions)`);
      
      // Step 2: Get this student's present classes in the subject - FAIR NUMERATOR
      const studentSubjectQuery = await db.collection('attendances')
        .where('userId', '==', auth.currentUser.uid)
        .where('subject', '==', subject)
        .get();
      
      let subjectPresentClasses = 0;
      studentSubjectQuery.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date >= academicStartDate && data.date <= currentDate && data.status === 'present') {
          const periods = data.periods || 1;
          subjectPresentClasses += periods;
        }
      });
      
      console.log(`📈 STUDENT PRESENT for ${subject}: ${subjectPresentClasses} out of ${subjectTotalClasses}`);
      
      // Step 3: FAIR FORMULA - (student's present classes / total classes held for subject) * 100
      const fairPercentage = subjectTotalClasses > 0 ? Math.round((subjectPresentClasses / subjectTotalClasses) * 100) : 0;
      subjectData[subject] = fairPercentage;
      
      console.log(`🎯 FAIR PERCENTAGE for ${subject}: (${subjectPresentClasses}/${subjectTotalClasses}) * 100 = ${fairPercentage}%`);
      
      // Add to overall calculations
      overallTotalClasses += subjectTotalClasses;
      overallPresentClasses += subjectPresentClasses;
    }
    
    // Calculate fair overall percentage
    const overallFairPercentage = overallTotalClasses > 0 ? Math.round((overallPresentClasses / overallTotalClasses) * 100) : 0;
    console.log(`🎯 FAIR OVERALL PERCENTAGE: (${overallPresentClasses}/${overallTotalClasses}) * 100 = ${overallFairPercentage}%`);
    
    // Update global variables with fair calculations
    window.subjectData = subjectData;
    window.overallTotalPeriods = overallTotalClasses;
    window.overallPresentPeriods = overallPresentClasses;
    
    console.log(`⚖️ FAIR EVALUATION COMPLETE:`);
    console.log(`  - Academic period: ${academicStartDate} to ${currentDate}`);
    console.log(`  - Overall: ${overallPresentClasses}/${overallTotalClasses} = ${overallFairPercentage}%`);
    console.log(`  - Subjects:`, Object.entries(subjectData).map(([s, p]) => `${s}: ${p}%`).join(', '));
    
    // Update UI
    updateCharts();
    showLowAttendanceWarnings();
    updateChartsVisibility();
    
  } catch (error) {
    console.error('❌ Error in fair attendance calculation:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    
    // FALLBACK: Try simple calculation if fair calculation fails
    console.log('🔄 Attempting fallback calculation...');
    try {
      await fallbackAttendanceCalculation();
    } catch (fallbackError) {
      console.error('❌ Fallback calculation also failed:', fallbackError);
      // Set empty data as last resort
      window.subjectData = {};
      window.overallTotalPeriods = 0;
      window.overallPresentPeriods = 0;
    }
    
    updateCharts();
    showLowAttendanceWarnings();
    updateChartsVisibility();
  }
}

// Fallback calculation using simpler logic
async function fallbackAttendanceCalculation() {
  console.log('🔄 Running fallback attendance calculation...');
  
  const academicStartDate = '2025-09-16';
  const currentDate = new Date().toISOString().split('T')[0];
  
  const studentSnapshot = await db.collection('attendances')
    .where('userId', '==', auth.currentUser.uid)
    .get();
  
  const subjectStats = {};
  let totalPeriodsAll = 0;
  let presentPeriodsAll = 0;
  
  studentSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.date && data.date >= academicStartDate && data.date <= currentDate && data.subject) {
      const periods = Math.max(1, Number(data.periods) || 1);
      
      if (!subjectStats[data.subject]) {
        subjectStats[data.subject] = { totalPeriods: 0, presentPeriods: 0 };
      }
      
      subjectStats[data.subject].totalPeriods += periods;
      totalPeriodsAll += periods;
      
      if (data.status === 'present') {
        subjectStats[data.subject].presentPeriods += periods;
        presentPeriodsAll += periods;
      }
    }
  });
  
  // Calculate simple percentages
  const fallbackSubjectData = {};
  Object.keys(subjectStats).forEach(subject => {
    const stats = subjectStats[subject];
    const percentage = stats.totalPeriods > 0 ? Math.round((stats.presentPeriods / stats.totalPeriods) * 100) : 0;
    fallbackSubjectData[subject] = percentage;
    console.log(`🔄 Fallback ${subject}: ${stats.presentPeriods}/${stats.totalPeriods} = ${percentage}%`);
  });
  
  // Update global variables
  window.subjectData = fallbackSubjectData;
  window.overallTotalPeriods = totalPeriodsAll;
  window.overallPresentPeriods = presentPeriodsAll;
  
  console.log('✅ Fallback calculation completed successfully');
}

// Make functions globally accessible for debugging
window.debugFetchAttendanceData = fetchAttendanceData;
window.debugFallbackCalculation = fallbackAttendanceCalculation;
window.debugUpdateCharts = updateCharts;

// Manual refresh function for debugging
window.manualRefreshAttendance = async function() {
  console.log('🔄 MANUAL REFRESH: Starting attendance data refresh...');
  try {
    await fetchAttendanceData();
    console.log('✅ MANUAL REFRESH: Success!');
  } catch (error) {
    console.error('❌ MANUAL REFRESH: Failed:', error);
    try {
      await fallbackAttendanceCalculation();
      updateCharts();
      showLowAttendanceWarnings();
      updateChartsVisibility();
      console.log('✅ MANUAL REFRESH: Fallback completed!');
    } catch (fallbackError) {
      console.error('❌ MANUAL REFRESH: Even fallback failed:', fallbackError);
    }
  }
};

// Show low attendance warning if below 75% and data is available (uses academic period data)
function showLowAttendanceWarnings() {
  // First, ensure there is data to process
  // Note: subjectData is already filtered to academic period (Sep 16, 2025 onwards)
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

  const subjectData = window.subjectData || {};
  const hasSubjectData = Object.keys(subjectData).length > 0;
  const hasOverallData = (window.overallTotalPeriods || 0) > 0 || hasSubjectData; // allow overall even if subjectData empty

  // Subject-wise chart (only if we have subject data)
  const subjectChartCanvas = document.getElementById("subjectChart");
  if (subjectChartCanvas && hasSubjectData) {
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

  // Overall attendance chart (render if we have any overall data)
  const overallChartCanvas = document.getElementById("overallChart");
  if (overallChartCanvas && hasOverallData) {
    const overallAttendance = calculateOverallAttendance();
    const missedPercentage = Math.max(0, 100 - overallAttendance);

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
  const subjectData = window.subjectData || {};
  const hasSubjectData = Object.keys(subjectData).length > 0;
  const hasOverallData = (window.overallTotalPeriods || 0) > 0 || hasSubjectData;
  
  // Subject-wise chart section
  const subjectChartCanvas = document.getElementById("subjectChart");
  const noSubjectData = document.getElementById("noSubjectData");
  
  if (subjectChartCanvas && noSubjectData) {
    if (hasSubjectData) {
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
    if (hasOverallData) {
      overallChartCanvas.style.display = 'block';
      noOverallData.style.display = 'none';
    } else {
      overallChartCanvas.style.display = 'none';
      noOverallData.style.display = 'block';
    }
  }
  
  console.log(`Charts visibility updated: subjectData=${hasSubjectData}, overallData=${hasOverallData}`);
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
  
  // Note: We no longer manually update attendance data here
  // The fair calculation system will handle this accurately when data is refreshed
  
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

// Helper: get YYYY-MM-DD in Asia/Kolkata
function getISTDateString(d = new Date()) {
  // Use Intl to format in IST then build YYYY-MM-DD
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${day}`;
}

// Fetch today's attendance from Firebase
async function fetchTodayAttendance(user) {
  const todayAttendanceList = document.getElementById('todayAttendanceList');
  const noTodayAttendance = document.getElementById('noTodayAttendance');
  const today = getISTDateString(); // YYYY-MM-DD in IST

  try {
    const attendanceRef = db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today);

    const snapshot = await attendanceRef.get();

    if (snapshot.empty) {
      noTodayAttendance.style.display = 'block';
      if (noTodayAttendance) {
        noTodayAttendance.textContent = 'No classes today';
      }
      todayAttendanceList.innerHTML = ''; // Clear existing entries
      return;
    }

    noTodayAttendance.style.display = 'none';
    todayAttendanceList.innerHTML = ''; // Clear existing entries

    // Collect docs and sort by timestamp/markedAt for stable ordering
    const records = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      records.push({
        subject: d.subject,
        status: d.status,
        periods: Math.max(1, Number(d.periods) || 1),
        when: d.markedAt?.toDate?.() || d.timestamp?.toDate?.() || new Date(d.date)
      });
    });
    records.sort((a,b) => (a.when || 0) - (b.when || 0));

    // Display all attendance records without any limit
    for (const rec of records) {
      const statusText = rec.status === 'present' ? 'Present' : 'Absent';
      const statusColor = rec.status === 'present' ? '#28a745' : '#dc3545';
      const periodsLabel = rec.periods ? ` (${rec.periods} ${rec.periods > 1 ? 'classes' : 'class'})` : '';
      
      const attendanceItem = `
        <div class="attendance-item" style="border-left-color: ${statusColor};">
          <span class="subject-name">${rec.subject}</span>
          <span class="attendance-status" style="color: ${statusColor};">${statusText}${periodsLabel}</span>
        </div>
      `;
      todayAttendanceList.innerHTML += attendanceItem;
    }

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
  
  // Calculate yesterday's date in IST
  const now = new Date();
  const istNowStr = getISTDateString(now);
  const istNow = new Date(istNowStr + 'T00:00:00');
  const yD = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDate = getISTDateString(yD); // YYYY-MM-DD (IST)

  try {
    const attendanceRef = db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', yesterdayDate);

    const snapshot = await attendanceRef.get();

    if (snapshot.empty) {
      noYesterdayData.style.display = 'block';
      if (noYesterdayData) {
        noYesterdayData.textContent = 'No classes yesterday';
      }
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
      const p = Number(periods);
      const periodsText = p ? `${p} ${p > 1 ? 'classes' : 'class'}` : '';
      
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
          <span class="subject-name" style="font-weight: 600; color: #2C3E50;">${subject}</span>
          ${periodsText ? `<span style="font-size: 12px; color: #aaa;">(${periodsText})</span>` : ''}
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
    
    // Check if the list is scrollable and add appropriate class
    checkYesterdayScrollability();

  } catch (error) {
    console.error('Error fetching yesterday\'s attendance:', error);
    noYesterdayData.style.display = 'block';
    yesterdayList.style.display = 'none';
    yesterdayList.innerHTML = '';
  }
}

// Function to check if yesterday's attendance list is scrollable
function checkYesterdayScrollability() {
  const yesterdaySection = document.getElementById('yesterdaySection');
  const yesterdayList = document.getElementById('yesterdayList');
  
  if (yesterdayList && yesterdaySection) {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      const isScrollable = yesterdayList.scrollHeight > yesterdayList.clientHeight;
      
      if (isScrollable) {
        yesterdaySection.classList.add('has-scroll');
        console.log('📋 Yesterday\'s attendance list is scrollable - fade effect enabled');
      } else {
        yesterdaySection.classList.remove('has-scroll');
        console.log('📋 Yesterday\'s attendance list fits in container - no scroll needed');
      }
    }, 100);
  }
}

// Update `onAuthStateChanged` to call the new function
auth.onAuthStateChanged(async (user) => {
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
    console.log('🚀 Loading dashboard data for authenticated user...');
    
    try {
      loadUserProfile(user);
      fetchTodayAttendance(user); // Fetch today's attendance
      fetchYesterdayAttendance(user); // Fetch yesterday's attendance
      
      console.log('📋 About to call fetchAttendanceData...');
      await fetchAttendanceData(); // Fetch all attendance data for charts and warnings (now async)
      console.log('✅ fetchAttendanceData completed');
      
      fetchNotificationsFromServer(); // Fetch real notifications from Firebase
      
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      // Try fallback even if main loading fails
      try {
        await fallbackAttendanceCalculation();
        updateCharts();
        showLowAttendanceWarnings();
        updateChartsVisibility();
      } catch (fallbackError) {
        console.error('❌ Even fallback failed:', fallbackError);
      }
    }
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
  
  // Sort notifications to maintain chronological order (newest first) with enhanced logic
  notifications.sort((a, b) => {
    // Enhanced timestamp handling (same as server notifications)
    let timeA, timeB;
    
    if (a.timestamp && a.timestamp instanceof Date) {
      timeA = a.timestamp;
    } else if (a.timestamp && typeof a.timestamp.toDate === 'function') {
      timeA = a.timestamp.toDate();
    } else if (a.time === 'Just now') {
      timeA = new Date();
    } else {
      timeA = new Date(0);
    }
    
    if (b.timestamp && b.timestamp instanceof Date) {
      timeB = b.timestamp;
    } else if (b.timestamp && typeof b.timestamp.toDate === 'function') {
      timeB = b.timestamp.toDate();
    } else if (b.time === 'Just now') {
      timeB = new Date();
    } else {
      timeB = new Date(0);
    }
    
    const result = timeB - timeA; // Descending order (newest first)
    
    // If timestamps are equal, prioritize "Just now" notifications
    if (result === 0) {
      if (a.time === 'Just now' && b.time !== 'Just now') return -1;
      if (b.time === 'Just now' && a.time !== 'Just now') return 1;
    }
    
    return result;
  });
  
  console.log('🗒 Local notification added and sorted. Current notification order:');
  notifications.slice(0, 3).forEach((notif, index) => {
    console.log(`  ${index + 1}. ${notif.message.substring(0, 30)} - ${notif.timestamp ? notif.timestamp.toLocaleString() : 'No timestamp'}`);
  });
  
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
  // TEMPORARY ALERT TO VERIFY NEW CODE IS LOADING
  console.log('🚀 NEW NOTIFICATION SORTING CODE LOADED v2.0 - FORCE REORDER ENABLED');
  
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
      
      // Sort notifications by timestamp (most recent first) to ensure proper ordering
      // This ensures recent notifications appear on top regardless of database query ordering
      console.log('🗐 DEBUG: Raw notifications before sorting:');
      serverNotifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title || notif.message.substring(0, 50)} - Timestamp: ${notif.timestamp ? notif.timestamp.toISOString() : 'NULL'} - Time: ${notif.time}`);
      });
      
      // SIMPLIFIED SORTING: Check for "Just now" first, then by timestamp
      serverNotifications.sort((a, b) => {
        console.log(`🔍 SORT DEBUG: Comparing notifications:`);
        console.log(`  A: "${a.message.substring(0, 30)}" - time: "${a.time}" - timestamp: ${a.timestamp ? a.timestamp.toISOString() : 'NULL'}`);
        console.log(`  B: "${b.message.substring(0, 30)}" - time: "${b.time}" - timestamp: ${b.timestamp ? b.timestamp.toISOString() : 'NULL'}`);
        
        // Priority 1: "Just now" notifications always come first
        if (a.time === 'Just now' && b.time !== 'Just now') {
          console.log(`  ✅ A wins ("Just now" priority)`);
          return -1;
        }
        if (b.time === 'Just now' && a.time !== 'Just now') {
          console.log(`  ✅ B wins ("Just now" priority)`);
          return 1;
        }
        
        // Priority 2: Both are "Just now" or neither, sort by timestamp
        const timeA = a.timestamp instanceof Date ? a.timestamp : (a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(0));
        const timeB = b.timestamp instanceof Date ? b.timestamp : (b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(0));
        
        const result = timeB.getTime() - timeA.getTime(); // Use getTime() for clearer comparison
        console.log(`  📅 Timestamp comparison: ${timeB.getTime()} - ${timeA.getTime()} = ${result}`);
        console.log(`  🏁 Final result: ${result > 0 ? 'B wins' : result < 0 ? 'A wins' : 'tie'}`);
        
        return result;
      });
      
      // FORCE REORDER: Manually move "Just now" notifications to the top
      const justNowNotifications = serverNotifications.filter(n => n.time === 'Just now');
      const otherNotifications = serverNotifications.filter(n => n.time !== 'Just now');
      
      console.log(`🚑 FORCE REORDER: Found ${justNowNotifications.length} "Just now" notifications`);
      justNowNotifications.forEach((notif, index) => {
        console.log(`  Just now #${index + 1}: ${notif.message.substring(0, 40)}`);
      });
      
      // Sort other notifications by timestamp
      otherNotifications.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp : (a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(0));
        const timeB = b.timestamp instanceof Date ? b.timestamp : (b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(0));
        return timeB.getTime() - timeA.getTime();
      });
      
      // Combine: "Just now" notifications first, then others
      serverNotifications = [...justNowNotifications, ...otherNotifications];
      
      console.log('🗒 Notifications AFTER force reordering ("Just now" first, then by timestamp):');
      serverNotifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title || notif.message.substring(0, 50)} - Time: ${notif.time} - Timestamp: ${notif.timestamp ? notif.timestamp.toISOString() : 'NULL'}`);
      });
      
      // Update the global notifications array with sorted notifications
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

// Manual refresh function for notifications (can be called from console for debugging)
function refreshNotifications() {
  console.log('🔄 MANUAL REFRESH: Re-sorting and updating notifications...');
  
  // Re-calculate time for all notifications
  notifications.forEach(notif => {
    if (notif.timestamp) {
      notif.time = getTimeAgo(notif.timestamp);
    }
  });
  
  // MANUAL REFRESH: Force reorder with same logic as server notifications
  const justNowNotifications = notifications.filter(n => n.time === 'Just now');
  const otherNotifications = notifications.filter(n => n.time !== 'Just now');
  
  console.log(`🚑 MANUAL REFRESH: Found ${justNowNotifications.length} "Just now" notifications`);
  
  // Sort other notifications by timestamp
  otherNotifications.sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp : (a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(0));
    const timeB = b.timestamp instanceof Date ? b.timestamp : (b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(0));
    return timeB.getTime() - timeA.getTime();
  });
  
  // Combine: "Just now" notifications first, then others
  notifications = [...justNowNotifications, ...otherNotifications];
  
  console.log('🗒 MANUAL REFRESH: Notifications after re-sorting:');
  notifications.forEach((notif, index) => {
    console.log(`  ${index + 1}. ${notif.title || notif.message.substring(0, 50)} - Timestamp: ${notif.timestamp ? notif.timestamp.toISOString() : 'NULL'} - Time: ${notif.time}`);
  });
  
  // Update the display
  updateNotifications(notifications);
  
  console.log('✅ MANUAL REFRESH: Notifications refreshed and display updated!');
}

// Make refreshNotifications globally available for debugging
window.refreshNotifications = refreshNotifications;

// Add window resize listener to handle dynamic scroll changes
window.addEventListener('resize', () => {
  // Debounce the resize event to avoid excessive calls
  clearTimeout(window.resizeTimeout);
  window.resizeTimeout = setTimeout(() => {
    checkYesterdayScrollability();
  }, 250);
});

// Make checkYesterdayScrollability globally available for debugging
window.checkYesterdayScrollability = checkYesterdayScrollability;

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



// Profile photo upload handler with Firebase Storage integration
async function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  
  console.log('📸 Profile photo selected:', file.name, 'Size:', file.size);
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification('Invalid File', 'Please select an image file.');
    return;
  }
  
  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('File Too Large', 'Please select an image smaller than 5MB.');
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to upload a profile photo.');
      return;
    }
    
    // Show loading state
    const profilePhoto = document.getElementById('profilePhoto');
    const originalSrc = profilePhoto.src;
    profilePhoto.style.opacity = '0.5';
    
    // Create a preview first
    const reader = new FileReader();
    reader.onload = function(e) {
      profilePhoto.src = e.target.result;
      profilePhoto.style.opacity = '1';
    };
    reader.readAsDataURL(file);
    
    // Check if Firebase Storage is available
    if (!storage) {
      throw new Error('Firebase Storage is not configured. Please enable Firebase Storage in the console.');
    }
    
    // Upload to Firebase Storage
    const timestamp = Date.now();
    const fileName = `profile_photos/${user.uid}/profile_${timestamp}.jpg`;
    const storageRef = storage.ref().child(fileName);
    
    console.log('☁️ Uploading profile photo to Firebase Storage...');
    
    const uploadTask = await storageRef.put(file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: user.uid,
        uploadedAt: new Date().toISOString()
      }
    });
    
    // Get download URL
    const photoURL = await uploadTask.ref.getDownloadURL();
    console.log('✅ Profile photo uploaded successfully:', photoURL);
    
    // Update user profile with photo URL (optional - save to localStorage and/or Firestore)
    const savedProfile = localStorage.getItem('studentProfile');
    if (savedProfile) {
      const profileData = JSON.parse(savedProfile);
      profileData.photoURL = photoURL;
      localStorage.setItem('studentProfile', JSON.stringify(profileData));
    }
    
    // Optionally save to Firestore profiles collection
    try {
      await db.collection('profiles').doc(user.uid).set({
        photoURL: photoURL,
        photoUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('✅ Profile photo URL saved to Firestore');
    } catch (firestoreError) {
      console.warn('Could not save photo URL to Firestore:', firestoreError);
      // Don't fail the entire process if Firestore update fails
    }
    
    showNotification('Profile Photo Updated', 'Your profile photo has been uploaded successfully!');
    
  } catch (error) {
    console.error('❌ Error uploading profile photo:', error);
    
    // Restore original image on error
    const profilePhoto = document.getElementById('profilePhoto');
    if (originalSrc) {
      profilePhoto.src = originalSrc;
    }
    profilePhoto.style.opacity = '1';
    
    // Show appropriate error message
    let errorMessage = 'Failed to upload profile photo. Please try again.';
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'You do not have permission to upload photos.';
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage = 'Storage quota exceeded. Please contact support.';
    } else if (error.message && error.message.includes('Firebase Storage is not configured')) {
      errorMessage = 'Photo upload is currently unavailable. Please contact your administrator to enable Firebase Storage.';
    }
    
    showNotification('Upload Error', errorMessage);
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
  
  try {
    // Check if profile exists in localStorage first
    const savedProfile = localStorage.getItem('studentProfile');
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile);
        
        // Ensure profile is marked as completed when we have valid saved data
        const requiredFields = ['fullName', 'regNumber', 'school', 'batch', 'phone'];
        const isComplete = requiredFields.every(field => 
          profileData[field] && typeof profileData[field] === 'string' && profileData[field].trim() !== ''
        );
        
        if (isComplete && !localStorage.getItem('profileCompleted')) {
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
        }
      }
    } catch (profileError) {
    }
    
    // Fallback to name extracted from email (this should only happen if profile is incomplete)
    const nameFromEmail = extractNameFromEmail(user.email);
    updateWelcomeMessage(nameFromEmail);
    
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

// Calculate overall attendance percentage (uses academically filtered data from Sep 16, 2025)
function calculateOverallAttendance() {
  // Prefer weighted computation by periods if we have it
  // Note: overallTotalPeriods and overallPresentPeriods are already filtered by fetchAttendanceData()
  const totalPeriods = window.overallTotalPeriods || 0;
  const presentPeriods = window.overallPresentPeriods || 0;
  
  if (totalPeriods > 0) {
    return Math.round((presentPeriods / totalPeriods) * 100);
  }
  
  // Fallback to simple average of subject percentages
  const subjectData = window.subjectData || {};
  const attendanceValues = Object.values(subjectData);
  if (attendanceValues.length === 0) return 0;
  const total = attendanceValues.reduce((sum, val) => sum + val, 0);
  return Math.round(total / attendanceValues.length);
}

// Count subjects with low attendance (below 75%)
function countLowAttendanceSubjects() {
  const subjectData = window.subjectData || {};
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
        subjects: window.subjectData || {},
        todayStatus: todayAttendanceStatus,
        generatedOn: typeof formatISTDateTime === 'function' ? formatISTDateTime(new Date()) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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
        
        // Fast QR Security validation (optimized for speed)
        if (window.validateSecureQR && qrData.security) {
            const validationResult = window.validateSecureQR(qrData);
            if (!validationResult.valid) {
                showNotification('Security Check Failed', validationResult.message);
                return;
            }
        }
        
        // Check if QR code has expired (basic validation)
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
    
    // Get student profile data from local storage (existing behavior)
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }

    // EXTRA GUARD: Ensure only students from the QR's school and batch can mark attendance
    // If local profile is missing or incomplete, try fetching from Firestore
    try {
      const needsFetch = !studentProfile || !studentProfile.school || !studentProfile.batch;
      if (needsFetch && auth.currentUser) {
        const profSnap = await db.collection('profiles').doc(auth.currentUser.uid).get();
        if (profSnap.exists) {
          const profData = profSnap.data();
          if (profData && profData.school && profData.batch) {
            studentProfile.school = profData.school;
            studentProfile.batch = profData.batch;
            // Cache back to localStorage to avoid future lookups
            const cached = JSON.parse(localStorage.getItem('studentProfile') || '{}');
            localStorage.setItem('studentProfile', JSON.stringify({ ...cached, school: profData.school, batch: profData.batch }));
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch profile from Firestore for strict QR validation:', e);
    }

    // Normalize and strictly compare school and batch
    const qrSchool = String(qrData.school || '').trim();
    const qrBatch = String(qrData.batch || '').trim();
    const profSchool = String(studentProfile.school || '').trim();
    const profBatch = String(studentProfile.batch || '').trim();

    if (!profSchool || !profBatch) {
      showNotification('Profile Required', 'Complete your profile (school and batch) before scanning the QR.');
      return;
    }

    if (profSchool !== qrSchool) {
      showNotification('Invalid QR Code', 'This QR code is not for your school.');
      return;
    }

    if (profBatch !== qrBatch) {
      showNotification('Invalid QR Code', 'This QR code is not for your batch.');
      return;
    }
    
    // Check if already marked attendance for this specific session
    const today = getISTDateString();
    const attendanceQuery = await db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .where('sessionId', '==', qrData.sessionId) // Check specific session
      .get();
    
    if (!attendanceQuery.empty) {
      showNotification('Already Marked', `Attendance already recorded for this ${qrData.subject} session.`);
      return;
    }
    
    // Create attendance record with session tracking
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
      verificationMethod: 'qr',
      hasPhoto: false,
      sessionId: qrData.sessionId, // Primary session identifier
      classTime: qrData.classTime || null, // Time when class happened
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      markedBy: qrData.facultyId || null,
      generatedAt: qrData.generatedAt || null
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
    
    // Refresh all attendance data with fair calculation (instead of manual simulation)
    if (auth.currentUser) {
      fetchTodayAttendance(auth.currentUser);
      // Trigger fair calculation refresh to get accurate percentages
      await fetchAttendanceData();
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
  
  // Submit photo for faculty verification - use direct Firestore fallback
  try {
    console.log('📸 Starting photo submission process...');
    
    // Get student profile
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    const user = auth.currentUser;
    const today = getISTDateString();
    
    // Use Firestore fallback method directly (more reliable)
    submitPhotoToFirestoreFallback(currentScannedData, capturedPhotoData, studentProfile, user, today)
      .then((docId) => {
        console.log('✅ Photo submission completed successfully:', docId);
      })
      .catch((error) => {
        console.error('❌ Photo submission failed:', error);
        showNotification('Photo Upload Error', 'Failed to submit photo. Please try again.');
      });
      
  } catch (error) {
    console.error('❌ Error in photo submission setup:', error);
    showNotification('Photo Upload Error', 'Failed to setup photo submission. Please try again.');
  }
  
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

// Firestore fallback for photo submission (when Storage is not available)
async function submitPhotoToFirestoreFallback(qrData, photoData, studentProfile, user, today) {
  try {
    console.log('📦 Using Firestore fallback for photo submission...');
    
    // Compress the photo to fit in Firestore (1MB document limit)
    let compressedPhoto = photoData;
    let compressionApplied = false;
    
    // Check photo size and compress if needed
    const photoSizeKB = (photoData.length * 0.75) / 1024; // Base64 is ~75% of actual bytes
    console.log(`📷 Original photo size: ${photoSizeKB.toFixed(2)} KB`);
    
    if (photoSizeKB > 700) { // If larger than 700KB, compress it
      console.log('🗜️ Compressing photo to fit in Firestore...');
      compressedPhoto = await compressImageSimple(photoData, 0.5, 800, 600);
      compressionApplied = true;
      const compressedSizeKB = (compressedPhoto.length * 0.75) / 1024;
      console.log(`✅ Compressed photo size: ${compressedSizeKB.toFixed(2)} KB`);
      
      // If still too large, compress more
      if (compressedSizeKB > 700) {
        console.log('🗜️ Applying stronger compression...');
        compressedPhoto = await compressImageSimple(photoData, 0.3, 600, 450);
        const finalSizeKB = (compressedPhoto.length * 0.75) / 1024;
        console.log(`✅ Final compressed size: ${finalSizeKB.toFixed(2)} KB`);
      }
    }
    
    // Create temporary photo record with compressed photo data
    const tempPhotoData = {
      studentId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      photoTimestamp: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      qrSessionId: qrData.sessionId || null,
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      photoData: compressedPhoto, // Store compressed base64 photo directly
      photoMethod: 'firestore_fallback', // Mark as fallback method
      compressionApplied: compressionApplied,
      originalSize: photoData.length,
      compressedSize: compressedPhoto.length,
      status: 'pending_verification',
      verificationMethod: 'qr_and_photo',
      submittedAt: new Date()
    };
    
    console.log('💾 Saving photo to Firestore tempPhotos collection...');
    
    // Save to temporary photos collection
    const docRef = await db.collection('tempPhotos').add(tempPhotoData);
    console.log('✅ Photo saved to Firestore with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      '📸 Photo Submitted!',
      `Your photo for ${qrData.subject} has been submitted for faculty verification (using fallback storage).`
    );
    
    // Add to local notifications
    addNotification(
      'info',
      `📸 Photo submitted for ${qrData.subject} - ${qrData.periods} periods (awaiting verification)`,
      'Just now'
    );
    
    // Clear the scanned data
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    console.log('✅ Photo submission completed using Firestore fallback');
    
    return docRef.id;
    
  } catch (error) {
    console.error('❌ Firestore fallback failed:', error);
    throw error;
  }
}

// Simple image compression function
async function compressImageSimple(dataURL, quality = 0.5, maxWidth = 800, maxHeight = 600) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let { width, height } = img;
      
      // Resize if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Return compressed image
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataURL;
  });
}

// Helper function to convert data URL to blob
function dataURLToBlob(dataURL) {
  try {
    // Split the data URL to get the base64 data
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while(n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  } catch (error) {
    console.error('Error converting data URL to blob:', error);
    return null;
  }
}

// Submit photo for faculty verification (new workflow with Firebase Storage)
async function submitPhotoForVerification(qrData, photoData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    console.log('📸 Starting photo verification submission...');
    
    // Get student profile data from local storage
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
    
    // Check if already submitted photo for this session
    const today = getISTDateString();
    // Use a simple query to avoid index/undefined issues
    const baseQuerySnap = await db.collection('tempPhotos')
      .where('studentId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .get();
    
    // Client-side filter by session if available
    const alreadySubmitted = baseQuerySnap.docs.some(d => {
      const data = d.data();
      return !qrData.sessionId || data.qrSessionId === (qrData.sessionId || null);
    });
    
    if (alreadySubmitted) {
      showNotification('Photo Already Submitted', `Your photo for ${qrData.subject} has already been submitted for verification.`);
      return;
    }
    
    // Convert base64 to blob for Firebase Storage upload
    console.log('🔄 Converting photo data for storage...');
    const photoBlob = dataURLToBlob(photoData);
    
    if (!photoBlob) {
      throw new Error('Failed to convert photo data');
    }
    
    // Generate unique photo filename
    const timestamp = Date.now();
    const photoFileName = `temp_photos/${user.uid}/${today}/${qrData.subject}_${timestamp}.jpg`;
    
    console.log('☁️ Uploading photo to Firebase Storage...', photoFileName);
    
    // Check if Firebase Storage is available
    if (!storage) {
      console.warn('Firebase Storage not available, using Firestore fallback');
      // Instead of throwing error, directly use Firestore fallback
      return submitPhotoToFirestoreFallback(qrData, photoData, studentProfile, user, today);
    }
    
    // Upload photo to Firebase Storage
    const storageRef = storage.ref().child(photoFileName);
    const uploadTask = await storageRef.put(photoBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        studentId: user.uid,
        subject: qrData.subject,
        date: today,
        sessionId: qrData.sessionId || 'unknown'
      }
    });
    
    // Get download URL for the uploaded photo
    const photoURL = await uploadTask.ref.getDownloadURL();
    console.log('✅ Photo uploaded successfully:', photoURL);
    
    // Create temporary photo record for faculty verification (without embedding photo data)
    const tempPhotoData = {
      studentId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      photoTimestamp: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      qrSessionId: qrData.sessionId || null,
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      photoURL: photoURL, // Store Firebase Storage URL instead of base64 data
      photoFileName: photoFileName, // Store filename for potential cleanup
      status: 'pending_verification', // Will be changed to 'approved' or 'rejected' by faculty
      verificationMethod: 'qr_and_photo',
      submittedAt: new Date()
    };
    
    console.log('💾 Saving photo verification record to Firestore...');
    
    // Save to temporary photos collection
    const docRef = await db.collection('tempPhotos').add(tempPhotoData);
    console.log('✅ Photo verification record saved with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      '📸 Photo Submitted!',
      `Your photo for ${qrData.subject} has been submitted for faculty verification. Attendance will be marked after approval.`
    );
    
    // Add to local notifications
    addNotification(
      'info',
      `📸 Photo submitted for ${qrData.subject} - ${qrData.periods} periods (awaiting verification)`,
      'Just now'
    );
    
    // Don't update attendance charts yet - wait for faculty approval
    // Don't mark as present immediately - this will happen after faculty verification
    
    // Clear the scanned data and localStorage backup
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    console.log('✅ QR data cleared after photo submission');
    
  } catch (error) {
    console.error('❌ Error submitting photo for verification:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Debug: Check Firebase Storage availability
    console.error('🔍 Firebase Storage Debug:', {
      storageAvailable: typeof storage !== 'undefined',
      storageObject: storage,
      firebaseApp: typeof firebase !== 'undefined',
      authUser: auth?.currentUser?.uid || 'No user'
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit photo for verification. Please try again.';
    let debugInfo = '';
    
    // Check for specific Firebase Storage errors
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'You do not have permission to upload photos. Please contact support.';
      debugInfo = 'Storage rules may not be deployed correctly.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Photo upload was cancelled. Please try again.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'Unknown error occurred while uploading photo. Please check your internet connection.';
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage = 'Storage quota exceeded. Please contact support.';
    } else if (error.message && error.message.includes('Firebase Storage is not configured')) {
      errorMessage = 'Photo upload is currently unavailable. Firebase Storage needs to be enabled. Please contact your administrator.';
      debugInfo = 'Firebase Storage service is not enabled in the console.';
    } else if (error.message && error.message.includes('convert')) {
      errorMessage = 'Failed to process photo data. Please take the photo again.';
    } else if (error.code === 'storage/object-not-found') {
      errorMessage = 'Storage bucket not found. Please contact support.';
      debugInfo = 'Firebase Storage bucket may not be created.';
    } else if (error.message && error.message.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (!storage) {
      errorMessage = 'Firebase Storage is not initialized. Please refresh the page and try again.';
      debugInfo = 'Storage object is undefined - Firebase Storage may not be enabled.';
    }
    
    showNotification('Photo Upload Error', errorMessage + (debugInfo ? '\n\nDebug: ' + debugInfo : ''));
    
    // Log additional debug information
    console.error('🔍 Additional Debug Info:', {
      errorMessage,
      debugInfo,
      currentUser: auth?.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email
      } : 'Not logged in',
      qrData: currentScannedData ? {
        school: currentScannedData.school,
        batch: currentScannedData.batch,
        subject: currentScannedData.subject
      } : 'No QR data',
      photoDataLength: capturedPhotoData ? capturedPhotoData.length : 0
    });
  }
}

// Keep the old function for backward compatibility but mark as deprecated
// Mark attendance with photo verification (DEPRECATED - use submitPhotoForVerification instead)
async function markAttendanceWithPhoto(qrData, photoData) {
  console.warn('markAttendanceWithPhoto is deprecated. Using new photo verification workflow.');
  return await submitPhotoForVerification(qrData, photoData);
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