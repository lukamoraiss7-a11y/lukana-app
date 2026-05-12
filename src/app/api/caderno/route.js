import { NextResponse } from 'next/server';
import { getCaderno, saveCaderno } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getCaderno());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = await getCaderno();
    if (items.find((i) => i.id === body.id)) {
      return NextResponse.json({ error: 'Projeto já está no Caderno Técnico' }, { status: 409 });
    }
    const newItem = {
      id: body.id,
      nome: body.nome,
      ambientes: body.ambientes || [],
      status: 'em_execucao',
      responsaveis: [],
      data_inicio: new Date().toISOString().slice(0, 10),
      prazo: body.prazo || null,
      observacoes: '',
      historico: [{ status: 'em_execucao', data: new Date().toISOString(), obs: 'Adicionado ao Caderno Técnico' }],
      enviado_em: new Date().toISOString(),
    };
    await saveCaderno([...items, newItem]);
    return NextResponse.json({ ok: true, item: newItem });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, obs_historico, ...updates } = body;
    const items = await getCaderno();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    const prev = items[idx];
    const updated = { ...prev, ...updates };
    if (updates.status && updates.status !== prev.status) {
      updated.historico = [
        ...(prev.historico || []),
        { status: updates.status, data: new Date().toISOString(), obs: obs_historico || '' },
      ];
    }
    items[idx] = updated;
    await saveCaderno(items);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const items = await getCaderno();
    await saveCaderno(items.filter((i) => i.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
