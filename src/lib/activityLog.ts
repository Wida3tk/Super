import { adminDb } from '@/lib/firebase/admin';

export async function logActivity({
  type,
  message,
  actorId,
  actorName,
  supervisorId,
  traineeId,
  meta,
}: {
  type: string;
  message: string;
  actorId?: string;
  actorName?: string;
  supervisorId?: string;
  traineeId?: string;
  meta?: Record<string, any>;
}) {
  try {
    await adminDb.collection('activityLog').add({
      type,
      message,
      actorId: actorId || null,
      actorName: actorName || null,
      supervisorId: supervisorId || null,
      traineeId: traineeId || null,
      meta: meta || {},
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('activityLog error:', e);
  }
}
