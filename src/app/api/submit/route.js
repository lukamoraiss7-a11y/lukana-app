import { NextResponse } from 'next/server';
import { upsert, getObras } from '@/lib/db';
import { postComment, createTask } from '@/lib/clickup';

const RDO_LIST = '901712152590';
const ANA_ID = 89355939;

const ST = { sim: 'Sim', nao: 'Não', outro: 'Outro' };
const QLABELS = [
  'O que instala/produz hoje',
  'Material faltando',
  'Acesso garantido',
  'Dúvida técnica',
  'Impeditivo',
  'Concluído ontem',
];

function buildComment(data) {
  const hora = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande',
  });
  const lines = [`Relatório diário — ${data.name} — ${hora}`, '', `Obra: ${data.obra}`, ''];
  QLABELS.forEach((label, i) => {
    const n = i + 1;
    const st = data[`q${n}_status`];
    const tx = n === 1
      ? (data.q1_descricao
          ? [data.q1_cliente, data.q1_ambiente, data.q1_descricao].filter(Boolean).join(' · ')
          : data.q1_text)
      : data[`q${n}_text`];
    if (st || tx) {
      lines.push(`${label}: ${ST[st] || st || ''}${tx ? ` — ${tx}` : ''}`);
    }
  });
  if (data.q7_escalate) {
    lines.push('', `*** Precisa do Diretor: ${data.q7_text || ''}`.trim());
  }
  return lines.join('\n');
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.name || !data.obra) {
      return NextResponse.json({ error: 'Nome e obra são obrigatórios' }, { status: 400 });
    }
    await upsert({
      ...data,
      date: new Date().toISOString().slice(0, 10),
      submitted_at: new Date().toISOString(),
    });
    // Post comment on ClickUp obra task (fire and forget)
    getObras().then((obras) => {
      const obraId = (obras || []).find((o) => o.nome === data.obra)?.id;
      if (obraId) postComment(obraId, buildComment(data)).catch(() => {});
    }).catch(() => {});
    // Coordenadora de Obra → cria task no RDO atribuída à Ana
    if (data.name === 'Coordenadora de Obra') {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' });
      const date = new Date().toISOString().slice(0, 10);
      const [y, m, d] = date.split('-');
      createTask(RDO_LIST, `Relatório Coordenadora — ${d}/${m}/${y} ${hora}`, buildComment(data), [ANA_ID]).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
