import { NextResponse } from 'next/server';
import { saveGerenteFab, getGerenteFab } from '@/lib/db';
import { createTask } from '@/lib/clickup';

const RDO_LIST = '901712152590';
const MATHEUS_ID = 84064690;
const ST = { sim: 'Sim', nao: 'Não', outro: 'Outro' };

function buildFabricaDesc(data) {
  const lines = [];
  if (data.gf1) {
    lines.push('Status da fábrica:');
    if (data.gf1.obra)      lines.push(`Obra: ${data.gf1.obra}`);
    if (data.gf1.ambiente)  lines.push(`Ambiente: ${data.gf1.ambiente}`);
    if (data.gf1.descricao) lines.push(`Descrição: ${data.gf1.descricao}`);
    lines.push('');
  }
  const simples = [
    { id: 'gf2', label: 'Móvel travado por material' },
    { id: 'gf5', label: 'Problema de qualidade' },
    { id: 'gf6', label: 'Máquina com problema' },
  ];
  simples.forEach(({ id, label }) => {
    const f = data[id];
    if (f?.status) lines.push(`${label}: ${ST[f.status] || f.status}${f.text ? ` — ${f.text}` : ''}`);
  });
  const listas = [
    { id: 'gf4', label: 'Móveis que saem hoje' },
    { id: 'gf3', label: 'Pronto amanhã cedo' },
  ];
  listas.forEach(({ id, label }) => {
    const items = data[id];
    if (items?.length) {
      lines.push('', `${label}:`);
      items.forEach((it) => lines.push(`- ${[it.obra, it.cliente, it.comodo, it.movel].filter(Boolean).join(' · ')}`));
    }
  });
  return lines.join('\n');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    return NextResponse.json(await getGerenteFab(date));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const date = new Date().toISOString().slice(0, 10);
    await saveGerenteFab(date, { ...data, date, saved_at: new Date().toISOString() });
    // Create task in RDO / Diarios de Obra (fire and forget)
    const [d, m, y] = date.split('-').reverse();
    createTask(RDO_LIST, `Relatório Fábrica — ${d}/${m}/${y}`, buildFabricaDesc(data), [MATHEUS_ID]).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
