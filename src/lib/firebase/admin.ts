import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const raw = process.env.FIREBASE_PRIVATE_KEY || '';
  
  // تنظيف الـ key من أي علامات اقتباس أو مسافات زيادة
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  
  // تحويل \n النصية لأسطر حقيقية
  const privateKey = cleaned.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey,
    }),
  });
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };
