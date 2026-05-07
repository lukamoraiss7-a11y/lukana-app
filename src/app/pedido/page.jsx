'use client';

import { useState, useEffect } from 'react';
import { TEAM_MEMBERS } from '@/lib/questions';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

const CAT_CONFIG = {
  'MDF': {
    unidade: 'chapa',
    campos: [
      { key: 'cor', label: 'Cor', type: 'text', ph: 'Ex: Branco TX, Areia, Grafite...' },
      { key: 'espessura', label: 'Espessura', type: 'chips', opts: ['6mm', '15mm', '18mm'], required: true },
    ],
  },
  'Fita de Bordo': {
    unidade: 'metros',
    campos: [
      { key: 'cor', label: 'Cor', type: 'text', ph: 'Ex: Branco TX, Areia...' },
      { key: 'largura', label: 'Largura', type: 'chips', opts: ['22mm', '40mm', '100mm'], required: true },
    ],
  },
  'Corrediça': {
    unidade: 'par',
    campos: [
      { key: 'marca', label: 'Marca', type: 'chips', opts: ['Blum', 'Hardt'], required: true },
      { key: 'tamanho', label: 'Tamanho', type: 'chips', opts: ['25cm','30cm','35cm','40cm','45cm','50cm','55cm'], required: true },
    ],
  },
  'Dobradiça': {
    unidade: 'unidade',
    campos: [
      { key: 'tipo', label: 'Tipo', type: 'chips', opts: ['Reta', 'Alta', 'Super Alta'], required: true },
    ],
  },
  'Parafuso':         { unidade: 'unidade', campos: [{ key: 'descricao', label: 'Especificação', type: 'text', ph: 'Ex: 3x25mm...' }] },
  'Cantoneira':       { unidade: 'unidade', campos: [{ key: 'descricao', label: 'Especificação', type: 'text', ph: '' }] },
  'Cola':             { unidade: 'litro',   campos: [{ key: 'descricao', label: 'Tipo', type: 'text', ph: 'Ex: Contato, PVA...' }] },
  'Thinner':          { unidade: 'litro',   campos: [{ key: 'descricao', label: 'Especificação', type: 'text', ph: '' }] },
  'Estopa':           { unidade: 'kg',      campos: [{ key: 'descricao', label: 'Especificação', type: 'text', ph: '' }] },
  'Disp. Prateleira': { unidade: 'unidade', campos: [{ key: 'descricao', label: 'Especificação', type: 'text', ph: '' }] },
};

const CATEGORIAS = Object.keys(CAT_CONFIG);
const EMPTY_FORM = { categoria: '', cor: '', espessura: '', largura: '', marca: '', tamanho: '', tipo: '', descricao: '', quantidade: '' };

const getItemKey = (item) =>
  `${item.categoria}|${item.cor||''}|${item.espessura||''}|${item.largura||''}|${item.marca||''}|${item.tamanho||''}|${item.tipo||''}|${item.descricao||''}`;

export const itemLabel = (item) => {
  const specs = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao].filter(Boolean);
  return specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
};

const pluralUnidade = (item) => `${item.quantidade} ${item.unidade}${item.quantidade > 1 && !item.unidade.endsWith('s') && item.unidade !== 'kg' ? 's' : ''}`;

const STEP_LABELS = ['Identificação', 'Materiais', 'Revisão'];

const PEDIDO_PASS = process.env.NEXT_PUBLIC_PEDIDO_PASS || 'pedido645';

export default function PedidoPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [step, setStep] = useState(0);
  const [obras, setObras] = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [obraId, setObraId] = useState('');
  const [obraNome, setObraNome] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [sessionNome, setSessionNome] = useState(''); // auto-filled if logged in
  const [itens, setItens] = useState([]);
  const [itemForm, setItemForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [baixas, setBaixas] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = getSession();
    if (s) { setSolicitante(s.nome); setSessionNome(s.nome); }
    fetch('/api/obras').then((r) => r.json())
      .then((d) => setObras(Array.isArray(d) ? d : []))
      .catch(() => setObras([]))
      .finally(() => setLoadingObras(false));
  }, []);

  const setIF = (k, v) => setItemForm((f) => ({ ...f, [k]: v }));
  const cfg = CAT_CONFIG[itemForm.categoria];

  const canAddItem = () => {
    if (!itemForm.categoria || !itemForm.quantidade || Number(itemForm.quantidade) <= 0) return false;
    if (!cfg) return false;
    return cfg.campos.every((c) => !c.required || !!itemForm[c.key]);
  };

  const addItem = () => {
    if (!canAddItem()) return;
    const newItem = {
      categoria: itemForm.categoria,
      ...(itemForm.cor        && { cor: itemForm.cor }),
      ...(itemForm.espessura  && { espessura: itemForm.espessura }),
      ...(itemForm.largura    && { largura: itemForm.largura }),
      ...(itemForm.marca      && { marca: itemForm.marca }),
      ...(itemForm.tamanho    && { tamanho: itemForm.tamanho }),
      ...(itemForm.tipo       && { tipo: itemForm.tipo }),
      ...(itemForm.descricao  && { descricao: itemForm.descricao }),
      quantidade: Number(itemForm.quantidade),
      unidade: cfg.unidade,
    };
    setItens((prev) => {
      const key = getItemKey(newItem);
      const idx = prev.findIndex((i) => getItemKey(i) === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantidade: updated[idx].quantidade + newItem.quantidade };
        return updated;
      }
      return [...prev, newItem];
    });
    setItemForm({ ...EMPTY_FORM, categoria: itemForm.categoria });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_id: obraId, obra_nome: obraNome, solicitante, itens }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setBaixas(result.baixas || []);
      setSent(true);
    } catch {
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return obraId && solicitante;
    if (step === 1) return itens.length > 0;
    return true;
  };

  const resetAll = () => { setStep(0); setObraId(''); setObraNome(''); if (!sessionNome) setSolicitante(''); setItens([]); setItemForm(EMPTY_FORM); setSent(false); setBaixas([]); };

  if (!unlocked) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <Link href="/">
          <img src="/logo.png" alt="Lukana" className="h-12 w-auto mb-3 brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        </Link>
        <div className="text-white/40 text-sm mb-10">Pedido de Material</div>
        <div className="w-full max-w-xs space-y-3">
          <input
            type="password"
            value={passInput}
            onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (passInput === PEDIDO_PASS) setUnlocked(true);
                else setPassError(true);
              }
            }}
            placeholder="Senha"
            className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold"
          />
          <button
            onClick={() => { if (passInput === PEDIDO_PASS) setUnlocked(true); else setPassError(true); }}
            className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">
            Entrar
          </button>
          {passError && <p className="text-red-300 text-sm text-center">Senha incorreta.</p>}
        </div>
        <Link href="/" className="mt-10 text-white/25 text-xs">Voltar ao início</Link>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-gold text-xl font-bold mb-2">Pedido enviado!</h1>
        <p className="text-white/50 text-sm mb-1">{obraNome}</p>
        <p className="text-white/30 text-sm mb-6">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</p>
        {baixas.length > 0 && (
          <div className="w-full max-w-xs bg-white/10 rounded-2xl p-4 mb-8">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wide mb-2">Atendido do estoque</p>
            {baixas.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1 border-b border-white/10 last:border-0">
                <span className="text-white/80 text-sm">{b.nome}</span>
                <span className="text-green-400 text-sm font-bold">−{b.quantidade} {b.unidade}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={resetAll} className="px-8 py-3 bg-gold text-navy font-bold rounded-full mb-4">Novo pedido</button>
        <Link href="/" className="text-white/30 text-sm">Voltar ao início</Link>
      </main>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f4f6]">
      <header className="sticky top-0 z-40 bg-navy px-4 py-3.5 flex items-center gap-3 shadow-lg">
        {step > 0
          ? <button onClick={() => setStep(step - 1)} className="text-white/60 mr-1">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
          : <Link href="/" className="text-white/60 mr-1">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
        }
        <div>
          <div className="text-white font-semibold text-sm leading-none">Pedido de Material</div>
          <div className="text-white/40 text-[11px] mt-0.5">{STEP_LABELS[step]}</div>
        </div>
        <div className="ml-auto flex gap-1">
          {[0,1,2].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-gold w-6' : 'bg-white/20 w-3'}`} />
          ))}
        </div>
      </header>

      {/* STEP 0 — Identificação */}
      {step === 0 && (
        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Obra</label>
            {loadingObras ? (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-400 text-center">Carregando obras...</div>
            ) : obras.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-400 text-center">Nenhuma obra cadastrada. Peça ao Diretor para cadastrar no sistema.</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {obras.map((o) => (
                  <button key={o.id} onClick={() => { setObraId(o.id); setObraNome(o.nome); }}
                    className={`w-full text-left px-4 py-3.5 text-sm font-medium border-b last:border-0 border-gray-100 transition-colors ${obraId === o.id ? 'bg-navy text-gold font-bold' : 'text-gray-800'}`}>
                    {o.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Solicitante</label>
            {sessionNome ? (
              <div className="bg-white rounded-xl px-4 py-3.5 text-sm font-bold text-navy border-2 border-green-200">{sessionNome}</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {TEAM_MEMBERS.map((m) => (
                  <button key={m} onClick={() => setSolicitante(m)}
                    className={`w-full text-left px-4 py-3.5 text-sm font-medium border-b last:border-0 border-gray-100 transition-colors ${solicitante === m ? 'bg-navy text-gold font-bold' : 'text-gray-800'}`}>
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 1 — Itens */}
      {step === 1 && (
        <div className="flex-1 p-4">
          <div className="text-xs text-gray-400 mb-3 px-1">{obraNome} · {solicitante}</div>

          {itens.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="px-4 pt-3 pb-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
              </div>
              {itens.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 leading-snug">{itemLabel(item)}</div>
                    <div className="text-xs text-gray-400">{pluralUnidade(item)}</div>
                  </div>
                  <button onClick={() => setItens((prev) => prev.filter((_,j) => j !== i))} className="text-gray-300 text-xl leading-none px-1 hover:text-red-400 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Adicionar item</p>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Categoria</label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {CATEGORIAS.map((cat) => (
                <button key={cat} onClick={() => setItemForm({ ...EMPTY_FORM, categoria: cat })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${itemForm.categoria === cat ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  {cat}
                </button>
              ))}
            </div>

            {cfg && cfg.campos.map((c) => (
              <div key={c.key} className="mb-3">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  {c.label}{c.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {c.type === 'chips' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.opts.map((opt) => (
                      <button key={opt} onClick={() => setIF(c.key, itemForm[c.key] === opt ? '' : opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${itemForm[c.key] === opt ? 'border-gold bg-gold/10 text-[#b38d3c] font-bold' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={itemForm[c.key] || ''} onChange={(e) => setIF(c.key, e.target.value)}
                    placeholder={c.ph || ''}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
                )}
              </div>
            ))}

            {itemForm.categoria && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Quantidade <span className="text-red-400">*</span>
                  {cfg && <span className="font-normal text-gray-300 ml-1">({cfg.unidade})</span>}
                </label>
                <input type="number" min="1" value={itemForm.quantidade} onChange={(e) => setIF('quantidade', e.target.value)}
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
              </div>
            )}

            <button onClick={addItem} disabled={!canAddItem()}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${canAddItem() ? 'bg-navy text-gold active:opacity-80' : 'bg-gray-100 text-gray-300'}`}>
              + Adicionar
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Revisão */}
      {step === 2 && (
        <div className="flex-1 p-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <div className="font-bold text-navy text-[15px]">{obraNome}</div>
              <div className="text-xs text-gray-400">{solicitante}</div>
            </div>
            {itens.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800">{itemLabel(item)}</div>
                  <div className="text-xs text-gray-400">{pluralUnidade(item)}</div>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-red-500 text-xs text-center mb-2">{error}</p>}
        </div>
      )}

      <div className="sticky bottom-0 p-4 bg-[#f4f4f6] border-t border-gray-200">
        <button
          onClick={step === 2 ? handleSubmit : () => setStep(step + 1)}
          disabled={!canAdvance() || submitting}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${canAdvance() && !submitting ? 'bg-gold text-navy active:opacity-80' : 'bg-gray-200 text-gray-400'}`}>
          {submitting ? 'Enviando...' : step === 2 ? 'Enviar pedido' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
