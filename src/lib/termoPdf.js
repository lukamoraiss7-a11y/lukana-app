import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const LUKANA_NAVY = rgb(0.176, 0.188, 0.251); // #2D3040
const GOLD       = rgb(0.745, 0.612, 0.388);  // #BF9C63
const GRAY       = rgb(0.4, 0.4, 0.4);
const BLACK      = rgb(0, 0, 0);

// Quebra texto em linhas respeitando largura máxima (em pontos)
function wrapText(font, text, size, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue; }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function gerarTermoPdf(termo) {
  const pdfDoc = await PDFDocument.create();
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 595, H = 842; // A4 points
  const ML = 50, MR = 50;
  const contentW = W - ML - MR;

  let page = pdfDoc.addPage([W, H]);
  let y = H - 48;

  const nextPage = () => {
    page = pdfDoc.addPage([W, H]);
    y = H - 48;
  };

  const ensureSpace = (needed) => { if (y < needed + 50) nextPage(); };

  const drawText = (text, x, size, font, color = BLACK, lineHeight = null) => {
    const lh = lineHeight ?? size * 1.4;
    ensureSpace(lh);
    page.drawText(text, { x, y, size, font, color });
    y -= lh;
  };

  const drawWrapped = (text, x, size, font, color = BLACK, maxW = contentW) => {
    const lines = wrapText(font, text, size, maxW);
    const lh = size * 1.55;
    for (const line of lines) {
      ensureSpace(lh);
      if (line) page.drawText(line, { x, y, size, font, color });
      y -= lh;
    }
  };

  const drawHRule = (color = GOLD, thickness = 0.8) => {
    ensureSpace(6);
    page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness, color });
    y -= 8;
  };

  const drawSection = (title) => {
    y -= 6;
    ensureSpace(20);
    page.drawRectangle({ x: ML, y: y - 2, width: contentW, height: 18, color: LUKANA_NAVY });
    page.drawText(title, { x: ML + 6, y: y + 2, size: 9, font: fontBold, color: GOLD });
    y -= 22;
  };

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: LUKANA_NAVY });
  page.drawText('LUKANA', { x: ML, y: H - 30, size: 20, font: fontBold, color: GOLD });
  page.drawText('MARCENARIA', { x: ML, y: H - 46, size: 9, font: fontReg, color: rgb(1,1,1) });
  page.drawText('TERMO DE RECEBIMENTO DE MÓVEIS PLANEJADOS', { x: ML, y: H - 60, size: 7.5, font: fontReg, color: rgb(0.7,0.7,0.7) });

  const dtStr = new Date(termo.assinado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hrStr = new Date(termo.assinado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  page.drawText(`${dtStr} · ${hrStr}`, { x: W - MR - 90, y: H - 46, size: 8, font: fontReg, color: rgb(0.7,0.7,0.7) });
  y = H - 88;

  // ── Dados da obra ─────────────────────────────────────────────────────────
  drawSection('DADOS DA ENTREGA');
  const dadosRows = [
    ['Obra / Projeto', termo.obra_nome],
    ['Contratante',    termo.cliente],
    ['Coordenador',    termo.coordenador || '—'],
    ['Data de entrega', dtStr],
    ['Tipo de aceite', termo.tipo_aceite === 'total' ? 'Aceite Total' : 'Aceite com Ressalva'],
  ];
  for (const [label, value] of dadosRows) {
    ensureSpace(14);
    page.drawText(`${label}:`, { x: ML, y, size: 8.5, font: fontBold, color: GRAY });
    page.drawText(value, { x: ML + 110, y, size: 8.5, font: fontReg, color: BLACK });
    y -= 14;
  }

  if (termo.tipo_aceite === 'ressalva' && termo.ressalva) {
    y -= 4;
    ensureSpace(14);
    page.drawText('Ressalva declarada:', { x: ML, y, size: 8.5, font: fontBold, color: rgb(0.8, 0.5, 0) });
    y -= 14;
    drawWrapped(termo.ressalva, ML, 8.5, fontReg, rgb(0.6, 0.35, 0));
  }
  y -= 6;

  // ── Texto do termo ────────────────────────────────────────────────────────
  const SECTIONS = [
    { title: 'OBJETO', body: 'Os móveis entregues foram confeccionados conforme especificações acordadas no contrato inicial, incluindo medidas, materiais, cores e acabamentos. A entrega segue de acordo com os projetos, memorial descritivo e material publicitário utilizado pela empresa. Todos os itens foram instalados nos locais previamente definidos e encontram-se em perfeito estado de conservação e funcionamento.' },
    { title: 'CONDIÇÕES DE ENTREGA E ACEITAÇÃO', body: '1. Os móveis foram entregues e montados dentro das normas técnicas aplicáveis.\n2. Foi realizada a entrega técnica com orientações detalhadas sobre uso, manutenção e cuidados necessários.\n3. Após a montagem, o contratante realizou a inspeção dos móveis e confirmou que estão em perfeito estado, sem vícios, patologias ou danos aparentes.\n4. O contratante declara estar ciente de que qualquer dano causado por uso inadequado ou falta de manutenção não será coberto pela garantia.' },
    { title: 'GARANTIA', body: '1. A Lukana Marcenaria fornece garantia contratual de 5 (cinco) anos para a montagem dos móveis planejados, contada a partir da data de entrega.\n2. A garantia cobre exclusivamente defeitos relacionados à montagem realizada pela contratada. Não estão incluídos danos decorrentes de mau uso, desgaste natural ou alterações realizadas por terceiros.' },
    { title: 'RESPONSABILIDADES DAS PARTES', body: 'Contratada: responsável pela entrega e montagem dos móveis conforme especificações acordadas, garantindo a qualidade do serviço prestado.\n\nContratante: responsável por seguir as orientações técnicas fornecidas durante a entrega e realizar a manutenção adequada dos móveis.' },
    { title: 'DISPOSIÇÕES GERAIS', body: '1. Este termo é firmado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores legais.\n2. Qualquer disputa decorrente deste termo será resolvida no foro da comarca de Campo Grande – Mato Grosso do Sul, com exclusão de qualquer outro.' },
  ];

  for (const { title, body } of SECTIONS) {
    drawSection(title);
    drawWrapped(body, ML, 8.5, fontReg);
    y -= 4;
  }

  // ── Declaração final ──────────────────────────────────────────────────────
  drawSection('DECLARAÇÃO FINAL');
  drawWrapped('O contratante declara que os móveis planejados foram entregues em conformidade com o contrato firmado, estando plenamente satisfeito com o serviço prestado. Ambas as partes concordam com os termos aqui descritos.', ML, 8.5, fontReg);
  y -= 8;

  // ── Assinatura ────────────────────────────────────────────────────────────
  ensureSpace(130);
  drawHRule();
  drawSection('ASSINATURA DO CONTRATANTE');
  y -= 4;

  // Embed signature image (base64 PNG)
  if (termo.assinatura) {
    try {
      const base64Data = termo.assinatura.replace(/^data:image\/png;base64,/, '');
      const sigBytes = Buffer.from(base64Data, 'base64');
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const sigW = 200, sigH = 80;
      ensureSpace(sigH + 20);
      page.drawImage(sigImage, { x: ML, y: y - sigH, width: sigW, height: sigH });
      y -= sigH + 10;
    } catch { /* ignora erro de embed */ }
  }

  page.drawLine({ start: { x: ML, y }, end: { x: ML + 220, y }, thickness: 0.5, color: GRAY });
  y -= 12;
  drawText(termo.cliente, ML, 8.5, fontBold, BLACK, 12);
  drawText('Contratante', ML, 7.5, fontReg, GRAY, 10);
  y -= 10;

  // Campo empresa
  ensureSpace(50);
  page.drawLine({ start: { x: ML, y }, end: { x: ML + 220, y }, thickness: 0.5, color: GRAY });
  y -= 12;
  drawText('Lukana Marcenaria', ML, 8.5, fontBold, BLACK, 12);
  drawText('Contratada', ML, 7.5, fontReg, GRAY, 10);
  y -= 10;

  // Campo coordenador se houver
  if (termo.coordenador) {
    page.drawLine({ start: { x: ML + 260, y: y + 50 }, end: { x: ML + 480, y: y + 50 }, thickness: 0.5, color: GRAY });
    page.drawText(termo.coordenador, { x: ML + 260, y: y + 36, size: 8.5, font: fontBold, color: BLACK });
    page.drawText('Coordenador(a)', { x: ML + 260, y: y + 24, size: 7.5, font: fontReg, color: GRAY });
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawRectangle({ x: 0, y: 0, width: W, height: 26, color: LUKANA_NAVY });
    p.drawText('Lukana Marcenaria · Campo Grande – MS', { x: ML, y: 9, size: 7, font: fontReg, color: rgb(0.5,0.5,0.5) });
    p.drawText(`Página ${i + 1} de ${pages.length}`, { x: W - MR - 55, y: 9, size: 7, font: fontReg, color: rgb(0.5,0.5,0.5) });
  }

  return await pdfDoc.save();
}
