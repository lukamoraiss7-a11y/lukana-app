import { NextResponse } from 'next/server';
import { getGestaoEscritorio, saveGestaoEscritorio } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getGestaoEscritorio());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = await getGestaoEscritorio();
    const newItem = {
      id: crypto.randomUUID(),
      obra: body.obra || '',
      ambiente: body.ambiente || '',
      responsavel: body.responsavel || '',
      medicao: body.medicao || null,
      inicio_modelagem: body.inicio_modelagem || null,
      fim_modelagem: body.fim_modelagem || null,
      apresentacao_cliente: body.apresentacao_cliente || null,
      aprovacao_cliente: body.aprovacao_cliente || null,
      solicitacao_alteracao: body.solicitacao_alteracao || null,
      entrega_alteracao: body.entrega_alteracao || null,
      aprovacao_final: body.aprovacao_final || null,
      inicio_caderno_tecnico: body.inicio_caderno_tecnico || null,
      fim_caderno_tecnico: body.fim_caderno_tecnico || null,
      revisao: body.revisao || null,
      envio_fabrica: body.envio_fabrica || null,
      status: body.status || 'em_progresso',
      observacoes: body.observacoes || '',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await saveGestaoEscritorio([...items, newItem]);
    return NextResponse.json({ ok: true, item: newItem });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    const items = await getGestaoEscritorio();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    const updated = { ...items[idx], ...updates, atualizado_em: new Date().toISOString() };
    items[idx] = updated;
    await saveGestaoEscritorio(items);
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const items = await getGestaoEscritorio();
    await saveGestaoEscritorio(items.filter((i) => i.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
