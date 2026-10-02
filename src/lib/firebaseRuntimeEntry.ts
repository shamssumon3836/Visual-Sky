import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth, type User } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

let cachedAuth: Auth | null = null;

export async function signInWithGooglePopup(_portalType?: 'client' | 'agency'): Promise<User> {
  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(cachedAuth, googleProvider);
  return result.user;
}

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      { ignoreUndefinedProperties: true },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

export { doc, getDoc, setDoc, onSnapshot, getDocFromServer };
