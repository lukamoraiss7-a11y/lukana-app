'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authenticate, setSession, getSession, clearSession } from '@/lib/auth';
import Link from 'next/link';

const ROLE_CONFIG = {
  gerente:              { dest: '/gerente'       },
  coordenador_obra:     { dest: '/coordenadores' },
  coordenador_projetos: { dest: '/coordenadores' },
  encarregado:          { dest: '/coordenadores' },
  marceneiro:           { dest: '/equipe'        },
  montador:             { dest: '/equipe'        },
  auxiliar:             { dest: '/equipe'        },
  cnc:                  { dest: '/cnc'           },
  diretor:              { dest: '/ceo'           },
  ariel:                { dest: '/ceo'           },
};

function EyeIcon({ open }) {
  return open
    ? <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}

function PasswordInput({ value, onChange, onEnter }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder="Senha"
        autoComplete="current-password"
        autoCapitalize="none"
        className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold"
      />
      <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1">
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

// Gerente: só senha
function GerenteLogin({ onSuccess }) {
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const user = authenticate('gerente', senha, '');
    if (!user) { setError('Senha incorreta.'); return; }
    onSuccess(user);
  };
  return (
    <div className="w-full max-w-xs space-y-3">
      <PasswordInput value={senha} onChange={(e) => { setSenha(e.target.value); setError(''); }} onEnter={submit} />
      <button onClick={submit} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
    </div>
  );
}

// Ariel: só nome + senha (Head de Gestão)
function ArielLogin({ onSuccess }) {
  const [nome,  setNome]  = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    const user = authenticate('ariel', senha, nome);
    if (!user) { setError('Senha incorreta.'); return; }
    onSuccess(user);
  };
  return (
    <div className="w-full max-w-xs space-y-3">
      <input value={nome} onChange={(e) => { setNome(e.target.value); setError(''); }}
        placeholder="Seu nome" autoComplete="name" autoCapitalize="words"
        className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
      <PasswordInput value={senha} onChange={(e) => { setSenha(e.target.value); setError(''); }} onEnter={submit} />
      <button onClick={submit} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
    </div>
  );
}

// Coordenador: escolhe cargo + nome + senha
const COORD_ROLES = [
  { value: 'coordenador_obra',     label: 'Coordenador de Obra'     },
  { value: 'coordenador_projetos', label: 'Gestor de Escritório' },
  { value: 'encarregado',          label: 'Encarregado'             },
];

function CoordLogin({ onSuccess, presetRole }) {
  const [funcao, setFuncao] = useState(presetRole || '');
  const [nome,   setNome]   = useState('');
  const [senha,  setSenha]  = useState('');
  const [error,  setError]  = useState('');
  const submit = () => {
    if (!funcao) { setError('Selecione o cargo.'); return; }
    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    const user = authenticate(funcao, senha, nome);
    if (!user) { setError('Senha incorreta.'); return; }
    onSuccess(user);
  };
  const roleLabel = COORD_ROLES.find((r) => r.value === presetRole)?.label;
  return (
    <div className="w-full max-w-xs space-y-3">
      {presetRole ? (
        <div className="w-full py-3 rounded-xl text-sm font-bold border-2 border-gold bg-gold/10 text-gold text-center">
          {roleLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {COORD_ROLES.map((r) => (
            <button key={r.value} type="button" onClick={() => { setFuncao(r.value); setError(''); }}
              className={`w-full py-3 rounded-xl text-sm font-bold border-2 transition-all ${funcao === r.value ? 'border-gold bg-gold/10 text-gold' : 'border-white/20 bg-white/5 text-white/70'}`}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {funcao && (
        <>
          <input value={nome} onChange={(e) => { setNome(e.target.value); setError(''); }}
            placeholder="Seu nome" autoComplete="name" autoCapitalize="words"
            className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
          <PasswordInput value={senha} onChange={(e) => { setSenha(e.target.value); setError(''); }} onEnter={submit} />
          <button onClick={submit} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
        </>
      )}
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
    </div>
  );
}

// Equipe: escolhe função + nome, sem senha
const EQUIPE_ROLES = [
  { value: 'marceneiro', label: 'Marceneiro'   },
  { value: 'montador',   label: 'Montador'     },
  { value: 'auxiliar',   label: 'Auxiliar'     },
  { value: 'cnc',        label: 'Operador CNC' },
];

function EquipeLogin({ onSuccess }) {
  const [funcao, setFuncao] = useState('');
  const [nome,   setNome]   = useState('');
  const [error,  setError]  = useState('');
  const submit = () => {
    if (!funcao) { setError('Selecione a função.'); return; }
    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    const user = authenticate(funcao, '', nome);
    if (!user) { setError('Erro ao entrar.'); return; }
    onSuccess(user);
  };
  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {EQUIPE_ROLES.map((r) => (
          <button key={r.value} type="button" onClick={() => { setFuncao(r.value); setError(''); }}
            className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${funcao === r.value ? 'border-gold bg-gold/10 text-gold' : 'border-white/20 bg-white/5 text-white/70'}`}>
            {r.label}
          </button>
        ))}
      </div>
      {funcao && (
        <>
          <input value={nome} onChange={(e) => { setNome(e.target.value); setError(''); }}
            placeholder="Seu nome" autoComplete="name" autoCapitalize="words"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
          <button onClick={submit} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
        </>
      )}
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
    </div>
  );
}

// Diretor: nome + senha
function DiretorLogin({ onSuccess }) {
  const [nome,  setNome]  = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    const user = authenticate('diretor', senha, nome);
    if (!user) { setError('Senha incorreta.'); return; }
    onSuccess(user);
  };
  return (
    <div className="w-full max-w-xs space-y-3">
      <input value={nome} onChange={(e) => { setNome(e.target.value); setError(''); }}
        placeholder="Seu nome" autoComplete="name" autoCapitalize="words"
        className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
      <PasswordInput value={senha} onChange={(e) => { setSenha(e.target.value); setError(''); }} onEnter={submit} />
      <button onClick={submit} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
    </div>
  );
}

const CONTEXT_LABELS = {
  '/gerente':       'Gerente de Fábrica',
  '/coordenadores': 'Coordenadores',
  '/equipe':        'Equipe',
  '/ceo':           'Diretor',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/';
  const roleParam = searchParams.get('role') || '';

  useEffect(() => {
    const session = getSession();
    if (session) {
      const sessionDest = ROLE_CONFIG[session.role]?.dest || '/';
      // Se a sessão atual não tem permissão para o destino solicitado, limpa e força novo login
      if (nextUrl !== '/' && sessionDest !== nextUrl) {
        clearSession();
        return;
      }
      router.replace(nextUrl !== '/' ? nextUrl : sessionDest);
    }
  }, [router, nextUrl]);

  const onSuccess = (user) => {
    setSession(user);
    router.push(nextUrl !== '/' ? nextUrl : (ROLE_CONFIG[user.role]?.dest || '/'));
  };

  let label = CONTEXT_LABELS[nextUrl] || 'Acesso';
  if (nextUrl === '/ceo' && roleParam === 'ariel') label = 'Head de Gestão';

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
      <Link href="/">
        <img src="/logo.png" alt="Lukana" className="h-12 w-auto mb-3 brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
      </Link>
      <div className="text-white/40 text-sm mb-10">{label}</div>

      {nextUrl === '/gerente'       && <GerenteLogin onSuccess={onSuccess} />}
      {nextUrl === '/coordenadores' && <CoordLogin   onSuccess={onSuccess} presetRole={roleParam} />}
      {nextUrl === '/equipe'        && <EquipeLogin  onSuccess={onSuccess} />}
      {nextUrl === '/ceo' && roleParam === 'ariel' && <ArielLogin onSuccess={onSuccess} />}
      {nextUrl === '/ceo' && roleParam !== 'ariel' && <DiretorLogin onSuccess={onSuccess} />}
      {!['/gerente','/coordenadores','/equipe','/ceo'].includes(nextUrl) && (
        <p className="text-white/40 text-sm text-center">Acesse pelo menu principal.</p>
      )}

      <Link href="/" className="mt-10 text-white/25 text-xs">Voltar ao início</Link>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-navy" />}>
      <LoginForm />
    </Suspense>
  );
}
