import { NextResponse } from 'next/server';
import { updateUserActivity, getActiveUsers, clearUserActivity } from '@/lib/db';

// Roles com apenas 1 pessoa — chave é o próprio role (sem nome livre variando)
const SINGLE_PERSON_ROLES = new Set([
  'gerente', 'coordenador_obra', 'coordenador_projetos',
  'encarregado', 'diretor', 'ariel',
]);

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
    // Roles únicos: chave = role apenas (1 entrada por cargo)
    // Outros (marceneiro, montador, auxiliar, cnc): chave = role + primeiro nome normalizado
    const stableKey = SINGLE_PERSON_ROLES.has(role)
      ? role
      : `${role}_${nome.split(' ')[0].toLowerCase()}`;
    await updateUserActivity(stableKey, nome, role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearUserActivity();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
