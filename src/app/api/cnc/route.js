import { NextResponse } from 'next/server';
import { todayCncEntries, addCncEntry } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await todayCncEntries());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.maquina || !data.peca || !data.operador) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });
    }
    await addCncEntry({
      ...data,
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
