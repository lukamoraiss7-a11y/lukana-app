'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const MAQUINAS = ['CNC', 'Seccionadora'];
const OPERADORES_FIXOS = ['Wilken'];

// ── Barcode scanner overlay ────────────────────────────────────────────────
// Uses @zxing/browser — funciona em iOS Safari e Android Chrome
function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [scanError, setScanError] = useState('');
  const [detected, setDetected] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const codeReader = new BrowserMultiFormatReader();

        const controls = await codeReader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, err) => {
            if (stoppedRef.current || !mounted) return;
            if (result) {
              stoppedRef.current = true;
              setDetected(true);
              try { controls.stop(); } catch {}
              setTimeout(() => {
                if (mounted) onScan(result.getText());
              }, 300);
            }
            // NotFoundException é lançado a cada frame sem código — ignorar
          }
        );

        if (!stoppedRef.current) {
          controlsRef.current = controls;
        } else {
          try { controls.stop(); } catch {}
        }
      } catch (e) {
        if (mounted) setScanError('Sem acesso à câmera. Verifique as permissões do navegador.');
      }
    };

    start();

    return () => {
      mounted = false;
      stoppedRef.current = true;
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <span className="text-white font-bold text-sm">Aponte para o código de barras</span>
        <button onClick={onClose} className="text-white/50 text-sm px-3 py-1.5">Cancelar</button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {/* Overlay de mira */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className={`w-72 h-44 rounded-2xl border-2 transition-colors duration-300 ${detected ? 'border-green-400' : 'border-gold'}`} />
            {[['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl'],
              ['top-0 right-0 border-t-4 border-r-4 rounded-tr-xl'],
              ['bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl'],
              ['bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'],
            ].map(([cls], i) => (
              <div key={i} className={`absolute w-6 h-6 ${detected ? 'border-green-400' : 'border-gold'} transition-colors duration-300 ${cls}`} />
            ))}
            {!detected && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gold/60 animate-scan-line" />
            )}
          </div>
        </div>

        {detected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500/90 rounded-full w-16 h-16 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 290px 180px at center, transparent 80%, rgba(0,0,0,0.65) 100%)'
        }} />
      </div>

      <div className="px-4 py-5">
        {scanError ? (
          <div className="text-amber-400 text-sm text-center bg-white/10 rounded-xl px-4 py-3 mb-3">{scanError}</div>
        ) : (
          <p className="text-white/40 text-xs text-center mb-3">Posicione o código de barras dentro do quadro</p>
        )}
        <button onClick={onClose} className="w-full py-3 border border-white/20 text-white/60 rounded-xl text-sm font-semibold">
          Digitar manualmente
        </button>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function CncPage() {
  const [maquina, setMaquina] = useState('');
  const [peca, setPeca] = useState('');
  const [obra, setObra] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [operadorOpt, setOperadorOpt] = useState('');
  const [operadorCustom, setOperadorCustom] = useState('');
  const operador = operadorOpt === 'Outro' ? operadorCustom.trim() : operadorOpt;
  const [submitting, setSubmitting] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedFrom, setScannedFrom] = useState(null);
  const [ativos, setAtivos] = useState({ CNC: null, Seccionadora: null });
  const [loadingAtivos, setLoadingAtivos] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const fetchAtivos = useCallback(async () => {
    setLoadingAtivos(true);
    try {
      const r = await fetch('/api/cnc-ativo');
      const d = await r.json();
      setAtivos(d);
    } catch {
      setAtivos({ CNC: null, Seccionadora: null });
    } finally {
      setLoadingAtivos(false);
    }
  }, []);

  useEffect(() => { fetchAtivos(); }, [fetchAtivos]);

  const corteAtivo = maquina ? ativos[maquina] : null;
  const canSubmit = maquina && peca.trim() && operador && !corteAtivo;

  const handleScan = useCallback((value) => {
    setPeca(value);
    setScannedFrom('scan');
    setScanning(false);
  }, []);

  const handleIniciar = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/cnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maquina, peca: peca.trim(), obra: obra.trim(), ambiente: ambiente.trim(), operador, status: 'Em corte' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      await fetch('/api/cnc-ativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maquina, corte: { id: data.id, peca: peca.trim(), obra: obra.trim(), ambiente: ambiente.trim(), operador, started_at: new Date().toISOString() } }),
      });

      await fetchAtivos();
      setSent(true);
    } catch {
      setError('Erro ao registrar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizar = async () => {
    if (!corteAtivo) return;
    setFinalizando(true);
    try {
      await fetch(`/api/cnc-ativo?maquina=${maquina}&id=${corteAtivo.id}`, { method: 'DELETE' });
      await fetchAtivos();
      showToast('Corte concluído!');
    } catch {
      showToast('Erro ao finalizar. Tente novamente.');
    } finally {
      setFinalizando(false);
    }
  };

  const reset = () => { setPeca(''); setObra(''); setAmbiente(''); setScannedFrom(null); setSent(false); setOperadorOpt(''); setOperadorCustom(''); };

  if (scanning) {
    return <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />;
  }

  if (sent) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-gold text-xl font-bold mb-2">Corte iniciado!</h1>
        <p className="text-white/50 text-sm mb-2 text-center">{maquina} · {peca}</p>
        {(obra || ambiente) && <p className="text-white/30 text-xs mb-10 text-center">{[obra, ambiente].filter(Boolean).join(' · ')}</p>}
        <button onClick={reset} className="px-8 py-3 bg-gold text-navy font-bold rounded-full mb-4">Novo registro</button>
        <Link href="/" className="text-white/30 text-sm">Voltar ao início</Link>
      </main>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f4f6]">
      <header className="sticky top-0 z-40 bg-navy px-4 py-3.5 flex items-center gap-3 shadow-lg">
        <Link href="/" className="text-white/60 mr-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </Link>
        <div>
          <div className="text-white font-semibold text-sm leading-none">Corte CNC / Seccionadora</div>
          <div className="text-white/40 text-[11px] mt-0.5">Registro de corte</div>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* Máquina */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Máquina</label>
          <div className="flex gap-2">
            {MAQUINAS.map((m) => (
              <button key={m} onClick={() => setMaquina(m)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${maquina === m ? 'border-navy bg-navy text-gold' : 'border-gray-200 bg-white text-gray-500'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Lock banner — corte ativo */}
        {maquina && !loadingAtivos && corteAtivo && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <span className="text-amber-700 font-bold text-sm">Corte em andamento</span>
            </div>
            <div className="space-y-1 mb-4">
              <p className="text-sm font-semibold text-gray-800">{corteAtivo.peca}</p>
              {(corteAtivo.obra || corteAtivo.ambiente) && (
                <p className="text-xs text-gray-500">{[corteAtivo.obra, corteAtivo.ambiente].filter(Boolean).join(' · ')}</p>
              )}
              <p className="text-xs text-gray-400">Operador: {corteAtivo.operador}</p>
              {corteAtivo.started_at && (
                <p className="text-xs text-gray-400">Início: {new Date(corteAtivo.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
            <p className="text-xs text-amber-600 mb-3">Finalize este corte antes de iniciar outro.</p>
            <button onClick={handleFinalizar} disabled={finalizando}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${finalizando ? 'bg-gray-200 text-gray-400' : 'bg-amber-500 text-white active:opacity-80'}`}>
              {finalizando ? 'Finalizando...' : 'Marcar como Concluído'}
            </button>
          </div>
        )}

        {/* Formulário */}
        {maquina && !corteAtivo && (
          <>
            {/* Peça — com scanner */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Peça / Arquivo</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input value={peca} onChange={(e) => { setPeca(e.target.value); setScannedFrom(null); }}
                    placeholder="Ex: Porta 600x700 MDF BP..."
                    className={`w-full border-2 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-gold pr-10 ${scannedFrom === 'scan' ? 'border-green-400' : 'border-gray-200'}`} />
                  {scannedFrom === 'scan' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </div>
                <button onClick={() => setScanning(true)}
                  title="Escanear código de barras"
                  className="flex-shrink-0 w-12 h-12 bg-navy rounded-xl flex items-center justify-center active:opacity-70 transition-opacity">
                  <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4" />
                    <path d="M7 8v8M10 8v8M13 8v8M16 8v8" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
              {scannedFrom === 'scan' && (
                <p className="text-[10px] text-green-600 mt-1 px-1">Lido por código de barras · toque para editar</p>
              )}
            </div>

            {/* Obra + Ambiente */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Cliente / Obra</label>
                <input value={obra} onChange={(e) => setObra(e.target.value)}
                  placeholder="Ex: Residência Silva"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:border-gold" />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Ambiente</label>
                <input value={ambiente} onChange={(e) => setAmbiente(e.target.value)}
                  placeholder="Ex: Cozinha"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:border-gold" />
              </div>
            </div>

            {/* Operador */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Operador</label>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-2">
                {[...OPERADORES_FIXOS, 'Outro'].map((m) => (
                  <button key={m} onClick={() => setOperadorOpt(m)}
                    className={`w-full text-left px-4 py-3.5 text-sm font-medium border-b last:border-0 border-gray-100 transition-colors ${operadorOpt === m ? 'bg-navy text-gold font-bold' : 'text-gray-800'}`}>
                    {m}
                  </button>
                ))}
              </div>
              {operadorOpt === 'Outro' && (
                <input value={operadorCustom} onChange={(e) => setOperadorCustom(e.target.value)}
                  placeholder="Nome do operador..."
                  autoFocus
                  className="w-full border-2 border-gold rounded-xl px-4 py-3 text-sm bg-white focus:outline-none" />
              )}
            </div>
          </>
        )}

        {loadingAtivos && maquina && (
          <div className="text-center py-8 text-sm text-gray-400">Verificando máquina...</div>
        )}
      </div>

      {!corteAtivo && (
        <div className="sticky bottom-0 p-4 bg-[#f4f4f6] border-t border-gray-200">
          {error && <p className="text-red-500 text-xs text-center mb-2">{error}</p>}
          <button onClick={handleIniciar} disabled={!canSubmit || submitting}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${canSubmit && !submitting ? 'bg-gold text-navy active:opacity-80' : 'bg-gray-200 text-gray-400'}`}>
            {submitting ? 'Registrando...' : 'Iniciar corte'}
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
