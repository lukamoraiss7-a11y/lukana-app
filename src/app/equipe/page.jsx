'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EQUIPE_PERGUNTAS, AMBIENTES_LISTA } from '@/lib/questions';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

function StatusBtns({ value, onChange }) {
  const opts = [
    { s: 'sim',   label: 'Sim',   cls: 'status-ok' },
    { s: 'nao',   label: 'Não',   cls: 'status-bloq' },
    { s: 'outro', label: 'Outro', cls: 'status-duvida' },
  ];
  return (
    <div className="flex gap-2 mt-2 mb-2">
      {opts.map((o) => (
        <button key={o.s} onClick={() => onChange(value === o.s ? null : o.s)}
          className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-all ${value === o.s ? o.cls : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const INIT_RESPOSTAS = () => EQUIPE_PERGUNTAS.map((_, i) => {
  if (i === 0) return { status: null, q1_ambientes: [], q1_ambiente_outro: '', q1_descricao: '' };
  if (i === 5) return { status: 'sim', text: '' }; // Q6 é sempre texto livre
  return { status: null, text: '' };
});

function AmbientesSelect({ selected, onToggle, outro, onOutro }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {AMBIENTES_LISTA.map((a) => {
          const sel = selected.includes(a);
          return (
            <button key={a} type="button" onClick={() => onToggle(a)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${sel ? 'border-gold bg-gold/10 text-navy' : 'border-gray-200 bg-white text-gray-500'}`}>
              {a}
            </button>
          );
        })}
        <button type="button" onClick={() => onToggle('__outro__')}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${selected.includes('__outro__') ? 'border-gold bg-gold/10 text-navy' : 'border-gray-200 bg-white text-gray-500'}`}>
          Outro
        </button>
      </div>
      {selected.includes('__outro__') && (
        <input value={outro} onChange={(e) => onOutro(e.target.value)}
          placeholder="Qual ambiente?"
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold mt-1" />
      )}
    </div>
  );
}

export default function EquipePage() {
  const router = useRouter();
  const [step, setStep]             = useState(0);
  const [session, setSessionState]  = useState(null);
  const [obra, setObra]             = useState('');
  const [obras, setObras]           = useState([]);

  useEffect(() => {
    const s = getSession();
    const allowed = ['marceneiro','montador','auxiliar','cnc','encarregado','coordenador_obra','coordenador_projetos','gerente','diretor'];
    if (!s || !allowed.includes(s.role)) { router.replace('/login?next=/equipe'); return; }
    setSessionState(s);
    fetch('/api/obras?aprovadas_only=1').then(r => r.json()).then(d => setObras(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);
  const [respostas, setRespostas]   = useState(INIT_RESPOSTAS());
  const [q7escalate, setQ7escalate] = useState(null);
  const [q7text, setQ7text]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [sugestao, setSugestao]     = useState('');
  const [envSugestao, setEnvSugestao] = useState(false);

  const setR = (i, field, val) => setRespostas((prev) => prev.map((r, j) => j === i ? { ...r, [field]: val } : r));

  const q1 = respostas[0];
  const q1AmbientesOk = q1.q1_ambientes?.length > 0 &&
    (!q1.q1_ambientes.includes('__outro__') || q1.q1_ambiente_outro?.trim());
  const q1Complete = q1AmbientesOk && !!q1.q1_descricao?.trim();

  const canAdvance = () => {
    if (step === 0) return session && obra.trim();
    if (step === 1) {
      if (!q1Complete) return false;
      if (!respostas.slice(1, 5).every((r) => r.status !== null)) return false; // Q2-5 precisam de status
      if (q7escalate === null) return false;
      if (q7escalate === 'sim' && !q7text.trim()) return false;
      return true;
    }
    return true;
  };

  const handleEnviarSugestao = async () => {
    if (!sugestao.trim()) return;
    setEnvSugestao(true);
    try {
      await fetch('/api/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'sugestao', texto: sugestao.trim(), autor: session?.nome || session?.role || 'Equipe' }) });
      setSugestao('');
      alert('Sugestão enviada!');
    } catch { alert('Erro ao enviar sugestão.'); }
    finally { setEnvSugestao(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    const ambienteStr = q1.q1_ambientes
      .map((a) => a === '__outro__' ? q1.q1_ambiente_outro : a)
      .filter(Boolean).join(', ');
    try {
      const payload = {
        name: session?.nome || '', obra,
        q1_status:    q1Complete ? 'sim' : 'nao',
        q1_cliente:   '',
        q1_ambiente:  ambienteStr,
        q1_descricao: q1.q1_descricao || '',
        q1_text:      q1.q1_descricao || '', // backward compat
        q2_status: respostas[1].status, q2_text: respostas[1].text,
        q3_status: respostas[2].status, q3_text: respostas[2].text,
        q4_status: respostas[3].status, q4_text: respostas[3].text,
        q5_status: respostas[4].status, q5_text: respostas[4].text,
        q6_status: respostas[5].status, q6_text: respostas[5].text,
        q7_escalate: q7escalate === 'sim',
        q7_text: q7text,
      };
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      setStep(3);
    } catch { setError('Erro ao enviar. Verifique a conexão e tente novamente.'); }
    finally { setSubmitting(false); }
  };

  if (step === 3) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-gold text-2xl font-bold mb-2">Enviado!</h1>
        <p className="text-white/60 text-sm text-center mb-10">Status do dia registrado com sucesso.</p>
        <button onClick={() => { setStep(0); setObra(''); setRespostas(INIT_RESPOSTAS()); setQ7escalate(null); setQ7text(''); }}
          className="px-8 py-3 bg-gold text-navy font-bold rounded-full">Novo envio</button>
        <Link href="/" className="mt-4 text-white/40 text-sm">Voltar ao início</Link>
      </main>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f4f6]">
      <header className="sticky top-0 z-40 bg-navy px-4 py-3.5 flex items-center gap-3 shadow-lg">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="text-white/60 mr-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
        )}
        <Link href="/">
          <img src="/logo.png" alt="Lukana" className="h-7 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        </Link>
        <div>
          <div className="text-white font-semibold text-sm leading-none">Status do Dia</div>
          <div className="text-white/40 text-[11px] mt-0.5">{step === 0 ? 'Identificação' : 'Perguntas'}</div>
        </div>
        <div className="ml-auto flex gap-1">
          {[0,1].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-gold w-6' : 'bg-white/20 w-3'}`} />
          ))}
        </div>
      </header>

      {step === 0 && (
        <div className="flex-1 p-4">
          {session && (
            <div className="bg-navy rounded-xl px-4 py-3 mb-5">
              <div className="text-gold font-bold text-base">{session.nome}</div>
              <div className="text-white/50 text-xs capitalize">{session.role}</div>
            </div>
          )}
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Obra / cliente</label>
          <select value={obra} onChange={(e) => setObra(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-gold">
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
          </select>

          {/* Sugestão de melhoria */}
          <div className="mt-5 bg-white rounded-xl shadow-sm p-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Sugestão de melhoria</p>
            <textarea value={sugestao} onChange={(e) => setSugestao(e.target.value)} rows={3}
              placeholder="Tem alguma ideia para melhorar o app, a obra ou a fábrica? Escreva aqui..."
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300 mb-3" />
            <button onClick={handleEnviarSugestao} disabled={!sugestao.trim() || envSugestao}
              className="w-full py-2.5 bg-navy text-white font-bold rounded-xl text-sm disabled:opacity-40">
              {envSugestao ? 'Enviando...' : 'Enviar sugestão'}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 p-4">
          <div className="text-xs text-gray-400 mb-3 px-1">{session?.nome} · {obra}</div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            {/* Q1 — estruturado */}
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 leading-snug mb-3">
                <span className="text-gold font-bold mr-1.5">1.</span>{EQUIPE_PERGUNTAS[0].texto}
              </p>
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ambiente(s) *</p>
                <AmbientesSelect
                  selected={q1.q1_ambientes || []}
                  onToggle={(a) => setR(0, 'q1_ambientes', q1.q1_ambientes?.includes(a) ? q1.q1_ambientes.filter((x) => x !== a) : [...(q1.q1_ambientes || []), a])}
                  outro={q1.q1_ambiente_outro || ''}
                  onOutro={(v) => setR(0, 'q1_ambiente_outro', v)}
                />
                <textarea value={q1.q1_descricao} onChange={(e) => setR(0, 'q1_descricao', e.target.value)}
                  rows={2} placeholder="Descrição dos móveis que serão produzidos/instalados hoje *"
                  className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none placeholder:text-gray-300 ${q1Complete ? 'border-green-300 focus:border-green-400' : 'border-gray-200 focus:border-gold'}`} />
                {!q1Complete && <p className="text-[10px] text-amber-500 px-1">Selecione ambiente(s) e preencha a descrição</p>}
              </div>
            </div>

            {/* Q2–6 */}
            {EQUIPE_PERGUNTAS.slice(1).map((q, idx) => {
              const i = idx + 1;
              const r = respostas[i];
              // Q6 (idx=4, i=5): texto livre sempre visível, sem botões
              if (i === 5) {
                return (
                  <div key={q.id} className="px-4 py-3.5 border-b border-gray-100 last:border-0">
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      <span className="text-gold font-bold mr-1.5">{i + 1}.</span>{q.texto}
                    </p>
                    <textarea value={r.text} onChange={(e) => setR(i, 'text', e.target.value)}
                      rows={2} placeholder={q.placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
                  </div>
                );
              }
              const showDetail = r.status === 'sim' || r.status === 'outro';
              return (
                <div key={q.id} className="px-4 py-3.5 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium text-gray-800 leading-snug">
                    <span className="text-gold font-bold mr-1.5">{i + 1}.</span>{q.texto}
                  </p>
                  <StatusBtns value={r.status} onChange={(s) => setR(i, 'status', s)} />
                  {showDetail && (
                    <textarea value={r.text} onChange={(e) => setR(i, 'text', e.target.value)}
                      rows={2} placeholder={q.placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Q7 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-2">
            <p className="text-sm font-medium text-gray-800 mb-3">
              <span className="text-gold font-bold mr-1.5">7.</span>Tem algo que só o Diretor resolve?
            </p>
            <div className="flex gap-3 mb-3">
              {['nao','sim'].map((v) => (
                <button key={v} onClick={() => setQ7escalate(v)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${q7escalate === v ? (v === 'sim' ? 'status-bloq' : 'status-ok') : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                  {v === 'nao' ? 'Não' : 'Sim'}
                </button>
              ))}
            </div>
            {q7escalate === 'sim' && (
              <textarea value={q7text} onChange={(e) => setQ7text(e.target.value)} rows={2}
                placeholder="Qual decisão, urgência..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
            )}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 p-4 bg-[#f4f4f6] border-t border-gray-200">
        {error && <p className="text-red-500 text-xs text-center mb-2">{error}</p>}
        <button onClick={step === 1 ? handleSubmit : () => setStep(step + 1)}
          disabled={!canAdvance() || submitting}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${canAdvance() && !submitting ? 'bg-gold text-navy active:opacity-80' : 'bg-gray-200 text-gray-400'}`}>
          {submitting ? 'Enviando...' : step === 1 ? 'Enviar status' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
