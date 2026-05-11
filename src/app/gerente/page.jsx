'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import { GERENTE_FABRICA, EQUIPES_OBRA, AMBIENTES_LISTA } from '@/lib/questions';
import Link from 'next/link';
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

// ── Shared helpers ─────────────────────────────────────────────────────────
const pedidoItemLabel = (item) => {
  const specs = [item.cor, item.espessura, item.largura, item.marca, item.tamanho, item.tipo, item.descricao].filter(Boolean);
  return specs.length ? `${item.categoria} · ${specs.join(' · ')}` : item.categoria;
};

const PEDIDO_STATUS = {
  pendente:  { label: 'Pendente',  cls: 'bg-amber-100 text-amber-600' },
  em_compra: { label: 'Em Compra', cls: 'bg-blue-100 text-blue-600' },
  comprado:  { label: 'Comprado',  cls: 'bg-green-100 text-green-600' },
};

// ── StatusBtns (sim/não/outro) ─────────────────────────────────────────────
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

// ── Fábrica form ───────────────────────────────────────────────────────────
function FabricaTab({ obras }) {
  const initData = () => {
    const td = today();
    try { const p = JSON.parse(localStorage.getItem('lukana_gerente_fab') || 'null'); if (p?.date === td) return p; } catch {}
    return { date: td, gf1: { obra: '', ambiente: '', descricao: '' }, gf2: { status: null, text: '' }, gf3: [], gf4: [], gf6: { status: null, text: '' }, vistoriadas: [] };
  };

  const [data, setData] = useState(() => typeof window !== 'undefined' ? initData() : null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Lista add state
  const [gf3Form, setGf3Form] = useState({ obra: '', comodo: '', movel: '' });
  const [gf4Form, setGf4Form] = useState({ obra: '', comodo: '', movel: '' });
  const [vistoriadaFoto, setVistoriadaFoto] = useState(null);
  const [vistoriadaFotoData, setVistoriadaFotoData] = useState(null);
  const [uploadingVistoriada, setUploadingVistoriada] = useState(false);

  const persist = (updated) => {
    setData(updated);
    localStorage.setItem('lukana_gerente_fab', JSON.stringify(updated));
  };

  const setGf1 = (k, v) => persist({ ...data, gf1: { ...data.gf1, [k]: v } });
  const setSimples = (id, field, v) => persist({ ...data, [id]: { ...data[id], [field]: v } });

  const addLista = (id, form, resetForm) => {
    if (!form.movel.trim()) return;
    persist({ ...data, [id]: [...(data[id] || []), { ...form, _id: Date.now().toString() }] });
    resetForm({ obra: '', comodo: '', movel: '' });
  };

  const removeLista = (id, idx) => persist({ ...data, [id]: data[id].filter((_, i) => i !== idx) });

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/gerente-fab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (!data) return null;

  const obrasOpts = obras.map((o) => o.nome);

  return (
    <div className="px-3 py-3">
      {GERENTE_FABRICA.map((q) => (
        <div key={q.id} className="bg-white rounded-xl shadow-sm mb-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-navy">{q.texto}</p>
          </div>

          {/* ESTRUTURADO */}
          {q.tipo === 'estruturado' && (
            <div className="px-4 py-3 space-y-3">
              {q.campos.map((c) => (
                <div key={c.key}>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{c.label}</label>
                  {c.tipo === 'select' ? (
                    <select value={data[q.id]?.[c.key] || ''} onChange={(e) => setGf1(c.key, e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold bg-white">
                      <option value="">Selecionar obra...</option>
                      {obrasOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.tipo === 'textarea' ? (
                    <textarea value={data[q.id]?.[c.key] || ''} onChange={(e) => setGf1(c.key, e.target.value)}
                      rows={2} placeholder="Descreva..."
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
                  ) : (
                    <input value={data[q.id]?.[c.key] || ''} onChange={(e) => setGf1(c.key, e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SIMPLES */}
          {q.tipo === 'simples' && (
            <div className="px-4 py-3">
              <StatusBtns value={data[q.id]?.status} onChange={(s) => setSimples(q.id, 'status', s)} />
              {(data[q.id]?.status === 'sim' || data[q.id]?.status === 'outro') && (
                <textarea value={data[q.id]?.text || ''} onChange={(e) => setSimples(q.id, 'text', e.target.value)}
                  rows={2} placeholder={q.placeholder}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
              )}
            </div>
          )}

          {/* LISTA */}
          {q.tipo === 'lista' && (
            <div className="px-4 py-3 space-y-2">
              {/* Existing items */}
              {(data[q.id] || []).map((item, i) => (
                <div key={item._id || i} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-navy truncate">{item.obra || '—'}</div>
                    <div className="text-xs text-gray-500">{[item.comodo, item.movel].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button onClick={() => removeLista(q.id, i)} className="text-gray-300 text-lg leading-none px-1 hover:text-red-400 flex-shrink-0">×</button>
                </div>
              ))}

              {/* Add form */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Adicionar item</p>
                {q.campos.map((c) => (
                  <div key={c.key}>
                    {c.tipo === 'select' ? (
                      <select
                        value={q.id === 'gf3' ? gf3Form[c.key] : gf4Form[c.key]}
                        onChange={(e) => q.id === 'gf3' ? setGf3Form({ ...gf3Form, [c.key]: e.target.value }) : setGf4Form({ ...gf4Form, [c.key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold">
                        <option value="">Obra...</option>
                        {obrasOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : c.tipo === 'select_amb' ? (
                      <select
                        value={q.id === 'gf3' ? gf3Form[c.key] : gf4Form[c.key]}
                        onChange={(e) => q.id === 'gf3' ? setGf3Form({ ...gf3Form, [c.key]: e.target.value }) : setGf4Form({ ...gf4Form, [c.key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold">
                        <option value="">Cômodo...</option>
                        {AMBIENTES_LISTA.map((a) => <option key={a} value={a}>{a}</option>)}
                        <option value="Outro">Outro</option>
                      </select>
                    ) : (
                      <input
                        value={q.id === 'gf3' ? gf3Form[c.key] : gf4Form[c.key]}
                        onChange={(e) => q.id === 'gf3' ? setGf3Form({ ...gf3Form, [c.key]: e.target.value }) : setGf4Form({ ...gf4Form, [c.key]: e.target.value })}
                        placeholder={c.label}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold placeholder:text-gray-400" />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => q.id === 'gf3'
                    ? addLista('gf3', gf3Form, setGf3Form)
                    : addLista('gf4', gf4Form, setGf4Form)
                  }
                  className="w-full py-2 rounded-lg text-xs font-bold bg-navy text-gold">
                  + Adicionar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Peças vistoriadas */}
      <div className="bg-white rounded-xl shadow-sm mb-3 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-navy">Peças vistoriadas com acabamentos finos verificados</p>
        </div>
        <div className="px-4 py-3 space-y-2">
          {(data?.vistoriadas || []).map((v, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-navy truncate">{v.peca || '—'}</div>
                {v.foto && <div className="text-[11px] text-green-600 mt-0.5">Foto anexada</div>}
              </div>
              <button onClick={() => persist({ ...data, vistoriadas: data.vistoriadas.filter((_, j) => j !== i) })}
                className="text-gray-300 text-lg leading-none px-1 hover:text-red-400 flex-shrink-0">×</button>
            </div>
          ))}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Registrar peça vistoriada</p>
            <input
              id="vistoriada-peca"
              placeholder="Descrição da peça / móvel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold placeholder:text-gray-400" />
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-2 py-3 text-xs font-semibold cursor-pointer text-gray-400 border-gray-200">
                <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                Tirar Foto
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { setVistoriadaFoto(e.target.files?.[0] || null); setVistoriadaFotoData(null); }} />
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-2 py-3 text-xs font-semibold cursor-pointer text-gray-400 border-gray-200">
                <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Subir da Galeria
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] || null;
                    setVistoriadaFoto(f);
                    setVistoriadaFotoData(f ? await readExifDate(f) : null);
                  }} />
              </label>
            </div>
            {vistoriadaFoto && (
              <p className="text-[11px] text-green-600 px-1 truncate">
                {vistoriadaFoto.name}{vistoriadaFotoData ? ` · Tirada em ${vistoriadaFotoData.split('-').reverse().join('/')}` : ''}
              </p>
            )}
            <button
              onClick={async () => {
                const input = document.getElementById('vistoriada-peca');
                const peca = input?.value?.trim();
                if (!peca) return;
                let fotoBase64 = null;
                if (vistoriadaFoto) {
                  setUploadingVistoriada(true);
                  fotoBase64 = await new Promise((res) => {
                    const reader = new FileReader();
                    reader.onload = (e) => res(e.target.result);
                    reader.readAsDataURL(vistoriadaFoto);
                  });
                  setUploadingVistoriada(false);
                }
                persist({ ...data, vistoriadas: [...(data.vistoriadas || []), { peca, foto: fotoBase64, data: vistoriadaFotoData || today() }] });
                if (input) input.value = '';
                setVistoriadaFoto(null);
                setVistoriadaFotoData(null);
              }}
              disabled={uploadingVistoriada}
              className="w-full py-2 rounded-lg text-xs font-bold bg-navy text-gold disabled:opacity-50">
              {uploadingVistoriada ? 'Processando...' : '+ Registrar'}
            </button>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className={`w-full py-3.5 rounded-2xl font-bold text-base mt-2 transition-all ${saving ? 'bg-gray-200 text-gray-400' : saved ? 'bg-green-500 text-white' : 'bg-gold text-navy active:opacity-80'}`}>
        {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar fábrica'}
      </button>
    </div>
  );
}

// ── Member card (equipe view) ──────────────────────────────────────────────
function MemberCard({ sub }) {
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
  const QLABELS = ['O que instala/produz hoje', 'Material faltando', 'Acesso garantido', 'Dúvida técnica', 'Impeditivo', 'Concluído ontem'];

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-[15px] text-gray-900">{sub.name}</div>
          <div className="text-xs text-gray-400">{sub.obra || '—'}</div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full badge-${wc}`}>{labels[wc]}</span>
        {sub.q7_escalate && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-500">Diretor</span>}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3">
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
        </div>
      )}
    </div>
  );
}

// ── Pedido card ───────────────────────────────────────────────────────────
function PedidoCard({ pedido, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const sm = PEDIDO_STATUS[pedido.status] || PEDIDO_STATUS.pendente;
  const nextStatus = pedido.status === 'pendente' ? 'em_compra' : pedido.status === 'em_compra' ? 'comprado' : null;
  const nextLabel  = nextStatus === 'em_compra' ? 'Em Compra' : nextStatus === 'comprado' ? 'Comprado' : null;

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button className={`w-full flex items-center gap-3 px-4 py-3.5 ${open ? 'border-b border-gray-100' : ''}`} onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-[15px] text-gray-900 truncate">{pedido.obra_nome}</div>
          <div className="text-xs text-gray-400">{pedido.solicitante} · {pedido.created_at?.slice(11,16)} · {pedido.itens?.length} {pedido.itens?.length === 1 ? 'item' : 'itens'}</div>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sm.cls}`}>{sm.label}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="mb-3">
            {pedido.itens?.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{pedidoItemLabel(item)}</span>
                <span className="text-sm font-bold text-navy ml-3 flex-shrink-0">{item.quantidade} {item.unidade}</span>
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

// ── Registros tab ──────────────────────────────────────────────────────────
function RegistrosTab({ session, obras }) {
  const [filter, setFilter] = useState('hoje');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [texto, setTexto]         = useState('');
  const [tipo, setTipo]           = useState('fabrica');
  const [obraRegistro, setObraRegistro] = useState(''); // Obra selecionada para registros
  const [saving, setSaving]       = useState(false);
  const [obraFotoId, setObraFotoId] = useState('');
  const [fotoFile, setFotoFile]     = useState(null);
  const [fotoData, setFotoData]     = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [toast, setToast]           = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const td = today();
    let start = td, end = td;
    if (filter === 'semana') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10);
    } else if (filter === 'mes') {
      start = td.slice(0, 7) + '-01';
    }
    try {
      const [rRes, nRes] = await Promise.all([
        fetch(`/api/registros?start=${start}&end=${end}`),
        fetch(`/api/notas?date=${td}`),
      ]);
      const [d, n] = await Promise.all([rRes.json(), nRes.json()]);
      setRegistros(Array.isArray(d) ? d : []);
      setSugestoes(Array.isArray(n) ? n.filter((x) => x.tipo === 'sugestao') : []);
    } catch { setRegistros([]); setSugestoes([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const handleAdd = async () => {
    if (!texto.trim()) return;
    if (!obraRegistro?.trim()) {
      showToast('Selecione a obra antes de registrar');
      return;
    }
    setSaving(true);
    try {
      const obraObj = obras.find(o => o.id === obraRegistro);
      await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autor: session.nome, role: session.role, texto, tipo, obra_id: obraRegistro, obra_nome: obraObj?.nome }),
      });
      setTexto('');
      setObraRegistro('');
      fetchRegistros();
    } catch {}
    setSaving(false);
  };

  const handleFotoUpload = async () => {
    if (!obraFotoId || !fotoFile) return;
    setUploadingFoto(true);
    try {
      const form = new FormData();
      form.append('task_id', obraFotoId);
      form.append('file', fotoFile);
      const res = await fetch('/api/attachment', { method: 'POST', body: form });
      if (!res.ok) throw new Error();
      setFotoFile(null);
      showToast('Foto enviada para o ClickUp');
    } catch { showToast('Erro ao enviar foto'); }
    setUploadingFoto(false);
  };

  const tipoStyle = (t) => t === 'obra' ? 'border-l-4 border-gold bg-gold/5' : t === 'fabrica' ? 'border-l-4 border-blue-300 bg-blue-50/40' : 'border-l-4 border-gray-200 bg-white';

  return (
    <div className="px-3 py-3">
      {/* Add form */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Novo registro</p>
        <div className="flex gap-2 mb-2">
          {[{v:'fabrica',l:'Fábrica'},{v:'obra',l:'Obra'},{v:'nota',l:'Geral'}].map((t) => (
            <button key={t.v} onClick={() => setTipo(t.v)}
              className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${tipo === t.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <select value={obraRegistro} onChange={(e) => setObraRegistro(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gold mb-3 text-gray-700">
          <option value="">— Selecione a obra —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
          placeholder="O que aconteceu? Evolução, bloqueio, decisão tomada..."
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300 mb-3" />
        <button onClick={handleAdd} disabled={saving || !texto.trim() || !obraRegistro}
          className="w-full py-2.5 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-50">
          {saving ? 'Salvando...' : 'Registrar'}
        </button>
      </div>

      {/* Foto para ClickUp */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Enviar foto para ClickUp</p>
        <select value={obraFotoId} onChange={(e) => setObraFotoId(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gold mb-2">
          <option value="">Selecionar cliente / obra...</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div className="flex gap-2 mb-1">
          <label className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-2 py-3 text-xs font-semibold cursor-pointer text-gray-400 border-gray-200">
            <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
            Tirar Foto
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { setFotoFile(e.target.files?.[0] || null); setFotoData(null); }} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-2 py-3 text-xs font-semibold cursor-pointer text-gray-400 border-gray-200">
            <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Subir da Galeria
            <input type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0] || null;
                setFotoFile(f);
                setFotoData(f ? await readExifDate(f) : null);
              }} />
          </label>
        </div>
        {fotoFile && (
          <p className="text-[11px] text-green-600 mb-1 px-1 truncate">
            {fotoFile.name}{fotoData ? ` · Tirada em ${fotoData.split('-').reverse().join('/')}` : ''}
          </p>
        )}
        <button onClick={handleFotoUpload} disabled={uploadingFoto || !obraFotoId || !fotoFile}
          className="w-full mt-2 py-2.5 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-40">
          {uploadingFoto ? 'Enviando...' : 'Enviar foto'}
        </button>
      </div>

      {/* Sugestões da equipe */}
      {sugestoes.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wide px-1 mb-2">Sugestões da equipe · hoje</p>
          {sugestoes.map((s) => (
            <div key={s.id} className="rounded-xl shadow-sm px-4 py-3 mb-2 border-l-4 border-purple-300 bg-purple-50/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-500">{s.autor}</span>
                <span className="text-[10px] text-gray-300">{s.created_at?.slice(11,16)}</span>
              </div>
              <p className="text-sm text-gray-800 leading-snug">{s.texto}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        {[{v:'hoje',l:'Hoje'},{v:'semana',l:'Semana'},{v:'mes',l:'Mês'}].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filter === f.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-sm text-gray-400">Carregando...</div>}
      {!loading && registros.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400">Nenhum registro neste período.</div>
      )}
      {!loading && registros.map((r) => (
        <div key={r.id} className={`rounded-xl shadow-sm px-4 py-3 mb-2 ${tipoStyle(r.tipo)}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-500">{r.autor}</span>
            <span className="text-[10px] text-gray-300">{r.date} {r.created_at?.slice(11,16)}</span>
          </div>
          <p className="text-sm text-gray-800 leading-snug">{r.texto}</p>
        </div>
      ))}
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">{toast}</div>}
    </div>
  );
}

// ── PÁGINA PRINCIPAL GERENTE ───────────────────────────────────────────────
export default function GerentePage() {
  const router  = useRouter();
  const [mounted, setMounted]   = useState(false);
  const [session, setSession_]  = useState(null);
  const [activeTab, setActiveTab] = useState('fabrica');
  const [obras, setObras]       = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [pedidos, setPedidos]   = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

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
      setObras((prev) => prev.map((o) => o.id === obraId
        ? { ...o, aprovada: novoVal, aprovada_por: novoVal ? session.nome : null, aprovada_em: novoVal ? new Date().toISOString() : null }
        : o));
    } catch { showToast('Erro ao atualizar'); }
    setAprovandoObra(null);
  };

  const handleLiberarTodas = async () => {
    setAprovandoObra('all');
    try {
      await Promise.all(obras.map((o) =>
        fetch('/api/obras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: o.id, aprovada: true, aprovada_por: session.nome }) })
      ));
      const agora = new Date().toISOString();
      setObras((prev) => prev.map((o) => ({ ...o, aprovada: true, aprovada_por: session.nome, aprovada_em: agora })));
      showToast('Todas as obras liberadas');
    } catch { showToast('Erro ao liberar'); }
    setAprovandoObra(null);
  };

  useEffect(() => {
    setMounted(true);
    const s = getSession();
    if (!s || !['gerente','diretor'].includes(s.role)) { router.replace('/login?next=/gerente'); return; }
    setSession_(s);
    // Load obras for fábrica form
    fetch('/api/obras').then((r) => r.json()).then((d) => setObras(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!session) return;
    if (activeTab === 'equipe') {
      setLoadingEquipe(true);
      fetch('/api/submissions').then((r) => r.json()).then((d) => setSubmissions(Array.isArray(d) ? d : [])).catch(() => setSubmissions([])).finally(() => setLoadingEquipe(false));
    }
    if (activeTab === 'pedidos') {
      setLoadingPedidos(true);
      fetch('/api/pedidos').then((r) => r.json()).then((d) => setPedidos(Array.isArray(d) ? d : [])).catch(() => setPedidos([])).finally(() => setLoadingPedidos(false));
    }
  }, [session, activeTab]);

  if (!mounted || !session) return null;

  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');

  const TABS = [
    { id: 'fabrica', label: 'Fábrica',  icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 9l4-4 4 4 4-4 4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/></svg> },
    { id: 'equipe',  label: 'Equipe',   icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'pedidos', label: 'Pedidos',  icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg> },
    { id: 'registros', label: 'Registros', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
    { id: 'atas', label: 'Atas', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6h.01M12 16h.01M16 12h.01"/></svg> },
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-navy flex items-center justify-between px-4 shadow-lg">
        <Link href="/">
          <img src="/logo.png" alt="Lukana" className="h-7 w-auto brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{dateStr}</span>
          <button onClick={() => { clearSession(); router.push('/'); }}
            className="text-[10px] text-white/30 border border-white/10 px-2 py-1 rounded-full">
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 mt-14 mb-16 overflow-y-auto">
        {activeTab === 'fabrica' && <FabricaTab obras={obras} />}

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
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${sel ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-white text-gray-500'}`}>
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

            {/* Liberar obras */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Obras visíveis para a equipe</p>
                <button onClick={handleLiberarTodas} disabled={aprovandoObra === 'all' || obras.length === 0}
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
                  <button onClick={() => handleToggleAprovada(o.id, o.aprovada)} disabled={aprovandoObra === o.id}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 flex-shrink-0 transition-all disabled:opacity-40 ${o.aprovada ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                    {aprovandoObra === o.id ? '...' : o.aprovada ? 'Liberada ✓' : 'Liberar'}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">{submissions.length} membro{submissions.length !== 1 ? 's' : ''} preencheram hoje</p>
              <button onClick={() => { setLoadingEquipe(true); fetch('/api/submissions').then(r=>r.json()).then(d=>setSubmissions(Array.isArray(d)?d:[])).finally(()=>setLoadingEquipe(false)); }}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loadingEquipe && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingEquipe && submissions.length === 0 && <div className="text-center py-12 text-sm text-gray-400">Nenhum membro preencheu ainda.</div>}
            {!loadingEquipe && submissions.map((s) => <MemberCard key={s.name} sub={s} />)}
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Pedidos recentes</p>
              <button onClick={() => { setLoadingPedidos(true); fetch('/api/pedidos').then(r=>r.json()).then(d=>setPedidos(Array.isArray(d)?d:[])).finally(()=>setLoadingPedidos(false)); }}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loadingPedidos && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loadingPedidos && pedidos.length === 0 && <div className="text-center py-12 text-sm text-gray-400">Nenhum pedido nos últimos 7 dias.</div>}
            {!loadingPedidos && pedidos.map((p) => (
              <PedidoCard key={p.id} pedido={p} onStatusChange={async (id, status) => {
                await fetch('/api/pedidos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
                setPedidos((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
                showToast('Status atualizado');
              }} />
            ))}
          </div>
        )}

        {activeTab === 'registros' && <RegistrosTab session={session} obras={obras} />}
        {activeTab === 'atas' && <AtasTab session={session} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-navy flex shadow-lg">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${activeTab === t.id ? 'text-gold' : 'text-white/35'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">{toast}</div>}
    </div>
  );
}
