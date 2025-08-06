/*
==================================================
FACULTY DASHBOARD JAVASCRIPT - DYNAMIC UPDATE
==================================================
*/

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Firebase auth listener
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('Faculty user authenticated:', user.email);
            initializeFacultyDashboard();
        } else {
            console.log('No faculty user signed in. Redirecting to login.');
            window.location.href = 'index.html';
        }
    });
});

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
 */
function loadLeaveRequests() {
    const db = firebase.firestore();
    const listContainer = document.getElementById('leaveRequestsList');
    const noRequestsMsg = document.getElementById('no-leave-requests');

    db.collection('leaveRequests').where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                listContainer.innerHTML = ''; // Clear old requests
                noRequestsMsg.style.display = 'block';
                return;
            }

            noRequestsMsg.style.display = 'none';
            listContainer.innerHTML = ''; // Clear list before re-rendering
            snapshot.forEach(doc => {
                const request = doc.data();
                const requestId = doc.id;

                const item = document.createElement('div');
                item.className = 'leave-request-item pending';
                item.innerHTML = `
                    <div class="leave-info">
                        <h4>${request.studentName || 'Unknown Student'} (${request.regNumber || 'N/A'})</h4>
                        <p><strong>Subject:</strong> ${request.subject}</p>
                        <p><strong>Date:</strong> ${request.date}</p>
                        <p><strong>Reason:</strong> ${request.reason || 'No reason provided.'}</p>
                    </div>
                    <div class="leave-actions">
                        <button class="approve-btn" onclick="approveLeave('${requestId}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="reject-btn" onclick="rejectLeave('${requestId}')">
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

/**
 * Approves a leave request by updating its status in Firestore.
 * @param {string} requestId - The document ID of the leave request.
 */
function approveLeave(requestId) {
    const db = firebase.firestore();
    db.collection('leaveRequests').doc(requestId).update({
        status: 'approved'
    }).then(() => {
        console.log(`Request ${requestId} approved.`);
        alert('Leave request approved!');
    }).catch(error => console.error("Error approving request: ", error));
}

/**
 * Rejects a leave request by updating its status in Firestore.
 * @param {string} requestId - The document ID of the leave request.
 */
function rejectLeave(requestId) {
    const db = firebase.firestore();
    db.collection('leaveRequests').doc(requestId).update({
        status: 'rejected'
    }).then(() => {
        console.log(`Request ${requestId} rejected.`);
        alert('Leave request rejected.');
    }).catch(error => console.error("Error rejecting request: ", error));
}

/**
 * Generates and displays a QR code for attendance.
 */
function generateQRCode() {
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