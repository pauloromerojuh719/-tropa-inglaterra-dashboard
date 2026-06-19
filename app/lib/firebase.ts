import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDD1dABIvOVWJ--43YbuwHcEfJMHa2TrfA",
  authDomain: "tropa-da-inglaterra-704e4.firebaseapp.com",
  projectId: "tropa-da-inglaterra-704e4",
  storageBucket: "tropa-da-inglaterra-704e4.firebasestorage.app",
  messagingSenderId: "57878298848",
  appId: "1:57878298848:web:22d1d93d07cdf5e379d085",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);