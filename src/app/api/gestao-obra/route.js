import { NextResponse } from 'next/server';
import { getGestaoObra, saveGestaoObra } from '@/lib/db';

// ⚠️ RESTRIÇÃO: Gestão de Obra exibe APENAS dados operacionais.
// Campos permitidos: cliente, obra, ambiente, equipe, datas, modulos, paineis, portas_passagem, retrabalhos, qualidade, status.
// NUNCA adicionar: entrada, parcelas, valor, preço, custo. Esses dados são restritos ao ClickUp.

export async function GET() {
  try {
    return NextResponse.json(await getGestaoObra());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = await getGestaoObra();
    const newItem = {
      id: crypto.randomUUID(),
      cliente: body.cliente || '',
      obra: body.obra || '',
      ambiente: body.ambiente || '',
      equipe: body.equipe || '',
      data_inicio: body.data_inicio || null,
      data_fim: body.data_fim || null,
      tempo_execucao: body.tempo_execucao || '',
      modulos: body.modulos || '0',
      paineis: body.paineis || '0',
      portas_passagem: body.portas_passagem || '0',
      retrabalhos: body.retrabalhos || '0',
      qualidade: body.qualidade || '0',
      status: body.status || 'em_progresso',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await saveGestaoObra([...items, newItem]);
    return NextResponse.json({ ok: true, item: newItem });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    const items = await getGestaoObra();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    const updated = { ...items[idx], ...updates, atualizado_em: new Date().toISOString() };
    items[idx] = updated;
    await saveGestaoObra(items);
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const items = await getGestaoObra();
    await saveGestaoObra(items.filter((i) => i.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
