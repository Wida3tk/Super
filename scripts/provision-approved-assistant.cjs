// A single explicitly approved account. No HTTP endpoint or reusable admin bypass.
// Completed requests never restore revoked access or change an administrator's edits.
const requestId = 'ehamdan-2026-11-18';
const email = 'ehamdan@sulukera.com';
const name = 'إيمان حمدان';
const uid = 'approved_assistant_ehamdan_20261118';

async function provision({ auth, db, sendReset }) {
  const marker = db.collection('assistantProvisioningRequests').doc(requestId);
  const prior = await marker.get();
  if (prior.exists && prior.data().accountCreated) {
    if (!prior.data().resetEmailAccepted) {
      await sendReset(email);
      await marker.update({ resetEmailAccepted: true });
    }
    return 'already-created';
  }
  for (const collection of ['trainees', 'supervisors']) {
    if (!(await db.collection(collection).where('email', '==', email).limit(1).get()).empty)
      throw new Error('APPROVED_EMAIL_ALREADY_HAS_ANOTHER_ROLE');
  }
  if (!prior.exists) await marker.create({ email, uid, requestedAt: new Date().toISOString(), accountCreated: false });
  else if (prior.data().email !== email || prior.data().uid !== uid) throw new Error('PROVISIONING_IDENTITY_MISMATCH');
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  if (user && user.uid !== uid) throw new Error('APPROVED_EMAIL_ALREADY_EXISTS');
  if (!user) user = await auth.createUser({ uid, email, displayName: name });
  if (user.disabled) throw new Error('APPROVED_ACCOUNT_DISABLED_REQUIRES_ADMIN_REVIEW');
  const staffRef = db.collection('administrativeAssistants').doc(uid);
  if ((await staffRef.get()).exists) throw new Error('EXISTING_STAFF_REQUIRES_ADMIN_REVIEW');
  await auth.setCustomUserClaims(uid, { role: 'administrative_assistant' });
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.create(staffRef, { name, email, role: 'administrative_assistant', active: true, scope: 'all', supervisorIds: [], createdAt: now, createdBy: 'approved-production-provisioning', provisioningRequestId: requestId });
  batch.create(db.collection('activityLog').doc(), { type: 'assistant_created', actorId: 'approved-production-provisioning', message: 'إنشاء حساب مساعد إداري بموافقة الإدارة', createdAt: now, meta: { assistantId: uid, scope: 'all', supervisorIds: [], provisioningRequestId: requestId } });
  batch.update(marker, { accountCreated: true, createdAt: now, resetEmailAccepted: false });
  await batch.commit();
  await sendReset(email);
  await marker.update({ resetEmailAccepted: true });
  return 'created';
}

async function main() {
  if (process.env.VERCEL_ENV !== 'production') { console.log('Approved assistant provisioning: skipped outside production.'); return; }
  const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (projectId !== 'sulukerabooking') throw new Error('UNEXPECTED_PRODUCTION_PROJECT');
  const privateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8').trim()
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const app = initializeApp({ projectId, credential: privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault() }, 'approved-assistant-provisioning');
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDC5IJuM7Y0Sz1ADYyLuDIx4OAGahqJ5vY';
  // Match src/lib/firebase/admin.ts: the live database is named "default",
  // which is distinct from Firestore's implicit "(default)" database.
  const result = await provision({ auth: getAuth(app), db: getFirestore(app, 'default'), sendReset: async (address) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: address }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`RESET_EMAIL_FAILED_${response.status}`);
  } });
  console.log(`Approved assistant provisioning: ${result}; password setup email accepted.`);
}

module.exports = { provision };
if (require.main === module) main().catch(error => {
  // Avoid printing SDK errors that may contain credentials or reset links.
  console.error('Approved assistant provisioning failed:', /^[A-Z_0-9]+$/.test(error.message) ? error.message : error.code || 'PROVISIONING_FAILED');
  process.exitCode = 1;
});
