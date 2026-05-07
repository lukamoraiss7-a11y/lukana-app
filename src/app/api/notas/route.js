import { NextResponse } from 'next/server';
import { addNota, getNotas } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    return NextResponse.json(await getNotas(date));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.texto?.trim() || !data.autor) {
      return NextResponse.json({ error: 'texto e autor obrigatórios' }, { status: 400 });
    }
    const date = new Date().toISOString().slice(0, 10);
    await addNota({
      id: Date.now().toString(),
      autor: data.autor,
      texto: data.texto.trim(),
      tipo: data.tipo || 'nota',
      date,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
