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
    const event = {
      id: Date.now().toString(),
      nome: body.nome || 'Desconhecido',
      role: body.role || 'unknown',
      timestamp: body.timestamp || new Date().toISOString(),
    };
    await addLoginEvent(event);
    // Atualizar atividade do usuário
    await updateUserActivity(event.id, event.nome, event.role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
