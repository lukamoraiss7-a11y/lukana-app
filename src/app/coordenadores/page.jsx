'use client';

// ⚠️ RESTRIÇÃO: Esta página exibe APENAS dados operacionais (clientes e ambientes relacionados).
// Valores de negociação, entrada, parcelas e preços devem permanecer restritos ao ClickUp.
// Coordenadores veem APENAS: cliente, ambiente, equipe, datas, métricas de execução (25/50/75/100).

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import { COORDENADOR_CHECKLIST, EQUIPES_OBRA, AMBIENTES_LISTA } from '@/lib/questions';
import AtasTab from '@/components/AtasTab';

const today = () => new Date().toISOString().slice(0, 10);

async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < buf.byteLength - 4) {
      const marker = view.getUint16(offset);
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        const hdr = new Uint8Array(buf, offset + 4, 6);
        if (String.fromCharCode(...hdr) === 'Exif\0\0') {
          const ts = offset + 10;
          const tv = new DataView(buf, ts);
          const le = tv.getUint16(0) === 0x4949;
          const ifd0 = tv.getUint32(4, le);
          const n0 = tv.getUint16(ifd0, le);
          for (let i = 0; i < n0; i++) {
            const e = ifd0 + 2 + i * 12;
            if (tv.getUint16(e, le) === 0x8769) {
              const exifOff = tv.getUint32(e + 8, le);
              const nx = tv.getUint16(exifOff, le);
              for (let j = 0; j < nx; j++) {
                const ex = exifOff + 2 + j * 12;
                if (tv.getUint16(ex, le) === 0x9003) {
                  const cnt = tv.getUint32(ex + 4, le);
                  const vOff = tv.getUint32(ex + 8, le);
                  const bytes = new Uint8Array(buf, ts + vOff, Math.min(cnt - 1, 19));
                  const s = String.fromCharCode(...bytes);
                  return s.slice(0, 10).replace(/:/g, '-');
                }
              }
            }
          }
        }
      }
      offset += 2 + segLen;
    }
  } catch {}
  return null;
}

const PEDIDO_STATUS = {
  pendente:  { label: 'Pendente',  cls: 'bg-amber-100 text-amber-600' },
  em_compra: { label: 'Em Compra', cls: 'bg-blue-100 text-blue-600' },
  comprado:  { label: 'Comprado',  cls: 'bg-green-100 text-green-600' },
};

const pedidoItemLabel = (item) => {
  const specs = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao].filter(Boolean);
  return specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
};

// ── Nota card ──────────────────────────────────────────────────────────────
function NotaCard({ nota }) {
  const s = nota.tipo === 'sugestao' ? 'border-l-4 border-purple-300 bg-purple-50/40'
    : nota.tipo === 'obra' ? 'border-l-4 border-gold bg-gold/5'
    : nota.tipo === 'fabrica' ? 'border-l-4 border-blue-300 bg-blue-50/40'
    : 'border-l-4 border-gray-200 bg-white';
  return (
    <div className={`rounded-xl shadow-sm px-4 py-3 mb-2 ${s}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-500">
          {nota.tipo === 'sugestao' && <span className="mr-1 text-purple-500">Sugestão ·</span>}
          {nota.autor}
        </span>
        <span className="text-[10px] text-gray-300">{nota.created_at?.slice(11,16)}</span>
      </div>
      <p className="text-sm text-gray-800 leading-snug">{nota.texto}</p>
    </div>
  );
}

// ── Equipe mini card ───────────────────────────────────────────────────────
function EquipeMiniCard({ sub }) {
  const [open, setOpen] = useState(false);
  const qs = ['q1_status','q2_status','q3_status','q4_status','q5_status','q6_status'];
  const worst = () => {
    if (qs.some((k) => sub[k] === 'nao')) return 'bloq';
    if (qs.some((k) => sub[k] === 'outro')) return 'duvida';
    if (qs.every((k) => sub[k] === 'sim')) return 'ok';
    return 'vazio';
  };
  const wc = worst();
  const labels = { ok: 'OK', duvida: 'Atenção', bloq: 'Bloqueio', vazio: 'Parcial' };
  const QLABELS = ['O que instala/produz hoje','Material faltando','Acesso garantido','Dúvida técnica','Impeditivo','Concluído ontem'];
  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-3 py-3 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-sm text-gray-900">{sub.name}</div>
          {sub.obra && <div className="text-xs text-gray-400">{sub.obra}</div>}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full badge-${wc}`}>{labels[wc]}</span>
        {sub.q7_escalate && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Diretor</span>}
        <span className="text-[10px] text-gray-300">{sub.submitted_at?.slice(11,16)}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {[1,2,3,4,5,6].map((n) => {
            const st = sub[`q${n}_status`];
            const tx = n === 1
              ? (sub.q1_descricao ? [sub.q1_cliente, sub.q1_ambiente, sub.q1_descricao].filter(Boolean).join(' · ') : sub.q1_text)
              : sub[`q${n}_text`];
            if (!st && !tx) return null;
            const sc = st === 'sim' ? 'status-ok' : st === 'outro' ? 'status-duvida' : st === 'nao' ? 'status-bloq' : 'border-gray-200 bg-gray-50 text-gray-400';
            const sl = st === 'sim' ? 'Sim' : st === 'nao' ? 'Não' : st === 'outro' ? 'Outro' : st;
            return (
              <div key={n}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{QLABELS[n-1]}</div>
                {st && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-2 ${sc} mr-1.5`}>{sl}</span>}
                {tx && <span className="text-xs text-gray-700">{tx}</span>}
              </div>
            );
          })}
          {sub.q7_escalate && (
            <div>
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-0.5">Precisa do Diretor</div>
              <p className="text-xs text-gray-700">{sub.q7_text || '—'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pedido card ────────────────────────────────────────────────────────────
function PedidoCoordCard({ pedido, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const sm = PEDIDO_STATUS[pedido.status] || PEDIDO_STATUS.pendente;
  const nextStatus = pedido.status === 'pendente' ? 'em_compra' : pedido.status === 'em_compra' ? 'comprado' : null;
  const nextLabel  = nextStatus === 'em_compra' ? 'Em Compra' : nextStatus === 'comprado' ? 'Comprado' : null;
  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-3 py-3 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-sm text-gray-900 truncate">{pedido.obra_nome}</div>
          <div className="text-xs text-gray-400">{pedido.solicitante} · {pedido.created_at?.slice(11,16)}</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sm.cls}`}>{sm.label}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="mb-2.5">
            {pedido.itens?.map((item, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-700">{pedidoItemLabel(item)}</span>
                <span className="text-xs font-bold text-navy ml-2 flex-shrink-0">{item.quantidade} {item.unidade}</span>
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

// ── Caderno Técnico (Coord. Projetos) ─────────────────────────────────────
const CT_RESPONSAVEIS = ['Ana', 'Aline', 'Munyke', 'Mariana', 'Letícia'];
const CT_STATUS_CFG = {
  em_execucao:     { label: 'Em Execução',        badge: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500' },
  concluido:       { label: 'Concluído',           badge: 'bg-green-100 text-green-700',     bar: 'bg-green-500' },
  em_apresentacao: { label: 'Em Apresentação',     badge: 'bg-purple-100 text-purple-700',   bar: 'bg-purple-500' },
  aprovado:        { label: 'Aprovado',             badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  reprovado:       { label: 'Reprovado',            badge: 'bg-red-100 text-red-600',         bar: 'bg-red-500' },
};

function CadernoTecnicoTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroResp, setFiltroResp] = useState('todos');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(null);
  const [reprovObs, setReprovObs] = useState({});
  const [enviando, setEnviando] = useState(null);
  const [showEnviar, setShowEnviar] = useState(false);
  const [cadernoIds, setCadernoIds] = useState(new Set());
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [loadingObras, setLoadingObras] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/caderno');
      const d = await r.json();
      const arr = Array.isArray(d) ? d : [];
      setItems(arr);
      setCadernoIds(new Set(arr.map(i => i.id)));
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const patchItem = async (id, updates, obs_historico = '') => {
    setSaving(id);
    try {
      await fetch('/api/caderno', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, obs_historico, ...updates }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
      setEditId(null);
    } finally { setSaving(null); }
  };

  const saveEdit = async (item) => {
    const ed = editData[item.id] || {};
    await patchItem(item.id, ed);
  };

  const removeItem = async (id) => {
    if (!confirm('Remover do Caderno Técnico?')) return;
    setSaving(id);
    try {
      await fetch('/api/caderno', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      setItems(prev => prev.filter(i => i.id !== id));
      setCadernoIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } finally { setSaving(null); }
  };

  const abrirPainelImportar = async () => {
    const abrir = !showEnviar;
    setShowEnviar(abrir);
    if (abrir) {
      setLoadingObras(true);
      try {
        const r = await fetch('/api/obras');
        const d = await r.json();
        setObrasDisponiveis(Array.isArray(d) ? d : []);
      } catch { setObrasDisponiveis([]); }
      finally { setLoadingObras(false); }
    }
  };

  const enviarParaCaderno = async (obra) => {
    setEnviando(obra.id);
    try {
      const r = await fetch('/api/caderno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obra.id, nome: obra.nome, ambientes: obra.ambientes, prazo: obra.prazo }),
      });
      if (r.ok) {
        setCadernoIds(prev => new Set([...prev, obra.id]));
        await fetchItems();
      }
    } finally { setEnviando(null); }
  };

  const filtered = items.filter(i => {
    if (filtroStatus !== 'todos' && i.status !== filtroStatus) return false;
    if (filtroResp !== 'todos' && !(i.responsaveis || []).includes(filtroResp)) return false;
    return true;
  });

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">{items.length} projeto{items.length !== 1 ? 's' : ''}</p>
        <button onClick={abrirPainelImportar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gold text-navy">
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Adicionar projeto
        </button>
      </div>

      {/* Painel adicionar */}
      {showEnviar && (
        <div className="bg-white rounded-xl shadow-sm mb-3 p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Projetos disponíveis</p>
          {loadingObras && <p className="text-sm text-gray-400 text-center py-3">Carregando...</p>}
          {!loadingObras && obrasDisponiveis.filter(o => !cadernoIds.has(o.id)).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">Todos os projetos já estão no Caderno Técnico.</p>
          )}
          {!loadingObras && obrasDisponiveis.filter(o => !cadernoIds.has(o.id)).map(obra => (
            <div key={obra.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-semibold text-gray-900 truncate">{obra.nome}</p>
                {obra.ambientes?.length > 0 && <p className="text-xs text-gray-400">{obra.ambientes.length} amb.</p>}
              </div>
              <button onClick={() => enviarParaCaderno(obra)} disabled={enviando === obra.id}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-navy text-navy disabled:opacity-50">
                {enviando === obra.id ? '...' : 'Adicionar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2 pb-0.5">
        {[{ v: 'todos', l: 'Todos' }, ...Object.entries(CT_STATUS_CFG).map(([v, c]) => ({ v, l: c.label }))].map(f => (
          <button key={f.v} onClick={() => setFiltroStatus(f.v)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filtroStatus === f.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-0.5">
        {[{ v: 'todos', l: 'Todos' }, ...CT_RESPONSAVEIS.map(r => ({ v: r, l: r }))].map(f => (
          <button key={f.v} onClick={() => setFiltroResp(f.v)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filtroResp === f.v ? 'border-gold bg-gold/10 text-gold-d' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          {items.length === 0 ? 'Nenhum projeto adicionado ainda.' : 'Nenhum projeto com este filtro.'}
        </div>
      )}

      {filtered.map(item => {
        const sc = CT_STATUS_CFG[item.status] || CT_STATUS_CFG.em_execucao;
        const isEditing = editId === item.id;
        const isSaving = saving === item.id;
        const ed = editData[item.id] || {};
        const responsaveis = ed.responsaveis ?? item.responsaveis ?? [];

        return (
          <div key={item.id} className="bg-white rounded-xl shadow-sm mb-3 overflow-hidden">
            <div className="flex items-stretch">
              <div className={`w-1.5 flex-shrink-0 ${sc.bar}`} />
              <div className="flex-1 px-4 py-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] text-gray-900 leading-tight truncate">{item.nome}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
                      {item.ambientes?.length > 0 && <span className="text-[10px] text-gray-400">{item.ambientes.length} amb.</span>}
                    </div>
                  </div>
                  <button onClick={() => { setEditId(isEditing ? null : item.id); if (!isEditing) setEditData(d => ({ ...d, [item.id]: {} })); }}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-500 transition-colors">
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>
                {responsaveis.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {responsaveis.map(r => <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-navy/10 text-navy">{r}</span>)}
                  </div>
                )}
                <div className="flex gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                  {item.data_inicio && <span>Início: {item.data_inicio.split('-').reverse().join('/')}</span>}
                  {item.prazo && <span>Prazo: {item.prazo.split('-').reverse().join('/')}</span>}
                </div>
                {item.observacoes && <p className="text-xs text-gray-500 mt-1.5 leading-snug">{item.observacoes}</p>}
              </div>
            </div>

            {isEditing && (
              <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Responsáveis</p>
                  <div className="flex flex-wrap gap-2">
                    {CT_RESPONSAVEIS.map(r => {
                      const sel = responsaveis.includes(r);
                      return (
                        <button key={r} onClick={() => setEditData(d => {
                          const cur = d[item.id]?.responsaveis ?? item.responsaveis ?? [];
                          return { ...d, [item.id]: { ...d[item.id], responsaveis: sel ? cur.filter(x => x !== r) : [...cur, r] } };
                        })} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${sel ? 'border-navy bg-navy text-gold' : 'border-gray-200 text-gray-500'}`}>
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prazo</p>
                  <input type="date" defaultValue={item.prazo || ''}
                    onChange={e => setEditData(d => ({ ...d, [item.id]: { ...d[item.id], prazo: e.target.value } }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Observações</p>
                  <textarea defaultValue={item.observacoes || ''} rows={2}
                    onChange={e => setEditData(d => ({ ...d, [item.id]: { ...d[item.id], observacoes: e.target.value } }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold" />
                </div>
                {item.ambientes?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Ambientes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.ambientes.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600">{typeof a === 'string' ? a : a.nome}</span>
                      ))}
                    </div>
                  </div>
                )}
                {item.historico?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Histórico</p>
                    <div className="space-y-1">
                      {[...item.historico].reverse().slice(0, 5).map((h, i) => {
                        const d = new Date(h.data);
                        const ds = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                        return (
                          <div key={i} className="text-[11px] text-gray-500">
                            <span className="font-semibold">{CT_STATUS_CFG[h.status]?.label || h.status}</span>
                            <span className="text-gray-400"> · {ds}</span>
                            {h.obs && <span className="text-gray-400"> — {h.obs}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => saveEdit(item)} disabled={isSaving}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-gold text-navy disabled:opacity-50">
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => removeItem(item.id)} disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-red-200 text-red-400">
                    Remover
                  </button>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="px-4 pb-3 pt-1 flex gap-2 flex-wrap">
                {item.status === 'em_execucao' && (
                  <button onClick={() => patchItem(item.id, { status: 'concluido' }, 'Caderno técnico concluído')} disabled={isSaving}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-green-500 text-white disabled:opacity-50">
                    {isSaving ? '...' : 'Marcar Concluído'}
                  </button>
                )}
                {item.status === 'concluido' && (
                  <button onClick={() => patchItem(item.id, { status: 'em_apresentacao' }, 'Enviado para apresentação')} disabled={isSaving}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-purple-500 text-white disabled:opacity-50">
                    {isSaving ? '...' : 'Enviar para Apresentação'}
                  </button>
                )}
                {item.status === 'em_apresentacao' && (
                  <>
                    <button onClick={() => patchItem(item.id, { status: 'aprovado' }, 'Aprovado pelo cliente')} disabled={isSaving}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white disabled:opacity-50">
                      {isSaving ? '...' : 'Aprovado'}
                    </button>
                    <div className="w-full flex gap-2">
                      <input value={reprovObs[item.id] || ''} onChange={e => setReprovObs(r => ({ ...r, [item.id]: e.target.value }))}
                        placeholder="Motivo da reprovação..." className="flex-1 border-2 border-red-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-red-400" />
                      <button onClick={() => patchItem(item.id, { status: 'reprovado' }, reprovObs[item.id] || 'Reprovado pelo cliente')} disabled={isSaving}
                        className="px-3 py-2 rounded-xl text-xs font-bold border-2 border-red-400 text-red-500 disabled:opacity-50">
                        Reprovado
                      </button>
                    </div>
                  </>
                )}
                {item.status === 'reprovado' && (
                  <button onClick={() => patchItem(item.id, { status: 'em_execucao' }, 'Retornado após reprovação')} disabled={isSaving}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-500 text-white disabled:opacity-50">
                    {isSaving ? '...' : 'Retornar para Execução'}
                  </button>
                )}
                {item.status === 'aprovado' && (
                  <div className="flex-1 text-center py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200">
                    Plano de Corte
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Caderno de Venda (Coord. Projetos) ────────────────────────────────────
const CADERNO_ITENS = [
  { key: 'briefing',             label: 'Briefing do Cliente',       ph: 'O que o cliente quer, expectativas, referências, estilo...', multi: true },
  { key: 'definicoes_cliente',   label: 'Definições com o Cliente',  ph: 'O que foi decidido em reunião/visita — cor, modelo, dimensão...', multi: true },
  { key: 'cor_mdf_principal',    label: 'Cor MDF Principal',         ph: 'Ex: Branco TX 18mm Duratex' },
  { key: 'cor_mdf_secundaria',   label: 'Cor MDF Secundária',        ph: 'Se houver (ex: Carvalho Naturale)' },
  { key: 'puxador',              label: 'Puxador — Modelo',          ph: 'Ex: Perfil contínuo alumínio 10cm' },
  { key: 'puxador_acabamento',   label: 'Puxador — Acabamento',      ph: 'Ex: Preto fosco / Cromado / Dourado' },
  { key: 'led',                  label: 'LED — Locais',              ph: 'Ex: Rodapé cozinha + interior armário' },
  { key: 'led_tipo',             label: 'LED — Tipo/Temperatura',    ph: 'Ex: 3000K branco quente, fita 5050' },
  { key: 'gavetas',              label: 'Gavetas',                   ph: 'Ex: Tandembox Blum / corrediça telescópica / altura...' },
  { key: 'divisorias',           label: 'Divisórias Internas',       ph: 'Ex: Porta-talher MDF / organizador modular / prateleira interna' },
  { key: 'alturas',              label: 'Alturas dos Móveis',        ph: 'Ex: Armário superior 80cm, base 87cm' },
  { key: 'tamponamento',         label: 'Acabamento Tamponamento',   ph: 'Ex: Fita de bordo PVC branco 22mm' },
  { key: 'serralheria',          label: 'Serralheria',               ph: 'Ex: Porta basculante em alumínio preto' },
  { key: 'obs',                  label: 'Observações do Projeto',    ph: 'Detalhes, exceções, alertas...', multi: true },
];

function CadernoTab({ obras, session }) {
  const [obraId, setObraId]     = useState('');
  const [campos, setCampos]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const set = (k, v) => setCampos(p => ({ ...p, [k]: v }));
  const canSave = obraId && CADERNO_ITENS.some(i => (campos[i.key] || '').trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const obra = obras.find(o => o.id === obraId);
    const lines = CADERNO_ITENS
      .filter(i => (campos[i.key] || '').trim())
      .map(i => `*${i.label}:* ${campos[i.key].trim()}`);
    const texto = `📋 *Caderno de Venda — ${obra?.nome || obraId}*\n${lines.join('\n')}`;
    try {
      await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autor: session.nome, texto, tipo: 'caderno' }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-3 space-y-3">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Obra / Projeto</p>
        </div>
        <div className="px-4 py-3">
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold bg-white">
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Definições do Projeto</p>
        </div>
        <div className="divide-y divide-gray-100">
          {CADERNO_ITENS.map(item => (
            <div key={item.key} className="px-4 py-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{item.label}</p>
              {item.multi ? (
                <textarea
                  value={campos[item.key] || ''}
                  onChange={e => set(item.key, e.target.value)}
                  placeholder={item.ph}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-gray-300 resize-none"
                />
              ) : (
                <input
                  value={campos[item.key] || ''}
                  onChange={e => set(item.key, e.target.value)}
                  placeholder={item.ph}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-gray-300"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-20 pt-2">
        {saved && <p className="text-green-600 text-xs text-center mb-2 font-bold">Caderno salvo!</p>}
        <button onClick={handleSave} disabled={!canSave || saving}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-colors ${canSave && !saving ? 'bg-gold text-navy active:opacity-80' : 'bg-gray-200 text-gray-400'}`}>
          {saving ? 'Salvando...' : 'Salvar Caderno de Venda'}
        </button>
      </div>
    </div>
  );
}

// ── Gestão do Escritório (Coord. Projetos) ────────────────────────────────
function GestaoEscritorioTab({ obras }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  const defaultForm = {
    obra: '',
    ambiente: '',
    responsavel: '',
    medicao: '',
    inicio_modelagem: '',
    fim_modelagem: '',
    apresentacao_cliente: '',
    aprovacao_cliente: '',
    solicitacao_alteracao: '',
    entrega_alteracao: '',
    aprovacao_final: '',
    inicio_caderno_tecnico: '',
    fim_caderno_tecnico: '',
    revisao: '',
    envio_fabrica: '',
    status: 'em_progresso',
    observacoes: '',
    equipe_escritorio: [],
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/gestao-escritorio');
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditId(null);
  };

  const handleEdit = (item) => {
    setFormData(item);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.obra || !formData.ambiente) {
      alert('Preencha Cliente/Obra e Ambiente');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        const r = await fetch('/api/gestao-escritorio', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...formData }),
        });
        if (r.ok) {
          setItems(prev =>
            prev.map(i => i.id === editId ? { ...i, ...formData } : i)
          );
        }
      } else {
        const r = await fetch('/api/gestao-escritorio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const res = await r.json();
        if (r.ok) {
          setItems(prev => [res.item, ...prev]);
        }
      }
      resetForm();
      setShowForm(false);
    } catch (e) {
      alert('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover?')) return;
    setSaving(true);
    try {
      await fetch('/api/gestao-escritorio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setSaving(false);
    }
  };

  const EQUIPE_ESC = ['Munyke', 'Ana', 'Aline', 'Letícia', 'Mariana'];
  const [showDesignarModal, setShowDesignarModal] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);

  const calcularDias = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) return 0;
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  };

  const tempoModelagem = calcularDias(formData.inicio_modelagem, formData.fim_modelagem);
  const tempoAlteracao = calcularDias(formData.solicitacao_alteracao, formData.entrega_alteracao);
  const tempoTecnico = calcularDias(formData.inicio_caderno_tecnico, formData.fim_caderno_tecnico);
  const tempoTotal = tempoModelagem + tempoAlteracao + tempoTecnico;

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">{items.length} projeto{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gold text-navy">
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Novo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Cliente/Obra *</label>
                <input type="text" value={formData.obra} onChange={(e) => setFormData({...formData, obra: e.target.value})}
                  placeholder="Nome do cliente/obra"
                  className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Ambiente *</label>
                <input type="text" value={formData.ambiente} onChange={(e) => setFormData({...formData, ambiente: e.target.value})}
                  placeholder="Ex: Cozinha, Sala"
                  className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Responsável</label>
              <input type="text" value={formData.responsavel} onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
                placeholder="Nome"
                className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Datas importantes</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'medicao', label: 'Medição' },
                  { key: 'inicio_modelagem', label: 'Início Modelagem' },
                  { key: 'fim_modelagem', label: 'Fim Modelagem' },
                  { key: 'apresentacao_cliente', label: 'Apresentação' },
                  { key: 'aprovacao_cliente', label: 'Aprovação Cliente' },
                  { key: 'solicitacao_alteracao', label: 'Sol. Alteração' },
                  { key: 'entrega_alteracao', label: 'Ent. Alteração' },
                  { key: 'aprovacao_final', label: 'Aprovação Final' },
                  { key: 'inicio_caderno_tecnico', label: 'Início Caderno' },
                  { key: 'fim_caderno_tecnico', label: 'Fim Caderno' },
                  { key: 'revisao', label: 'Revisão' },
                  { key: 'envio_fabrica', label: 'Envio Fábrica' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">{label}</label>
                    <input type="date" value={formData[key] || ''} onChange={(e) => setFormData({...formData, [key]: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-gold" />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gold bg-white">
                  <option value="em_progresso">Em progresso</option>
                  <option value="completo">Completo</option>
                  <option value="parado">Parado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Observações</label>
              <textarea value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Anotações gerais"
                rows={2}
                className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold resize-none" />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-gold text-navy disabled:opacity-50">
                {editId ? 'Atualizar' : 'Adicionar'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-gray-200 text-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Designação de Tarefas */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-2">Clique para designar tarefas</p>
        <div className="grid grid-cols-2 gap-2">
          {EQUIPE_ESC.map(pessoa => {
            const contagemTarefas = items.filter(i => i.equipe_escritorio?.includes(pessoa)).length;
            return (
              <button key={pessoa} onClick={() => { setPessoaSelecionada(pessoa); setShowDesignarModal(true); }}
                className="py-3 rounded-lg text-xs font-bold transition-colors bg-blue-50 text-blue-600 border-2 border-blue-200 hover:border-blue-400">
                <div>{pessoa}</div>
                {contagemTarefas > 0 && <div className="text-[10px] mt-1 opacity-70">{contagemTarefas} tarefa{contagemTarefas !== 1 ? 's' : ''}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal de Designação */}
      {showDesignarModal && pessoaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-80 overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">Designar tarefas para {pessoaSelecionada}</h3>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Nenhum projeto criado ainda</p>
              ) : (
                items.map(item => {
                  const isAssigned = item.equipe_escritorio?.includes(pessoaSelecionada);
                  return (
                    <button key={item.id} onClick={() => {
                      const updatedItems = items.map(i =>
                        i.id === item.id
                          ? {
                              ...i,
                              equipe_escritorio: isAssigned
                                ? i.equipe_escritorio.filter(p => p !== pessoaSelecionada)
                                : [...(i.equipe_escritorio || []), pessoaSelecionada]
                            }
                          : i
                      );
                      setItems(updatedItems);
                      // Atualizar no servidor
                      fetch('/api/gestao-escritorio', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: item.id,
                          equipe_escritorio: updatedItems.find(i => i.id === item.id).equipe_escritorio
                        })
                      });
                    }}
                      className={`w-full p-3 rounded-lg text-left text-sm font-bold border-2 transition-colors ${
                        isAssigned
                          ? 'bg-blue-100 text-blue-600 border-blue-300'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      <div>{item.obra} - {item.ambiente}</div>
                      {isAssigned && <div className="text-[10px] mt-1 opacity-70">✓ Designado</div>}
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t mt-4">
              <button onClick={() => { setShowDesignarModal(false); setPessoaSelecionada(null); }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-200 text-gray-600">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {items.map(item => {
          const tMod = calcularDias(item.inicio_modelagem, item.fim_modelagem);
          const tAlt = calcularDias(item.solicitacao_alteracao, item.entrega_alteracao);
          const tTec = calcularDias(item.inicio_caderno_tecnico, item.fim_caderno_tecnico);
          const tTotal = tMod + tAlt + tTec;

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-navy">{item.obra}</p>
                  <p className="text-xs text-gray-500">{item.ambiente}</p>
                  {item.responsavel && <p className="text-[10px] text-gray-400 mt-1">Resp: {item.responsavel}</p>}
                  {item.equipe_escritorio?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.equipe_escritorio.map(pessoa => (
                        <span key={pessoa} className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                          {pessoa}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => handleEdit(item)}
                    className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-600 rounded-md">Edit</button>
                  <button onClick={() => handleDelete(item.id)}
                    className="px-2 py-1 text-xs font-bold bg-red-100 text-red-600 rounded-md">Del</button>
                </div>
              </div>

              {/* Tempos em Cards */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {tMod > 0 && (
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Model.</p>
                    <p className="text-sm font-bold text-blue-600">{tMod}d</p>
                  </div>
                )}
                {tAlt > 0 && (
                  <div className="bg-yellow-50 p-2 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Altera.</p>
                    <p className="text-sm font-bold text-yellow-600">{tAlt}d</p>
                  </div>
                )}
                {tTec > 0 && (
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Técn.</p>
                    <p className="text-sm font-bold text-purple-600">{tTec}d</p>
                  </div>
                )}
                {tTotal > 0 && (
                  <div className="bg-green-50 p-2 rounded text-center">
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Total</p>
                    <p className="text-sm font-bold text-green-600">{tTotal}d</p>
                  </div>
                )}
              </div>

              {/* Status e Observações */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    item.status === 'completo' ? 'bg-green-100 text-green-600'
                    : item.status === 'parado' ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                  }`}>
                    {item.status === 'completo' ? 'Completo' : item.status === 'parado' ? 'Parado' : 'Em progresso'}
                  </span>
                </div>
                {item.observacoes && <div className="text-gray-600 italic">{item.observacoes}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Termo de Recebimento ───────────────────────────────────────────────────
const TERMO_TEXTO = `Os móveis entregues foram confeccionados conforme especificações acordadas no contrato inicial, incluindo medidas, materiais, cores e acabamentos. A entrega segue de acordo com os projetos, memorial descritivo e material publicitário utilizado pela empresa. Todos os itens foram instalados nos locais previamente definidos e encontram-se em perfeito estado de conservação e funcionamento.

CONDIÇÕES DE ENTREGA E ACEITAÇÃO

1. Os móveis foram entregues e montados dentro das normas técnicas aplicáveis.
2. Foi realizada a entrega técnica com orientações detalhadas sobre uso, manutenção e cuidados necessários para preservar qualidade e funcionalidade.
3. Após a montagem, o contratante realizou a inspeção dos móveis e confirmou que estão em perfeito estado, sem vícios, patologias ou danos aparentes.
4. O contratante declara estar ciente de que qualquer dano causado por uso inadequado ou falta de manutenção não será coberto pela garantia.

GARANTIA

1. A Lukana Marcenaria fornece garantia contratual de 5 (cinco) anos para a montagem dos móveis planejados, contada a partir da data de entrega.
2. A garantia cobre exclusivamente defeitos relacionados à montagem realizada pela contratada. Não estão incluídos danos decorrentes de mau uso, desgaste natural ou alterações realizadas por terceiros.

RESPONSABILIDADES DAS PARTES

Contratada: responsável pela entrega e montagem dos móveis conforme especificações acordadas, garantindo a qualidade do serviço prestado.

Contratante: responsável por seguir as orientações técnicas fornecidas durante a entrega e realizar a manutenção adequada dos móveis.

DISPOSIÇÕES GERAIS

1. Este termo é firmado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores legais.
2. Qualquer disputa decorrente deste termo será resolvida no foro da comarca de Campo Grande – Mato Grosso do Sul, com exclusão de qualquer outro.

DECLARAÇÃO FINAL

O contratante declara que os móveis planejados foram entregues em conformidade com o contrato firmado. Ambas as partes concordam com os termos aqui descritos.`;

// ── Gestão (Head/Diretor) ────────────────────────────────
function GestaoHeadTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const r = await fetch('/api/gestao-escritorio');
        const d = await r.json();
        setItems(Array.isArray(d) ? d : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const calcularDias = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) return 0;
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-3">
      <div className="grid grid-cols-1 gap-3">
        {items.map(item => {
          const tMod = calcularDias(item.inicio_modelagem, item.fim_modelagem);
          const tAlt = calcularDias(item.solicitacao_alteracao, item.entrega_alteracao);
          const tTec = calcularDias(item.inicio_caderno_tecnico, item.fim_caderno_tecnico);
          const tTotal = tMod + tAlt + tTec;

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-navy">
              <div className="mb-3">
                <p className="font-bold text-sm text-navy">{item.obra}</p>
                <p className="text-xs text-gray-500">{item.ambiente}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]">
                {item.inicio_modelagem && (
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="font-bold text-blue-600">Modelagem Início</p>
                    <p className="text-gray-600">{new Date(item.inicio_modelagem).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                {item.fim_modelagem && (
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="font-bold text-blue-600">Modelagem Fim</p>
                    <p className="text-gray-600">{new Date(item.fim_modelagem).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                {item.inicio_caderno_tecnico && (
                  <div className="bg-purple-50 p-2 rounded">
                    <p className="font-bold text-purple-600">Técnico Início</p>
                    <p className="text-gray-600">{new Date(item.inicio_caderno_tecnico).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                {item.fim_caderno_tecnico && (
                  <div className="bg-purple-50 p-2 rounded">
                    <p className="font-bold text-purple-600">Técnico Fim</p>
                    <p className="text-gray-600">{new Date(item.fim_caderno_tecnico).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
              </div>

              {/* Tempos totais e equipe */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {tMod > 0 && <div className="bg-blue-100 text-blue-700 p-2 rounded text-center font-bold">Model. {tMod}d</div>}
                {tAlt > 0 && <div className="bg-yellow-100 text-yellow-700 p-2 rounded text-center font-bold">Alt. {tAlt}d</div>}
                {tTec > 0 && <div className="bg-purple-100 text-purple-700 p-2 rounded text-center font-bold">Tec. {tTec}d</div>}
                {tTotal > 0 && <div className="bg-green-100 text-green-700 p-2 rounded text-center font-bold col-span-3">Total {tTotal}d</div>}
              </div>

              {item.equipe_escritorio?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 mb-2">Equipe:</p>
                  <div className="flex gap-1 flex-wrap">
                    {item.equipe_escritorio.map(pessoa => (
                      <span key={pessoa} className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                        {pessoa}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Gestão de Obra (Coord. Obra) ────────────────────────────────
function GestaoObraTab({ obras }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [availableObras, setAvailableObras] = useState([]);
  const [selectedObraIds, setSelectedObraIds] = useState([]);
  const [importingLoading, setImportingLoading] = useState(false);

  const defaultForm = {
    cliente: '',
    obra: '',
    ambiente: '',
    equipe: '',
    data_inicio: '',
    data_fim: '',
    tempo_execucao: '',
    modulos: '',
    paineis: '',
    portas_passagem: '',
    retrabalhos: '0',
    qualidade: '0',
    status: 'em_progresso',
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/gestao-obra');
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchAvailableObras = async () => {
    try {
      const r = await fetch('/api/gestao-obra/import');
      const d = await r.json();
      setAvailableObras(Array.isArray(d) ? d : []);
      setSelectedObraIds([]);
    } catch {
      setAvailableObras([]);
    }
  };

  const handleImport = async () => {
    if (selectedObraIds.length === 0) {
      alert('Selecione pelo menos uma obra');
      return;
    }
    setImportingLoading(true);
    try {
      const r = await fetch('/api/gestao-obra/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obraIds: selectedObraIds }),
      });
      if (r.ok) {
        const res = await r.json();
        alert(res.message || 'Obras importadas com sucesso');
        setShowImport(false);
        fetchItems();
        setAvailableObras([]);
      }
    } catch {
      alert('Erro ao importar obras');
    } finally {
      setImportingLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!formData.cliente || !formData.obra) {
      alert('Preencha Cliente e Obra');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        const r = await fetch('/api/gestao-obra', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...formData }),
        });
        if (r.ok) {
          setItems(prev =>
            prev.map(i => i.id === editId ? { ...i, ...formData } : i)
          );
        }
      } else {
        const r = await fetch('/api/gestao-obra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const res = await r.json();
        if (r.ok) {
          setItems(prev => [res.item, ...prev]);
        }
      }
      resetForm();
      setShowForm(false);
    } catch (e) {
      alert('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const calcularTempo = (inicio, fim) => {
    if (!inicio || !fim) return 0;
    const d1 = new Date(inicio);
    const d2 = new Date(fim);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  };

  const dashboardData = {
    totalObras: items.length,
    totalRetrabalhos: items.reduce((sum, item) => sum + (parseInt(item.retrabalhos) || 0), 0),
    mediaQualidade: items.length > 0 ? Math.round(items.reduce((sum, item) => sum + (parseInt(item.qualidade) || 0), 0) / items.length) : 0,
  };

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-3">
      {/* Dashboard */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <p className="text-[10px] text-blue-600 font-bold uppercase">Total Obras</p>
          <p className="text-2xl font-bold text-blue-700">{dashboardData.totalObras}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 border border-red-200">
          <p className="text-[10px] text-red-600 font-bold uppercase">Retrabalhos</p>
          <p className="text-2xl font-bold text-red-700">{dashboardData.totalRetrabalhos}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-200">
          <p className="text-[10px] text-green-600 font-bold uppercase">Qual. Média</p>
          <p className="text-2xl font-bold text-green-700">{dashboardData.mediaQualidade}%</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">{items.length} obra{items.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => { fetchAvailableObras(); setShowImport(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-600">
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
            Importar
          </button>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gold text-navy">
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Novo
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-80 overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">Importar Obras do ClickUp</h3>
            {availableObras.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">Nenhuma obra disponível para importar</p>
            ) : (
              <div className="space-y-2 mb-4">
                {availableObras.map((obra) => (
                  <label key={obra.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedObraIds.includes(obra.id)} onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedObraIds([...selectedObraIds, obra.id]);
                      } else {
                        setSelectedObraIds(selectedObraIds.filter((id) => id !== obra.id));
                      }
                    }} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-navy">{obra.nome}</p>
                      <p className="text-xs text-gray-500">{obra.ambientes?.length > 0 ? obra.ambientes.join(', ') : 'Sem ambientes definidos'}</p>
                      {obra.prazo && <p className="text-xs text-gray-400">Prazo: {obra.prazo}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <button onClick={() => { setShowImport(false); setAvailableObras([]); }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-200 text-gray-600">
                Cancelar
              </button>
              <button onClick={handleImport} disabled={importingLoading || selectedObraIds.length === 0}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gold text-navy disabled:opacity-50">
                {importingLoading ? 'Importando...' : `Importar (${selectedObraIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Cliente *</label>
                <input type="text" value={formData.cliente} onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                  placeholder="Nome do cliente"
                  className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Obra *</label>
                <input type="text" value={formData.obra} onChange={(e) => setFormData({...formData, obra: e.target.value})}
                  placeholder="Nome da obra"
                  className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
              </div>
            </div>
            {['ambiente', 'equipe'].map(field => (
              <div key={field}>
                <label className="text-[10px] font-bold text-gray-400 uppercase">{field === 'ambiente' ? 'Ambiente' : 'Equipe'}</label>
                <input type="text" value={formData[field]} onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                  placeholder={field === 'ambiente' ? 'Ex: Cozinha' : 'Ex: Marceneiro 1'}
                  className="w-full border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['data_inicio', 'data_fim'].map(field => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{field === 'data_inicio' ? 'Data Início' : 'Data Fim'}</label>
                  <input type="date" value={formData[field]} onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                    className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gold" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['modulos', 'paineis', 'portas_passagem'].map(field => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')}</label>
                  <input type="number" value={formData[field] || ''} onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                    placeholder="0"
                    className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gold" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {['retrabalhos', 'qualidade'].map(field => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input type="number" value={formData[field]} onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                    min="0" max="100"
                    className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gold" />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gold bg-white">
                  <option value="em_progresso">Em progresso</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-gold text-navy disabled:opacity-50">
                {editId ? 'Atualizar' : 'Adicionar'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-gray-200 text-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-bold text-sm text-navy">{item.cliente}</p>
                <p className="text-xs text-gray-500">{item.obra} · {item.ambiente}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setFormData(item); setEditId(item.id); setShowForm(true); }}
                  className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-600 rounded-md">E</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-400 text-[10px]">Retrabalhos</p>
                <p className="font-bold text-red-600">{item.retrabalhos}</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-400 text-[10px]">Qualidade</p>
                <p className="font-bold text-green-600">{item.qualidade}%</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-400 text-[10px]">Status</p>
                <p className="font-bold text-blue-600 capitalize">{item.status}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TermoTab({ obras, session }) {
  const [cliente, setCliente] = useState('');
  const [obraId, setObraId]   = useState('');
  const [tipoAceite, setTipoAceite] = useState('');
  const [ressalva, setRessalva] = useState('');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(null);
  const canvasRef = useRef(null);
  const drawing   = useRef(false);

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#2D3040'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const p = getPos(e, canvas);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };

  const endDraw = () => { drawing.current = false; };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const isCanvasBlank = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some((v) => v !== 0);
  };

  const handleSubmit = async () => {
    if (!cliente.trim()) return alert('Informe o nome do contratante.');
    if (!obraId) return alert('Selecione a obra.');
    if (!tipoAceite) return alert('Selecione o resultado.');
    if ((tipoAceite === 'ressalva' || tipoAceite === 'recusa') && !ressalva.trim()) return alert(tipoAceite === 'recusa' ? 'Descreva o motivo da recusa.' : 'Descreva a ressalva.');
    if (isCanvasBlank()) return alert('A assinatura está em branco.');

    setSaving(true);
    const obra = obras.find((o) => o.id === obraId);
    const assinatura = canvasRef.current.toDataURL('image/png');
    const r = await fetch('/api/termos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        obra_nome: obra?.nome || obraId,
        cliente: cliente.trim(),
        tipo_aceite: tipoAceite,
        ressalva: ressalva.trim(),
        assinatura,
        coordenador: session?.nome || '',
      }),
    });
    setSaving(false);
    if (r.ok) {
      setDone({ cliente: cliente.trim(), obra: obra?.nome || obraId, tipo: tipoAceite, assinatura });
    } else {
      alert('Erro ao salvar. Tente novamente.');
    }
  };

  if (done) {
    return (
      <div className="px-4 py-6 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
        </div>
        <p className="text-center font-bold text-navy text-lg">Termo assinado!</p>
        <div className="w-full bg-white rounded-xl shadow-sm p-4 space-y-1.5">
          <div className="text-xs text-gray-400">Contratante</div>
          <div className="font-semibold text-gray-900">{done.cliente}</div>
          <div className="text-xs text-gray-400 mt-2">Obra</div>
          <div className="font-semibold text-gray-900">{done.obra}</div>
          <div className="text-xs text-gray-400 mt-2">Aceite</div>
          <div className={`text-xs font-bold px-2.5 py-1 rounded-full inline-block ${done.tipo === 'total' ? 'bg-green-100 text-green-600' : done.tipo === 'recusa' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            {done.tipo === 'total' ? 'Aceite Total' : done.tipo === 'recusa' ? 'Recusa' : 'Aceite com Ressalva'}
          </div>
          <div className="text-xs text-gray-400 mt-2">Assinatura</div>
          <img src={done.assinatura} alt="assinatura" className="border border-gray-200 rounded-lg max-h-20 mt-1" />
        </div>
        <button onClick={() => { setDone(null); setCliente(''); setObraId(''); setTipoAceite(''); setRessalva(''); limparAssinatura(); }}
          className="w-full py-3 bg-navy text-white font-bold rounded-xl text-sm">
          Novo Termo
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Termo de Recebimento</p>

      {/* Dados */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nome do Contratante *</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome completo do cliente"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Obra *</label>
          <select value={obraId} onChange={(e) => setObraId(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold">
            <option value="">— Selecione a obra —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Texto do termo */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Termo</p>
        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{TERMO_TEXTO}</p>
      </div>

      {/* Tipo de aceite */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Resultado *</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setTipoAceite('total')}
            className={`py-3 rounded-xl text-xs font-bold border-2 transition-colors ${tipoAceite === 'total' ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 bg-white text-gray-400'}`}>
            Aceite Total
          </button>
          <button onClick={() => setTipoAceite('ressalva')}
            className={`py-3 rounded-xl text-xs font-bold border-2 transition-colors ${tipoAceite === 'ressalva' ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-gray-200 bg-white text-gray-400'}`}>
            Com Ressalva
          </button>
          <button onClick={() => setTipoAceite('recusa')}
            className={`py-3 rounded-xl text-xs font-bold border-2 transition-colors ${tipoAceite === 'recusa' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-400'}`}>
            Recusa
          </button>
        </div>
        {(tipoAceite === 'ressalva' || tipoAceite === 'recusa') && (
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
              {tipoAceite === 'recusa' ? 'Motivo da recusa *' : 'Descreva a ressalva *'}
            </label>
            <textarea value={ressalva} onChange={(e) => setRessalva(e.target.value)} rows={3}
              placeholder={tipoAceite === 'recusa' ? 'Descreva o motivo da recusa...' : 'Descreva o que o cliente ressalvou...'}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold" />
          </div>
        )}
      </div>

      {/* Assinatura digital */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Assinatura do Contratante *</p>
          <button onClick={limparAssinatura} className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1 rounded-lg">Limpar</button>
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50">
          <canvas ref={canvasRef} width={340} height={140}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">Assine com o dedo ou mouse</p>
      </div>

      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-3.5 bg-navy text-white font-bold rounded-xl text-sm">
        {saving ? 'Salvando...' : 'Confirmar Recebimento'}
      </button>
    </div>
  );
}

// ── Registros tab ──────────────────────────────────────────────────────────
function RegistrosTab({ session }) {
  const [filter, setFilter]     = useState('hoje');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [texto, setTexto]       = useState('');
  const [tipo, setTipo]         = useState('obra');
  const [saving, setSaving]     = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const td = today();
    let start = td, end = td;
    if (filter === 'semana') { const d = new Date(); d.setDate(d.getDate()-6); start = d.toISOString().slice(0,10); }
    else if (filter === 'mes') { start = td.slice(0,7)+'-01'; }
    try {
      const r = await fetch(`/api/registros?start=${start}&end=${end}`);
      const d = await r.json();
      setRegistros(Array.isArray(d) ? d : []);
    } catch { setRegistros([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const handleAdd = async () => {
    if (!texto.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/registros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autor: session.nome, role: session.role, texto, tipo }) });
      setTexto(''); fetchRegistros();
    } catch {}
    setSaving(false);
  };

  const tipoStyle = (t) => t === 'obra' ? 'border-l-4 border-gold bg-gold/5' : t === 'fabrica' ? 'border-l-4 border-blue-300 bg-blue-50/40' : 'border-l-4 border-gray-200 bg-white';

  return (
    <div className="px-3 py-3">
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Novo registro</p>
        <div className="flex gap-2 mb-2">
          {[{v:'obra',l:'Obra'},{v:'fabrica',l:'Fábrica'},{v:'nota',l:'Geral'}].map((t) => (
            <button key={t.v} onClick={() => setTipo(t.v)}
              className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-colors ${tipo === t.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
          placeholder="O que aconteceu? Evolução, bloqueio, decisão tomada..."
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300 mb-3" />
        <button onClick={handleAdd} disabled={saving || !texto.trim()}
          className="w-full py-2.5 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-50">
          {saving ? 'Salvando...' : 'Registrar'}
        </button>
      </div>
      <div className="flex gap-2 mb-3">
        {[{v:'hoje',l:'Hoje'},{v:'semana',l:'Semana'},{v:'mes',l:'Mês'}].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${filter === f.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>
      {loading && <div className="text-center py-8 text-sm text-gray-400">Carregando...</div>}
      {!loading && registros.length === 0 && <div className="text-center py-10 text-sm text-gray-400">Nenhum registro neste período.</div>}
      {!loading && registros.map((r) => (
        <div key={r.id} className={`rounded-xl shadow-sm px-4 py-3 mb-2 ${tipoStyle(r.tipo)}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-500">{r.autor}</span>
            <span className="text-[10px] text-gray-300">{r.date} {r.created_at?.slice(11,16)}</span>
          </div>
          <p className="text-sm text-gray-800 leading-snug">{r.texto}</p>
        </div>
      ))}
    </div>
  );
}

// ── Ambient picker — memoized to avoid re-creating 25 closures on every keystroke ──
const AmbientesPicker = memo(function AmbientesPicker({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AMBIENTES_LISTA.map((a) => {
        const sel = selected.includes(a);
        return (
          <button key={a} type="button"
            onClick={() => onChange((prev) => sel ? prev.filter((x) => x !== a) : [...prev, a])}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${sel ? 'border-gold bg-gold/10 text-navy' : 'border-gray-200 bg-white text-gray-500'}`}>
            {a}
          </button>
        );
      })}
      <button type="button"
        onClick={() => onChange((prev) => prev.includes('__outro__') ? prev.filter((x) => x !== '__outro__') : [...prev, '__outro__'])}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${selected.includes('__outro__') ? 'border-gold bg-gold/10 text-navy' : 'border-gray-200 bg-white text-gray-500'}`}>
        Outro
      </button>
    </div>
  );
});

// ── Checklist — memoized to avoid re-creating 8 closures on every keystroke ──
const CoordChecklist = memo(function CoordChecklist({ checklist, setChecklist }) {
  return (
    <div className="space-y-1 mb-3">
      {COORDENADOR_CHECKLIST.map((item) => (
        <button key={item} onClick={() => setChecklist((c) => ({ ...c, [item]: !c[item] }))}
          className="w-full flex items-center gap-3 text-left py-2 px-1">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checklist[item] ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
            {checklist[item] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
          </div>
          <span className={`text-sm transition-colors ${checklist[item] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item}</span>
        </button>
      ))}
    </div>
  );
});

// ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
export default function CoordenadoresPage() {
  const router = useRouter();
  const [mounted, setMounted]   = useState(false);
  const [session, setSession_]  = useState(null);
  const [activeTab, setActiveTab] = useState('diario');

  const [notas, setNotas]           = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [cncEntries, setCncEntries] = useState([]);
  const [pedidos, setPedidos]       = useState([]);
  const [obras, setObras]           = useState([]);
  const [loading, setLoading]       = useState(true);

  // Escalar equipe
  const [escalarObraId, setEscalarObraId] = useState('');
  const [escalarEquipe, setEscalarEquipe] = useState([]);
  const [savingEscalar, setSavingEscalar] = useState(false);
  const [aprovandoObra, setAprovandoObra] = useState(null);

  const handleEscalarObraChange = (id) => {
    setEscalarObraId(id);
    const obra = obras.find((o) => o.id === id);
    setEscalarEquipe(obra?.equipe || []);
  };

  const handleSalvarEscala = async () => {
    if (!escalarObraId) return;
    setSavingEscalar(true);
    try {
      await fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: escalarObraId, equipe: escalarEquipe }) });
      setObras((prev) => prev.map((o) => o.id === escalarObraId ? { ...o, equipe: escalarEquipe } : o));
      showToast('Equipe escalada');
    } catch { showToast('Erro ao salvar'); }
    setSavingEscalar(false);
  };

  const handleToggleAprovada = async (obraId, atual) => {
    setAprovandoObra(obraId);
    try {
      const novoVal = !atual;
      await fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obraId, aprovada: novoVal, aprovada_por: novoVal ? session.nome : null }) });
      setObras((prev) => prev.map((o) => o.id === obraId ? { ...o, aprovada: novoVal, aprovada_por: novoVal ? session.nome : null, aprovada_em: novoVal ? new Date().toISOString() : null } : o));
    } catch { showToast('Erro ao atualizar'); }
    setAprovandoObra(null);
  };

  const handleLiberarTodas = async () => {
    setAprovandoObra('all');
    const agora = new Date().toISOString();
    try {
      await Promise.all(obras.map((o) =>
        fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: o.id, aprovada: true, aprovada_por: session.nome }) })
      ));
      setObras((prev) => prev.map((o) => ({ ...o, aprovada: true, aprovada_por: session.nome, aprovada_em: agora })));
      showToast('Todas as obras liberadas');
    } catch { showToast('Erro ao liberar'); }
    setAprovandoObra(null);
  };

  // Diário form
  const [resumo, setResumo]   = useState('');
  const [texto, setTexto]     = useState('');
  const [tipo, setTipo]       = useState('nota');
  const [obraNota, setObraNota] = useState(''); // Obra selecionada para notas
  const [checklist, setChecklist] = useState({});
  const [obraVistoria, setObraVistoria] = useState('');
  const [ambientesVistoria, setAmbientesVistoria] = useState([]);
  const [ambienteOutro, setAmbienteOutro] = useState('');
  const [savingVistoria, setSavingVistoria] = useState(false);
  // Foto (agora dentro da vistoria)
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoData, setFotoData] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  useEffect(() => {
    setMounted(true);
    const s = getSession();
    if (!s || !['coordenador_obra','coordenador_projetos','gerente','encarregado','diretor'].includes(s.role)) {
      router.replace('/login?next=/coordenadores'); return;
    }
    if (s.role === 'coordenador_projetos') setActiveTab('caderno');
    setSession_(s);
  }, [router]);

  const loadAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [nRes, sRes, cRes, pRes, oRes] = await Promise.all([
        fetch(`/api/notas?date=${today()}`),
        fetch('/api/submissions'),
        fetch('/api/cnc'),
        fetch('/api/pedidos'),
        fetch('/api/obras'),
      ]);
      const [n, s, c, p, o] = await Promise.all([nRes.json(), sRes.json(), cRes.json(), pRes.json(), oRes.json()]);
      setNotas(Array.isArray(n) ? n : []);
      setSubmissions(Array.isArray(s) ? s : []);
      setCncEntries(Array.isArray(c) ? c : []);
      setPedidos(Array.isArray(p) ? p : []);
      setObras(Array.isArray(o) ? o : []);
    } catch {}
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) loadAll(); }, [session, loadAll]);

  const handleAddNota = async () => {
    if (!texto.trim()) return;
    if (!obraNota?.trim()) {
      showToast('Selecione a obra antes de registrar');
      return;
    }
    setSaving(true);
    try {
      const obraObj = obras.find(o => o.id === obraNota);
      await fetch('/api/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autor: session.nome, texto, tipo, obra_id: obraNota, obra_nome: obraObj?.nome, role: session?.role }) });
      setTexto('');
      setObraNota('');
      const r = await fetch(`/api/notas?date=${today()}`);
      const n = await r.json();
      setNotas(Array.isArray(n) ? n : []);
      showToast('Nota registrada');
    } catch (err) { showToast('Erro ao salvar'); }
    setSaving(false);
  };

  const handleVistoria = async () => {
    if (!obraVistoria) return;
    setSavingVistoria(true);
    const ambienteStr = ambientesVistoria
      .map((a) => a === '__outro__' ? ambienteOutro : a)
      .filter(Boolean).join(', ');
    try {
      const obra = obras.find((o) => o.id === obraVistoria);
      await fetch('/api/vistoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: obraVistoria,
          obra_nome: obra?.nome || obraVistoria,
          ambiente: ambienteStr,
          checklist,
          autor: session.nome,
        }),
      });
      // Upload foto if present
      if (fotoFile) {
        setUploadingFoto(true);
        const form = new FormData();
        form.append('task_id', obraVistoria);
        form.append('file', fotoFile);
        await fetch('/api/attachment', { method: 'POST', body: form });
        setFotoFile(null);
        setUploadingFoto(false);
      }
      setChecklist({});
      setAmbientesVistoria([]);
      setAmbienteOutro('');
      showToast('Vistoria registrada no ClickUp');
    } catch { showToast('Erro ao registrar vistoria'); }
    setSavingVistoria(false);
  };

  const handleStatusChange = async (id, status) => {
    await fetch('/api/pedidos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    setPedidos((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
    showToast('Status atualizado');
  };

  // Timeline
  const timeline = useMemo(() => {
    const items = [];
    notas.forEach((n) => items.push({ time: n.created_at, type: 'nota', data: n }));
    submissions.forEach((s) => { if (s.submitted_at) items.push({ time: s.submitted_at, type: 'equipe', data: s }); });
    cncEntries.forEach((c) => { if (c.created_at) items.push({ time: c.created_at, type: 'cnc', data: c }); });
    const todayStr = today();
    pedidos.filter((p) => p.date === todayStr).forEach((p) => { if (p.created_at) items.push({ time: p.created_at, type: 'pedido', data: p }); });
    return items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  }, [notas, submissions, cncEntries, pedidos]);

  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace(',', '');

  if (!mounted || !session) return null;

  const isProj = session?.role === 'coordenador_projetos';
  const isHead = ['diretor', 'gerente'].includes(session?.role);
  const ATA_TAB = { id: 'atas', label: 'Atas', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6h.01M12 16h.01M16 12h.01"/></svg> };
  const TABS = isHead ? [
    { id: 'gestao', label: 'Gestão', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 9v6m-3-3h6"/></svg> },
    ATA_TAB,
  ] : isProj ? [
    { id: 'caderno', label: 'Caderno', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg> },
    { id: 'tecnico', label: 'Técnico', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg> },
    { id: 'gestao',  label: 'Gestão',  icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 9v6m-3-3h6"/></svg> },
    { id: 'termo',   label: 'Termo',   icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 12l2 2 4-4M7 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg> },
    ATA_TAB,
  ] : [
    { id: 'diario',      label: 'Diário',      icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
    { id: 'gestao_obra', label: 'Gestão de Obra', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 9v6m-3-3h6"/></svg> },
    { id: 'equipe',      label: 'Equipe',      icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'termo',       label: 'Termo',       icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 12l2 2 4-4M7 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg> },
    ATA_TAB,
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-navy flex items-center justify-between px-4 shadow-lg">
        <a href="/">
          <img src="/logo.png" alt="Lukana" className="h-7 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        </a>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 capitalize">{dateStr}</span>
          <button onClick={() => { clearSession(); router.push('/'); }}
            className="text-[10px] text-white/30 border border-white/10 px-2 py-1 rounded-full">Sair</button>
        </div>
      </header>

      <main className="flex-1 mt-14 mb-16 overflow-y-auto [will-change:transform]">

        {/* ── DIÁRIO ── */}
        {activeTab === 'diario' && (
          <div className="px-3 py-3">

            {/* Atualização de obra */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Atualização de obra</p>
              <div className="flex gap-2 mb-2">
                {[{v:'nota',l:'Geral'},{v:'obra',l:'Obra'},{v:'fabrica',l:'Fábrica'}].map((t) => (
                  <button key={t.v} onClick={() => setTipo(t.v)}
                    className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-colors ${tipo === t.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <select value={obraNota} onChange={(e) => setObraNota(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gold mb-3 text-gray-700">
                <option value="">— Selecione a obra —</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
                placeholder="O que aconteceu? Bloqueio, evolução, observação..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300 mb-3" />
              <button onClick={handleAddNota} disabled={saving || !obraNota}
                className="w-full py-2.5 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-50">
                {saving ? 'Salvando...' : 'Registrar nota'}
              </button>
            </div>

            {/* Timeline */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">
              Evolução do dia · {timeline.length} {timeline.length === 1 ? 'registro' : 'registros'}
            </p>
            {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loading && timeline.length === 0 && <div className="text-center py-8 text-sm text-gray-400">Nenhum registro hoje ainda.</div>}
            {!loading && timeline.map((item, i) => {
              if (item.type === 'nota') return <NotaCard key={`n-${i}`} nota={item.data} />;
              if (item.type === 'equipe') {
                const s = item.data;
                const qs = ['q1_status','q2_status','q3_status','q4_status','q5_status','q6_status'];
                const hasBloq = qs.some((k) => s[k] === 'nao');
                const q1txt = s.q1_descricao ? [s.q1_cliente, s.q1_ambiente, s.q1_descricao].filter(Boolean).join(' · ') : s.q1_text;
                return (
                  <div key={`e-${i}`} className={`rounded-xl shadow-sm px-4 py-3 mb-2 border-l-4 bg-white ${hasBloq ? 'border-red-300' : 'border-green-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">{s.name}</span>
                      <span className="text-[10px] text-gray-300">{s.submitted_at?.slice(11,16)} · formulário</span>
                    </div>
                    {q1txt && <p className="text-sm text-gray-700 mt-1 leading-snug">{q1txt}</p>}
                    {s.q7_escalate && <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Precisa Diretor</span>}
                  </div>
                );
              }
              if (item.type === 'cnc') {
                const c = item.data;
                return (
                  <div key={`c-${i}`} className="rounded-xl shadow-sm px-4 py-3 mb-2 border-l-4 border-blue-200 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">{c.operador} · {c.maquina}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'Concluído' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{c.status}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{c.peca}{c.obra ? ` · ${c.obra}` : ''}{c.ambiente ? ` · ${c.ambiente}` : ''}</p>
                  </div>
                );
              }
              if (item.type === 'pedido') {
                const p = item.data;
                const sm = PEDIDO_STATUS[p.status] || PEDIDO_STATUS.pendente;
                return (
                  <div key={`p-${i}`} className="rounded-xl shadow-sm px-4 py-3 mb-2 border-l-4 border-amber-200 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">{p.solicitante} · pedido</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{p.obra_nome} · {p.itens?.length} {p.itens?.length === 1 ? 'item' : 'itens'}</p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* ── SUPRIMENTOS ── */}

        {/* ── EQUIPE ── */}
        {activeTab === 'equipe' && (
          <div className="px-3 py-3">
            {/* Direcionar equipe para obra */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Direcionar equipe para obra</p>
              <select value={escalarObraId} onChange={(e) => handleEscalarObraChange(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gold mb-3">
                <option value="">— Selecione a obra —</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              {escalarObraId && (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {EQUIPES_OBRA.map((eq) => {
                      const sel = escalarEquipe.includes(eq);
                      return (
                        <button key={eq} onClick={() => setEscalarEquipe((prev) => sel ? prev.filter((x) => x !== eq) : [...prev, eq])}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${sel ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-white text-gray-500'}`}>
                          {eq}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleSalvarEscala} disabled={savingEscalar}
                    className="w-full py-2.5 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-50">
                    {savingEscalar ? 'Salvando...' : 'Salvar escala'}
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">{submissions.length} membro{submissions.length !== 1 ? 's' : ''} preencheram hoje</p>
              <button onClick={loadAll} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loading && submissions.length === 0 && <div className="text-center py-12 text-sm text-gray-400">Nenhum membro preencheu hoje ainda.</div>}
            {!loading && submissions.map((s) => <EquipeMiniCard key={s.name} sub={s} />)}
            {!loading && cncEntries.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">CNC hoje · {cncEntries.length} {cncEntries.length === 1 ? 'corte' : 'cortes'}</p>
                {cncEntries.map((e, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm px-3 py-2.5 mb-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{e.peca}</div>
                      <div className="text-xs text-gray-400">{e.maquina} · {e.operador}{e.obra ? ` · ${e.obra}` : ''}{e.ambiente ? ` · ${e.ambiente}` : ''}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${e.status === 'Concluído' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'caderno' && <CadernoTab obras={obras} session={session} />}
        {activeTab === 'tecnico' && <CadernoTecnicoTab />}
        {activeTab === 'gestao' && (isHead ? <GestaoHeadTab /> : <GestaoEscritorioTab obras={obras} />)}
        {activeTab === 'gestao_obra' && <GestaoObraTab obras={obras} />}
        {activeTab === 'termo' && <TermoTab obras={obras} session={session} />}
        {activeTab === 'atas' && <AtasTab session={session} />}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-navy flex overflow-x-auto no-scrollbar shadow-lg">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors px-3 min-w-[64px] ${activeTab === t.id ? 'text-gold' : 'text-white/35'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">{toast}</div>}
    </div>
  );
}
