import { NextResponse } from 'next/server';
import { addRegistro, getRegistros } from '@/lib/db';
import { createTask } from '@/lib/clickup';

const RDO_LIST = '901712152590';
const TIPO_LABEL = { obra: 'Obra', fabrica: 'Fábrica', nota: 'Geral' };

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const start = searchParams.get('start') || today;
    const end   = searchParams.get('end')   || today;
    return NextResponse.json(await getRegistros(start, end));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.texto?.trim() || !data.autor || !data.role) {
      return NextResponse.json({ error: 'texto, autor e role obrigatórios' }, { status: 400 });
    }
    const date = new Date().toISOString().slice(0, 10);
    const tipo = data.tipo || 'nota';
    await addRegistro({
      id: Date.now().toString(),
      autor: data.autor,
      role: data.role,
      texto: data.texto.trim(),
      tipo,
      date,
      created_at: new Date().toISOString(),
    });
    // Create task in RDO / Diarios de Obra (fire and forget)
    const hora = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande',
    });
    const [d, m, y] = date.split('-').reverse();
    const tipoLabel = TIPO_LABEL[tipo] || tipo;
    createTask(
      RDO_LIST,
      `Registro [${tipoLabel}] — ${data.autor} — ${d}/${m}/${y} ${hora}`,
      data.texto.trim(),
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
