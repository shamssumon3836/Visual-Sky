import { initializeApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  const scheduleTest = () => setTimeout(() => { void testConnection(); }, 5000);
  if (document.readyState === 'complete') {
    scheduleTest();
  } else {
    window.addEventListener('load', scheduleTest, { once: true });
  }
}
