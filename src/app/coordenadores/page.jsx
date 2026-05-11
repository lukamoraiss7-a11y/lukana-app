'use client';

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

// ── Caderno de Venda (Coord. Projetos) ────────────────────────────────────
const CADERNO_ITENS = [
  { key: 'cor_mdf_principal',    label: 'Cor MDF Principal',         ph: 'Ex: Branco TX 18mm Duratex' },
  { key: 'cor_mdf_secundaria',   label: 'Cor MDF Secundária',        ph: 'Se houver (ex: Carvalho Naturale)' },
  { key: 'puxador',              label: 'Puxador — Modelo',          ph: 'Ex: Perfil contínuo alumínio 10cm' },
  { key: 'puxador_acabamento',   label: 'Puxador — Acabamento',      ph: 'Ex: Preto fosco / Cromado / Dourado' },
  { key: 'led',                  label: 'LED — Locais',              ph: 'Ex: Rodapé cozinha + interior armário' },
  { key: 'led_tipo',             label: 'LED — Tipo/Temperatura',    ph: 'Ex: 3000K branco quente, fita 5050' },
  { key: 'alturas',              label: 'Alturas dos Móveis',        ph: 'Ex: Armário superior 80cm, base 87cm' },
  { key: 'tamponamento',         label: 'Acabamento Tamponamento',   ph: 'Ex: Fita de bordo PVC branco 22mm' },
  { key: 'serralheria',          label: 'Serralheria',               ph: 'Ex: Porta basculante em alumínio preto' },
  { key: 'obs',                  label: 'Observações do Projeto',    ph: 'Detalhes, exceções, alertas...' },
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
              <input
                value={campos[item.key] || ''}
                onChange={e => set(item.key, e.target.value)}
                placeholder={item.ph}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder:text-gray-300"
              />
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
    setSaving(true);
    try {
      await fetch('/api/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autor: session.nome, texto, tipo }) });
      setTexto('');
      const r = await fetch(`/api/notas?date=${today()}`);
      const n = await r.json();
      setNotas(Array.isArray(n) ? n : []);
      showToast('Nota registrada');
    } catch { showToast('Erro ao salvar'); }
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
  const ATA_TAB = { id: 'atas', label: 'Atas', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6h.01M12 16h.01M16 12h.01"/></svg> };
  const TABS = isProj ? [
    { id: 'caderno', label: 'Caderno', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg> },
    { id: 'termo',   label: 'Termo',   icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 12l2 2 4-4M7 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg> },
    ATA_TAB,
  ] : [
    { id: 'diario',      label: 'Diário',      icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
    { id: 'suprimentos', label: 'Suprimentos', icon: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg> },
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

            {/* Resumo das equipes (obrigatório) */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Resumo das equipes <span className="text-red-400">*</span></p>
              <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={3}
                placeholder="Como estão as equipes hoje? Ritmo, dificuldades, destaques..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300" />
            </div>

            {/* Registro de vistoria + foto */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Registro de vistoria</p>
              <div className="space-y-2 mb-3">
                <select value={obraVistoria} onChange={(e) => setObraVistoria(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gold">
                  <option value="">Selecionar cliente / obra...</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide pt-1">Ambiente(s)</p>
                <AmbientesPicker selected={ambientesVistoria} onChange={setAmbientesVistoria} />
                {ambientesVistoria.includes('__outro__') && (
                  <input value={ambienteOutro} onChange={(e) => setAmbienteOutro(e.target.value)}
                    placeholder="Qual ambiente?"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold" />
                )}
              </div>
              <CoordChecklist checklist={checklist} setChecklist={setChecklist} />
              {/* Foto integrada — dois botões */}
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
                <p className="text-[11px] text-green-600 mb-3 px-1 truncate">
                  {fotoFile.name}{fotoData ? ` · Tirada em ${fotoData.split('-').reverse().join('/')}` : ''}
                </p>
              )}
              <button onClick={handleVistoria} disabled={savingVistoria || uploadingFoto || !obraVistoria || Object.keys(checklist).length === 0}
                className="w-full py-2.5 bg-navy text-gold font-bold rounded-xl text-sm disabled:opacity-40">
                {savingVistoria || uploadingFoto ? 'Registrando...' : 'Registrar e enviar para ClickUp'}
              </button>
            </div>

            {/* Nota rápida */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Nota rápida</p>
              <div className="flex gap-2 mb-2">
                {[{v:'nota',l:'Geral'},{v:'obra',l:'Obra'},{v:'fabrica',l:'Fábrica'}].map((t) => (
                  <button key={t.v} onClick={() => setTipo(t.v)}
                    className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-colors ${tipo === t.v ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
                placeholder="O que aconteceu? Bloqueio, evolução, observação..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gold placeholder:text-gray-300 mb-3" />
              <button onClick={handleAddNota} disabled={saving}
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
        {activeTab === 'suprimentos' && (
          <div className="px-3 py-3">
            {/* Obras visíveis para equipe */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Obras visíveis para a equipe</p>
                <button onClick={handleLiberarTodas} disabled={aprovandoObra === 'all' || obras.length === 0}
                  className="px-3 py-1 rounded-full text-xs font-bold border-2 border-green-400 bg-green-50 text-green-600 disabled:opacity-40">
                  {aprovandoObra === 'all' ? '...' : 'Liberar todas'}
                </button>
              </div>
              {obras.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Nenhuma obra carregada.</p>}
              <div className="space-y-2">
                {obras.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-navy truncate">{o.nome}</div>
                      {o.aprovada && o.aprovada_por
                        ? <div className="text-[10px] text-green-500 mt-0.5">{o.aprovada_por} · {(() => { const d = new Date(o.aprovada_em); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}</div>
                        : <div className="text-[10px] text-red-400 mt-0.5">{o.aprovada ? 'Liberada' : 'Não liberada'}</div>
                      }
                    </div>
                    <button
                      onClick={() => handleToggleAprovada(o.id, o.aprovada)}
                      disabled={aprovandoObra === o.id}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors disabled:opacity-40 ${o.aprovada ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                      {aprovandoObra === o.id ? '...' : o.aprovada ? 'Liberada ✓' : 'Liberar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold px-1">Pedidos de material</p>
              <button onClick={loadAll} className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-gold text-gold-d bg-white">Atualizar</button>
            </div>
            {loading && <div className="text-center py-10 text-sm text-gray-400">Carregando...</div>}
            {!loading && pedidos.length === 0 && <div className="text-center py-12 text-sm text-gray-400">Nenhum pedido nos últimos 7 dias.</div>}
            {!loading && pedidos.map((p) => <PedidoCoordCard key={p.id} pedido={p} onStatusChange={handleStatusChange} />)}
          </div>
        )}

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
