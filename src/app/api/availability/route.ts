import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const snap = await adminDb.collection('availability').get();
    
    const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return NextResponse.json({ 
      total: all.length,
      slots: all
    });
  } catch (error) {
    return NextResponse.json({ 
      error: String(error),
      slots: [] 
    });
  }
}
