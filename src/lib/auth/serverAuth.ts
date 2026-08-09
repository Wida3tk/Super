import 'server-only';

import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface AuthenticatedSupervisor {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface AuthenticatedTrainee {
  id: string;
  name: string;
  email: string;
  currentSupervisorId?: string;
  status: string;
  [key: string]: unknown;
}

export async function getSessionUser(): Promise<DecodedIdToken | null> {
  const sessionCookie = (await cookies()).get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<DecodedIdToken | null> {
  const user = await getSessionUser();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!user || !adminEmail || user.email?.trim().toLowerCase() !== adminEmail) {
    return null;
  }

  return user;
}

export async function getAuthenticatedSupervisor(): Promise<AuthenticatedSupervisor | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const byUid = await adminDb.collection('supervisors').doc(user.uid).get();
  if (byUid.exists) {
    const data = byUid.data() as Omit<AuthenticatedSupervisor, 'id'>;
    if (data.isActive === false) return null;
    return { id: byUid.id, ...data } as AuthenticatedSupervisor;
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const byEmail = await adminDb
    .collection('supervisors')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (byEmail.empty) return null;
  const doc = byEmail.docs[0];
  const data = doc.data() as Omit<AuthenticatedSupervisor, 'id'>;
  if (data.isActive === false) return null;
  return { id: doc.id, ...data } as AuthenticatedSupervisor;
}

export async function getAuthenticatedTrainee(): Promise<AuthenticatedTrainee | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const byUid = await adminDb.collection('trainees').where('authUid', '==', user.uid).limit(1).get();
  if (!byUid.empty) {
    const doc = byUid.docs[0];
    return { id: doc.id, ...doc.data() } as AuthenticatedTrainee;
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  const byEmail = await adminDb.collection('trainees').where('email', '==', email).limit(1).get();
  if (byEmail.empty) return null;
  const doc = byEmail.docs[0];
  return { id: doc.id, ...doc.data() } as AuthenticatedTrainee;
}
