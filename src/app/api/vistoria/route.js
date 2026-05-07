import { NextResponse } from 'next/server';
import { postComment } from '@/lib/clickup';

export async function POST(request) {
  try {
    const { task_id, obra_nome, ambiente, checklist, autor } = await request.json();
    if (!task_id) return NextResponse.json({ error: 'task_id obrigatório' }, { status: 400 });

    const hora = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande',
    });

    const lines = [
      `Vistoria — ${autor || 'Coordenador'} — ${hora}`,
      `Obra: ${obra_nome}`,
      ...(ambiente ? [`Ambiente: ${ambiente}`] : []),
      '',
      'Checklist:',
      ...Object.entries(checklist).map(([item, ok]) => `${ok ? '✓' : '✗'} ${item}`),
    ];

    postComment(task_id, lines.join('\n')).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
