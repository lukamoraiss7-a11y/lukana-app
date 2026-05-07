import { NextResponse } from 'next/server';
import { getCncAtivo, setCncAtivo, clearCncAtivo, updateCncConcluido } from '@/lib/db';

const MAQUINAS = ['CNC', 'Seccionadora'];

export async function GET() {
  try {
    const result = {};
    for (const m of MAQUINAS) {
      result[m] = await getCncAtivo(m);
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { maquina, corte } = await request.json();
    if (!maquina || !corte) {
      return NextResponse.json({ error: 'maquina e corte obrigatórios' }, { status: 400 });
    }
    await setCncAtivo(maquina, corte);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const maquina = searchParams.get('maquina');
    const id = searchParams.get('id'); // optional: mark corte as concluded
    if (!maquina) return NextResponse.json({ error: 'maquina obrigatória' }, { status: 400 });
    if (id) await updateCncConcluido(id);
    await clearCncAtivo(maquina);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
