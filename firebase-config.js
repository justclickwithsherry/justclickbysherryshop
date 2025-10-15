// Centralized Firebase Configuration
// This file manages all Firebase initialization and exports the necessary instances

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBs74HoIeuFoXE0G_mdD2eNBDsucuAEQCA",
  authDomain: "justclickshop-8081b.firebaseapp.com",
  projectId: "justclickshop-8081b",
  storageBucket: "justclickshop-8081b.firebasestorage.app",
  messagingSenderId: "623998776057",
  appId: "1:623998776057:web:f488332b7b49bbc3f5a828",
  measurementId: "G-DTDJ1CGMWB"
};

// Initialize Firebase App (only once)
let firebaseApp = null;
let firestoreDb = null;

// Initialize Firebase and return the app instance
async function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    firebaseApp = initializeApp(firebaseConfig);
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

// Initialize Firestore and return the database instance
async function initializeFirestore() {
  if (firestoreDb) return firestoreDb;
  
  try {
    const app = await initializeFirebase();
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    firestoreDb = getFirestore(app);
    return firestoreDb;
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw error;
  }
}

// Get Firebase helpers (collection, addDoc, etc.)
async function getFirebaseHelpers() {
  if (window.__fb && firebaseApp && firestoreDb) return window.__fb;
  
  try {
    const app = await initializeFirebase();
    const db = await initializeFirestore();
    
    const [
      { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, setDoc, deleteDoc, query, orderBy, onSnapshot }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);
    
    window.__fb = { 
      collection, 
      addDoc, 
      serverTimestamp, 
      doc, 
      updateDoc, 
      getDocs, 
      setDoc, 
      deleteDoc, 
      query, 
      orderBy, 
      onSnapshot 
    };
    
    return window.__fb;
  } catch (error) {
    console.error('Failed to load Firebase modules:', error);
    throw error;
  }
}

// Export the configuration and helper functions
export { firebaseConfig, initializeFirebase, initializeFirestore, getFirebaseHelpers };

// For backward compatibility, also set window.FIREBASE_CONFIG
window.FIREBASE_CONFIG = firebaseConfig;
