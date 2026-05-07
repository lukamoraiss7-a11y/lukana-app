import { NextResponse } from 'next/server';
import { getEstoque, saveEstoque } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getEstoque());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Importação em lote
    if (Array.isArray(body.itens)) {
      const items = await getEstoque();
      const novos = body.itens.map((i) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nome: i.nome,
        categoria: i.categoria || '',
        unidade: i.unidade || 'unidade',
        quantidade: Number(i.quantidade) || 0,
        minimo: Number(i.minimo) || 0,
        pedido: false,
        atualizado_em: new Date().toISOString(),
      }));
      await saveEstoque([...items, ...novos]);
      return NextResponse.json({ ok: true, adicionados: novos.length });
    }

    const { nome, categoria, unidade, quantidade, minimo } = body;
    if (!nome || !unidade) return NextResponse.json({ error: 'nome e unidade obrigatórios' }, { status: 400 });

    const items = await getEstoque();
    const item = {
      id: Date.now().toString(),
      nome,
      categoria: categoria || '',
      unidade,
      quantidade: Number(quantidade) || 0,
      minimo: Number(minimo) || 0,
      pedido: false,
      atualizado_em: new Date().toISOString(),
    };
    items.push(item);
    await saveEstoque(items);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const items = await getEstoque();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    const item = { ...items[idx] };
    if (body.delta !== undefined) item.quantidade = Math.max(0, item.quantidade + Number(body.delta));
    if (body.quantidade !== undefined) item.quantidade = Math.max(0, Number(body.quantidade));
    if (body.pedido !== undefined) item.pedido = body.pedido;
    if (body.nome !== undefined) item.nome = body.nome;
    if (body.categoria !== undefined) item.categoria = body.categoria;
    if (body.unidade !== undefined) item.unidade = body.unidade;
    if (body.minimo !== undefined) item.minimo = Number(body.minimo);
    item.atualizado_em = new Date().toISOString();

    items[idx] = item;
    await saveEstoque(items);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const items = await getEstoque();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    await saveEstoque(filtered);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
