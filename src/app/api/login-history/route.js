import { NextResponse } from 'next/server';
import { addLoginEvent, getLoginHistory, updateUserActivity, getActiveUsers } from '@/lib/db';

export async function GET() {
  try {
    const users = await getActiveUsers(300); // 5 minutos
    return NextResponse.json(users);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nome = body.nome || 'Desconhecido';
    const role = body.role || 'unknown';
    // Chave estável: não cria duplicatas — upsert por role+nome
    const stableKey = `${role}_${nome.toLowerCase().replace(/\s+/g, '_')}`;
    await updateUserActivity(stableKey, nome, role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
