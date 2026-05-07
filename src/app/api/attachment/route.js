import { NextResponse } from 'next/server';
import { attachFile } from '@/lib/clickup';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const taskId = formData.get('task_id');
    const file = formData.get('file');
    if (!taskId || !file) {
      return NextResponse.json({ error: 'task_id e file obrigatórios' }, { status: 400 });
    }
    const result = await attachFile(taskId, file);
    if (!result) return NextResponse.json({ error: 'Falha ao enviar para ClickUp' }, { status: 500 });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
