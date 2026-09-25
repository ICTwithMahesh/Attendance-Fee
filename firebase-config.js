// ============================================================
// STEP 1: Replace the values below with YOUR Firebase project's
// config. Get this from:
// Firebase Console -> Project Settings -> General -> Your apps
// -> SDK setup and configuration -> "Config"
// ============================================================

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCCICV4aqgdmnR0S8SKow8g_jqlD2_bbfE",
  authDomain: "my-class-manager-5fa69.firebaseapp.com",
  projectId: "my-class-manager-5fa69",
  storageBucket: "my-class-manager-5fa69.firebasestorage.app",
  messagingSenderId: "151435245146",
  appId: "1:151435245146:web:a1a687cc5d3dbf31c68a63",
  measurementId: "G-XTSE5J5M01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
