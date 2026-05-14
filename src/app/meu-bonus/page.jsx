'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MARCENEIROS } from '@/lib/auth';

const SESSION_KEY = 'lukana_mbonus_session';

const fmtBRL = (v) =>
  v == null || isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

// Calcula dias de atraso a partir de hoje vs data_limite
function calcAtrasoHoje(dataLimite) {
  if (!dataLimite) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(dataLimite + 'T00:00:00');
  const diff = Math.floor((hoje - limite) / 86400000);
  return diff > 0 ? diff : 0;
}

function calcDiasRestantes(dataLimite) {
  if (!dataLimite) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(dataLimite + 'T00:00:00');
  return Math.floor((limite - hoje) / 86400000);
}

function calcDesconto(bonif, diasAtraso) {
  const penPct = Math.floor(diasAtraso / 3) * 0.5;
  return bonif * (penPct / 100);
}

// ── Card de bonificação do marceneiro ───────────────────────────────────────
function BonusCard({ record, marceneiroId }) {
  const [now, setNow] = useState(Date.now());

  // Atualiza o clock a cada minuto (desconto em tempo real)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const pv   = parseFloat(record.inputs?.preco_venda) || 0;
  const func = record.funcionarios?.find((f) => f.marceneiro_id === marceneiroId);
  if (!func) return null;

  const pct    = parseFloat(func.percentual) || 0;
  const bonif  = (pct / 100) * pv;

  const diasAtraso    = calcAtrasoHoje(record.data_limite);
  const diasRestantes = calcDiasRestantes(record.data_limite);
  const desconto      = calcDesconto(bonif, diasAtraso);
  const valorLiquido  = bonif - desconto;
  const penPct        = Math.floor(diasAtraso / 3) * 0.5;

  const statusColor =
    diasRestantes === null ? 'text-gray-400' :
    diasAtraso > 0         ? 'text-red-600'  :
    diasRestantes <= 3     ? 'text-amber-600' : 'text-green-600';

  const statusLabel =
    diasRestantes === null   ? 'Sem prazo definido' :
    diasAtraso > 0           ? `${diasAtraso}d de atraso` :
    diasRestantes === 0      ? 'Vence hoje' :
    `${diasRestantes}d restantes`;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-3">
      {/* Header colorido por status */}
      <div className={`px-4 py-2 ${diasAtraso > 0 ? 'bg-red-50' : diasRestantes !== null && diasRestantes <= 3 ? 'bg-amber-50' : 'bg-green-50'}`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-gray-600">{record.nome_projeto}</span>
          <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
        </div>
        {record.data_limite && (
          <p className="text-[11px] text-gray-400 mt-0.5">Prazo: {fmtDate(record.data_limite)}</p>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Módulos */}
        {record.modulos?.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase mb-1.5">Peças</p>
            <div className="flex flex-wrap gap-1.5">
              {record.modulos.map((m, i) => (
                <span key={i} className="bg-navy/8 text-navy text-xs font-semibold px-2.5 py-1 rounded-full border border-navy/15">{m}</span>
              ))}
            </div>
          </div>
        )}
        {/* Valor base */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Sua bonificação ({pct}%)</span>
          <span className="text-base font-bold text-navy font-mono">{fmtBRL(bonif)}</span>
        </div>

        {/* Desconto */}
        {diasAtraso > 0 ? (
          <div className="bg-red-50 rounded-xl px-3 py-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-red-600 font-semibold">Desconto por atraso</span>
              <span className="text-sm font-bold text-red-700 font-mono">- {fmtBRL(desconto)}</span>
            </div>
            <p className="text-[11px] text-red-400">
              {diasAtraso}d atrasado → -{penPct.toFixed(1)}% ({Math.floor(diasAtraso / 3)} períodos de 3 dias)
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">
              {diasRestantes !== null && diasRestantes > 0
                ? `Sem desconto agora. Cada 3 dias de atraso = -0,5% (${fmtBRL(bonif * 0.005)} por período).`
                : diasRestantes === 0
                ? 'Vence hoje. Entregue a tempo para evitar desconto.'
                : 'Sem prazo definido.'}
            </p>
          </div>
        )}

        {/* Valor líquido */}
        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-600">
            {diasAtraso > 0 ? 'Você receberá' : 'Você pode receber'}
          </span>
          <span className={`text-xl font-bold font-mono ${diasAtraso > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {fmtBRL(valorLiquido)}
          </span>
        </div>

        {/* Projeção se atrasar */}
        {diasAtraso === 0 && diasRestantes !== null && diasRestantes >= 0 && (
          <div className="text-[11px] text-gray-400 text-center">
            Se atrasar 3 dias: {fmtBRL(bonif - bonif * 0.005)} · 6 dias: {fmtBRL(bonif - bonif * 0.01)} · 9 dias: {fmtBRL(bonif - bonif * 0.015)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tela de login ───────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selectedId, setSelectedId] = useState('');
  const [senha, setSenha]           = useState('');
  const [erro, setErro]             = useState('');
  const [showPass, setShowPass]     = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    const m = MARCENEIROS.find((x) => x.id === selectedId);
    if (!m) { setErro('Selecione seu nome.'); return; }
    if (m.senha !== senha) { setErro('Senha incorreta.'); return; }
    onLogin({ id: m.id, nome: m.nome });
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
      <Link href="/" className="mb-10 text-center select-none">
        <img src="/logo.png" alt="Lukana" className="h-12 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        <div className="text-white/40 text-xs mt-2">Minha Bonificação</div>
      </Link>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">Seu nome</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold">
            <option value="" className="bg-navy">Selecionar...</option>
            {MARCENEIROS.map((m) => (
              <option key={m.id} value={m.id} className="bg-navy">{m.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Senha</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold pr-11"
            />
            <button type="button" onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                {showPass
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {erro && <p className="text-xs text-red-400 text-center">{erro}</p>}

        <button type="submit"
          className="w-full py-3 rounded-xl bg-gold text-white font-bold text-sm mt-2">
          Entrar
        </button>
      </form>
    </main>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function MeuBonusPage() {
  const [session, setSession]   = useState(null);
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setSession(JSON.parse(saved)); } catch {}
    }
    setHydrated(true);
  }, []);

  const handleLogin = useCallback((user) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession(user);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRecords([]);
  };

  const fetchRecords = useCallback(async (marceneiroId) => {
    setLoading(true);
    try {
      const r = await fetch('/api/bonificacao');
      if (!r.ok) return;
      const all = await r.json();
      // Filtra apenas registros onde este marceneiro está alocado
      const mine = all.filter((rec) =>
        rec.funcionarios?.some((f) => f.marceneiro_id === marceneiroId)
      );
      setRecords(mine);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchRecords(session.id);
  }, [session, fetchRecords]);

  if (!hydrated) return null;
  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const hoje = new Date().toISOString().slice(0, 10);
  const ativos   = records.filter((r) => !r.data_limite || r.data_limite >= hoje);
  const passados = records.filter((r) => r.data_limite && r.data_limite < hoje);

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-navy flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Lukana" className="h-6 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
          <span className="text-sm font-bold text-white">{session.nome}</span>
        </div>
        <button onClick={handleLogout} className="text-xs text-white/40 hover:text-white/70 px-3 py-1 rounded-lg hover:bg-white/5">
          Sair
        </button>
      </header>

      <main className="flex-1 mt-14 px-4 pt-4 pb-6">
        <h2 className="text-base font-bold text-navy mb-4">Minha Bonificação</h2>

        {loading && <p className="text-sm text-gray-400 text-center py-10">Carregando...</p>}

        {!loading && records.length === 0 && (
          <div className="text-center py-14">
            <p className="text-sm text-gray-400">Nenhuma bonificação registrada ainda.</p>
          </div>
        )}

        {!loading && ativos.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Em andamento</p>
            {ativos.map((r) => (
              <BonusCard key={r.id} record={r} marceneiroId={session.id} />
            ))}
          </div>
        )}

        {!loading && passados.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Anteriores</p>
            {passados.map((r) => (
              <BonusCard key={r.id} record={r} marceneiroId={session.id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
