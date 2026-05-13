'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TEAM_MEMBERS } from '@/lib/questions';
import { getSession } from '@/lib/auth';

// ── Pedido config (same as /pedido) ───────────────────────────────────────────
const CAT_CONFIG = {
  'MDF': {
    unidade: 'chapa',
    campos: [
      { key: 'espessura', label: 'Espessura', type: 'chips', opts: ['6mm', '15mm', '18mm'], required: true },
      { key: 'marca_mdf', label: 'Marca', type: 'chips', opts: ['Duratex', 'Greenplac', 'Arauco', 'Guararapes', 'Berneck'] },
    ],
    corCustom: true,
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
  'Outros':           { unidade: 'unidade', campos: [{ key: 'descricao', label: 'Descreva o material', type: 'text', ph: 'Ex: Puxador 128mm preto fosco...', required: true }] },
};

const CATEGORIAS = Object.keys(CAT_CONFIG);

const GRUPOS = [
  { label: 'Chapas',      cats: ['MDF'] },
  { label: 'Ferragens',   cats: ['Corrediça', 'Dobradiça'] },
  { label: 'Acabamento',  cats: ['Fita de Bordo'] },
  { label: 'Fixação',     cats: ['Parafuso', 'Cantoneira'] },
  { label: 'Química',     cats: ['Cola', 'Thinner', 'Estopa'] },
  { label: 'Outros',      cats: ['Disp. Prateleira', 'Outros'] },
];
const EMPTY_FORM = { categoria: '', cor: '', espessura: '', largura: '', marca: '', marca_mdf: '', tamanho: '', tipo: '', descricao: '', quantidade: '', cor_tipo: '', cor_detalhe: '', cor_especial: '' };

const COR_TIPOS = ['Branco', 'Madeirado', 'Sólido', 'Especial'];
const COR_ESPECIAIS = ['Laca', 'Pedra', 'Tecido', 'Outro'];

const getItemKey = (item) =>
  `${item.categoria}|${item.cor||''}|${item.espessura||''}|${item.largura||''}|${item.marca||''}|${item.marca_mdf||''}|${item.tamanho||''}|${item.tipo||''}|${item.descricao||''}`;

const itemLabel = (item) => {
  const specs = [item.cor, item.espessura, item.largura, item.marca, item.marca_mdf, item.tamanho, item.tipo, item.descricao].filter(Boolean);
  return specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
};

// Monta string de cor do MDF a partir dos campos de cor_tipo, cor_especial, cor_detalhe
function buildCorMdf(cor_tipo, cor_especial, cor_detalhe) {
  if (!cor_tipo) return '';
  if (cor_tipo === 'Branco') return 'Branco';
  if (cor_tipo === 'Especial') {
    const parts = [cor_especial, cor_detalhe].filter(Boolean);
    return parts.length ? `Especial · ${parts.join(' · ')}` : 'Especial';
  }
  return cor_detalhe ? `${cor_tipo} · ${cor_detalhe}` : cor_tipo;
}

const pluralUnidade = (item) =>
  `${item.quantidade} ${item.unidade}${item.quantidade > 1 && !item.unidade.endsWith('s') && item.unidade !== 'kg' ? 's' : ''}`;

const STEP_LABELS = ['Identificação', 'Materiais', 'Revisão'];
const PEDIDO_PASS = process.env.NEXT_PUBLIC_PEDIDO_PASS || 'pedido645';
const INCLUSAO_PASS = process.env.NEXT_PUBLIC_INCLUSAO_PASS || 'entrada645';

// ── Pedido Tab ─────────────────────────────────────────────────────────────────
function PedidoTab() {
  const [step, setStep] = useState(0);
  const [obras, setObras] = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [obraId, setObraId] = useState('');
  const [obraNome, setObraNome] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [sessionNome, setSessionNome] = useState('');
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
    if (!cfg.campos.every((c) => !c.required || !!itemForm[c.key])) return false;
    if (cfg.corCustom && !itemForm.cor_tipo) return false;
    return true;
  };

  const addItem = () => {
    if (!canAddItem()) return;
    const corMdf = cfg.corCustom ? buildCorMdf(itemForm.cor_tipo, itemForm.cor_especial, itemForm.cor_detalhe) : '';
    const newItem = {
      categoria: itemForm.categoria,
      ...(corMdf             && { cor: corMdf }),
      ...(itemForm.cor       && !cfg.corCustom && { cor: itemForm.cor }),
      ...(itemForm.espessura && { espessura: itemForm.espessura }),
      ...(itemForm.largura   && { largura: itemForm.largura }),
      ...(itemForm.marca     && { marca: itemForm.marca }),
      ...(itemForm.marca_mdf && { marca_mdf: itemForm.marca_mdf }),
      ...(itemForm.tamanho   && { tamanho: itemForm.tamanho }),
      ...(itemForm.tipo      && { tipo: itemForm.tipo }),
      ...(itemForm.descricao && { descricao: itemForm.descricao }),
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
    if (step === 0) return obraId;
    if (step === 1) return itens.length > 0;
    return true;
  };

  const resetAll = () => {
    setStep(0); setObraId(''); setObraNome('');
    if (!sessionNome) setSolicitante('');
    setItens([]); setItemForm(EMPTY_FORM); setSent(false); setBaixas([]);
  };

  const continueAdding = () => {
    setSent(false); setBaixas([]);
    setStep(1); setItens([]); setItemForm(EMPTY_FORM);
  };

  if (sent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-gold text-xl font-bold mb-2">Pedido enviado!</h1>
        <p className="text-white/50 text-sm mb-1">{obraNome}</p>
        <p className="text-white/30 text-sm mb-6">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</p>
        {baixas.length > 0 && (
          <div className="w-full max-w-xs bg-white/10 rounded-2xl p-4 mb-8">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wide mb-2">Atendido do estoque</p>
            {baixas.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1 border-b border-white/10 last:border-0">
                <span className="text-white/80 text-sm">{b.nome}</span>
                <span className="text-green-400 text-sm font-bold">-{b.quantidade} {b.unidade}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={continueAdding} className="flex-1 px-6 py-3 bg-navy text-gold font-bold rounded-full border-2 border-gold">Adicionar mais itens</button>
          <button onClick={resetAll} className="flex-1 px-6 py-3 bg-gold text-navy font-bold rounded-full">Novo pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#f4f4f6]">
      <div className="bg-navy px-4 py-3 flex items-center gap-3">
        <button onClick={() => step > 0 ? setStep(step - 1) : null} className="text-white/60 mr-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <div className="text-white font-semibold text-sm leading-none">Pedido de Material</div>
          <div className="text-white/40 text-[11px] mt-0.5">{STEP_LABELS[step]}</div>
        </div>
        <div className="ml-auto flex gap-1">
          {[0,1,2].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-gold w-6' : 'bg-white/20 w-3'}`} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Obra</label>
            {loadingObras ? (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-400 text-center">Carregando obras...</div>
            ) : obras.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-400 text-center">Nenhuma obra cadastrada.</div>
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
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-xs text-gray-400 mb-3 px-1">{obraNome}</div>
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
                  <button onClick={() => setItens((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 text-xl leading-none px-1 hover:text-red-400 flex-shrink-0">x</button>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Adicionar item</p>

            {/* Seletor de categoria agrupado */}
            {!itemForm.categoria ? (
              <div className="-mx-4 mb-4">
                {GRUPOS.map((g) => (
                  <div key={g.label}>
                    <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{g.label}</span>
                    </div>
                    {g.cats.map((cat) => (
                      <button key={cat}
                        onClick={() => setItemForm({ ...EMPTY_FORM, categoria: cat })}
                        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 text-left active:bg-gray-50">
                        <span className="text-sm font-medium text-gray-800">{cat}</span>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-300"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-navy/5 rounded-xl border border-navy/10">
                <span className="text-sm font-bold text-navy">{itemForm.categoria}</span>
                <button onClick={() => setItemForm(EMPTY_FORM)} className="text-xs text-gray-400 underline">Trocar</button>
              </div>
            )}
            <SpecsForm itemForm={itemForm} setIF={setIF} setItemForm={setItemForm} cfg={cfg} />
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

      {step === 2 && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <div className="font-bold text-navy text-[15px]">{obraNome}</div>
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

      <div className="p-4 bg-[#f4f4f6] border-t border-gray-200">
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

// ── Formulário de specs reutilizável (Pedido e Inclusão) ──────────────────────
function SpecsForm({ itemForm, setIF, setItemForm, cfg }) {
  return (
    <>
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
      {cfg?.corCustom && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Cor <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COR_TIPOS.map((opt) => (
              <button key={opt}
                onClick={() => setItemForm((f) => ({ ...f, cor_tipo: f.cor_tipo === opt ? '' : opt, cor_detalhe: '', cor_especial: '' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${itemForm.cor_tipo === opt ? 'border-gold bg-gold/10 text-[#b38d3c] font-bold' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                {opt}
              </button>
            ))}
          </div>
          {itemForm.cor_tipo === 'Madeirado' && (
            <input value={itemForm.cor_detalhe} onChange={(e) => setIF('cor_detalhe', e.target.value)}
              placeholder="Qual madeirado? Ex: Carvalho Naturale, Freijó..."
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
          )}
          {itemForm.cor_tipo === 'Sólido' && (
            <input value={itemForm.cor_detalhe} onChange={(e) => setIF('cor_detalhe', e.target.value)}
              placeholder="Qual cor? Ex: Areia, Grafite, Off-White..."
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
          )}
          {itemForm.cor_tipo === 'Especial' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {COR_ESPECIAIS.map((opt) => (
                  <button key={opt}
                    onClick={() => setIF('cor_especial', itemForm.cor_especial === opt ? '' : opt)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${itemForm.cor_especial === opt ? 'border-gold bg-gold/10 text-[#b38d3c] font-bold' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    {opt}
                  </button>
                ))}
              </div>
              <input value={itemForm.cor_detalhe} onChange={(e) => setIF('cor_detalhe', e.target.value)}
                placeholder="Especificação (ex: Laca Cinza Claro, Pedra Calacata...)"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Inclusão Tab ───────────────────────────────────────────────────────────────
function InclusaoTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});   // { cat: true }
  const [entradas, setEntradas] = useState({});   // { itemId: qtdStr }
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  // Novo item form
  const [novoForm, setNovoForm] = useState(EMPTY_FORM);
  const [novoQtd, setNovoQtd] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [novoSalvo, setNovoSalvo] = useState(false);

  const loadEstoque = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/estoque');
      const data = await res.json();
      setEstoque(Array.isArray(data) ? data : []);
    } catch { setEstoque([]); }
    finally { setLoading(false); }
  };

  const tryUnlock = () => {
    if (passInput === INCLUSAO_PASS) { setUnlocked(true); loadEstoque(); }
    else setPassError(true);
  };

  const toggleCat = (cat) => setExpanded((e) => ({ ...e, [cat]: !e[cat] }));

  const handleEntrada = async (item) => {
    const qty = Number(entradas[item.id]);
    if (!qty || qty <= 0) return;
    setSaving((s) => ({ ...s, [item.id]: true }));
    try {
      await fetch('/api/estoque', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, delta: qty }) });
      setEstoque((prev) => prev.map((e) => e.id === item.id ? { ...e, quantidade: e.quantidade + qty } : e));
      setEntradas((e) => ({ ...e, [item.id]: '' }));
      setSaved((s) => ({ ...s, [item.id]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [item.id]: false })), 2000);
    } catch {} finally { setSaving((s) => ({ ...s, [item.id]: false })); }
  };

  const setNF = (k, v) => setNovoForm((f) => ({ ...f, [k]: v }));
  const novoCfg = CAT_CONFIG[novoForm.categoria];

  const canAddNovo = () => {
    if (!novoForm.categoria || !novoQtd || Number(novoQtd) <= 0) return false;
    if (!novoCfg) return false;
    if (!novoCfg.campos.every((c) => !c.required || !!novoForm[c.key])) return false;
    if (novoCfg.corCustom && !novoForm.cor_tipo) return false;
    return true;
  };

  const handleAddNovo = async () => {
    if (!canAddNovo()) return;
    setAdicionando(true);
    try {
      const corMdf = novoCfg.corCustom ? buildCorMdf(novoForm.cor_tipo, novoForm.cor_especial, novoForm.cor_detalhe) : '';
      const specs = [
        corMdf || novoForm.cor,
        novoForm.espessura, novoForm.largura,
        novoForm.marca, novoForm.marca_mdf,
        novoForm.tamanho, novoForm.tipo, novoForm.descricao,
      ].filter(Boolean);
      const nome = specs.length ? `${novoForm.categoria} · ${specs.join(' · ')}` : novoForm.categoria;
      const res = await fetch('/api/estoque', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, categoria: novoForm.categoria,
          unidade: novoCfg.unidade,
          quantidade: Number(novoQtd),
        }),
      });
      const data = await res.json();
      if (data.item) setEstoque((prev) => [...prev, data.item]);
      setNovoForm(EMPTY_FORM); setNovoQtd('');
      setNovoSalvo(true);
      setTimeout(() => setNovoSalvo(false), 2500);
    } catch {} finally { setAdicionando(false); }
  };

  if (!unlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-white/40 text-sm mb-8">Inclusao de Material</div>
        <div className="w-full max-w-xs space-y-3">
          <input type="password" value={passInput}
            onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
            placeholder="Senha de entrada"
            className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
          <button onClick={tryUnlock} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
          {passError && <p className="text-red-300 text-sm text-center">Senha incorreta.</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><span className="text-white/40 text-sm">Carregando...</span></div>;
  }

  const grouped = estoque.reduce((acc, item) => {
    const cat = item.categoria || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col bg-[#f4f4f6] overflow-y-auto pb-8">
      {/* Estoque existente — grupos colapsáveis */}
      {Object.keys(grouped).sort().map((cat) => (
        <div key={cat}>
          <button onClick={() => toggleCat(cat)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 active:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{cat}</span>
              <span className="text-[10px] text-gray-300">({grouped[cat].length})</span>
            </div>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              className={`text-gray-300 transition-transform ${expanded[cat] ? 'rotate-90' : ''}`}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          {expanded[cat] && grouped[cat].map((item, i) => (
            <div key={item.id} className={`bg-white px-4 py-3.5 ${i < grouped[cat].length - 1 ? 'border-b border-gray-100' : 'border-b-4 border-gray-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.nome}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Atual: <span className="font-bold text-navy">{item.quantidade} {item.unidade}</span>
                    {item.minimo > 0 && (
                      <span className={`ml-2 ${item.quantidade <= item.minimo ? 'text-red-400 font-bold' : 'text-gray-300'}`}>(min. {item.minimo})</span>
                    )}
                  </div>
                </div>
                {saved[item.id] && <span className="text-green-500 text-xs font-bold flex-shrink-0">Salvo!</span>}
              </div>
              <div className="flex gap-2">
                <input type="number" min="0" step="1"
                  value={entradas[item.id] || ''}
                  onChange={(e) => setEntradas((en) => ({ ...en, [item.id]: e.target.value }))}
                  placeholder={`Qtd recebida (${item.unidade})`}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                <button onClick={() => handleEntrada(item)}
                  disabled={!entradas[item.id] || Number(entradas[item.id]) <= 0 || saving[item.id]}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    entradas[item.id] && Number(entradas[item.id]) > 0 && !saving[item.id]
                      ? 'bg-navy text-gold active:opacity-80' : 'bg-gray-100 text-gray-300'}`}>
                  {saving[item.id] ? '...' : '+Entrada'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Novo item */}
      <div className="mx-4 mt-5 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-navy/5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-navy uppercase tracking-wide">Novo item no estoque</span>
          {novoSalvo && <span className="text-green-500 text-xs font-bold">Adicionado!</span>}
        </div>
        <div className="p-4">
          {/* Seletor de categoria */}
          {!novoForm.categoria ? (
            <div className="-mx-4">
              {GRUPOS.map((g) => (
                <div key={g.label}>
                  <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{g.label}</span>
                  </div>
                  {g.cats.map((cat) => (
                    <button key={cat} onClick={() => setNovoForm({ ...EMPTY_FORM, categoria: cat })}
                      className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 text-left active:bg-gray-50">
                      <span className="text-sm font-medium text-gray-800">{cat}</span>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-300"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-navy/5 rounded-xl border border-navy/10">
                <span className="text-sm font-bold text-navy">{novoForm.categoria}</span>
                <button onClick={() => setNovoForm(EMPTY_FORM)} className="text-xs text-gray-400 underline">Trocar</button>
              </div>
              <SpecsForm itemForm={novoForm} setIF={setNF} setItemForm={setNovoForm} cfg={novoCfg} />
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Quantidade recebida <span className="text-red-400">*</span>
                  {novoCfg && <span className="font-normal text-gray-300 ml-1">({novoCfg.unidade})</span>}
                </label>
                <input type="number" min="1" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)}
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
              </div>
              <button onClick={handleAddNovo} disabled={!canAddNovo() || adicionando}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${canAddNovo() && !adicionando ? 'bg-gold text-navy active:opacity-80' : 'bg-gray-100 text-gray-300'}`}>
                {adicionando ? 'Salvando...' : 'Adicionar ao estoque'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MaterialPage() {
  const [tab, setTab] = useState('pedido');

  return (
    <div className="min-h-dvh flex flex-col bg-navy">
      <header className="sticky top-0 z-40 bg-navy px-4 py-3.5 flex items-center gap-3 shadow-lg border-b border-white/10">
        <Link href="/" className="text-white/60">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="text-white font-bold text-sm tracking-wide">MATERIAL</div>
        <div className="ml-auto flex rounded-xl overflow-hidden border border-white/20">
          <button
            onClick={() => setTab('pedido')}
            className={`px-3 py-1.5 text-xs font-bold transition-all ${tab === 'pedido' ? 'bg-gold text-navy' : 'text-white/50'}`}
          >
            Pedido
          </button>
          <button
            onClick={() => setTab('inclusao')}
            className={`px-3 py-1.5 text-xs font-bold transition-all ${tab === 'inclusao' ? 'bg-gold text-navy' : 'text-white/50'}`}
          >
            Inclusao
          </button>
        </div>
      </header>

      {tab === 'pedido' ? <PedidoTab /> : <InclusaoTab />}
    </div>
  );
}
