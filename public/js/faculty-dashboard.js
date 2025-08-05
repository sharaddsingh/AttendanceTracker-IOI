/*
==================================================
FACULTY DASHBOARD JAVASCRIPT
==================================================
Author: Attendance Tracker System
Description: Comprehensive functionality for faculty dashboard
Last Updated: 2024
==================================================
*/

/*
==================================================
FACULTY DASHBOARD JAVASCRIPT - CLEANED VERSION
==================================================
*/

function initializeFacultyDashboard() {
  loadFacultyProfile();
  setUpEventListeners();
}

function loadFacultyProfile() {
  const user = auth.currentUser;
  console.log("Loading faculty profile for:", user.email);
  // Note: Profile summary section has been removed from the dashboard
}

function setUpEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', logout);
  // Add more event listeners as needed
}

function generateAttendanceQR() {
  // Show QR section
  document.getElementById('qrSection').style.display = 'block';
}

function generateQRCode() {
  const subject = document.getElementById('subjectSelect').value;
  const sessionDate = document.getElementById('sessionDate').value;
  const sessionTime = document.getElementById('sessionTime').value;
  const duration = document.getElementById('duration').value;

  const qrContent = `${subject} - ${sessionDate} ${sessionTime} for ${duration} minutes`;
  const qrcodeContainer = document.getElementById('qrcode');

  QRCode.toCanvas(qrcodeContainer, qrContent, function (error) {
    if (error) console.error(error);
    console.log('QR Code generated successfully!');
    document.getElementById('qrDisplay').style.display = 'block';
    document.getElementById('qrSubject').innerText = subject;
    document.getElementById('qrDate').innerText = sessionDate;
    document.getElementById('qrTime').innerText = sessionTime;
    document.getElementById('qrDuration').innerText = duration;
  });
}

function logout() {
  auth.signOut().then(() => {
    console.log('Signed out successfully');
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error('Sign out error:', error);
  });
}

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('Faculty user authenticated:', user.email);
    initializeFacultyDashboard();
  } else {
    console.log('No faculty user signed in. Redirecting to login.');
    window.location.href = 'index.html';
  }
});

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Faculty dashboard DOM loaded');
});

// Initialize dashboard when window loads
window.onload = function() {
  console.log('Faculty dashboard window loaded');
};
