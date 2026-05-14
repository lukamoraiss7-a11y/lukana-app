import { NextResponse } from 'next/server';
import { getBonificacaoList, saveBonificacaoRecord, deleteBonificacaoRecord } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getBonificacaoList());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const record = await request.json();
    if (!record.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    await saveBonificacaoRecord(record);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    await deleteBonificacaoRecord(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
