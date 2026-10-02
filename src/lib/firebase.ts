import type { User } from 'firebase/auth';

type FirebaseRuntimeModule = typeof import('./firebaseRuntime');

let runtimePromise: Promise<FirebaseRuntimeModule> | null = null;

export function getFirebaseRuntime(): Promise<FirebaseRuntimeModule> {
  if (!runtimePromise) {
    if (import.meta.env.PROD) {
      const runtimeUrl = '/prebuilt/firebase-runtime.js';
      runtimePromise = import(/* @vite-ignore */ runtimeUrl) as Promise<FirebaseRuntimeModule>;
    } else {
      runtimePromise = import('./firebaseRuntime');
    }
  }
  return runtimePromise;
}

export async function signInWithGooglePopup(portalType?: 'client' | 'agency'): Promise<User> {
  const rt = await getFirebaseRuntime();
  return rt.signInWithGooglePopup(portalType);
}
