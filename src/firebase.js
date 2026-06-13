import { initializeApp } from "firebase/app";

import {
  getAuth
} from "firebase/auth";

import {
  getFirestore
} from "firebase/firestore";

import {
  getStorage
} from "firebase/storage";

import {
  getMessaging,
  isSupported as messagingIsSupported,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDRe5VC2gPrpNn07c6x8BH3VLlXhaO-ICk",
  authDomain: "habi-3e0a6.firebaseapp.com",
  projectId: "habi-3e0a6",
  storageBucket: "habi-3e0a6.firebasestorage.app",
  messagingSenderId: "1056100831110",
  appId: "1:1056100831110:web:a9661ea3dcbd6c3a92a607",
  measurementId: "G-TYW4JSGSLH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);

// getMessaging() throws in unsupported browsers (old Safari, Firefox without push).
// Initialise lazily so a failure here doesn't break the whole app.
export let messaging = null;
messagingIsSupported().then((ok) => {
  if (ok) messaging = getMessaging(app);
}).catch(() => {});

export default app;