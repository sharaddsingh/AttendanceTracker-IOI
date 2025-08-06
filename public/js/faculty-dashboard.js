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
        
        // Save to Firestore
        await db.collection('faculty').doc(currentFaculty.uid).set(profileData);
        
        // Update user document as well
        await db.collection('users').doc(currentFaculty.uid).update({
            profileCompleted: true,
            fullName: fullName,
            updatedAt: new Date()
        });
        
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
        alert('Error saving profile. Please try again.');
    }
}

/**
 * Show faculty welcome message
 * @param {Object} profileData - Faculty profile data
 */
function showFacultyWelcome(profileData) {
    const header = document.querySelector('.header div:first-child');
    
    // Create welcome message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'faculty-welcome';
    welcomeDiv.innerHTML = `
        <h4><i class="fas fa-user-check"></i> Welcome, ${profileData.fullName}!</h4>
        <p>Department(s): ${profileData.departments ? profileData.departments.join(', ') : profileData.department || 'N/A'} | Subjects: ${profileData.subjects.join(', ')}</p>
    `;
    
    // Insert after the main title
    header.appendChild(welcomeDiv);
}

/**
 * Populate QR generation subject options with faculty's subjects
 * @param {Array} subjects - Array of subjects the faculty teaches
 */
function populateSubjectOptions(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    
    // Clear existing options except the first one
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    
    // Add faculty's subjects
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectSelect.appendChild(option);
    });
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
