'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MEU_DIA_BLOCOS, FABRICA_PERGUNTAS, EQUIPES_OBRA } from '@/lib/questions';
import { getSession, clearSession } from '@/lib/auth';
import AtasTab from '@/components/AtasTab';

// DEBUG: Remove password requirement - accept anything
const CEO_PASS = 'xxxxx';
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const diasRest = (s) => { if (!s) return ''; const d = Math.round((new Date(s + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000); return d < 0 ? ` · ${Math.abs(d)}d atrasada` : d === 0 ? ' · Hoje' : ` · ${d}d`; };

const ROOM_PRESETS = ['Cozinha','Sala','Suíte 1','Suíte 2','Suíte 3','Suíte Master','Gourmet','Banheiro','Lavabo','Escritório','Varanda','Hall','Área de Serviço','Lavanderia','Garagem'];

const CADERNO_RESPONSAVEIS = ['Ana', 'Aline', 'Munyke', 'Mariana', 'Letícia'];
const CADERNO_STATUS_CFG = {
  em_execucao:     { label: 'Em Execução',        badge: 'bg-blue-100 text-blue-700',      bar: 'bg-blue-500' },
  concluido:       { label: 'Concluído',           badge: 'bg-green-100 text-green-700',    bar: 'bg-green-500' },
  em_apresentacao: { label: 'Em Apresentação',     badge: 'bg-purple-100 text-purple-700',  bar: 'bg-purple-500' },
  aprovado:        { label: 'Aprovado',             badge: 'bg-emerald-100 text-emerald-700',bar: 'bg-emerald-500' },
  reprovado:       { label: 'Reprovado',            badge: 'bg-red-100 text-red-600',        bar: 'bg-red-500' },
};

// ── Botões Sim / Não / Outro ───────────────────────────────────────────────
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

// ── Pergunta individual ────────────────────────────────────────────────────
function QuestionItem({ q, status, text, onStatus, onText }) {
  // tipo='textarea': só campo de texto, sem botões
  if (q.tipo === 'textarea') {
    return (
      <div className="py-3 px-4 border-b border-gray-100 last:border-0">
        <p className="text-sm font-medium text-gray-800 leading-snug mb-2">{q.texto}</p>
        <textarea value={text} onChange={(e) => onText(e.target.value)} rows={3} placeholder={q.placeholder}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
      </div>
    );
  }
  // tipo='nao_detail': textarea obrigatório apenas quando status='nao'
  if (q.tipo === 'nao_detail') {
    return (
      <div className="py-3 px-4 border-b border-gray-100 last:border-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{q.texto}</p>
        <StatusBtns value={status} onChange={onStatus} />
        {status === 'nao' && (
          <textarea value={text} onChange={(e) => onText(e.target.value)} rows={2} placeholder={q.placeholder} required
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
        )}
      </div>
    );
  }
  // padrão: StatusBtns + textarea em sim/outro
  const showDetail = status === 'sim' || status === 'outro';
  const ph = status === 'outro' ? 'Justifique...' : q.placeholder;
  return (
    <div className="py-3 px-4 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-800 leading-snug">{q.texto}</p>
      <StatusBtns value={status} onChange={onStatus} />
      {showDetail && (
        <textarea value={text} onChange={(e) => onText(e.target.value)} rows={2} placeholder={ph}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
      )}
    </div>
  );
}

// ── Bloco accordion ────────────────────────────────────────────────────────
function TimeBlock({ bloco, data, onChange }) {
  const [open, setOpen] = useState(false);
  const dot = () => {
    if (!data || data.every((r) => !r.status)) return 'bg-gray-200';
    if (data.some((r) => r.status === 'nao')) return 'bg-red-400';
    if (data.some((r) => r.status === 'outro')) return 'bg-amber-400';
    if (data.every((r) => r.status === 'sim')) return 'bg-green-500';
    return 'bg-gray-200';
  };
  return (
    <div className="bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button className={`w-full flex items-center justify-between px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot()}`} />
          <span className="font-bold text-navy text-[15px]">{bloco.hora}</span>
          <span className="text-xs text-gray-400 font-normal">{bloco.label}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && bloco.perguntas.map((q, i) => (
        <QuestionItem key={q.id} q={q} status={data?.[i]?.status || null} text={data?.[i]?.text || ''}
          onStatus={(s) => onChange(i, 'status', s)} onText={(t) => onChange(i, 'text', t)} />
      ))}
    </div>
  );
}

// ── Card de membro da equipe ───────────────────────────────────────────────
function MemberCard({ sub, onAction }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(sub._action || null);
  const [actioning, setActioning] = useState(false);
  const qs = ['q1_status','q2_status','q3_status','q4_status','q5_status','q6_status'];

  const handleAction = async (a) => {
    setActioning(true);
    if (a === 'excluir') {
      await fetch('/api/submissions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: sub.name }) });
      onAction?.('excluir', sub.name);
    } else {
      const next = action === a ? null : a;
      await fetch('/api/submissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: sub.name, action: next }) });
      setAction(next);
    }
    setActioning(false);
  };
  const worst = () => {
    if (qs.some((k) => sub[k] === 'nao')) return 'bloq';
    if (qs.some((k) => sub[k] === 'outro')) return 'duvida';
    if (qs.every((k) => sub[k] === 'sim')) return 'ok';
    return 'vazio';
  };
  const wc = worst();
  const labels = { ok: 'Sim', duvida: 'Outro', bloq: 'Não', vazio: 'Parcial' };
  const initials = sub.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const QLABELS = ['O que instala/produz hoje','Material faltando','Acesso garantido','Dúvida técnica','Impeditivo de entrega','Concluído ontem'];

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">{initials}</div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-[15px] text-gray-900">{sub.name}</div>
          <div className="text-xs text-gray-400">{sub.obra || '—'}</div>
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full badge-${wc}`}>{labels[wc]}</span>
        {sub.q7_escalate ? <span className="ml-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-500">Diretor</span> : null}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3">
          {[1,2,3,4,5,6].map((n) => {
            if (n === 1) {
              // Q1 — structured view
              const desc = sub.q1_descricao || sub.q1_text;
              if (!desc && !sub.q1_cliente && !sub.q1_ambiente) return null;
              return (
                <div key={1}>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{QLABELS[0]}</div>
                  {(sub.q1_cliente || sub.q1_ambiente) && (
                    <p className="text-xs text-gray-500 mb-0.5">
                      {[sub.q1_cliente, sub.q1_ambiente].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {desc && <span className="text-sm text-gray-700">{desc}</span>}
                </div>
              );
            }
            const st = sub[`q${n}_status`], tx = sub[`q${n}_text`];
            if (!st && !tx) return null;
            const sc = st === 'sim' ? 'status-ok' : st === 'outro' ? 'status-duvida' : st === 'nao' ? 'status-bloq' : 'border-gray-200 bg-gray-50 text-gray-400';
            const sl = st === 'sim' ? 'Sim' : st === 'nao' ? 'Não' : st === 'outro' ? 'Outro' : st;
            return (
              <div key={n}>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{QLABELS[n-1]}</div>
                {st && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border-2 ${sc} mr-2`}>{sl}</span>}
                {tx && <span className="text-sm text-gray-700">{tx}</span>}
              </div>
            );
          })}
          {sub.q7_escalate && (
            <div>
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide mb-1">Precisa do Diretor</div>
              <p className="text-sm text-gray-700">{sub.q7_text || '—'}</p>
            </div>
          )}
          <div className="text-[11px] text-gray-300 pt-1">Enviado às {sub.submitted_at?.slice(11,16)}</div>
          {/* Ações do diretor */}
          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-1">
            {[
              { a: 'pendente',  label: 'Pendente',  cls: 'border-amber-300 bg-amber-50 text-amber-600'  },
              { a: 'resolvido', label: 'Resolvido', cls: 'border-green-300 bg-green-50 text-green-600'  },
            ].map(({ a, label, cls }) => (
              <button key={a} disabled={actioning} onClick={() => handleAction(a)}
                className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${action === a ? cls : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                {label}
              </button>
            ))}
            <button disabled={actioning} onClick={() => handleAction('excluir')}
              className="px-3 py-1.5 rounded-lg border-2 border-red-200 bg-red-50 text-red-400 text-xs font-bold">
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estoque ────────────────────────────────────────────────────────────────
const UNIDADES_EST = ['chapa', 'kg', 'unidade', 'rolo', 'metro', 'litro', 'caixa', 'par'];
const CATEGORIAS_EST = ['Chapa MDF', 'Chapa MDP', 'Chapa BP', 'Corrediça', 'Dobradiça Preta', 'Dobradiça Anodizada', 'Cola', 'Fita de Bordo', 'Perfil', 'Parafuso', 'Outro'];
const CORREDICA_MARCAS = ['Blum', 'Hardt', 'Häfele'];
const CORREDICA_TAMANHOS = ['25cm', '30cm', '35cm', '40cm', '45cm', '50cm', '55cm'];

const GRUPOS_EST = ['MDF', 'FERRAGENS', 'ALMOXARIFADO'];
const catOfEst = (item) => {
  if (['Chapa MDF','Chapa MDP','Chapa BP'].includes(item.categoria)) return 'MDF';
  if (['Corrediça','Dobradiça Preta','Dobradiça Anodizada'].includes(item.categoria)) return 'FERRAGENS';
  return 'ALMOXARIFADO';
};

function EstoqueTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [subTab, setSubTab] = useState('MDF');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: '', categoria: '', unidade: 'chapa', quantidade: '', minimo: '' });
  const [corrMarca, setCorrMarca] = useState('Blum');
  const [corrTamanho, setCorrTamanho] = useState('35cm');
  const [saving, setSaving] = useState(false);
  const [editQtd, setEditQtd] = useState(null); // id do item sendo editado
  const [editVal, setEditVal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/estoque'); const d = await r.json(); setItems(Array.isArray(d) ? d : []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id, body) => {
    await fetch('/api/estoque', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
  };

  const ajustar = async (id, delta) => {
    await patch(id, { delta });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i));
  };

  const confirmarQtd = async (id) => {
    const novaQtd = parseFloat(editVal);
    if (!isNaN(novaQtd) && novaQtd >= 0) {
      await patch(id, { quantidade: novaQtd });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantidade: novaQtd } : i));
    }
    setEditQtd(null);
    setEditVal('');
  };

  const remover = async (id) => {
    if (!confirm('Remover item do estoque?')) return;
    await fetch('/api/estoque', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addItem = async (e) => {
    e.preventDefault();
    const isCorr = form.categoria === 'Corrediça';
    const nome = isCorr ? `Corrediça ${corrMarca} ${corrTamanho}` : form.nome;
    const unidade = isCorr ? 'par' : form.unidade;
    if (!nome || !unidade) return;
    setSaving(true);
    const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, nome, unidade, quantidade: Number(form.quantidade) || 0, minimo: Number(form.minimo) || 0 }) });
    if (r.ok) {
      const { item } = await r.json();
      setItems((prev) => [...prev, item]);
      setForm({ nome: '', categoria: '', unidade: 'chapa', quantidade: '', minimo: '' });
      setCorrMarca('Blum');
      setCorrTamanho('35cm');
      setShowAdd(false);
    }
    setSaving(false);
  };

  const filtered = items.filter((i) => {
    const matchBusca = !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.categoria.toLowerCase().includes(busca.toLowerCase());
    return matchBusca && catOfEst(i) === subTab;
  });
  const baixo = items.filter((i) => i.minimo > 0 && i.quantidade <= i.minimo).length;

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Estoque de materiais</p>
          {baixo > 0 && <p className="text-xs text-red-500 px-1 mt-0.5">{baixo} item(s) abaixo do mínimo</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-navy bg-navy text-white">+ Item</button>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1.5 mb-3">
        {GRUPOS_EST.map((g) => {
          const count = items.filter((i) => catOfEst(i) === g).length;
          return (
            <button key={g} onClick={() => setSubTab(g)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${subTab === g ? 'bg-navy text-gold' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {g}<span className={`ml-1 text-[10px] ${subTab === g ? 'text-gold/60' : 'text-gray-400'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {showAdd && (
        <form onSubmit={addItem} className="bg-white rounded-xl shadow-sm p-4 mb-3 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Novo item</p>
          {/* Categoria primeiro — define o resto do form */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Categoria</label>
            <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value, unidade: e.target.value === 'Corrediça' ? 'par' : f.unidade }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
              <option value="">— Selecione —</option>
              {CATEGORIAS_EST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {form.categoria === 'Corrediça' ? (
            /* Corrediça: marca + tamanho → nome automático, unidade = par */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Marca</label>
                <select value={corrMarca} onChange={(e) => setCorrMarca(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  {CORREDICA_MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tamanho</label>
                <select value={corrTamanho} onChange={(e) => setCorrTamanho(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  {CORREDICA_TAMANHOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          ) : (
            /* Todos os outros: nome livre */
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nome *</label>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required={form.categoria !== 'Corrediça'} placeholder={form.categoria.startsWith('Dobradiça') ? 'Ex: 35mm copo 26' : 'Ex: MDF 18mm Branco TX'} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Quantidade</label>
              <input type="number" min="0" step="0.01" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Unidade</label>
              {form.categoria === 'Corrediça' ? (
                <div className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400">par</div>
              ) : (
                <select value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
                  {UNIDADES_EST.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Mínimo</label>
            <input type="number" min="0" value={form.minimo} onChange={(e) => setForm((f) => ({ ...f, minimo: e.target.value }))} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-navy text-white font-bold rounded-xl text-sm">{saving ? 'Salvando...' : 'Adicionar'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-gold" />

      {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
      {!loading && filtered.length === 0 && <div className="text-center py-12 text-sm text-gray-400">{items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item nesta categoria.'}</div>}
      {!loading && [...filtered].sort((a, b) => a.nome.localeCompare(b.nome)).map((item) => {
        const alerta = item.minimo > 0 && item.quantidade <= item.minimo;
        const bcolor = alerta ? 'border-l-red-400' : 'border-l-green-400';
        const editando = editQtd === item.id;
        return (
          <div key={item.id} className={`bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden border-l-4 ${bcolor}`}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] text-gray-900 truncate">{item.nome}</div>
                  <div className="text-xs text-gray-400">{item.categoria || '—'}{item.minimo > 0 ? ` · mín ${item.minimo} ${item.unidade}` : ''}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => ajustar(item.id, -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-200">−</button>
                  {editando ? (
                    <input
                      type="number" min="0" step="0.01" autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onBlur={() => confirmarQtd(item.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmarQtd(item.id); if (e.key === 'Escape') { setEditQtd(null); setEditVal(''); } }}
                      className="w-14 text-center font-bold text-navy text-[15px] border-2 border-gold rounded-lg px-1 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditQtd(item.id); setEditVal(String(item.quantidade)); }}
                      title="Toque para digitar quantidade"
                      className="min-w-[2.5rem] text-center font-bold text-navy text-[15px] px-1 py-0.5 rounded-lg hover:bg-gray-50 active:bg-gray-100"
                    >{item.quantidade}</button>
                  )}
                  <button onClick={() => ajustar(item.id, +1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-200">+</button>
                  <span className="text-xs text-gray-400 ml-0.5">{item.unidade}</span>
                </div>
              </div>
              {alerta && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Abaixo do mínimo</span>
                  <button onClick={() => remover(item.id)} className="px-2.5 py-1 rounded-lg border border-red-100 bg-red-50 text-red-400 text-[11px] font-bold">✕ Remover</button>
                </div>
              )}
              {!alerta && (
                <div className="mt-2 flex justify-end">
                  <button onClick={() => remover(item.id)} className="px-2.5 py-1 rounded-lg border border-gray-100 bg-gray-50 text-gray-400 text-[11px] font-bold">✕ Remover</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Pedidos ────────────────────────────────────────────────────────────────
const pedidoItemLabel = (item) => {
  const specs = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao].filter(Boolean);
  return specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
};

function PedidoCard({ pedido, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const STATUS = {
    pendente:  { label: 'Pendente',   cls: 'bg-amber-100 text-amber-600' },
    em_compra: { label: 'Em Compra',  cls: 'bg-blue-100 text-blue-600' },
    comprado:  { label: 'Comprado',   cls: 'bg-green-100 text-green-600' },
  };
  const sm = STATUS[pedido.status] || STATUS.pendente;
  const nextStatus = pedido.status === 'pendente' ? 'em_compra' : pedido.status === 'em_compra' ? 'comprado' : null;
  const nextLabel  = nextStatus === 'em_compra' ? 'Em Compra' : nextStatus === 'comprado' ? 'Comprado' : null;

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-[15px] text-gray-900 truncate">{pedido.obra_nome}</div>
          <div className="text-xs text-gray-400">{pedido.solicitante}{pedido.fornecedor ? ` · ${pedido.fornecedor}` : ''} · {pedido.created_at?.slice(11,16)} · {pedido.itens?.length} {pedido.itens?.length === 1 ? 'item' : 'itens'}</div>
          {pedido.total > 0 && <div className="text-sm font-bold text-navy mt-0.5">{pedido.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>}
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sm.cls}`}>{sm.label}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="mb-3">
            {pedido.itens?.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{pedidoItemLabel(item)}</span>
                <span className="text-sm font-bold text-navy ml-3 flex-shrink-0">{item.quantidade} {item.unidade}{item.quantidade > 1 && !item.unidade.endsWith('s') && item.unidade !== 'kg' ? 's' : ''}</span>
              </div>
            ))}
          </div>
          {nextStatus && (
            <button onClick={() => onStatusChange(pedido.id, nextStatus)}
              className="w-full py-2 rounded-xl text-xs font-bold border-2 border-navy text-navy bg-white">
              Marcar como {nextLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Projetos ───────────────────────────────────────────────────────────────
// ── Caderno Técnico (read-only para CEO) ───────────────────────────────────
function CadernoTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroResp, setFiltroResp] = useState('todos');

  useEffect(() => {
    fetch('/api/caderno').then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => {
    if (filtroStatus !== 'todos' && i.status !== filtroStatus) return false;
    if (filtroResp !== 'todos' && !(i.responsaveis || []).includes(filtroResp)) return false;
    return true;
  });

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="px-3 py-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2 pb-0.5">
        {[{ v: 'todos', l: 'Todos' }, ...Object.entries(CADERNO_STATUS_CFG).map(([v, c]) => ({ v, l: c.label }))].map((f) => (
          <button key={f.v} onClick={() => setFiltroStatus(f.v)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filtroStatus === f.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-0.5">
        {[{ v: 'todos', l: 'Todos' }, ...CADERNO_RESPONSAVEIS.map((r) => ({ v: r, l: r }))].map((f) => (
          <button key={f.v} onClick={() => setFiltroResp(f.v)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filtroResp === f.v ? 'border-gold bg-gold/10 text-gold-d' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          {items.length === 0 ? 'Nenhum projeto no Caderno Técnico ainda.' : 'Nenhum projeto com este filtro.'}
        </div>
      )}

      {filtered.map((item) => {
        const sc = CADERNO_STATUS_CFG[item.status] || CADERNO_STATUS_CFG.em_execucao;
        const responsaveis = item.responsaveis || [];
        return (
          <div key={item.id} className="bg-white rounded-xl shadow-sm mb-3 overflow-hidden">
            <div className="flex items-stretch">
              <div className={`w-1.5 flex-shrink-0 ${sc.bar}`} />
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="font-semibold text-[15px] text-gray-900 leading-tight truncate">{item.nome}</p>
                <div className="flex items-center flex-wrap gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
                  {item.ambientes?.length > 0 && <span className="text-[10px] text-gray-400">{item.ambientes.length} amb.</span>}
                </div>
                {responsaveis.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {responsaveis.map((r) => (
                      <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-navy/10 text-navy">{r}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                  {item.data_inicio && <span>Início: {item.data_inicio.split('-').reverse().join('/')}</span>}
                  {item.prazo && <span>Prazo: {item.prazo.split('-').reverse().join('/')}</span>}
                </div>
                {item.observacoes && <p className="text-xs text-gray-500 mt-1.5 leading-snug">{item.observacoes}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjetosTab({ obras, loading, onSaveEquipe, onSavePrazo, isAriel }) {
  const [subTab, setSubTab] = useState('obras');
  const [aberto, setAberto] = useState(null);
  const [equipeEdits, setEquipeEdits] = useState({});
  const [prazoEdits, setPrazoEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [savingPrazo, setSavingPrazo] = useState(null);
  const [cadernoIds, setCadernoIds] = useState(new Set());

  useEffect(() => {
    fetch('/api/caderno').then((r) => r.json()).then((d) => {
      setCadernoIds(new Set((d || []).map((i) => i.id)));
    }).catch(() => {});
  }, []);

  const statusMap = {
    no_prazo: { label: 'No prazo', bar: 'bg-green-400',  badge: 'bg-green-100 text-green-600' },
    em_risco: { label: 'Em risco',  bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-600' },
    atrasada: { label: 'Atrasada',  bar: 'bg-red-400',   badge: 'bg-red-100 text-red-500'    },
  };

  const handleOpen = (id, currentEquipe) => {
    if (aberto === id) { setAberto(null); return; }
    setAberto(id);
    if (equipeEdits[id] === undefined) setEquipeEdits((e) => ({ ...e, [id]: currentEquipe || [] }));
  };

  const toggleMembro = (obraId, eq) => {
    setEquipeEdits((e) => {
      const cur = e[obraId] || [];
      return { ...e, [obraId]: cur.includes(eq) ? cur.filter((x) => x !== eq) : [...cur, eq] };
    });
  };

  const handleSave = async (obraId) => {
    setSaving(obraId);
    await onSaveEquipe(obraId, equipeEdits[obraId] || []);
    setSaving(null);
  };

  const handleSavePrazo = async (obraId) => {
    const prazo = prazoEdits[obraId];
    if (prazo === undefined) return;
    setSavingPrazo(obraId);
    await onSavePrazo(obraId, prazo);
    setSavingPrazo(null);
  };

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 px-3 pt-3 pb-2">
        <button onClick={() => setSubTab('obras')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${subTab === 'obras' ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
          Obras
        </button>
        <button onClick={() => setSubTab('caderno')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${subTab === 'caderno' ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
          Caderno Técnico
          {cadernoIds.size > 0 && <span className="ml-1.5 bg-gold text-navy rounded-full px-1.5 py-0.5 text-[9px]">{cadernoIds.size}</span>}
        </button>
      </div>

      {subTab === 'caderno' && <CadernoTab />}

      {subTab === 'obras' && (
        <div className="px-3 pb-3">
          {loading && <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>}
          {!loading && obras.length === 0 && <div className="text-center py-12 text-sm text-gray-400">Nenhuma obra cadastrada.</div>}
          {!loading && obras.length > 0 && (
            <>
              {/* Contador de status */}
              {(() => {
                const atrasadas = obras.filter(o => o.status === 'atrasada').length;
                const risco     = obras.filter(o => o.status === 'em_risco').length;
                const ok        = obras.filter(o => o.status === 'no_prazo').length;
                return (
                  <div className="flex gap-2 mb-3">
                    <div className={`flex-1 rounded-xl px-3 py-2.5 text-center border-2 ${atrasadas > 0 ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white'}`}>
                      <div className={`text-2xl font-bold ${atrasadas > 0 ? 'text-red-500' : 'text-gray-300'}`}>{atrasadas}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Atrasada{atrasadas !== 1 ? 's' : ''}</div>
                    </div>
                    <div className={`flex-1 rounded-xl px-3 py-2.5 text-center border-2 ${risco > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                      <div className={`text-2xl font-bold ${risco > 0 ? 'text-amber-500' : 'text-gray-300'}`}>{risco}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Em Risco</div>
                    </div>
                    <div className="flex-1 rounded-xl px-3 py-2.5 text-center border-2 border-gray-100 bg-white">
                      <div className="text-2xl font-bold text-green-500">{ok}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">No Prazo</div>
                    </div>
                  </div>
                );
              })()}
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1 mb-3">
                {obras.length} projeto{obras.length !== 1 ? 's' : ''} ativos
              </p>
              {obras.map((obra) => {
                const sm = statusMap[obra.status] || statusMap.no_prazo;
                const isOpen = aberto === obra.id;
                const editEquipe = equipeEdits[obra.id] ?? (obra.equipe || []);
                const jaNoCaderno = cadernoIds.has(obra.id);
                return (
                  <div key={obra.id} className="bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden">
                    <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${isOpen ? 'border-b border-gray-100' : ''}`}
                      onClick={() => handleOpen(obra.id, obra.equipe)}>
                      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${sm.bar}`} />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-semibold text-[15px] text-gray-900 truncate">{obra.nome}</div>
                        <div className="text-xs text-gray-400">
                          {obra.prazo ? fmtDate(obra.prazo) + diasRest(obra.prazo) : 'Sem prazo'}
                          {obra.ambientes?.length ? ` · ${obra.ambientes.length} amb.` : ''}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sm.badge}`}>{sm.label}</span>
                      <svg className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-3 space-y-3">
                        {/* Equipe editável */}
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Equipe escalada</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {EQUIPES_OBRA.map((eq) => {
                              const sel = editEquipe.includes(eq);
                              return (
                                <button key={eq} onClick={() => toggleMembro(obra.id, eq)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${sel ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-white text-gray-500'}`}>
                                  {eq}
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={() => handleSave(obra.id)} disabled={saving === obra.id}
                            className="w-full py-2 rounded-xl text-xs font-bold bg-gold text-navy disabled:opacity-50">
                            {saving === obra.id ? 'Salvando...' : 'Salvar escala'}
                          </button>
                        </div>

                        {/* Prazo — editável só pela Ariel */}
                        {isAriel ? (
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Prazo de entrega</p>
                            <div className="flex gap-2">
                              <input type="date"
                                defaultValue={obra.prazo || ''}
                                onChange={(e) => setPrazoEdits((p) => ({ ...p, [obra.id]: e.target.value }))}
                                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                              <button onClick={() => handleSavePrazo(obra.id)} disabled={savingPrazo === obra.id || prazoEdits[obra.id] === undefined}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-gold text-navy disabled:opacity-40">
                                {savingPrazo === obra.id ? '...' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          obra.prazo && (
                            <div className="text-[11px] text-gray-400">
                              Prazo: <span className="font-semibold text-gray-600">{obra.prazo.split('-').reverse().join('/')}</span>
                            </div>
                          )
                        )}

                        {/* Ambientes */}
                        {obra.ambientes?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Ambientes</p>
                            <div className="flex flex-wrap gap-1.5">
                              {obra.ambientes.map((a) => (
                                <span key={typeof a === 'string' ? a : a.id} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  {typeof a === 'string' ? a : a.nome}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {jaNoCaderno && (
                          <div className="w-full py-2 rounded-xl text-xs font-bold border-2 border-gray-200 bg-gray-50 text-gray-400 text-center">
                            No Caderno Técnico
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Obras ──────────────────────────────────────────────────────────────────
function ObrasTab({ obras, setObras, loading, onRefresh, aprovandoObra, onToggleAprovada, onLiberarTodas }) {
  const [showModal, setShowModal] = useState(false);
  const [novaNome, setNovaNome] = useState('');
  const [novaPrazo, setNovaPrazo] = useState('');
  const save = (u) => {
    setObras(u);
    fetch('/api/obras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) }).catch(() => {});
  };
  const addObra = () => {
    if (!novaNome.trim()) return;
    save([...obras, { id: Date.now().toString(), nome: novaNome.trim(), prazo: novaPrazo, status: 'no_prazo', ambientes: [], notas: {} }]);
    setNovaNome(''); setNovaPrazo(''); setShowModal(false);
  };
  return (
    <div className="px-3 pb-4">
      <div className="flex items-center justify-between my-3">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">{obras.length} obra{obras.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gold text-navy text-sm font-bold">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Nova Obra
          </button>
        </div>
      </div>

      {/* Liberar obras para equipe */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Visibilidade para a equipe</p>
          <button onClick={onLiberarTodas} disabled={aprovandoObra === 'all' || obras.length === 0}
            className="px-3 py-1 rounded-full text-xs font-bold border-2 border-green-400 bg-green-50 text-green-600 disabled:opacity-40">
            {aprovandoObra === 'all' ? '...' : 'Liberar todas'}
          </button>
        </div>
        {obras.length === 0 && <div className="text-sm text-gray-400 text-center py-2">Nenhuma obra.</div>}
        {obras.map((o) => (
          <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-navy truncate">{o.nome}</div>
              {o.aprovada && o.aprovada_por
                ? <div className="text-[10px] text-green-500 mt-0.5">{o.aprovada_por} · {(() => { const d = new Date(o.aprovada_em); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}</div>
                : <div className="text-[10px] text-red-400 mt-0.5">{o.aprovada ? 'Liberada' : 'Não liberada'}</div>
              }
            </div>
            <button onClick={() => onToggleAprovada(o.id, o.aprovada)} disabled={aprovandoObra === o.id}
              className={`px-3 py-1 rounded-full text-xs font-bold border-2 flex-shrink-0 transition-all disabled:opacity-40 ${o.aprovada ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              {aprovandoObra === o.id ? '...' : o.aprovada ? 'Liberada ✓' : 'Liberar'}
            </button>
          </div>
        ))}
      </div>
      {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando obras...</div>}
      {!loading && obras.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">Nenhuma obra cadastrada.</div>}
      {!loading && obras.map((obra, i) => (
        <ObraCard key={obra.id} obra={obra}
          onSave={(u) => { const arr = [...obras]; arr[i] = u; save(arr); }}
          onDelete={() => { if (confirm('Excluir obra?')) save(obras.filter((_,j) => j !== i)); }} />
      ))}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-t-2xl p-6 w-full pb-10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy mb-4">Nova Obra</h3>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nome / cliente</label>
            <input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-gold" placeholder="Ex: Residência Ferreira" />
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prazo de entrega</label>
            <input type="date" value={novaPrazo} onChange={(e) => setNovaPrazo(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:border-gold" />
            <button onClick={addObra} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Criar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const normalizeAmbientes = (ams) => (ams || []).map((a) =>
  typeof a === 'string' ? { id: a, nome: a, nota: '' } : a
);

function ObraCard({ obra, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showAddAmb, setShowAddAmb] = useState(false);
  const [customAmb, setCustomAmb] = useState('');
  const td = today();
  const notas = obra.notas?.[td] || { pecas: '', executado: '', pendencias: '' };
  const [form, setForm] = useState({ status: obra.status, prazo: obra.prazo, ambientes: normalizeAmbientes(obra.ambientes), equipe: obra.equipe || [], ...notas });

  const statusMap = {
    no_prazo: { label: 'No prazo', bar: 'bar-ok',   text: 'text-green-500' },
    em_risco: { label: 'Em risco',  bar: 'bar-risco', text: 'text-amber-500' },
    atrasada: { label: 'Atrasada',  bar: 'bar-atr',   text: 'text-red-500'  },
  };
  const sm = statusMap[obra.status] || statusMap.no_prazo;

  const addAmbiente = (nome) => {
    if (!nome.trim()) return;
    setForm((f) => ({ ...f, ambientes: [...f.ambientes, { id: Date.now().toString(), nome: nome.trim(), nota: '' }] }));
    setCustomAmb(''); setShowAddAmb(false);
  };
  const removeAmb = (idx) => setForm((f) => ({ ...f, ambientes: f.ambientes.filter((_,i) => i !== idx) }));
  const updateAmb = (idx, val) => setForm((f) => ({ ...f, ambientes: f.ambientes.map((a,i) => i === idx ? { ...a, nota: val } : a) }));

  const handleSave = () => {
    onSave({ ...obra, status: form.status, prazo: form.prazo, ambientes: form.ambientes, equipe: form.equipe,
      notas: { ...obra.notas, [td]: { pecas: form.pecas, executado: form.executado, pendencias: form.pendencias } } });
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${sm.bar}`} />
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-[15px] text-gray-900 truncate">{obra.nome}</div>
          <div className="text-xs text-gray-400">
            {obra.prazo ? fmtDate(obra.prazo) + diasRest(obra.prazo) : 'Sem prazo'}
            {obra.ambientes?.length ? ` · ${obra.ambientes.length} amb.` : ''}
            {obra.equipe?.length ? ` · ${obra.equipe.map((e) => e.split(' - ')[0]).join(', ')}` : ''}
          </div>
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${sm.text}`}>{sm.label}</span>
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Status da obra</label>
            <div className="flex gap-2">
              {['no_prazo','em_risco','atrasada'].map((s) => {
                const cls = s === 'no_prazo' ? 'status-ok' : s === 'em_risco' ? 'status-duvida' : 'status-bloq';
                const lbl = s === 'no_prazo' ? 'No prazo' : s === 'em_risco' ? 'Em risco' : 'Atrasada';
                return <button key={s} onClick={() => setForm({ ...form, status: s })} className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${form.status === s ? cls : 'border-gray-200 bg-gray-50 text-gray-400'}`}>{lbl}</button>;
              })}
            </div>
          </div>

          {/* Prazo */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prazo de entrega</label>
            <input type="date" value={form.prazo || ''} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
          </div>

          {/* Equipe escalada */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Equipe escalada</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPES_OBRA.map((eq) => {
                const sel = form.equipe.includes(eq);
                return (
                  <button key={eq} onClick={() => setForm((f) => ({ ...f, equipe: sel ? f.equipe.filter((e) => e !== eq) : [...f.equipe, eq] }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${sel ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {eq}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ambientes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ambientes</label>
              <button onClick={() => setShowAddAmb(!showAddAmb)} className="text-xs font-bold text-gold px-2.5 py-1 rounded-lg border border-gold/30 bg-gold/5">
                + Adicionar
              </button>
            </div>

            {showAddAmb && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ROOM_PRESETS.map((r) => (
                    <button key={r} onClick={() => addAmbiente(r)} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 active:bg-navy active:text-white active:border-navy transition-colors">
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customAmb} onChange={(e) => setCustomAmb(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAmbiente(customAmb)}
                    placeholder="Outro ambiente..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold" />
                  <button onClick={() => addAmbiente(customAmb)} className="px-3 py-2 bg-navy text-white rounded-lg text-xs font-bold">Add</button>
                </div>
              </div>
            )}

            {form.ambientes.length === 0 && !showAddAmb && (
              <p className="text-xs text-gray-300 italic">Nenhum ambiente cadastrado. Clique em + Adicionar.</p>
            )}

            {form.ambientes.map((a, i) => (
              <div key={a.id} className="border border-gray-100 rounded-xl p-3 mb-2 bg-gray-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-navy">{a.nome}</span>
                  <button onClick={() => removeAmb(i)} className="text-gray-300 text-xl leading-none px-1 hover:text-red-400">×</button>
                </div>
                <textarea value={a.nota} onChange={(e) => updateAmb(i, e.target.value)} rows={2}
                  placeholder="O que vai ser feito / por que não vai ser feito e motivo..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
              </div>
            ))}
          </div>

          {/* Campos diários */}
          {[
            { key: 'pecas',      label: 'Peças / o que será instalado hoje',     ph: 'Liste: peça — quantidade — ambiente...' },
            { key: 'executado',  label: 'O que foi executado hoje',               ph: 'O que foi concluído, por quem, em qual ambiente...' },
            { key: 'pendencias', label: 'Pendências / bloqueios / como resolver', ph: 'O que ficou, motivo, quem resolve, prazo...' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
              <textarea value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                rows={3} placeholder={f.ph}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
            </div>
          ))}

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={handleSave} className="flex-1 py-2.5 bg-navy text-white font-bold rounded-xl text-sm">Salvar</button>
            <button onClick={onDelete} className="px-4 py-2.5 border-2 border-red-100 text-red-400 font-semibold rounded-xl text-sm">Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Histórico local (7 dias) ───────────────────────────────────────────────
const HIST_DIA_KEY = 'lukana_ceo_historico';
const HIST_FAB_KEY = 'lukana_ceo_fab_hist';
const HIST_MAX = 7;

function loadHist(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function saveHist(key, date, data) {
  const hist = loadHist(key);
  hist[date] = data;
  const sorted = Object.keys(hist).sort().slice(-HIST_MAX);
  const pruned = {};
  sorted.forEach((k) => { pruned[k] = hist[k]; });
  localStorage.setItem(key, JSON.stringify(pruned));
}
function getAvailableDates(key) {
  const hist = loadHist(key);
  return Object.keys(hist).sort().reverse(); // mais recente primeiro
}

function DateNavSimple({ viewDate, setViewDate, days = 7 }) {
  const td = today();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const fmtBtn = (d) => {
    if (d === td) return 'Hoje';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };
  return (
    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 no-scrollbar">
      {dates.map((d) => (
        <button key={d} onClick={() => setViewDate(d)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${viewDate === d ? 'bg-navy text-gold border-navy' : 'bg-white text-gray-500 border-gray-200'}`}>
          {fmtBtn(d)}
        </button>
      ))}
    </div>
  );
}

function DateNav({ histKey, viewDate, setViewDate }) {
  const td = today();
  const past = getAvailableDates(histKey).filter((d) => d !== td);
  const dates = [td, ...past].slice(0, HIST_MAX);
  const fmtBtn = (d) => {
    if (d === td) return 'Hoje';
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  };
  if (dates.length <= 1 && dates[0] === td) return null;
  return (
    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 no-scrollbar">
      {dates.map((d) => (
        <button key={d} onClick={() => setViewDate(d)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${viewDate === d ? 'bg-navy text-gold border-navy' : 'bg-white text-gray-500 border-gray-200'}`}>
          {fmtBtn(d)}
        </button>
      ))}
    </div>
  );
}

// ── RESUMO DIÁRIO POR ÁREA ─────────────────────────────────────────────────
function BarEvol({ aFazer, andamento, finalizado, total }) {
  if (total === 0) return <p className="text-xs text-gray-400 italic mt-1">Sem dados</p>;
  const pct = (n) => Math.max(0, Math.round((n / total) * 100));
  return (
    <div className="mt-2">
      <div className="flex rounded-full overflow-hidden h-2 gap-0.5 bg-gray-100">
        {finalizado > 0 && <div style={{ width: `${pct(finalizado)}%` }} className="bg-green-400" />}
        {andamento  > 0 && <div style={{ width: `${pct(andamento)}%`  }} className="bg-amber-400" />}
        {aFazer     > 0 && <div style={{ width: `${pct(aFazer)}%`     }} className="bg-gray-200" />}
      </div>
      <div className="flex gap-3 mt-1">
        <span className="text-[10px] font-semibold text-green-500">✓ {finalizado} finalizados</span>
        <span className="text-[10px] font-semibold text-amber-500">⟳ {andamento} andamento</span>
        <span className="text-[10px] font-semibold text-gray-400">○ {aFazer} a fazer</span>
      </div>
    </div>
  );
}

function DashboardMeta({ resumoObra, resumoEscritorio }) {
  const now = new Date();
  const dow = now.getDay();
  const diffMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now); mon.setDate(now.getDate() + diffMon); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const fmtDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const inRange = (dateStr, from, to) => {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T12:00:00');
    return d >= from && d <= to;
  };

  const obraSem   = resumoObra.filter(o => inRange(o.data_fim, mon, sun));
  const obraMes   = resumoObra.filter(o => inRange(o.data_fim, monthStart, monthEnd));
  const obraSemOk = obraSem.filter(o => ['finalizado','concluido'].includes(o.status)).length;
  const obraMesOk = obraMes.filter(o => ['finalizado','concluido'].includes(o.status)).length;

  const projDeadline = (p) => p.data_limite_tecnico || p.data_limite_modelagem || p.envio_fabrica;
  const projSem   = resumoEscritorio.filter(p => inRange(projDeadline(p), mon, sun));
  const projMes   = resumoEscritorio.filter(p => inRange(projDeadline(p), monthStart, monthEnd));
  const projSemOk = projSem.filter(p => p.envio_fabrica || p.status === 'concluido').length;
  const projMesOk = projMes.filter(p => p.envio_fabrica || p.status === 'concluido').length;

  const Row = ({ label, semTotal, semOk, mesTotal, mesOk }) => (
    <div className="grid grid-cols-3 items-center py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-bold text-gray-700">{label}</span>
      <div className="px-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">{fmtDate(mon)}–{fmtDate(sun)}</span>
          <span className="text-[10px] font-bold text-amber-600">{semOk}/{semTotal}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all" style={{ width: semTotal > 0 ? `${(semOk/semTotal)*100}%` : '0%' }} />
        </div>
      </div>
      <div className="px-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">{now.toLocaleDateString('pt-BR', { month: 'long' })}</span>
          <span className="text-[10px] font-bold text-blue-600">{mesOk}/{mesTotal}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: mesTotal > 0 ? `${(mesOk/mesTotal)*100}%` : '0%' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-4">
      <div className="grid grid-cols-3 mb-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Área</span>
        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide px-2">Semana</span>
        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide px-2">Mês</span>
      </div>
      <Row label="🏗️ Obras"      semTotal={obraSem.length}  semOk={obraSemOk}  mesTotal={obraMes.length}  mesOk={obraMesOk} />
      <Row label="📐 Escritório" semTotal={projSem.length}  semOk={projSemOk}  mesTotal={projMes.length}  mesOk={projMesOk} />
    </div>
  );
}

function ResumoDiario({ gerenteFab, resumoObra, resumoEscritorio }) {
  // ── Fábrica (Matheus) ──
  const fabSaem    = (gerenteFab?.gf4 || []).length;
  const fabAmanha  = (gerenteFab?.gf3 || []).length;
  const fabProd    = gerenteFab?.gf1?.obra || gerenteFab?.gf1?.descricao ? 1 : 0;
  const fabBloq    = [gerenteFab?.gf2, gerenteFab?.gf5, gerenteFab?.gf6]
    .filter(f => f?.status === 'sim' || f?.status === 'outro').length;
  const fabTotal   = fabSaem + fabAmanha + fabProd;
  const fabHora    = gerenteFab?.saved_at ? (() => {
    const d = new Date(gerenteFab.saved_at);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  })() : null;

  // ── Obras (Vinny) ──
  const obraTotal  = resumoObra.length;
  const obraFin    = resumoObra.filter(o => ['finalizado','concluido'].includes(o.status)).length;
  const obraAnd    = resumoObra.filter(o => o.status === 'em_progresso').length;
  const obraAF     = obraTotal - obraFin - obraAnd;

  // ── Escritório (Ana) ──
  const projTotal  = resumoEscritorio.length;
  const projFin    = resumoEscritorio.filter(i => i.envio_fabrica || i.status === 'concluido').length;
  const projAnd    = resumoEscritorio.filter(i => i.medicao && !i.envio_fabrica && i.status !== 'concluido').length;
  const projAF     = projTotal - projFin - projAnd;

  return (
    <div className="space-y-2 mb-4">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1">Evolução do dia</p>

      {/* Fábrica */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">🏭 Fábrica · Matheus</span>
          <span className="text-[10px] text-gray-400">
            {gerenteFab ? (fabHora ? `às ${fabHora}` : 'preenchido') : 'não preencheu'}
          </span>
        </div>
        {!gerenteFab ? (
          <p className="text-xs text-gray-400 italic mt-1">Aguardando preenchimento.</p>
        ) : (
          <>
            {gerenteFab.gf1?.obra && (
              <p className="text-xs text-gray-600 mt-1">
                <span className="font-semibold">Em produção:</span> {gerenteFab.gf1.obra}{gerenteFab.gf1.ambiente ? ` · ${gerenteFab.gf1.ambiente}` : ''}
              </p>
            )}
            <BarEvol aFazer={fabAmanha} andamento={fabProd} finalizado={fabSaem} total={fabTotal || 1} />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              <span className="text-[10px] font-semibold text-green-500">↑ Saem hoje: {fabSaem}</span>
              <span className="text-[10px] font-semibold text-amber-500">⟳ Produzindo: {fabProd}</span>
              <span className="text-[10px] font-semibold text-gray-400">→ Amanhã: {fabAmanha}</span>
              {fabBloq > 0 && <span className="text-[10px] font-semibold text-red-500">⚠ Bloqueios: {fabBloq}</span>}
            </div>
          </>
        )}
      </div>

      {/* Obras */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">🏗️ Obras · Vinny</span>
          <span className="text-[10px] text-gray-400">{obraTotal} ambientes</span>
        </div>
        <BarEvol aFazer={obraAF} andamento={obraAnd} finalizado={obraFin} total={obraTotal} />
      </div>

      {/* Escritório */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">📐 Escritório · Ana</span>
          <span className="text-[10px] text-gray-400">{projTotal} projetos</span>
        </div>
        <BarEvol aFazer={projAF} andamento={projAnd} finalizado={projFin} total={projTotal} />
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL DIRETOR ───────────────────────────────────────────────
export default function CeoPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [viewMode, setViewMode] = useState('diretor'); // 'diretor' ou 'acompanhamento' (Ariel)
  const [activeTab, setActiveTab] = useState('meudia');
  const [diaData, setDiaData] = useState(null);
  const [fabricaData, setFabricaData] = useState(null);
  const [viewDate, setViewDate] = useState(today());
  const [viewFabDate, setViewFabDate] = useState(today());
  const [submissions, setSubmissions] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [equipeFilter, setEquipeFilter] = useState('todos');
  const [equipeDate, setEquipeDate] = useState(today());
  const [cncEntries, setCncEntries] = useState([]);
  const [loadingCnc, setLoadingCnc] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [obras, setObras] = useState([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [aprovandoObra, setAprovandoObra] = useState(null);
  const [ceoSession, setCeoSession] = useState(null);
  const [toast, setToast] = useState('');
  const [loginHistory, setLoginHistory] = useState([]);
  const [loadingAcessos, setLoadingAcessos] = useState(false);
  const [notas, setNotas] = useState([]);
  const [notasDate, setNotasDate] = useState(today());
  const [gerenteFab, setGerenteFab] = useState(null);
  const [loadingFab, setLoadingFab] = useState(false);
  const [resumoObra, setResumoObra] = useState([]);
  const [resumoEscritorio, setResumoEscritorio] = useState([]);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const handleLogout = () => {
    clearSession();
    localStorage.removeItem('lukana_ceo_auth');
    router.push('/login?next=/ceo');
  };

  // Logout via URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('logout') === 'true') {
      clearSession();
      localStorage.removeItem('lukana_ceo_auth');
      localStorage.clear(); // Limpa TUDO
      router.push('/login?next=/ceo');
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
    const session = getSession();
    setCeoSession(session);
    // Se é ariel, ativa modo acompanhamento automaticamente
    if (session?.role === 'ariel') {
      setViewMode('acompanhamento');
    }
    if (session?.role === 'diretor' || session?.role === 'ariel' || localStorage.getItem('lukana_ceo_auth') === CEO_PASS) {
      setAuth(true); loadAll();
    }
  }, []);

  const initDia = useCallback(() => {
    const td = today();
    // Migrar formato antigo
    try {
      const old = JSON.parse(localStorage.getItem('lukana_ceo_dia'));
      if (old?.date && old?.blocos) { saveHist(HIST_DIA_KEY, old.date, old); localStorage.removeItem('lukana_ceo_dia'); }
    } catch {}
    const hist = loadHist(HIST_DIA_KEY);
    if (hist[td]) return hist[td];
    const fresh = { date: td, blocos: {} };
    MEU_DIA_BLOCOS.forEach((b) => { fresh.blocos[b.id] = b.perguntas.map(() => ({ status: null, text: '' })); });
    return fresh;
  }, []);

  const initFabrica = useCallback(() => {
    const td = today();
    // Migrar formato antigo
    try {
      const old = JSON.parse(localStorage.getItem('lukana_ceo_fabrica'));
      if (old?.date && old?.respostas) { saveHist(HIST_FAB_KEY, old.date, old); localStorage.removeItem('lukana_ceo_fabrica'); }
    } catch {}
    const hist = loadHist(HIST_FAB_KEY);
    if (hist[td]) return hist[td];
    return { date: td, respostas: FABRICA_PERGUNTAS.map(() => ({ status: null, text: '' })) };
  }, []);

  const fetchObras = useCallback(async () => {
    setLoadingObras(true);
    try { const r = await fetch('/api/obras'); const d = await r.json(); setObras(Array.isArray(d) ? d : []); }
    catch { setObras([]); }
    finally { setLoadingObras(false); }
  }, []);

  const loadAll = useCallback(async () => {
    setDiaData(initDia());
    setFabricaData(initFabrica());
    fetchObras();
    // Carregar notas de hoje
    try {
      const r = await fetch(`/api/notas?date=${today()}`);
      const d = await r.json();
      setNotas(Array.isArray(d) ? d : []);
    } catch {
      setNotas([]);
    }
  }, [initDia, initFabrica, fetchObras]);

  const fetchNotas = useCallback(async (date) => {
    try {
      const r = await fetch(`/api/notas?date=${date || today()}`);
      const d = await r.json();
      setNotas(Array.isArray(d) ? d : []);
    } catch { setNotas([]); }
  }, []);

  const fetchGerenteFab = useCallback(async (date) => {
    setLoadingFab(true);
    try { const r = await fetch(`/api/gerente-fab?date=${date || today()}`); const d = await r.json(); setGerenteFab(d || null); }
    catch { setGerenteFab(null); }
    finally { setLoadingFab(false); }
  }, []);

  const handleAuth = () => {
    // DEBUG: Remove password validation - accept anything
    localStorage.setItem('lukana_ceo_auth', 'debug_mode');
    setAuth(true);
    loadAll();
  };

  const handleToggleAprovadaCeo = async (obraId, atual) => {
    const nome = ceoSession?.role === 'diretor' ? ceoSession.nome : 'Diretor';
    setAprovandoObra(obraId);
    try {
      const novoVal = !atual;
      await fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obraId, aprovada: novoVal, aprovada_por: novoVal ? nome : null }) });
      setObras((prev) => prev.map((o) => o.id === obraId
        ? { ...o, aprovada: novoVal, aprovada_por: novoVal ? nome : null, aprovada_em: novoVal ? new Date().toISOString() : null }
        : o));
    } catch { showToast('Erro ao atualizar'); }
    setAprovandoObra(null);
  };

  const handleLiberarTodasCeo = async () => {
    const nome = ceoSession?.role === 'diretor' ? ceoSession.nome : 'Diretor';
    setAprovandoObra('all');
    try {
      await Promise.all(obras.map((o) =>
        fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: o.id, aprovada: true, aprovada_por: nome }) })
      ));
      const agora = new Date().toISOString();
      setObras((prev) => prev.map((o) => ({ ...o, aprovada: true, aprovada_por: nome, aprovada_em: agora })));
      showToast('Todas as obras liberadas');
    } catch { showToast('Erro ao liberar'); }
    setAprovandoObra(null);
  };

  const handleDia = useCallback((blocoId, idx, field, value) => {
    setDiaData((prev) => {
      const updated = { ...prev, blocos: { ...prev.blocos, [blocoId]: prev.blocos[blocoId].map((r, i) => i === idx ? { ...r, [field]: value } : r) } };
      saveHist(HIST_DIA_KEY, today(), updated);
      return updated;
    });
  }, []);

  const handleFabrica = useCallback((idx, field, value) => {
    setFabricaData((prev) => {
      const updated = { ...prev, respostas: prev.respostas.map((r, i) => i === idx ? { ...r, [field]: value } : r) };
      saveHist(HIST_FAB_KEY, today(), updated);
      return updated;
    });
  }, []);

  const fetchEquipe = useCallback(async (date) => {
    setLoadingEquipe(true);
    const d = date || today();
    try { const r = await fetch(d !== today() ? `/api/submissions?date=${d}` : '/api/submissions'); const data = await r.json(); setSubmissions(Array.isArray(data) ? data : []); }
    catch { setSubmissions([]); }
    finally { setLoadingEquipe(false); }
  }, []);

  const fetchCnc = useCallback(async () => {
    setLoadingCnc(true);
    try { const r = await fetch('/api/cnc'); const d = await r.json(); setCncEntries(Array.isArray(d) ? d : []); }
    catch { setCncEntries([]); }
    finally { setLoadingCnc(false); }
  }, []);

  // Ajustar aba quando viewMode muda (Resumo do Dia disponível para ambos)
  useEffect(() => {
    if (viewMode === 'diretor' && activeTab === 'equipe') {
      setActiveTab('acompanhamento');
    }
  }, [viewMode, activeTab]);

  // Sincroniza equipeDate com viewDate quando está no Resumo do Dia
  useEffect(() => { if (activeTab === 'meudia') setEquipeDate(viewDate); }, [viewDate, activeTab]);
  useEffect(() => { if (auth && activeTab === 'meudia') fetchEquipe(equipeDate); }, [auth, activeTab, equipeDate, fetchEquipe]);
  useEffect(() => { if (auth && activeTab === 'cnc') fetchCnc(); }, [auth, activeTab, fetchCnc]);
  useEffect(() => { if (auth && activeTab === 'fabrica') fetchGerenteFab(viewFabDate); }, [auth, activeTab, viewFabDate, fetchGerenteFab]);
  useEffect(() => { if (auth && activeTab === 'acompanhamento') fetchNotas(notasDate); }, [auth, activeTab, notasDate, fetchNotas]);

  const fetchPedidos = useCallback(async () => {
    setLoadingPedidos(true);
    try { const r = await fetch('/api/pedidos'); const d = await r.json(); setPedidos(Array.isArray(d) ? d : []); }
    catch { setPedidos([]); }
    finally { setLoadingPedidos(false); }
  }, []);

  const fetchLoginHistory = useCallback(async () => {
    setLoadingAcessos(true);
    try { const r = await fetch('/api/login-history'); const d = await r.json(); setLoginHistory(Array.isArray(d) ? d : []); }
    catch { setLoginHistory([]); }
    finally { setLoadingAcessos(false); }
  }, []);

  const fetchResumo = useCallback(async () => {
    try {
      const [oRes, eRes] = await Promise.all([
        fetch('/api/gestao-obra').then(r => r.json()),
        fetch('/api/gestao-escritorio').then(r => r.json()),
      ]);
      setResumoObra(Array.isArray(oRes) ? oRes : []);
      setResumoEscritorio(Array.isArray(eRes) ? eRes : []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { if (auth && activeTab === 'meudia') { fetchGerenteFab(today()); fetchResumo(); } }, [auth, activeTab, fetchGerenteFab, fetchResumo]);
  useEffect(() => { if (auth && activeTab === 'pedidos') fetchPedidos(); }, [auth, activeTab, fetchPedidos]);
  useEffect(() => { if (auth && activeTab === 'obras') fetchObras(); }, [auth, activeTab, fetchObras]);
  useEffect(() => {
    if (auth && activeTab === 'acessos') {
      fetchLoginHistory(); // Initial fetch
      const interval = setInterval(fetchLoginHistory, 10000); // Poll every 10 seconds
      return () => clearInterval(interval); // Cleanup on unmount or when dependencies change
    }
  }, [auth, activeTab, fetchLoginHistory]);

  const diaProgress = () => {
    if (!diaData) return { ans: 0, tot: 0 };
    let tot = 0, ans = 0;
    MEU_DIA_BLOCOS.forEach((b) => { (diaData.blocos[b.id] || []).forEach((r) => { tot++; if (r.status) ans++; }); });
    return { ans, tot };
  };

  if (!mounted) return null;

  if (!auth) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <img src="/logo.png" alt="Lukana" className="h-12 w-auto mb-6 brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        <div className="text-white/50 text-sm mb-8">Área do Diretor</div>
        <div className="w-full max-w-xs">
          <div className="relative mb-3">
            <input type={showPass ? 'text' : 'password'} value={passInput} onChange={(e) => setPassInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()} placeholder="Senha"
              autoComplete="current-password" autoCapitalize="none"
              className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold" />
            <button type="button" onClick={() => setShowPass((v) => !v)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1">
              {showPass
                ? <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          <button onClick={handleAuth} className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl">Entrar</button>
          {toast && <p className="text-red-300 text-sm text-center mt-3">{toast}</p>}
        </div>
      </main>
    );
  }

  const { ans, tot } = diaProgress();
  const QKEYS = ['q1_status','q2_status','q3_status','q4_status','q5_status','q6_status'];
  const filteredSubs = submissions.filter((s) => {
    if (equipeFilter === 'todos') return true;
    if (equipeFilter === 'nao') return QKEYS.some((k) => s[k] === 'nao');
    if (equipeFilter === 'outro') return QKEYS.some((k) => s[k] === 'outro');
    if (equipeFilter === 'diretor') return s.q7_escalate;
    return true;
  });

  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',','');

  // DEBUG: Verificar valor de ceoSession
  console.log('🔍 DEBUG CEO Page - ceoSession:', ceoSession, 'role:', ceoSession?.role, 'é diretor?', ceoSession?.role === 'diretor');

  const ALL_TABS = [
    { id: 'acompanhamento', label: 'Acompanhamento', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 6h.01M12 16h.01"/></svg> },
    { id: 'meudia',  label: 'Resumo do Dia', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
    { id: 'fabrica', label: 'Fábrica',  icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 9l4-4 4 4 4-4 4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/></svg> },
    { id: 'projetos',label: 'Projetos', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 7h18M3 12h18M3 17h18"/><path d="M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2"/></svg> },
    { id: 'obras',   label: 'Obras',    icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id: 'cnc',     label: 'CNC',      icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8l3 3 3-3 3 3"/></svg> },
    { id: 'pedidos', label: 'Pedidos',   icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg> },
    { id: 'estoque', label: 'Estoque',   icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8l-2 4h12l-2-4z"/><path d="M12 12v4M10 14h4"/></svg> },
    { id: 'acessos', label: 'Acessos', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
    { id: 'atas',    label: 'Atas',    icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6h.01M12 16h.01M16 12h.01"/></svg> },
  ];

  // Ambos os modos veem todas as tabs
  const TABS = ALL_TABS;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-navy flex items-center justify-between px-4 shadow-lg">
        <Link href="/"><img src="/logo.png" alt="Lukana" className="h-7 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" /></Link>
        <div className="flex items-center gap-2">
          {activeTab === 'meudia' && <span className="text-xs text-gold/80 bg-white/10 px-2.5 py-1 rounded-full">{ans}/{tot}</span>}
          <span className="text-xs text-white/40 px-2 py-1">{dateStr}</span>
          <button onClick={handleLogout} className="text-xs text-white/40 hover:text-white/70 px-3 py-1 rounded-lg hover:bg-white/5 transition-all">Sair</button>
        </div>
      </header>

      <main className="flex-1 mt-14 mb-16 overflow-y-auto">

        {activeTab === 'acompanhamento' && (
          <div className="px-3 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-2 px-1">Acompanhamento de anotações</p>
            <DateNavSimple viewDate={notasDate} setViewDate={setNotasDate} days={15} />
            {notasDate !== today() && (
              <div className="mb-3 px-1 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold text-center">
                Visualizando {notasDate.split('-').reverse().join('/')} · somente leitura
              </div>
            )}
            {notas.length === 0 ? (
              <div className="space-y-2 text-sm text-gray-500">
                <p className="text-center py-8">📋 Nenhuma anotação registrada hoje ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notas.map((nota) => {
                  const tipoColor = nota.tipo === 'obra' ? 'border-l-4 border-gold bg-gold/5'
                    : nota.tipo === 'fabrica' ? 'border-l-4 border-blue-300 bg-blue-50/40'
                    : 'border-l-4 border-gray-200 bg-white';
                  const tipoLabel = nota.tipo === 'obra' ? '🏗️ Obra'
                    : nota.tipo === 'fabrica' ? '🏭 Fábrica'
                    : '📝 Geral';
                  return (
                    <div key={nota.id} className={`rounded-lg shadow-sm px-3 py-2.5 text-sm ${tipoColor}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{nota.autor}</span>
                          {nota.obra_nome && <span className="text-xs text-gray-500">· {nota.obra_nome}</span>}
                        </div>
                        <span className="text-xs text-gray-400">{nota.created_at?.slice(11,16)}</span>
                      </div>
                      <span className="inline-block text-xs font-bold px-2 py-0.5 rounded mb-1.5 bg-white/50 text-gray-600">{tipoLabel}</span>
                      <p className="text-gray-700 leading-snug">{nota.texto}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'meudia' && (
          <div className="px-3 py-3">
            <ResumoDiario gerenteFab={gerenteFab} resumoObra={resumoObra} resumoEscritorio={resumoEscritorio} />
            <DashboardMeta resumoObra={resumoObra} resumoEscritorio={resumoEscritorio} />
            {notas.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Notas do dia</p>
                <div className="space-y-2">
                  {notas.map((nota) => {
                    const tipoColor = nota.tipo === 'obra' ? 'border-l-4 border-gold bg-gold/5'
                      : nota.tipo === 'fabrica' ? 'border-l-4 border-blue-300 bg-blue-50/40'
                      : 'border-l-4 border-gray-200 bg-white';
                    return (
                      <div key={nota.id} className={`rounded-lg shadow-sm px-3 py-2.5 text-sm ${tipoColor}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-gray-800 text-xs">{nota.autor}</span>
                          <span className="text-[10px] text-gray-400">{nota.created_at?.slice(11,16)}</span>
                        </div>
                        {nota.obra_nome && <span className="text-[10px] text-gray-500 block mb-1">{nota.obra_nome}</span>}
                        <p className="text-gray-700 leading-snug text-xs">{nota.texto}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fabrica' && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Relatório do Gerente</p>
              <button onClick={() => fetchGerenteFab(viewFabDate)} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            <DateNavSimple viewDate={viewFabDate} setViewDate={setViewFabDate} days={15} />
            {viewFabDate !== today() && (
              <div className="mb-3 px-1 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold text-center">
                Visualizando {viewFabDate.split('-').reverse().join('/')} · somente leitura
              </div>
            )}
            {loadingFab && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingFab && !gerenteFab && (
              <div className="text-center py-12 text-sm text-gray-400">Gerente não preencheu neste dia.</div>
            )}
            {!loadingFab && gerenteFab && (() => {
              const ST = { sim: 'Sim', nao: 'Não', outro: 'Outro' };
              const savedAt = gerenteFab.saved_at ? new Date(gerenteFab.saved_at) : null;
              const savedStr = savedAt ? `${String(savedAt.getHours()).padStart(2,'0')}:${String(savedAt.getMinutes()).padStart(2,'0')}` : null;
              return (
                <div className="space-y-2">
                  {savedStr && <p className="text-[10px] text-gray-400 px-1 mb-1">Preenchido às {savedStr}</p>}
                  {gerenteFab.gf1 && (gerenteFab.gf1.obra || gerenteFab.gf1.descricao) && (
                    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Em produção hoje</p>
                      {gerenteFab.gf1.obra && <p className="text-sm text-gray-800 font-semibold">{gerenteFab.gf1.obra}{gerenteFab.gf1.ambiente ? ` · ${gerenteFab.gf1.ambiente}` : ''}</p>}
                      {gerenteFab.gf1.descricao && <p className="text-sm text-gray-600 mt-0.5">{gerenteFab.gf1.descricao}</p>}
                    </div>
                  )}
                  {gerenteFab.gf4?.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Saem hoje</p>
                      {gerenteFab.gf4.map((it, i) => (
                        <p key={i} className="text-sm text-gray-700">{[it.obra, it.cliente, it.comodo, it.movel].filter(Boolean).join(' · ')}</p>
                      ))}
                    </div>
                  )}
                  {gerenteFab.gf3?.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Pronto amanhã cedo</p>
                      {gerenteFab.gf3.map((it, i) => (
                        <p key={i} className="text-sm text-gray-700">{[it.obra, it.cliente, it.comodo, it.movel].filter(Boolean).join(' · ')}</p>
                      ))}
                    </div>
                  )}
                  {[{ key: 'gf2', label: 'Travado por material' }, { key: 'gf5', label: 'Problema de qualidade' }, { key: 'gf6', label: 'Máquina com problema' }].map(({ key: k, label }) => {
                    const f = gerenteFab[k];
                    if (!f?.status) return null;
                    const isProblema = f.status === 'sim' || f.status === 'outro';
                    return (
                      <div key={k} className={`bg-white rounded-xl shadow-sm px-4 py-3 border-l-4 ${isProblema ? 'border-red-400' : 'border-green-400'}`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className={`text-sm font-semibold ${isProblema ? 'text-red-600' : 'text-green-600'}`}>{ST[f.status] || f.status}{f.text ? ` — ${f.text}` : ''}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}


        {activeTab === 'projetos' && <ProjetosTab obras={obras} loading={loadingObras}
          isAriel={ceoSession?.role === 'ariel'}
          onSaveEquipe={async (id, equipe) => {
            await fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, equipe }) }).catch(() => {});
            setObras((prev) => prev.map((o) => o.id === id ? { ...o, equipe } : o));
          }}
          onSavePrazo={async (id, prazo) => {
            await fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, prazo }) }).catch(() => {});
            setObras((prev) => prev.map((o) => o.id === id ? { ...o, prazo } : o));
          }}
        />}
        {activeTab === 'obras' && <ObrasTab obras={obras} setObras={setObras} loading={loadingObras} onRefresh={fetchObras} aprovandoObra={aprovandoObra} onToggleAprovada={handleToggleAprovadaCeo} onLiberarTodas={handleLiberarTodasCeo} />}

        {activeTab === 'estoque' && <EstoqueTab />}

        {activeTab === 'pedidos' && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Pedidos recentes</p>
              <button onClick={fetchPedidos} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loadingPedidos && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingPedidos && pedidos.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">Nenhum pedido nos últimos 7 dias.</div>
            )}
            {!loadingPedidos && pedidos.map((p) => (
              <PedidoCard key={p.id} pedido={p} onStatusChange={async (id, status) => {
                await fetch('/api/pedidos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
                setPedidos((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
              }} />
            ))}
          </div>
        )}

        {activeTab === 'acessos' && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Acessos</p>
              <button onClick={fetchLoginHistory} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loadingAcessos && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingAcessos && loginHistory.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">Nenhum acesso registrado.</div>
            )}
            {!loadingAcessos && loginHistory.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {loginHistory.map((ev) => {
                  const d = new Date(ev.timestamp);
                  const now = new Date();
                  const isToday = d.toDateString() === now.toDateString();
                  const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  const dia = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
                  const roleLabels = {
                    diretor: 'Diretor', gerente: 'Gerente',
                    coordenador_obra: 'Coord. Obra', coordenador_projetos: 'Gestor Escrit.',
                    encarregado: 'Encarregado', marceneiro: 'Marceneiro',
                    montador: 'Montador', auxiliar: 'Auxiliar', cnc: 'Op. CNC',
                  };
                  const roleLabel = roleLabels[ev.role] || ev.role;
                  const firstName = ev.nome.split(' ')[0];
                  const initials = ev.nome.split(' ').filter(Boolean).slice(0,2).map(n => n[0]).join('').toUpperCase();
                  const visto = ev.isOnline ? 'Online' : isToday ? `às ${hora}` : `${dia} ${hora}`;
                  return (
                    <div key={ev.id} className="bg-white rounded-xl shadow-sm p-3 flex flex-col items-center text-center gap-1">
                      <div className="relative mt-1">
                        <div className="w-11 h-11 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm">
                          {initials}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${ev.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="font-semibold text-sm text-gray-900 mt-0.5 leading-tight">{firstName}</div>
                      <div className="text-[10px] text-gray-400 leading-tight">{roleLabel}</div>
                      <div className={`text-[10px] font-medium mt-0.5 ${ev.isOnline ? 'text-green-500' : 'text-gray-400'}`}>{visto}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cnc' && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Cortes do dia</p>
              <button onClick={fetchCnc} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loadingCnc && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingCnc && cncEntries.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">Nenhum corte registrado hoje.</div>
            )}
            {!loadingCnc && ['CNC','Seccionadora'].map((maq) => {
              const entries = cncEntries.filter((e) => e.maquina === maq);
              if (entries.length === 0) return null;
              return (
                <div key={maq} className="mb-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{maq}</p>
                  {entries.map((e, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm px-4 py-3 mb-2 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{e.peca}</div>
                        {e.obra && <div className="text-xs text-gray-400 mt-0.5">{e.obra}</div>}
                        <div className="text-xs text-gray-400">{e.operador}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${e.status === 'Concluído' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{e.status}</span>
                        <span className="text-[10px] text-gray-300">{e.created_at?.slice(11,16)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'atas' && <AtasTab session={auth} readonly={auth?.role === 'diretor'} />}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-navy flex overflow-x-auto no-scrollbar shadow-lg">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors px-3 min-w-[64px] ${activeTab === t.id ? 'text-gold' : 'text-white/35'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">{toast}</div>}
    </div>
  );
}
