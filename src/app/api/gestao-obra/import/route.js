import { NextResponse } from 'next/server';
import { getGestaoObra, saveGestaoObra } from '@/lib/db';
import { getObras } from '@/lib/db';

// ⚠️ RESTRIÇÃO: Import de Gestão de Obra traz APENAS dados operacionais do ClickUp.
// Campos importados: id, nome (obra), prazo, ambientes, equipe.
// NUNCA importar: entrada, parcelas, valor, preço, custo. Esses dados devem permanecer no ClickUp.

export async function POST(request) {
  try {
    const body = await request.json();
    const { obraIds } = body; // array de IDs das obras a importar

    if (!Array.isArray(obraIds) || obraIds.length === 0) {
      return NextResponse.json({ error: 'obraIds deve ser um array não vazio' }, { status: 400 });
    }

    // Fetch obras from ClickUp
    const todasObras = await getObras();
    const obraSelecionadas = todasObras.filter((o) => obraIds.includes(o.id));

    if (obraSelecionadas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma obra encontrada com os IDs fornecidos' }, { status: 404 });
    }

    // Get current gestao-obra items
    const gestaoItems = await getGestaoObra();

    // Create gestao-obra entries from obras (um por ambiente)
    const novoItems = [];
    for (const obra of obraSelecionadas) {
      // Se não há ambientes, criar uma entrada geral
      if (!obra.ambientes || obra.ambientes.length === 0) {
        novoItems.push({
          id: crypto.randomUUID(),
          cliente: '', // será preenchido após
          obra: obra.nome,
          ambiente: 'Geral',
          equipe: obra.equipe?.join(', ') || '',
          data_inicio: null,
          data_fim: obra.prazo || null,
          tempo_execucao: '',
          modulos: '0',
          paineis: '0',
          portas_passagem: '0',
          retrabalhos: '0',
          qualidade: '0',
          status: 'em_progresso',
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        });
      } else {
        // Criar uma entrada por ambiente
        for (const ambiente of obra.ambientes) {
          novoItems.push({
            id: crypto.randomUUID(),
            cliente: '', // será preenchido após
            obra: obra.nome,
            ambiente: ambiente,
            equipe: obra.equipe?.join(', ') || '',
            data_inicio: null,
            data_fim: obra.prazo || null,
            tempo_execucao: '',
            modulos: '0',
            paineis: '0',
            portas_passagem: '0',
            retrabalhos: '0',
            qualidade: '0',
            status: 'em_progresso',
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          });
        }
      }
    }

    // Adicionar novos items sem duplicar
    const existingObraAmbientes = new Set(
      gestaoItems.map((item) => `${item.obra}|${item.ambiente}`)
    );
    const itemsAdicionar = novoItems.filter(
      (item) => !existingObraAmbientes.has(`${item.obra}|${item.ambiente}`)
    );

    const finalItems = [...gestaoItems, ...itemsAdicionar];
    await saveGestaoObra(finalItems);

    return NextResponse.json({
      ok: true,
      imported: itemsAdicionar.length,
      total: finalItems.length,
      message: `${itemsAdicionar.length} ambiente(s) importado(s) com sucesso`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET available obras to import
export async function GET() {
  try {
    const todasObras = await getObras();
    const gestaoItems = await getGestaoObra();

    const existingObraAmbientes = new Set(
      gestaoItems.map((item) => `${item.obra}|${item.ambiente}`)
    );

    // Filter out obras that are already fully imported
    const disponiveis = todasObras
      .filter((obra) => {
        const ambientes = obra.ambientes?.length > 0 ? obra.ambientes : ['Geral'];
        return !ambientes.every((amb) => existingObraAmbientes.has(`${obra.nome}|${amb}`));
      })
      .map((obra) => ({
        id: obra.id,
        nome: obra.nome,
        prazo: obra.prazo,
        ambientes: obra.ambientes || [],
        equipe: obra.equipe || [],
      }));

    return NextResponse.json(disponiveis);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
