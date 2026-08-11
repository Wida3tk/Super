import type { App } from 'firebase-admin/app';

// Use the CommonJS entry points on the server. Vercel's external ESM loader can
// otherwise rewrite firebase-admin to a deployment-specific package name that
// is unavailable when the function starts.
const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app') as typeof import('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage') as typeof import('firebase-admin/storage');

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const base64Key = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const plainKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const privateKey = base64Key
    ? Buffer.from(base64Key, 'base64').toString('utf8')
    : plainKey;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const credential =
    projectId && clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault();

  return initializeApp({
    credential,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim() || (projectId ? `${projectId}.firebasestorage.app` : undefined),
  });
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp, 'default');
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
export { adminApp };
