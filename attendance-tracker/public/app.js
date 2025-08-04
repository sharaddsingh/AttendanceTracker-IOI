// Firebase Config & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Replace with your config
const firebaseConfig = {
  apiKey: "AIzaSyAJAl0Y-vtu-edqDBiOUWZHLRuPpg2W7AY",
  authDomain: "attendancetracker-f8461.firebaseapp.com",
  projectId: "attendancetracker-f8461"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

// Handle login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  message.textContent = "Logging in...";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      await signOut(auth);
      message.textContent = "Email not verified. Verification link sent.";
      await user.sendEmailVerification();
      return;
    }

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      message.textContent = "User record not found in database.";
      await signOut(auth);
      return;
    }

    const role = docSnap.data().role;

    if (role === "student") {
      window.location.href = "student-dashboard.html";
    } else if (role === "faculty") {
      window.location.href = "faculty-dashboard.html";
    } else {
      message.textContent = "Invalid role.";
      await signOut(auth);
    }
  } catch (error) {
    console.error(error);
    message.textContent = "Login failed: " + error.message;
  }
});
