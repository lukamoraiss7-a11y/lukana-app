import { NextResponse } from 'next/server';
import { getPedidos, addPedido, updatePedidoStatus, getEstoque, saveEstoque } from '@/lib/db';
import { createTask } from '@/lib/clickup';

const RDO_LIST = '901712152590';
const ARIEL_ID = 89355694;

// Normaliza string: minúsculas + converte 30cm → 300mm
function norm(s) {
  return s.toLowerCase().replace(/(\d+)\s*cm\b/g, (_, n) => `${parseInt(n) * 10}mm`);
}

// Tenta casar um item do pedido com um item do estoque por keywords
function matchEstoque(item, estoque) {
  const tokens = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao]
    .filter(Boolean)
    .map(norm);
  if (tokens.length === 0) return null;

  let best = null, bestScore = 0;
  for (const e of estoque) {
    const nome = norm(e.nome);
    const score = tokens.filter((t) => nome.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  // Exige que todos os tokens batam (ou pelo menos 2, o que for menor)
  return bestScore >= Math.min(2, tokens.length) ? best : null;
}

function buildPedidoDesc(data, estoque = []) {
  const lines = [
    `Obra: ${data.obra_nome}`,
    `Solicitante: ${data.solicitante}`,
    '',
    'Itens solicitados:',
  ];
  data.itens.forEach((item) => {
    const specs = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao].filter(Boolean);
    const label = specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
    const unidade = `${item.quantidade} ${item.unidade}${item.quantidade > 1 && !item.unidade.endsWith('s') && item.unidade !== 'kg' ? 's' : ''}`;
    lines.push(`- ${label}: ${unidade}`);
  });

  if (estoque.length > 0) {
    lines.push('', 'Estoque atual:');
    data.itens.forEach((item) => {
      const catLower = (item.categoria || '').toLowerCase();
      const match = estoque.find(e =>
        e.nome.toLowerCase().includes(catLower) ||
        catLower.includes(e.nome.toLowerCase().split(' ')[0])
      );
      const specs = [item.cor, item.espessura, item.largura, item.tipo].filter(Boolean).join(' ');
      const label = specs ? `${item.categoria} ${specs}` : item.categoria;
      if (match) {
        const ok = match.quantidade >= item.quantidade;
        const flag = ok ? '✓' : '⚠';
        const pedidoNote = match.pedido ? ' [pedido em trânsito]' : '';
        lines.push(`${flag} ${label}: ${match.quantidade} ${match.unidade} em estoque${pedidoNote}`);
      } else {
        lines.push(`? ${label}: não encontrado no cadastro`);
      }
    });
  }

  return lines.join('\n');
}

export async function GET() {
  try {
    return NextResponse.json(await getPedidos(7));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.obra_nome || !data.solicitante || !data.itens?.length) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });
    }
    const pedido = {
      ...data,
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      status: 'pendente',
    };
    await addPedido(pedido);
    const [y, m, d] = pedido.date.split('-');
    const estoque = await getEstoque().catch(() => []);
    const estoqueOriginal = [...estoque]; // cópia antes das baixas

    // Baixa automática de estoque quando há match
    const baixas = [];
    const itensCobertos = new Set();
    if (estoque.length > 0) {
      let changed = false;
      for (const item of data.itens) {
        const match = matchEstoque(item, estoque);
        if (match && match.quantidade >= item.quantidade) {
          const idx = estoque.findIndex((e) => e.id === match.id);
          estoque[idx] = {
            ...estoque[idx],
            quantidade: estoque[idx].quantidade - item.quantidade,
            atualizado_em: new Date().toISOString(),
          };
          baixas.push({ nome: match.nome, quantidade: item.quantidade, unidade: match.unidade });
          itensCobertos.add(match.id);
          changed = true;
        }
      }
      if (changed) await saveEstoque(estoque);
    }

    // Só notifica Ariel no ClickUp se houver itens não cobertos pelo estoque
    const itensSemEstoque = data.itens.filter((item) => {
      const match = matchEstoque(item, estoqueOriginal);
      return !match || match.quantidade < item.quantidade;
    });

    if (itensSemEstoque.length > 0) {
      const pedidoParcial = { ...data, itens: itensSemEstoque };
      createTask(
        RDO_LIST,
        `Pedido de Material — ${data.obra_nome} — ${d}/${m}/${y}`,
        buildPedidoDesc(pedidoParcial, estoqueOriginal),
        [ARIEL_ID],
      ).catch(() => {});
    }
    return NextResponse.json({ ok: true, baixas });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'id e status obrigatórios' }, { status: 400 });
    await updatePedidoStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
