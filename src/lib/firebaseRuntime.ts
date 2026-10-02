import { initializeApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let cachedAuth: Auth | null = null;

export async function signInWithGooglePopup(_portalType?: 'client' | 'agency'): Promise<User> {
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
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

export { doc, getDoc, getDocFromServer, setDoc, onSnapshot };
