'use client';

import { useState, useEffect, useCallback } from 'react';
import { MARCENEIROS } from '@/lib/auth';

const fmtBRL = (v) =>
  v == null || isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtPct = (v) => (v == null || isNaN(v) ? '—' : `${v.toFixed(2)}%`);
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

const EMPTY_INPUTS = {
  preco_venda: '',
  m2_vendidos: '',
  meta_m2_vendidos: 800,
  dias_atraso: 0,
  dias_adiantamento: 0,
  folha_fixa: 120000,
  custo_material: '',
  led_valor: 0,
  custos_gerais: 0,
};

// penPct: 3d=-1%, 6d=-1.5%, 9d=-2%, +0.5% a cada 3d extras
function calcPenPct(atraso) {
  const periods = Math.floor(atraso / 3);
  return periods > 0 ? -(0.5 * (1 + periods)) : 0;
}

// bonusPct: +0.5% a cada 5d adiantados (só se validado_vinny && validado_ana)
function calcBonusPct(adiant, validVinny, validAna) {
  if (!validVinny || !validAna) return 0;
  const periods = Math.floor(adiant / 5);
  return periods > 0 ? periods * 0.5 : 0;
}

function calcular(inp) {
  const pv     = parseFloat(inp.preco_venda)      || 0;
  const m2v    = parseFloat(inp.m2_vendidos)      || 0;
  const metaV  = parseFloat(inp.meta_m2_vendidos) || 800;
  const folha  = parseFloat(inp.folha_fixa)       || 0;
  const atraso = parseFloat(inp.dias_atraso)      || 0;
  const mat    = parseFloat(inp.custo_material)   || 0;
  const ledV   = parseFloat(inp.led_valor)        || 0;
  const custos = parseFloat(inp.custos_gerais)    || 0;

  const moBase      = metaV > 0 ? folha / metaV : 0;
  const moTotal     = moBase * m2v;
  const penPct      = calcPenPct(atraso);
  const moPen       = moTotal * (1 + penPct / 100);
  const pcp         = moPen * 0.4;
  const comissao    = pv * 0.05;
  const totalCustos = mat + moPen + pcp + comissao + ledV + custos;
  const mc          = pv - totalCustos;
  const mcPct       = pv > 0 ? (mc / pv) * 100 : 0;
  const cfAlocado   = 135000 / 30;
  const lucro       = mc - cfAlocado;
  const margemLiq   = pv > 0 ? (lucro / pv) * 100 : 0;

  return { moBase, moTotal, penPct, moPen, pcp, comissao, totalCustos, mc, mcPct, cfAlocado, lucro, margemLiq };
}

function CalcRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-3 rounded-lg ${highlight ? 'bg-navy/10 font-semibold' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-mono ${highlight ? 'text-navy' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

function NumInput({ label, sublabel, value, onChange, prefix, suffix }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      {sublabel && <p className="text-[10px] text-gray-400 mb-1">{sublabel}</p>}
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

// ── Formulário ──────────────────────────────────────────────────────────────
function RecordForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [nome, setNome]           = useState(initial?.nome_projeto || '');
  const [data, setData]           = useState(initial?.data || today);
  const [dataLim, setDataLim]     = useState(initial?.data_limite || '');
  const [inp, setInp]             = useState(initial?.inputs || { ...EMPTY_INPUTS });
  const [funcs, setFuncs]         = useState(initial?.funcionarios || []);
  const [tercs, setTercs]         = useState(initial?.terceirizados || []);
  const [modulos, setModulos]     = useState(initial?.modulos || []);
  const [modInput, setModInput]   = useState('');
  const [validVinny, setValidVinny] = useState(initial?.validado_vinny || false);
  const [validAna, setValidAna]   = useState(initial?.validado_ana || false);
  const [saving, setSaving]       = useState(false);

  const setF = (k) => (v) => setInp((p) => ({ ...p, [k]: v }));
  const calc = calcular(inp);
  const pv   = parseFloat(inp.preco_venda) || 0;
  const adiant = parseFloat(inp.dias_adiantamento) || 0;
  const bonusPct = calcBonusPct(adiant, validVinny, validAna);

  // ── Marceneiros
  const addFunc = () => setFuncs((p) => [...p, { id: Date.now().toString(), marceneiro_id: '', nome: '', percentual: '' }]);
  const removeFunc = (id) => setFuncs((p) => p.filter((f) => f.id !== id));
  const handleSelectMarceneiro = (id, mid) => {
    const m = MARCENEIROS.find((x) => x.id === mid);
    setFuncs((p) => p.map((f) => f.id === id ? { ...f, marceneiro_id: mid, nome: m ? m.nome : '' } : f));
  };
  const updateFunc = (id, field, val) => setFuncs((p) => p.map((f) => (f.id === id ? { ...f, [field]: val } : f)));

  // ── Terceirizados
  const addTerc = () => setTercs((p) => [...p, { id: Date.now().toString(), nome: '', percentual: '', valor_pago: '' }]);
  const removeTerc = (id) => setTercs((p) => p.filter((t) => t.id !== id));
  const updateTerc = (id, field, val) => setTercs((p) => p.map((t) => (t.id === id ? { ...t, [field]: val } : t)));

  const handleSave = async () => {
    if (!nome.trim()) return alert('Informe o nome do projeto.');
    setSaving(true);
    try {
      await onSave({
        id: initial?.id || Date.now().toString(),
        nome_projeto: nome.trim(),
        data,
        data_limite: dataLim,
        inputs: inp,
        modulos,
        funcionarios: funcs,
        terceirizados: tercs,
        validado_vinny: validVinny,
        validado_ana: validAna,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-4">
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-white">{initial ? 'Editar Registro' : 'Novo Registro'}</span>
        <button onClick={onCancel} className="text-white/50 hover:text-white text-xs">Cancelar</button>
      </div>

      <div className="p-4 space-y-5">
        {/* Identificação */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Nome do Projeto / Cliente</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Obra Silva - Cozinha"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Limite</label>
            <input type="date" value={dataLim} onChange={(e) => setDataLim(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold" />
          </div>
        </div>

        {/* Módulos / Peças */}
        <div>
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Módulos / Peças</p>
          <div className="flex gap-2 mb-2">
            <input
              value={modInput}
              onChange={(e) => setModInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && modInput.trim()) {
                  e.preventDefault();
                  setModulos((p) => [...p, modInput.trim()]);
                  setModInput('');
                }
              }}
              placeholder="Ex: Guarda Roupa, Painel..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-gold"
            />
            <button type="button"
              onClick={() => { if (modInput.trim()) { setModulos((p) => [...p, modInput.trim()]); setModInput(''); } }}
              className="px-3 py-2 bg-navy text-white text-xs font-bold rounded-lg">+</button>
          </div>
          {modulos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {modulos.map((m, i) => (
                <span key={i} className="flex items-center gap-1 bg-navy/10 text-navy text-xs font-semibold px-2.5 py-1 rounded-full">
                  {m}
                  <button type="button" onClick={() => setModulos((p) => p.filter((_, j) => j !== i))}
                    className="text-navy/40 hover:text-red-500 leading-none">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dados do Ambiente */}
        <div>
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Dados do Ambiente</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Preço de Venda (R$)" value={inp.preco_venda} onChange={setF('preco_venda')} prefix="R$" />
            <NumInput label="m² Vendidos" value={inp.m2_vendidos} onChange={setF('m2_vendidos')} suffix="m²" />
            <NumInput label="Meta m² Vendidos" value={inp.meta_m2_vendidos} onChange={setF('meta_m2_vendidos')} suffix="m²" />
            <NumInput label="Folha Fixa (R$)" value={inp.folha_fixa} onChange={setF('folha_fixa')} prefix="R$" />
            <NumInput label="Custo de Material (R$)" value={inp.custo_material} onChange={setF('custo_material')} prefix="R$" />
            <NumInput label="LED (R$)" value={inp.led_valor} onChange={setF('led_valor')} prefix="R$" />
            <div className="col-span-2">
              <NumInput
                label="Custos Gerais (R$)"
                sublabel="alimentação, uber, gasolina e outros da obra"
                value={inp.custos_gerais}
                onChange={setF('custos_gerais')}
                prefix="R$"
              />
            </div>
            <NumInput label="Dias de Atraso" value={inp.dias_atraso} onChange={setF('dias_atraso')} />
            <NumInput label="Dias Adiantado" value={inp.dias_adiantamento} onChange={setF('dias_adiantamento')} />
          </div>
        </div>

        {/* Validação de adiantamento */}
        {adiant > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">
              Validação de Adiantamento — {adiant}d adiantado → +{(Math.floor(adiant / 5) * 0.5).toFixed(1)}%
            </p>
            <p className="text-[11px] text-green-600">O bônus só é aplicado após Vinny e Ana validarem a qualidade da entrega.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setValidVinny((v) => !v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${validVinny ? 'bg-green-600 border-green-600 text-white' : 'border-green-300 text-green-600 bg-white'}`}>
                {validVinny ? '✓ Vinny validou' : 'Vinny — pendente'}
              </button>
              <button type="button" onClick={() => setValidAna((v) => !v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${validAna ? 'bg-green-600 border-green-600 text-white' : 'border-green-300 text-green-600 bg-white'}`}>
                {validAna ? '✓ Ana validou' : 'Ana — pendente'}
              </button>
            </div>
            {bonusPct > 0 && (
              <p className="text-xs text-green-700 font-semibold text-center">Bônus ativo: +{bonusPct.toFixed(1)}%</p>
            )}
          </div>
        )}

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
              <CalcRow label="Comissão (5%)" value={fmtBRL(calc.comissao)} />
              <CalcRow label="LED" value={fmtBRL(parseFloat(inp.led_valor) || 0)} />
              <CalcRow label="Custos Gerais" value={fmtBRL(parseFloat(inp.custos_gerais) || 0)} />
              <CalcRow label="Total Custos" value={fmtBRL(calc.totalCustos)} />
              <CalcRow label="Margem de Contribuição" value={fmtBRL(calc.mc)} highlight />
              <CalcRow label="MC %" value={fmtPct(calc.mcPct)} highlight />
              <CalcRow label="CF Alocado" value={fmtBRL(calc.cfAlocado)} />
              <CalcRow label="Lucro Líquido" value={fmtBRL(calc.lucro)} highlight />
              <CalcRow label="Margem Líquida %" value={fmtPct(calc.margemLiq)} highlight />
            </div>
          </div>
        )}

        {/* Marceneiros */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-navy uppercase tracking-wide">Bonificação — Marceneiros</p>
            <button onClick={addFunc} className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg font-semibold">
              + Funcionário
            </button>
          </div>
          {funcs.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Nenhum marceneiro adicionado.</p>}
          <div className="space-y-2">
            {funcs.map((f) => {
              const basePct  = parseFloat(f.percentual) || 0;
              const baseVal  = pv > 0 ? (basePct / 100) * pv : 0;
              const bonif    = bonusPct > 0 ? baseVal * (1 + bonusPct / 100) : baseVal;
              return (
                <div key={f.id} className="bg-gray-50 rounded-xl px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={f.marceneiro_id || ''}
                      onChange={(e) => handleSelectMarceneiro(f.id, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
                    >
                      <option value="">Selecionar marceneiro...</option>
                      {MARCENEIROS.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                    <button onClick={() => removeFunc(f.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <input type="number" value={f.percentual} onChange={(e) => updateFunc(f.id, 'percentual', e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-gold pr-5" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    <span className={`text-sm font-semibold font-mono flex-1 text-right ${bonif > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {pv > 0 ? fmtBRL(bonif) : '—'}
                    </span>
                  </div>
                  {bonusPct > 0 && pv > 0 && (
                    <p className="text-[10px] text-green-600 text-right">
                      base {fmtBRL(baseVal)} + bônus {fmtPct(bonusPct)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {funcs.length > 0 && pv > 0 && (
            <div className="mt-2 flex justify-between items-center px-3 py-2 bg-navy/5 rounded-xl">
              <span className="text-xs text-gray-500 font-semibold">Total marceneiros</span>
              <span className="text-sm font-bold text-navy font-mono">
                {fmtBRL(funcs.reduce((acc, f) => {
                  const baseVal = ((parseFloat(f.percentual) || 0) / 100) * pv;
                  return acc + (bonusPct > 0 ? baseVal * (1 + bonusPct / 100) : baseVal);
                }, 0))}
              </span>
            </div>
          )}
        </div>

        {/* Terceirizados */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-navy uppercase tracking-wide">Terceirizados</p>
            <button onClick={addTerc} className="text-xs bg-navy/80 text-white px-3 py-1.5 rounded-lg font-semibold">
              + Terceirizado
            </button>
          </div>
          {tercs.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Nenhum terceirizado.</p>}
          <div className="space-y-2">
            {tercs.map((t) => {
              const bonif = pv > 0 ? ((parseFloat(t.percentual) || 0) / 100) * pv : 0;
              return (
                <div key={t.id} className="bg-amber-50 rounded-xl px-3 py-2 space-y-1.5 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <input value={t.nome} onChange={(e) => updateTerc(t.id, 'nome', e.target.value)}
                      placeholder="Nome do terceirizado"
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold" />
                    <button onClick={() => removeTerc(t.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-20">
                      <input type="number" value={t.percentual} onChange={(e) => updateTerc(t.id, 'percentual', e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-gold pr-5" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    <span className="text-xs text-gray-500">calc: {pv > 0 ? fmtBRL(bonif) : '—'}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input type="number" value={t.valor_pago} onChange={(e) => updateTerc(t.id, 'valor_pago', e.target.value)}
                        placeholder="Valor pago"
                        className="w-full bg-white border border-amber-200 rounded-lg pl-7 pr-2 py-1 text-sm focus:outline-none focus:border-gold" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-gold text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar Registro'}
        </button>
      </div>
    </div>
  );
}

// ── Card de registro ────────────────────────────────────────────────────────
function RecordCard({ record, onEdit, onDelete, onValidate }) {
  const [open, setOpen] = useState(false);
  const calc   = calcular(record.inputs || {});
  const pv     = parseFloat(record.inputs?.preco_venda) || 0;
  const adiant = parseFloat(record.inputs?.dias_adiantamento) || 0;
  const bonusPct = calcBonusPct(adiant, record.validado_vinny, record.validado_ana);

  const mcColor =
    calc.mcPct >= 70 ? 'text-green-600' :
    calc.mcPct >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{fmtDate(record.data)}</span>
            {record.data_limite && (
              <span className="text-xs text-gray-400">· limite {fmtDate(record.data_limite)}</span>
            )}
            {adiant > 0 && (
              <span className={`text-xs font-bold ${bonusPct > 0 ? 'text-green-600' : 'text-amber-500'}`}>
                +{adiant}d {bonusPct > 0 ? `✓ +${bonusPct.toFixed(1)}%` : '(validação pendente)'}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">{record.nome_projeto}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">PV: {fmtBRL(pv)}</span>
            {pv > 0 && <span className={`text-xs font-semibold ${mcColor}`}>MC {fmtPct(calc.mcPct)}</span>}
            <span className="text-xs text-gray-400">{record.funcionarios?.length || 0} marc.</span>
            {record.terceirizados?.length > 0 && (
              <span className="text-xs text-amber-600">{record.terceirizados.length} terc.</span>
            )}
          </div>
        </div>
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {/* Módulos */}
          {record.modulos?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Módulos / Peças</p>
              <div className="flex flex-wrap gap-1.5">
                {record.modulos.map((m, i) => (
                  <span key={i} className="bg-navy/10 text-navy text-xs font-semibold px-2.5 py-1 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Marceneiros */}
          {record.funcionarios?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Marceneiros</p>
              <div className="space-y-1.5">
                {record.funcionarios.map((f) => {
                  const baseVal = pv > 0 ? ((parseFloat(f.percentual) || 0) / 100) * pv : 0;
                  const bonif   = bonusPct > 0 ? baseVal * (1 + bonusPct / 100) : baseVal;
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
            </div>
          )}

          {/* Terceirizados */}
          {record.terceirizados?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase mb-2">Terceirizados</p>
              <div className="space-y-1.5">
                {record.terceirizados.map((t) => {
                  const bonif = pv > 0 ? ((parseFloat(t.percentual) || 0) / 100) * pv : 0;
                  const pago  = parseFloat(t.valor_pago);
                  return (
                    <div key={t.id} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{t.nome || '—'}</span>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="text-xs text-gray-400">{t.percentual || 0}% → {fmtBRL(bonif)}</span>
                        {!isNaN(pago) && pago > 0 && (
                          <span className="text-xs font-semibold text-amber-700 font-mono">pago: {fmtBRL(pago)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validação de adiantamento */}
          {adiant > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-green-700">
                Adiantamento: {adiant}d → bônus potencial +{(Math.floor(adiant / 5) * 0.5).toFixed(1)}%
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onValidate(record.id, 'validado_vinny', !record.validado_vinny)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${record.validado_vinny ? 'bg-green-600 border-green-600 text-white' : 'border-green-300 text-green-700 bg-white'}`}>
                  {record.validado_vinny ? '✓ Vinny' : 'Vinny'}
                </button>
                <button
                  onClick={() => onValidate(record.id, 'validado_ana', !record.validado_ana)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${record.validado_ana ? 'bg-green-600 border-green-600 text-white' : 'border-green-300 text-green-700 bg-white'}`}>
                  {record.validado_ana ? '✓ Ana' : 'Ana'}
                </button>
              </div>
              {bonusPct > 0
                ? <p className="text-xs text-green-700 font-semibold text-center">Bônus aplicado: +{bonusPct.toFixed(1)}%</p>
                : <p className="text-[11px] text-green-600 text-center">Pendente: ambos precisam validar</p>
              }
            </div>
          )}

          {/* Resumo */}
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
              className="flex-1 py-2 rounded-lg bg-navy/10 text-navy text-xs font-semibold">Editar</button>
            <button onClick={() => onDelete(record.id)}
              className="flex-1 py-2 rounded-lg bg-red-50 text-red-500 text-xs font-semibold">Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab principal ───────────────────────────────────────────────────────────
export default function BonificacaoTab() {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);

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
    const res = await fetch('/api/bonificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) { alert('Erro ao salvar. Tente novamente.'); return; }
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

  const handleValidate = async (id, field, value) => {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const updated = { ...record, [field]: value };
    await fetch('/api/bonificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    await fetchRecords();
  };

  if (showForm) {
    return (
      <div className="px-4 pt-4">
        <RecordForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-navy">Bonificação</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-gold text-white text-xs font-bold px-4 py-2 rounded-lg">+ Novo</button>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>}

      {!loading && records.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400">Nenhum registro ainda.</p>
          <p className="text-xs text-gray-300 mt-1">Clique em "+ Novo" para começar.</p>
        </div>
      )}

      {!loading && records.map((r) => (
        <RecordCard key={r.id} record={r} onEdit={handleEdit} onDelete={handleDelete} onValidate={handleValidate} />
      ))}
    </div>
  );
}
