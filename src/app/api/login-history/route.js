import { NextResponse } from 'next/server';
import { addLoginEvent, getLoginHistory } from '@/lib/db';

export async function GET() {
  try {
    const history = await getLoginHistory(200);
    return NextResponse.json(history);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const event = {
      id: Date.now().toString(),
      nome: body.nome || 'Desconhecido',
      role: body.role || 'unknown',
      timestamp: body.timestamp || new Date().toISOString(),
    };
    await addLoginEvent(event);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
