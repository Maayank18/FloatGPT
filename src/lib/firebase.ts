import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjeNWb9N0Bth818sfSvH-QmXiWxS9gf6Q",
  authDomain: "floatgpt-c1d8a.firebaseapp.com",
  projectId: "floatgpt-c1d8a",
  storageBucket: "floatgpt-c1d8a.firebasestorage.app",
  messagingSenderId: "103673985297",
  appId: "1:103673985297:web:a79c6e8f39eabeece734b0",
  measurementId: "G-DJ80KHPFMQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
};
