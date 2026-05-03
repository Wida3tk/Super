// scripts/seed.ts
// تشغيل: npx ts-node scripts/seed.ts
// لإضافة بيانات تجريبية أولية

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

const SAMPLE_SUPERVISORS = [
  {
    name: 'د. أحمد الزهراني',
    email: 'ahmed.zahrani@university.edu',
    photo: '',
    bio: 'أستاذ مشارك في قسم علم الحاسب، متخصص في الذكاء الاصطناعي وتعلم الآلة. أشرف على أكثر من 50 رسالة ماجستير ودكتوراه.',
    totalSessions: 48,
    ratingAverage: 4.8,
    isActive: true,
  },
  {
    name: 'د. سارة المطيري',
    email: 'sarah.mutairi@university.edu',
    photo: '',
    bio: 'دكتوراه في إدارة الأعمال من جامعة LSE. متخصصة في ريادة الأعمال والتحول الرقمي للمنشآت الصغيرة والمتوسطة.',
    totalSessions: 32,
    ratingAverage: 4.6,
    isActive: true,
  },
  {
    name: 'د. عمر الغامدي',
    email: 'omar.ghamdi@university.edu',
    photo: '',
    bio: 'خبير في مجال البيانات الضخمة وتحليل البيانات. مستشار لعدد من الشركات التقنية في المنطقة.',
    totalSessions: 27,
    ratingAverage: 4.5,
    isActive: true,
  },
];

async function seed() {
  console.log('🌱 بدء إضافة البيانات التجريبية...');

  const batch = db.batch();

  for (const supervisor of SAMPLE_SUPERVISORS) {
    const ref = db.collection('supervisors').doc();
    batch.set(ref, supervisor);
    console.log(`  ✓ مشرف: ${supervisor.name}`);
  }

  await batch.commit();
  console.log('✅ تمت إضافة البيانات بنجاح!');
  process.exit(0);
}

seed().catch(console.error);
