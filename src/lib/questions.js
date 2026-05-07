export const MEU_DIA_BLOCOS = [
  {
    id: 'b700', hora: '7h00', label: 'Alinhamento fábrica',
    perguntas: [
      { id: 'p1', texto: 'O que sai de fábrica hoje e para qual obra?', placeholder: 'Liste por obra: peças, quantidades, horário de saída...' },
      { id: 'p2', texto: 'Tem móvel travado por material, projeto ou máquina?', placeholder: 'Qual móvel, motivo, o que está sendo feito...' },
      { id: 'p3', texto: 'Tem peça com problema que vai travar instalação?', placeholder: 'Qual peça, defeito, prazo de reexecução...' },
    ],
  },
  {
    id: 'b730', hora: '7h30', label: 'Briefing de campo',
    perguntas: [
      { id: 'p1', texto: 'Cada encarregado sabe o que instala hoje?', placeholder: 'Nome — obra — ambiente — tarefa específica...' },
      { id: 'p2', texto: 'Todos saíram com peças, ferramentas e projeto?', placeholder: 'Quem saiu sem o quê, como foi resolvido...', tipo: 'nao_detail' },
      { id: 'p3', texto: 'Acesso garantido em todos os locais?', placeholder: 'Qual obra tem dúvida, contato do responsável...' },
    ],
  },
  {
    id: 'b1000', hora: '10h00', label: 'Ronda obras críticas',
    perguntas: [
      { id: 'p1', texto: 'Ritmo de execução compatível com a entrega?', placeholder: 'Qual obra está lenta, ponto exato de travamento...' },
      { id: 'p2', texto: 'Peça que não encaixa, medida errada ou faltando?', placeholder: 'Qual peça, qual obra, o que foi acionado...' },
      { id: 'p3', texto: 'Encarregado com dúvida travando a equipe?', placeholder: 'Qual dúvida, quem responde, prazo...' },
    ],
  },
  {
    id: 'b1300', hora: '13h00', label: 'Check meio-dia',
    perguntas: [
      { id: 'p1', texto: 'O que foi prometido para sair hoje ainda sai?', placeholder: 'Se não: qual obra impacta, nova data para o cliente...' },
      { id: 'p2', texto: 'Surgiu problema que vai impactar campo amanhã?', placeholder: 'Problema e ação já tomada...' },
    ],
  },
  {
    id: 'b1700', hora: '17h00', label: 'Fechamento',
    perguntas: [
      { id: 'p1', texto: 'O que foi concluído hoje em cada obra?', placeholder: 'Obra — ambiente — o que foi instalado...', tipo: 'textarea' },
      { id: 'p2', texto: 'O que ficou pendente e por quê?', placeholder: 'Obra — o que ficou — motivo real...', tipo: 'textarea' },
      { id: 'p3', texto: 'Algum cliente precisa de ligação sobre prazo?', placeholder: 'Nome, o que dizer, quem liga...' },
      { id: 'p4', texto: 'O que precisa sair de fábrica amanhã cedo?', placeholder: 'Lista de peças por obra — confirmar antes das 18h...' },
    ],
  },
  {
    id: 'b1730', hora: '17h30', label: 'Decisões urgentes',
    perguntas: [
      { id: 'p1', texto: 'Obra que vai estourar prazo em 3 dias?', placeholder: 'Qual obra, dias de atraso, plano concreto...' },
      { id: 'p2', texto: 'Cliente que precisa de ligação sua hoje?', placeholder: 'Nome, assunto, o que dizer...' },
      { id: 'p3', texto: 'Decisão técnica ou comercial só você resolve?', placeholder: 'Qual decisão, o que está esperando...' },
    ],
  },
];

export const FABRICA_PERGUNTAS = [
  { id: 'f1', texto: 'Quais móveis saem hoje e para qual obra?', placeholder: 'Móvel — cliente — peças — horário previsto de saída...' },
  { id: 'f2', texto: 'Tem móvel travado por falta de material?', placeholder: 'Qual material, qual móvel, previsão de chegada, quem desbloqueou...' },
  { id: 'f3', texto: 'Tem móvel com problema de qualidade?', placeholder: 'Qual peça, qual defeito, prazo de reexecução...' },
  { id: 'f4', texto: 'O que precisa estar pronto amanhã cedo?', placeholder: 'Lista: peça — quantidade — horário que precisa estar pronto por obra...' },
  { id: 'f5', texto: 'Capacidade de hoje é suficiente para o volume em fila?', placeholder: 'Se não: o que repriorizar, o que atrasa, como comunicar campo...' },
  { id: 'f6', texto: 'Alguma máquina com problema que impacta hoje ou amanhã?', placeholder: 'Qual máquina, qual impacto nas OPs, solução prevista...' },
];

export const EQUIPE_PERGUNTAS = [
  { id: 'q1', texto: 'O que será instalado / produzido hoje?', placeholder: 'Liste as peças, ambientes, quantidades...' },
  { id: 'q2', texto: 'Tem material ou peça faltando para hoje?', placeholder: 'Qual peça, quantidade, onde está, previsão de chegada...' },
  { id: 'q3', texto: 'Tem acesso garantido ao local de obra?', placeholder: 'Contato responsável, horário liberado...' },
  { id: 'q4', texto: 'Tem dúvida técnica sem resposta?', placeholder: 'Descreva a dúvida e quem precisa responder...' },
  { id: 'q5', texto: 'Algum impeditivo que vai atrasar entrega?', placeholder: 'Bloqueio, causa, como resolver...' },
  { id: 'q6', texto: 'O que foi concluído ontem?', placeholder: 'O que foi feito, o que ficou e por quê...' },
];

// ── Perguntas estruturadas do Gerente de Fábrica ──────────────────────────
export const GERENTE_FABRICA = [
  {
    id: 'gf2', tipo: 'simples',
    texto: 'Tem móvel travado por falta de material?',
    placeholder: 'Qual material, qual móvel, previsão de chegada...',
  },
  {
    id: 'gf3', tipo: 'lista',
    texto: 'O que precisa estar pronto amanhã cedo?',
    campos: [
      { key: 'obra',   label: 'Obra',    tipo: 'select' },
      { key: 'comodo', label: 'Cômodo',  tipo: 'select_amb' },
      { key: 'movel',  label: 'Móvel',   tipo: 'text' },
    ],
  },
  {
    id: 'gf4', tipo: 'lista',
    texto: 'Quais móveis saem hoje para a obra?',
    campos: [
      { key: 'obra',   label: 'Obra',    tipo: 'select' },
      { key: 'comodo', label: 'Cômodo',  tipo: 'select_amb' },
      { key: 'movel',  label: 'Móvel',   tipo: 'text' },
    ],
  },
  {
    id: 'gf6', tipo: 'simples',
    texto: 'Alguma máquina com problema que impacta hoje ou amanhã?',
    placeholder: 'Qual máquina, qual impacto, solução prevista...',
  },
];

// ── Checklist de vistoria do Coordenador ──────────────────────────────────
export const COORDENADOR_CHECKLIST = [
  'Acabamento verificado',
  'Regulagem de portas e gavetas verificada',
  'Ferragens (puxadores, dobradiças) conferidas',
  'Alinhamento de painéis verificado',
  'Silicone e vedação verificados',
  'Ambiente limpo após entrega',
  'Foto de conclusão registrada',
  'Cliente informado / aprovação obtida',
];

// ── Obras/clientes com pagamento aprovado (sincronizado do ClickUp) ─────────
export const OBRAS_INICIAIS = [
  { id: '86e11tap8', nome: '26.34 - Edir',                  prazo: '2026-04-28', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86e0yj6j3', nome: '26.32 - Raquel Santos',         prazo: '2026-04-22', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86e0yj6md', nome: '26.31 - Maraline Fernandes',    prazo: '2026-04-22', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86e0dz63w', nome: '26.29 - Lorene',                prazo: '2026-03-20', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86e0br06n', nome: '26.27 - Gustavo e Patricia',    prazo: '2026-03-18', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86e0a9wt8', nome: '26.28 - Pedro',                 prazo: '2026-03-16', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86dzav977', nome: '26.01 - Carmen Silvia',         prazo: '2026-01-22', status: 'no_prazo', ambientes: [], notas: {} },
  { id: '86dyr2euw', nome: '25.91 - Camila e João',         prazo: '2025-12-11', status: 'no_prazo', ambientes: [], notas: {} },
];

export const TEAM_MEMBERS = [
  'Rodrigo',
  'Edmilson',
  'João',
  'Victor',
  'Luciano - Encarregado',
];

// ── Lista de ambientes padrão ──────────────────────────────────────────────
export const AMBIENTES_LISTA = [
  'Hall de Entrada', 'Sala de Estar', 'Sala de TV', 'Sala de Jantar',
  'Lavabo', 'Varanda Gourmet / Terraço', 'Bar / Adega', 'Cozinha',
  'Copa', 'Área de Serviço / Lavanderia', 'Despensa', 'Quarto de Casal',
  'Quarto de Solteiro', 'Quarto de Hóspedes', 'Closet', 'Home Office / Escritório',
  'Biblioteca', 'Banheiro Social', 'Suíte Master', 'Circulação / Corredor',
  'Rouparia', 'Depósito', 'Garagem', 'Sótão / Porão', 'Escada (vão inferior)',
];

// ── Equipes de obra (instalação em campo) ──────────────────────────────────
export const EQUIPES_OBRA = [
  'Equipe 01 - Nil',
  'Equipe 02 - Gomes + Luiz',
  'Equipe 03 - Kauã + Ivan',
  'Equipe 04 - João + João',
  'Equipe 05 - Rodrigo + José',
  'Equipe 06 - Victor + Eduardo',
  'Equipe 07 - Vinni',
  'Terceirizado',
];
