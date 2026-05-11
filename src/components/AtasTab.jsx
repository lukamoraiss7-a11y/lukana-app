'use client';

import { useState, useEffect, useCallback } from 'react';

const MAX_ANEXO_BYTES = 500 * 1024; // 500 KB

const EQUIPE_LABEL = {
  gerente: 'Gerente de Fábrica',
  coordenador_obra: 'Coordenação de Obra',
  coordenador_projetos: 'Coordenação de Projetos',
};

const fmtDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const STATUS_CFG = {
  aberto:    { label: 'Pendente',   cls: 'bg-amber-100 text-amber-700' },
  concluido: { label: 'Concluído',  cls: 'bg-green-100 text-green-700' },
};

// ── Card de ata ─────────────────────────────────────────────────────────────
function AtaCard({ ata, readonly, onToggleStatus }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_CFG[ata.status_pendencias] || STATUS_CFG.aberto;
  const equipeLabel = EQUIPE_LABEL[ata.role] || ata.equipe || ata.role || '—';

  return (
    <div className="bg-white rounded-xl shadow-sm mb-2 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-navy">{fmtDate(ata.data_reuniao)}</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase">{equipeLabel}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate mt-0.5 leading-snug">{ata.resumo}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{ata.autor}</p>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
          <svg
            fill="none" stroke="currentColor" strokeWidth="2"
            viewBox="0 0 24 24" className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Detalhes */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <Field label="Participantes" value={ata.participantes} />
          <Field label="Resumo" value={ata.resumo} />
          {ata.problemas && <Field label="Problemas levantados" value={ata.problemas} />}
          {ata.decisoes && <Field label="Decisões tomadas" value={ata.decisoes} />}
          {ata.pendencias && <Field label="Pendências" value={ata.pendencias} />}
          {ata.proximos_passos && <Field label="Próximos passos" value={ata.proximos_passos} />}
          {ata.responsaveis && <Field label="Responsáveis" value={ata.responsaveis} />}
          {ata.prazo_acoes && <Field label="Prazo das ações" value={fmtDate(ata.prazo_acoes)} />}

          {/* Anexo */}
          {ata.anexo && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Anexo</p>
              <a
                href={`/api/atas?download=1&id=${ata.id}&data_reuniao=${ata.data_reuniao}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy border border-navy/30 rounded-lg px-3 py-1.5 hover:bg-navy/5 transition-colors"
              >
                <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                {ata.anexo.nome}
                {ata.anexo.tamanho && (
                  <span className="text-gray-400 font-normal">
                    ({(ata.anexo.tamanho / 1024).toFixed(0)} KB)
                  </span>
                )}
              </a>
            </div>
          )}

          {/* Toggle status pendências — só quem criou ou diretoria */}
          {!readonly && ata.pendencias && (
            <button
              type="button"
              onClick={() => onToggleStatus(ata)}
              className={`w-full py-2 rounded-xl text-xs font-bold border-2 transition-colors mt-1 ${
                ata.status_pendencias === 'concluido'
                  ? 'border-amber-300 text-amber-600 bg-amber-50'
                  : 'border-green-300 text-green-600 bg-green-50'
              }`}
            >
              {ata.status_pendencias === 'concluido' ? 'Reabrir pendências' : 'Marcar pendências como concluídas'}
            </button>
          )}

          <p className="text-[10px] text-gray-300 text-right">
            Registrado em {ata.created_at?.slice(0, 10).split('-').reverse().join('/')} {ata.created_at?.slice(11, 16)}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 leading-snug whitespace-pre-line">{value}</p>
    </div>
  );
}

// ── Formulário nova ata ─────────────────────────────────────────────────────
function AtaForm({ session, onSaved }) {
  const today = () => new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    data_reuniao: today(),
    participantes: '',
    resumo: '',
    problemas: '',
    decisoes: '',
    pendencias: '',
    proximos_passos: '',
    responsaveis: '',
    prazo_acoes: '',
  });
  const [anexo, setAnexo] = useState(null); // { nome, tipo, tamanho, dados_b64 }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setAnexo(null); return; }
    if (file.size > MAX_ANEXO_BYTES) {
      setError(`Arquivo muito grande (máx. 500 KB). Este arquivo tem ${(file.size / 1024).toFixed(0)} KB.`);
      e.target.value = '';
      return;
    }
    setError('');
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setAnexo({ nome: file.name, tipo: file.type, tamanho: file.size, dados_b64: b64 });
  };

  const handleSubmit = async () => {
    if (!form.participantes.trim() || !form.resumo.trim()) {
      setError('Participantes e Resumo são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const equipe = EQUIPE_LABEL[session.role] || session.role || '';
      const res = await fetch('/api/atas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          autor: session.nome,
          role: session.role,
          equipe,
          anexo,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Erro ao salvar.'); return; }
      onSaved();
    } catch (e) {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const ta = (key, placeholder, rows = 3) => (
    <textarea
      value={form[key]}
      onChange={set(key)}
      rows={rows}
      placeholder={placeholder}
      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300"
    />
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Nova ata</p>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Data da reunião <span className="text-red-400">*</span></p>
        <input type="date" value={form.data_reuniao} onChange={set('data_reuniao')}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Participantes <span className="text-red-400">*</span></p>
        {ta('participantes', 'Ex: Ana, Matheus, Luciano...', 2)}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Resumo da reunião <span className="text-red-400">*</span></p>
        {ta('resumo', 'Principais pontos discutidos...')}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Problemas levantados</p>
        {ta('problemas', 'Obstáculos, bloqueios, riscos identificados...')}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Decisões tomadas</p>
        {ta('decisoes', 'O que foi decidido na reunião...')}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Pendências</p>
        {ta('pendencias', 'O que ficou em aberto...')}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Próximos passos</p>
        {ta('proximos_passos', 'Ações planejadas para a próxima semana...')}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Responsáveis pelas ações</p>
        {ta('responsaveis', 'Ex: Ana (obra), Matheus (fábrica)...', 2)}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">Prazo das ações</p>
        <input type="date" value={form.prazo_acoes} onChange={set('prazo_acoes')}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
      </div>

      {/* Upload */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1">Anexo (PDF, DOCX ou imagem — máx. 500 KB)</p>
        <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-3 py-3 cursor-pointer hover:border-gold transition-colors">
          <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5 text-gray-400 flex-shrink-0">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span className="text-xs text-gray-400 truncate">
            {anexo ? anexo.nome : 'Escolher arquivo...'}
          </span>
          <input
            type="file"
            accept=".pdf,.docx,.doc,image/*"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        {anexo && (
          <button type="button" onClick={() => setAnexo(null)}
            className="text-[11px] text-red-400 mt-1 ml-1">
            Remover anexo
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3 bg-gold text-navy font-bold rounded-xl text-sm disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Registrar Ata'}
      </button>
    </div>
  );
}

// ── Componente principal exportado ──────────────────────────────────────────
export default function AtasTab({ session, readonly = false }) {
  const [atas, setAtas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(3);
  const [showForm, setShowForm] = useState(false);
  const [filterEquipe, setFilterEquipe] = useState('todos');

  const fetchAtas = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/atas?months=${months}`);
      const data = await r.json();
      setAtas(Array.isArray(data) ? data : []);
    } catch {
      setAtas([]);
    }
    setLoading(false);
  }, [months]);

  useEffect(() => { fetchAtas(); }, [fetchAtas]);

  const handleToggleStatus = async (ata) => {
    const novoStatus = ata.status_pendencias === 'concluido' ? 'aberto' : 'concluido';
    await fetch('/api/atas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ata.id, data_reuniao: ata.data_reuniao, updates: { status_pendencias: novoStatus } }),
    });
    fetchAtas();
  };

  // Para coordenadores/gerente, filtrar por role próprio na listagem
  const filtered = atas.filter((a) => {
    if (filterEquipe !== 'todos') return a.role === filterEquipe;
    return true;
  });

  // Equipes disponíveis para filtro (CEO vê todas)
  const equipes = [...new Set(atas.map((a) => a.role).filter(Boolean))];

  return (
    <div className="px-3 py-3">

      {/* Botão nova ata — só para quem não é readonly */}
      {!readonly && (
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={`w-full py-2.5 rounded-xl text-sm font-bold border-2 mb-3 transition-colors ${
            showForm
              ? 'border-gray-300 bg-gray-100 text-gray-600'
              : 'border-gold bg-gold text-navy'
          }`}
        >
          {showForm ? 'Cancelar' : '+ Nova Ata de Reunião'}
        </button>
      )}

      {/* Formulário */}
      {showForm && !readonly && (
        <AtaForm
          session={session}
          onSaved={() => { setShowForm(false); fetchAtas(); }}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {/* Período */}
        {[
          { v: 1, l: '1 mês' },
          { v: 3, l: '3 meses' },
          { v: 6, l: '6 meses' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setMonths(f.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              months === f.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Filtro por equipe — só mostra se readonly (CEO) ou se há mais de 1 equipe */}
      {(readonly && equipes.length > 1) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setFilterEquipe('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              filterEquipe === 'todos' ? 'border-gold bg-gold text-navy' : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            Todas as equipes
          </button>
          {equipes.map((e) => (
            <button
              key={e}
              onClick={() => setFilterEquipe(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                filterEquipe === e ? 'border-gold bg-gold text-navy' : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {EQUIPE_LABEL[e] || e}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400">
          Nenhuma ata registrada neste período.
        </div>
      )}
      {!loading && filtered.map((ata) => (
        <AtaCard
          key={ata.id}
          ata={ata}
          readonly={readonly}
          onToggleStatus={handleToggleStatus}
        />
      ))}
    </div>
  );
}
