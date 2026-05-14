// Usuários com acesso por login+senha
export const USERS = [
  {
    id: 'gerente',
    role: 'gerente',
    nome: 'Gerente',
    login: 'gerente',
    senha: process.env.NEXT_PUBLIC_GERENTE_PASS || 'gerente645',
  },
];

// Roles com senha obrigatória
const ROLE_SENHAS = {
  coordenador_obra:     process.env.NEXT_PUBLIC_COORD_OBRA_PASS || 'coordvinny',
  coordenador_projetos: process.env.NEXT_PUBLIC_COORD_PROJ_PASS || 'coordana',
  encarregado:          process.env.NEXT_PUBLIC_ENC_PASS        || 'enc645',
  ariel:                process.env.NEXT_PUBLIC_ARIEL_PASS      || 'ariellkn',
};

// Marceneiros — acesso individual a /meu-bonus
export const MARCENEIROS = [
  { id: 'jean',    nome: 'Jean',    senha: 'prd74jn' },
  { id: 'gomes',   nome: 'Gomes',   senha: 'fab38gm' },
  { id: 'joao',    nome: 'João',    senha: 'mrc92jx' },
  { id: 'rodrigo', nome: 'Rodrigo', senha: 'ops56rd' },
  { id: 'victor',  nome: 'Victor',  senha: 'lkn83vc' },
];

// Roles sem senha (só nome)
const ROLES_SEM_SENHA = ['marceneiro', 'montador', 'auxiliar', 'cnc'];

// funcao: 'gerente' | 'marceneiro' | 'montador' | 'auxiliar' | 'cnc' | 'coordenador_obra' | 'coordenador_projetos' | 'encarregado' | 'diretor' | 'ariel'
export function authenticate(funcao, senha, nome) {
  if (funcao === 'gerente') {
    return USERS.find((u) => u.login === 'gerente' && u.senha === senha) || null;
  }
  if (funcao === 'diretor') {
    // DEBUG: aceita qualquer senha durante debug
    return { id: 'diretor', role: 'diretor', nome: nome?.trim() || 'Diretor' };
  }
  if (ROLE_SENHAS[funcao]) {
    return senha === ROLE_SENHAS[funcao]
      ? { id: `${funcao}_${(nome || '').trim()}`, role: funcao, nome: nome?.trim() || funcao }
      : null;
  }
  if (ROLES_SEM_SENHA.includes(funcao)) {
    return { id: `${funcao}_${(nome || '').trim()}`, role: funcao, nome: nome?.trim() || funcao };
  }
  return null;
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('lukana_session') || 'null');
  } catch {
    return null;
  }
}

export function setSession(user) {
  localStorage.setItem(
    'lukana_session',
    JSON.stringify({ id: user.id, role: user.role, nome: user.nome })
  );
  fetch('/api/login-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: user.nome, role: user.role, timestamp: new Date().toISOString() }),
  }).catch(() => {});
}

export function clearSession() {
  localStorage.removeItem('lukana_session');
}

// Roles que podem usar Registros
export const CAN_REGISTROS = ['gerente', 'coordenador_obra', 'coordenador_projetos', 'encarregado'];
