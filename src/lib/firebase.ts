import type { User } from 'firebase/auth';

export interface FirebaseRuntimeModule {
  db: any;
  doc: (...args: any[]) => any;
  getDoc: (ref: any) => Promise<any>;
  setDoc: (ref: any, data: any, options?: any) => Promise<void>;
  onSnapshot: (ref: any, onNext: (snap: any) => void, onError?: (err: any) => void) => () => void;
  getDocFromServer: (ref: any) => Promise<any>;
  signInWithGooglePopup: (_portalType?: 'client' | 'agency') => Promise<User>;
}

let runtimePromise: Promise<FirebaseRuntimeModule | null> | null = null;

export function getFirebaseRuntime(): Promise<FirebaseRuntimeModule | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  if (!runtimePromise) {
    const runtimeUrl = '/prebuilt/firebase-runtime.js';
    runtimePromise = import(/* @vite-ignore */ runtimeUrl)
      .then((mod: any) => (mod && mod.db ? (mod as FirebaseRuntimeModule) : null))
      .catch(() => null);
  }
  return runtimePromise;
}

export async function signInWithGooglePopup(portalType?: 'client' | 'agency'): Promise<User> {
  const rt = await getFirebaseRuntime();
  if (!rt || typeof rt.signInWithGooglePopup !== 'function') {
    throw new Error('Firebase authentication runtime is still initializing. Please try again.');
  }
  return rt.signInWithGooglePopup(portalType);
}

// Warm up Firebase runtime in background after initial page paint so first render is never blocked
if (typeof window !== 'undefined') {
  const warmUp = () => {
    setTimeout(() => {
      void getFirebaseRuntime();
    }, 600);
  };
  if (document.readyState === 'complete') {
    warmUp();
  } else {
    window.addEventListener('load', warmUp, { once: true });
  }
}
