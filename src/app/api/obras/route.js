import { NextResponse } from 'next/server';
import { getObras, saveObras } from '@/lib/db';

const CU_LIST = '901705200106'; // Contratos e Pagamentos

// ⚠️ RESTRIÇÃO: Valores de negociação (entrada, parcelas, preço, custo) devem permanecer
// APENAS no ClickUp. O app coordenadores exibe APENAS: id, nome, prazo, ambientes,
// equipe, notas, status, aprovada. Nunca adicionar campos financeiros aqui.

// Lines that are NOT room names (furniture descriptions, contacts, etc.)
const FURNITURE_RE = /^\d|^armário|^prateleira|^painel|^sofá|^rack|^bancada|^gabinete|^estante|^mesa|^cadeira|^banco|^nicho|^móvel|^rouparia|^torre|^aéreo|^inferior|^superior|^divisória|^espelho|^balcão|^cuba|^tampo|^vão|^detalhe|^imagem|^sugestão|^contato|^\+55|\d{2}\s*9\d{4}|@|https?:\/\//i;

function parseAmbientes(text) {
  if (!text) return [];
  const seen = new Set();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !FURNITURE_RE.test(l) && l.length < 60)
    .filter((l) => { if (seen.has(l)) return false; seen.add(l); return true; });
}

async function fetchClickUpObras() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) return [];
  try {
    const url = `https://api.clickup.com/api/v2/list/${CU_LIST}/task?statuses[]=pagamento%20fechado&include_closed=false&subtasks=true&page=0`;
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) return [];
    const { tasks } = await res.json();
    if (!tasks || tasks.length === 0) return [];

    // Separa tarefas principais de sub-tarefas
    const mainTasks = tasks.filter((t) => !t.parent);
    const subTasks  = tasks.filter((t) =>  t.parent);

    // Agrupa subtarefas pelo parent id → ambientes
    const subByParent = {};
    subTasks.forEach((s) => {
      if (!subByParent[s.parent]) subByParent[s.parent] = [];
      subByParent[s.parent].push(s.name);
    });

    return mainTasks.map((t) => ({
      id: t.id,
      nome: t.name,
      prazo: t.due_date ? new Date(parseInt(t.due_date)).toISOString().slice(0, 10) : null,
      // subtarefas têm prioridade; fallback para texto se não houver
      ambientes: subByParent[t.id]?.length > 0
        ? subByParent[t.id]
        : parseAmbientes(t.text_content || t.description || ''),
    }));
  } catch { return []; }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const aprovadas_only = searchParams.get('aprovadas_only') === '1';

    const [existing, cuObras] = await Promise.all([getObras(), fetchClickUpObras()]);
    const base = existing || [];

    if (cuObras.length === 0) {
      const result = base.length > 0 ? base : [];
      return NextResponse.json(aprovadas_only ? result.filter((o) => o.aprovada === true) : result);
    }

    // Merge: ClickUp is authoritative for id/nome/ambientes
    // prazo: Redis (set by Ariel in-app) takes priority over ClickUp
    const byId = Object.fromEntries(base.map((o) => [o.id, o]));
    const merged = cuObras.map((cu) => {
      const ex = byId[cu.id] || {};
      return {
        ...ex,
        id: cu.id,
        nome: cu.nome,
        prazo: ex.prazo ?? cu.prazo ?? null,
        ambientes: cu.ambientes.length > 0 ? cu.ambientes : (ex.ambientes || []),
        status: ex.status || 'no_prazo',
        equipe: ex.equipe || [],
        notas: ex.notas || {},
        aprovada: ex.aprovada ?? true,
      };
    });

    // Keep obras in Redis that are no longer in ClickUp (e.g., manually added)
    const cuIds = new Set(cuObras.map((o) => o.id));
    const extras = base.filter((o) => !cuIds.has(o.id));
    const final = [...merged, ...extras];

    await saveObras(final);
    return NextResponse.json(aprovadas_only ? final.filter((o) => o.aprovada === true) : final);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const obras = await request.json();
    await saveObras(obras);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    const obras = await getObras();
    const idx = obras.findIndex((o) => o.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    if ('equipe' in body) {
      if (!Array.isArray(body.equipe)) return NextResponse.json({ error: 'equipe deve ser array' }, { status: 400 });
      obras[idx] = { ...obras[idx], equipe: body.equipe };
    }
    if ('prazo' in body) {
      obras[idx] = { ...obras[idx], prazo: body.prazo || null };
    }
    if ('aprovada' in body) {
      obras[idx] = {
        ...obras[idx],
        aprovada: !!body.aprovada,
        aprovada_por: body.aprovada ? (body.aprovada_por || null) : null,
        aprovada_em:  body.aprovada ? new Date().toISOString() : null,
      };
    }
    await saveObras(obras);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
