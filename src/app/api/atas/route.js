import { NextResponse } from 'next/server';
import { addAta, getAtas, updateAta } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Download de anexo: ?download=1&id=...&data_reuniao=...
    if (searchParams.get('download') === '1') {
      const id = searchParams.get('id');
      const dataReuniao = searchParams.get('data_reuniao');
      if (!id || !dataReuniao) {
        return NextResponse.json({ error: 'id e data_reuniao obrigatórios' }, { status: 400 });
      }
      const atas = await getAtas(dataReuniao, dataReuniao);
      const ata = atas.find((a) => a.id === id);
      if (!ata?.anexo?.dados_b64) {
        return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
      }
      const buf = Buffer.from(ata.anexo.dados_b64, 'base64');
      return new Response(buf, {
        headers: {
          'Content-Type': ata.anexo.tipo || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(ata.anexo.nome)}"`,
        },
      });
    }

    // Listagem normal
    const end = searchParams.get('end') || new Date().toISOString().slice(0, 10);
    const months = Math.min(parseInt(searchParams.get('months') || '3'), 12);
    const d = new Date(end + 'T12:00:00Z');
    d.setMonth(d.getMonth() - months + 1);
    d.setDate(1);
    const start = d.toISOString().slice(0, 10);
    const atas = await getAtas(start, end);
    // Remove dados_b64 do anexo para não explodir o payload
    const lite = atas.map(({ anexo, ...a }) => ({
      ...a,
      anexo: anexo ? { nome: anexo.nome, tipo: anexo.tipo, tamanho: anexo.tamanho } : null,
    }));
    return NextResponse.json(lite);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const required = ['data_reuniao', 'participantes', 'resumo', 'autor'];
    for (const f of required) {
      if (!data[f]?.trim()) {
        return NextResponse.json({ error: `Campo obrigatório: ${f}` }, { status: 400 });
      }
    }
    const ata = {
      id: Date.now().toString(),
      data_reuniao: data.data_reuniao,
      participantes: data.participantes.trim(),
      resumo: data.resumo.trim(),
      problemas: data.problemas?.trim() || '',
      decisoes: data.decisoes?.trim() || '',
      pendencias: data.pendencias?.trim() || '',
      proximos_passos: data.proximos_passos?.trim() || '',
      responsaveis: data.responsaveis?.trim() || '',
      prazo_acoes: data.prazo_acoes || '',
      autor: data.autor,
      role: data.role || '',
      equipe: data.equipe || '',
      status_pendencias: 'aberto',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      anexo: data.anexo || null,
    };
    await addAta(ata);
    return NextResponse.json({ ok: true, id: ata.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const data = await request.json();
    if (!data.id || !data.data_reuniao) {
      return NextResponse.json({ error: 'id e data_reuniao obrigatórios' }, { status: 400 });
    }
    const ok = await updateAta(data.id, data.data_reuniao, data.updates || {});
    if (!ok) return NextResponse.json({ error: 'Ata não encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
