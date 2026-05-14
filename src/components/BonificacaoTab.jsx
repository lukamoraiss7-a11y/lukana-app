'use client';

import { useState, useEffect, useCallback } from 'react';

const fmtBRL = (v) =>
  v == null || isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = (v) => (v == null || isNaN(v) ? '—' : `${v.toFixed(2)}%`);
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

const EMPTY_INPUTS = {
  preco_venda: '',
  m2_vendidos: '',
  m2_entregues: '',
  meta_m2_vendidos: 800,
  meta_m2_entregues: 800,
  dias_atraso: 0,
  folha_fixa: 120000,
  custo_material: '',
  hardware: '',
  lados_curvos: 0,
  led_pct: 0,
  transporte: 600,
};

function calcular(inp) {
  const pv       = parseFloat(inp.preco_venda)       || 0;
  const m2e      = parseFloat(inp.m2_entregues)      || 0;
  const metaE    = parseFloat(inp.meta_m2_entregues) || 800;
  const folha    = parseFloat(inp.folha_fixa)        || 0;
  const atraso   = parseFloat(inp.dias_atraso)       || 0;
  const mat      = parseFloat(inp.custo_material)    || 0;
  const hw       = parseFloat(inp.hardware)          || 0;
  const curvos   = parseFloat(inp.lados_curvos)      || 0;
  const ledFlag  = parseFloat(inp.led_pct)           || 0;
  const transp   = parseFloat(inp.transporte)        || 0;

  const moBase       = metaE > 0 ? folha / metaE : 0;
  const moTotal      = moBase * m2e;
  const penPct       = -(Math.floor(atraso / 3) * 0.5);
  const moPen        = moTotal * (1 + penPct / 100);
  const pcp          = moPen * 0.4;
  const curvo        = curvos * 2000;
  const comissao     = pv * 0.05;
  const ledBase      = mat + moPen + pcp;
  const led          = ledBase * (ledFlag / 100);
  const totalCustos  = mat + hw + moPen + pcp + curvo + comissao + led + transp;
  const mc           = pv - totalCustos;
  const mcPct        = pv > 0 ? (mc / pv) * 100 : 0;
  const cfAlocado    = 135000 / 30;
  const lucro        = mc - cfAlocado;
  const margemLiq    = pv > 0 ? (lucro / pv) * 100 : 0;

  return { moBase, moTotal, penPct, moPen, pcp, curvo, comissao, led, totalCustos, mc, mcPct, cfAlocado, lucro, margemLiq };
}

// ── Linha de resultado ──────────────────────────────────────────────────────
function CalcRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-3 rounded-lg ${highlight ? 'bg-navy/10 font-semibold' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-mono ${highlight ? 'text-navy' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

// ── Campo numérico ──────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, prefix, suffix }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-200 rounded-lg py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold ${prefix ? 'pl-8 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Formulário de registro ──────────────────────────────────────────────────
function RecordForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [nome, setNome] = useState(initial?.nome_projeto || '');
  const [data, setData] = useState(initial?.data || today);
  const [inp, setInp] = useState(initial?.inputs || { ...EMPTY_INPUTS });
  const [funcs, setFuncs] = useState(initial?.funcionarios || []);
  const [saving, setSaving] = useState(false);

  const setF = (k) => (v) => setInp((p) => ({ ...p, [k]: v }));

  const calc = calcular(inp);

  const addFunc = () => setFuncs((p) => [...p, { id: Date.now().toString(), nome: '', percentual: '' }]);
  const removeFunc = (id) => setFuncs((p) => p.filter((f) => f.id !== id));
  const updateFunc = (id, field, val) =>
    setFuncs((p) => p.map((f) => (f.id === id ? { ...f, [field]: val } : f)));

  const handleSave = async () => {
    if (!nome.trim()) return alert('Informe o nome do projeto.');
    setSaving(true);
    const record = {
      id: initial?.id || Date.now().toString(),
      nome_projeto: nome.trim(),
      data,
      inputs: inp,
      funcionarios: funcs,
    };
    await onSave(record);
    setSaving(false);
  };

  const pv = parseFloat(inp.preco_venda) || 0;

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-4">
      {/* Header */}
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-white">{initial ? 'Editar Registro' : 'Novo Registro'}</span>
        <button onClick={onCancel} className="text-white/50 hover:text-white text-xs">Cancelar</button>
      </div>

      <div className="p-4 space-y-5">
        {/* Identificação */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Nome do Projeto / Cliente</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Obra Silva - Cozinha"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* Dados do Ambiente */}
        <div>
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Dados do Ambiente</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Preço de Venda (R$)" value={inp.preco_venda} onChange={setF('preco_venda')} prefix="R$" />
            <NumInput label="m² Vendidos" value={inp.m2_vendidos} onChange={setF('m2_vendidos')} suffix="m²" />
            <NumInput label="m² Entregues" value={inp.m2_entregues} onChange={setF('m2_entregues')} suffix="m²" />
            <NumInput label="Dias de Atraso" value={inp.dias_atraso} onChange={setF('dias_atraso')} />
            <NumInput label="Meta m² Vendidos" value={inp.meta_m2_vendidos} onChange={setF('meta_m2_vendidos')} suffix="m²" />
            <NumInput label="Meta m² Entregues" value={inp.meta_m2_entregues} onChange={setF('meta_m2_entregues')} suffix="m²" />
            <NumInput label="Folha Fixa (R$)" value={inp.folha_fixa} onChange={setF('folha_fixa')} prefix="R$" />
            <NumInput label="Custo de Material (R$)" value={inp.custo_material} onChange={setF('custo_material')} prefix="R$" />
            <NumInput label="Hardware (R$)" value={inp.hardware} onChange={setF('hardware')} prefix="R$" />
            <NumInput label="Lados Curvos (qtd)" value={inp.lados_curvos} onChange={setF('lados_curvos')} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">LED %</label>
              <select
                value={inp.led_pct}
                onChange={(e) => setF('led_pct')(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold"
              >
                <option value={0}>0%</option>
                <option value={3}>3%</option>
                <option value={6}>6%</option>
              </select>
            </div>
            <NumInput label="Transporte (R$)" value={inp.transporte} onChange={setF('transporte')} prefix="R$" />
          </div>
        </div>

        {/* Cálculos */}
        {pv > 0 && (
          <div>
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Cálculos</p>
            <div className="space-y-0.5">
              <CalcRow label="MO/m² Base" value={fmtBRL(calc.moBase)} />
              <CalcRow label="MO Total" value={fmtBRL(calc.moTotal)} />
              <CalcRow label="Penalidade" value={fmtPct(calc.penPct)} />
              <CalcRow label="MO c/ Penalidade" value={fmtBRL(calc.moPen)} />
              <CalcRow label="PCP (40% MO)" value={fmtBRL(calc.pcp)} />
              <CalcRow label="Curvos" value={fmtBRL(calc.curvo)} />
              <CalcRow label="Comissão (5%)" value={fmtBRL(calc.comissao)} />
              <CalcRow label="LED" value={fmtBRL(calc.led)} />
              <CalcRow label="Total Custos" value={fmtBRL(calc.totalCustos)} />
              <CalcRow label="Margem de Contribuição" value={fmtBRL(calc.mc)} highlight />
              <CalcRow label="MC %" value={fmtPct(calc.mcPct)} highlight />
              <CalcRow label="CF Alocado" value={fmtBRL(calc.cfAlocado)} />
              <CalcRow label="Lucro Líquido" value={fmtBRL(calc.lucro)} highlight />
              <CalcRow label="Margem Líquida %" value={fmtPct(calc.margemLiq)} highlight />
            </div>
          </div>
        )}

        {/* Equipe / Bonificação */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-navy uppercase tracking-wide">Bonificação por Funcionário</p>
            <button
              onClick={addFunc}
              className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg font-semibold"
            >
              + Funcionário
            </button>
          </div>

          {funcs.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Nenhum funcionário adicionado.</p>
          )}

          <div className="space-y-2">
            {funcs.map((f) => {
              const pctVal = parseFloat(f.percentual) || 0;
              const bonif = pv > 0 ? (pctVal / 100) * pv : 0;
              return (
                <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <input
                    value={f.nome}
                    onChange={(e) => updateFunc(f.id, 'nome', e.target.value)}
                    placeholder="Nome"
                    className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
                  />
                  <div className="relative w-20">
                    <input
                      type="number"
                      value={f.percentual}
                      onChange={(e) => updateFunc(f.id, 'percentual', e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-gold pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  <div className="w-28 text-right">
                    <span className={`text-sm font-semibold font-mono ${bonif > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {pv > 0 ? fmtBRL(bonif) : '—'}
                    </span>
                  </div>
                  <button onClick={() => removeFunc(f.id)} className="text-gray-300 hover:text-red-400 ml-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {funcs.length > 0 && pv > 0 && (
            <div className="mt-2 flex justify-between items-center px-3 py-2 bg-navy/5 rounded-xl">
              <span className="text-xs text-gray-500 font-semibold">Total bonificado</span>
              <span className="text-sm font-bold text-navy font-mono">
                {fmtBRL(funcs.reduce((acc, f) => acc + ((parseFloat(f.percentual) || 0) / 100) * pv, 0))}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gold text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar Registro'}
        </button>
      </div>
    </div>
  );
}

// ── Card de registro ────────────────────────────────────────────────────────
function RecordCard({ record, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const calc = calcular(record.inputs || {});
  const pv = parseFloat(record.inputs?.preco_venda) || 0;

  const mcColor =
    calc.mcPct >= 70 ? 'text-green-600' :
    calc.mcPct >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{fmtDate(record.data)}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">{record.nome_projeto}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">PV: {fmtBRL(pv)}</span>
            {pv > 0 && <span className={`text-xs font-semibold ${mcColor}`}>MC {fmtPct(calc.mcPct)}</span>}
            <span className="text-xs text-gray-400">{record.funcionarios?.length || 0} func.</span>
          </div>
        </div>
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {/* Funcionários */}
          {record.funcionarios?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Bonificações</p>
              <div className="space-y-1.5">
                {record.funcionarios.map((f) => {
                  const bonif = pv > 0 ? ((parseFloat(f.percentual) || 0) / 100) * pv : 0;
                  return (
                    <div key={f.id} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{f.nome || '—'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{f.percentual || 0}%</span>
                        <span className="text-sm font-semibold text-green-700 font-mono">{fmtBRL(bonif)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold border-t border-gray-100 pt-2">
                <span className="text-gray-500">Total</span>
                <span className="text-navy font-mono">
                  {fmtBRL(record.funcionarios.reduce((acc, f) => acc + ((parseFloat(f.percentual) || 0) / 100) * pv, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Resumo dos cálculos */}
          {pv > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Resumo</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ['MO c/ Penalidade', fmtBRL(calc.moPen)],
                  ['Penalidade', fmtPct(calc.penPct)],
                  ['Total Custos', fmtBRL(calc.totalCustos)],
                  ['MC', `${fmtBRL(calc.mc)} (${fmtPct(calc.mcPct)})`],
                  ['Lucro Líquido', fmtBRL(calc.lucro)],
                  ['Margem Líq.', fmtPct(calc.margemLiq)],
                ].map(([l, v]) => (
                  <div key={l} className="text-xs">
                    <span className="text-gray-400">{l}: </span>
                    <span className="font-semibold text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => onEdit(record)}
              className="flex-1 py-2 rounded-lg bg-navy/10 text-navy text-xs font-semibold">
              Editar
            </button>
            <button onClick={() => onDelete(record.id)}
              className="flex-1 py-2 rounded-lg bg-red-50 text-red-500 text-xs font-semibold">
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab principal ───────────────────────────────────────────────────────────
export default function BonificacaoTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/bonificacao');
      if (r.ok) setRecords(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSave = async (record) => {
    await fetch('/api/bonificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    setShowForm(false);
    setEditing(null);
    await fetchRecords();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este registro?')) return;
    await fetch('/api/bonificacao', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await fetchRecords();
  };

  const handleEdit = (record) => {
    setEditing(record);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (showForm) {
    return (
      <div className="px-4 pt-4">
        <RecordForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-navy">Bonificação</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-gold text-white text-xs font-bold px-4 py-2 rounded-lg"
        >
          + Novo
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
      )}

      {!loading && records.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400">Nenhum registro ainda.</p>
          <p className="text-xs text-gray-300 mt-1">Clique em "+ Novo" para começar.</p>
        </div>
      )}

      {!loading && records.map((r) => (
        <RecordCard key={r.id} record={r} onEdit={handleEdit} onDelete={handleDelete} />
      ))}
    </div>
  );
}
