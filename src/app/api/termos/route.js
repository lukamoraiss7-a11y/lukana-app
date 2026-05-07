import { NextResponse } from 'next/server';
import { saveTermoRecebimento, getTermosRecebimento } from '@/lib/db';
import { gerarTermoPdf } from '@/lib/termoPdf';
import { createTask, attachFile } from '@/lib/clickup';

// Gestão Financeira › Termos Assinados (criar lista e atualizar ID)
// Por ora aponta para Contratos e Pagamentos até a lista ser criada
const TERMOS_LIST = '901705200106'; // Gestão Financeira › Contratos e Pagamentos
const ARIEL_ID    = 89355694;

export async function GET() {
  try {
    return NextResponse.json(await getTermosRecebimento());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.obra_nome || !body.cliente || !body.tipo_aceite || !body.assinatura) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const termo = {
      id: Date.now().toString(),
      obra_nome: body.obra_nome,
      cliente:   body.cliente,
      tipo_aceite: body.tipo_aceite,
      ressalva:  body.ressalva || '',
      assinatura: body.assinatura,
      assinado_em: new Date().toISOString(),
      coordenador: body.coordenador || '',
    };

    // Salva no Redis
    await saveTermoRecebimento(termo);

    // Gera PDF e envia ao ClickUp em background
    gerarTermoPdf(termo).then(async (pdfBytes) => {
      const dtStr = new Date(termo.assinado_em).toLocaleDateString('pt-BR');
      const aceite = termo.tipo_aceite === 'total' ? 'Aceite Total' : 'Aceite com Ressalva';
      const taskName = `Termo de Recebimento — ${termo.obra_nome} — ${termo.cliente} — ${dtStr}`;
      const desc = [
        `Obra: ${termo.obra_nome}`,
        `Contratante: ${termo.cliente}`,
        `Coordenador(a): ${termo.coordenador || '—'}`,
        `Tipo de aceite: ${aceite}`,
        termo.ressalva ? `Ressalva: ${termo.ressalva}` : '',
        `Assinado em: ${dtStr}`,
      ].filter(Boolean).join('\n');

      const task = await createTask(TERMOS_LIST, taskName, desc, [ARIEL_ID]);
      if (task?.id) {
        const fileName = `Termo_${termo.obra_nome.replace(/\s+/g, '_')}_${termo.cliente.replace(/\s+/g, '_')}.pdf`;
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const file = Object.assign(blob, { name: fileName });
        await attachFile(task.id, file);
      }
    }).catch(() => {});

    return NextResponse.json({ ok: true, termo });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
