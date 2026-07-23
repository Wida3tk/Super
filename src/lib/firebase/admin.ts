import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
  });
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp, 'default');
export const adminAuth = getAuth(adminApp);
export { adminApp };
