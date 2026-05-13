import { NextResponse } from 'next/server';
import { getObras, saveObras } from '@/lib/db';

const CU_LIST = '901705200106'; // Contratos e Pagamentos

// ⚠️ RESTRIÇÃO: Valores de negociação (entrada, parcelas, preço, custo) devem permanecer
// APENAS no ClickUp. O app coordenadores exibe APENAS: id, nome, prazo, ambientes,
// equipe, notas, status, aprovada. Nunca adicionar campos financeiros aqui.

// Nomes que NÃO são ambientes (móveis, contatos, pagamentos, etc.)
const FURNITURE_RE = /^\d|^armário|^prateleira|^painel|^sofá|^rack|^bancada|^gabinete|^estante|^mesa|^cadeira|^banco|^nicho|^móvel|^rouparia|^torre|^aéreo|^inferior|^superior|^divisória|^espelho|^balcão|^cuba|^tampo|^vão|^detalhe|^imagem|^sugestão|^contato|\+55|\d{2}\s*9\d{3,5}|@|https?:\/\/|R\$|pagamento|entrada|parcela|contrato|proposta|visita\s+técnica|reunião|medição|^ok$|^sim$|^não$/i;

function parseAmbientes(text) {
  if (!text) return [];
  const seen = new Set();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !FURNITURE_RE.test(l) && l.length < 60)
    .filter((l) => { if (seen.has(l)) return false; seen.add(l); return true; });
}

async function fetchSubtasks(token, taskId) {
  try {
    const res = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}?include_subtasks=true`,
      { headers: { Authorization: token } }
    );
    if (!res.ok) return [];
    const { subtasks } = await res.json();
    return (subtasks || [])
      .map((s) => s.name?.trim())
      .filter((name) => name && !FURNITURE_RE.test(name) && name.length < 60);
  } catch { return []; }
}

async function fetchClickUpObras() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) return [];
  try {
    // 1. Busca tarefas principais com status "pagamento fechado"
    const mainTasks = [];
    for (let page = 0; page < 3; page++) {
      const url = `https://api.clickup.com/api/v2/list/${CU_LIST}/task?statuses[]=pagamento%20fechado&include_closed=false&page=${page}`;
      const res = await fetch(url, { headers: { Authorization: token } });
      if (!res.ok) break;
      const { tasks } = await res.json();
      if (!tasks || tasks.length === 0) break;
      mainTasks.push(...tasks);
      if (tasks.length < 100) break;
    }
    if (mainTasks.length === 0) return [];

    // 2. Para cada tarefa, busca subtarefas individualmente (evita problema de paginação)
    const results = await Promise.all(
      mainTasks.map(async (t) => ({
        id: t.id,
        nome: t.name,
        prazo: t.due_date ? new Date(parseInt(t.due_date)).toISOString().slice(0, 10) : null,
        ambientes: await fetchSubtasks(token, t.id),
      }))
    );

    // Fallback para text_content se nenhuma subtarefa válida retornou
    return results.map((r) => ({
      ...r,
      ambientes: r.ambientes.length > 0
        ? r.ambientes
        : parseAmbientes(mainTasks.find((t) => t.id === r.id)?.text_content || ''),
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
        ambientes: cu.ambientes, // ClickUp is authoritative; don't fall back to stale Redis data
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
