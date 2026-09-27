import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGooglePopup(preferredRole: 'client' | 'agency' = 'client'): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  if (user && user.email) {
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const isAdminEmail =
      user.email.toLowerCase() === 'rafiqulvisualsky@gmail.com' ||
      user.email.toLowerCase() === 'sojibdaridro123@gmail.com';
    const resolvedRole: 'client' | 'agency' = isAdminEmail ? 'agency' : 'client';
    const cleanName = (user.displayName || user.email.split('@')[0]).slice(0, 120);
    const cleanEmail = user.email.slice(0, 254);
    const cleanAvatar = (user.photoURL || '').slice(0, 1024);

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const profilePayload: Record<string, any> = {
          uid: user.uid.slice(0, 128),
          email: cleanEmail,
          name: cleanName,
          role: resolvedRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (cleanAvatar) {
          profilePayload.avatar = cleanAvatar;
        }
        try {
          await setDoc(userRef, profilePayload);
        } catch (writeErr: any) {
          if (String(writeErr?.message || '').includes('Missing or insufficient permissions')) {
            handleFirestoreError(writeErr, OperationType.CREATE, userPath);
          }
        }
      }
    } catch (readErr: any) {
      if (String(readErr?.message || '').includes('Missing or insufficient permissions')) {
        handleFirestoreError(readErr, OperationType.GET, userPath);
      }
    }
  }

  return user;
}

export async function signOutFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch {}
}
