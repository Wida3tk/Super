import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId');
  const date = searchParams.get('date');

  // بيانات تجريبية مؤقتة
  const mockSlots = [
    { id: '1', supervisorId: '5nyuVW6fS1eOx3m5ryOO', date: '2026-05-10', time: '09:00', isBooked: false },
    { id: '2', supervisorId: '5nyuVW6fS1eOx3m5ryOO', date: '2026-05-10', time: '09:30', isBooked: false },
    { id: '3', supervisorId: '5nyuVW6fS1eOx3m5ryOO', date: '2026-05-10', time: '10:00', isBooked: false },
  ];

  const slots = mockSlots.filter(s => s.supervisorId === supervisorId && s.date === date);

  return NextResponse.json({ slots });
}
