'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProjetosPage() {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    fetch('/api/obras')
      .then((r) => r.json())
      .then((d) => setObras(Array.isArray(d) ? d : []))
      .catch(() => setObras([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh flex flex-col bg-navy">
      <header className="sticky top-0 z-40 bg-navy px-4 py-3.5 flex items-center gap-3 shadow-lg border-b border-white/10">
        <Link href="/" className="text-white/60">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="text-white font-bold text-sm tracking-wide">PROJETOS</div>
        <div className="ml-auto text-white/30 text-xs">{obras.length} ativo{obras.length !== 1 ? 's' : ''}</div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="text-white/30 text-sm">Carregando...</span>
          </div>
        )}

        {!loading && obras.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <span className="text-white/30 text-sm">Nenhum projeto ativo.</span>
          </div>
        )}

        {!loading && obras.length > 0 && (
          <div className="p-4 space-y-2">
            {obras.map((obra) => {
              const isOpen = aberto === obra.id;
              return (
                <div key={obra.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setAberto(isOpen ? null : obra.id)}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-[15px] truncate">{obra.nome}</div>
                      {obra.prazo && (
                        <div className="text-white/40 text-xs mt-0.5">
                          Prazo: {new Date(obra.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                    {obra.equipe?.length > 0 && (
                      <span className="text-white/30 text-xs flex-shrink-0">{obra.equipe.length} pessoa{obra.equipe.length !== 1 ? 's' : ''}</span>
                    )}
                    <svg className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-4">
                      {/* Equipe */}
                      <div>
                        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Equipe na obra</p>
                        {obra.equipe?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {obra.equipe.map((eq) => (
                              <span key={eq} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gold/20 text-gold border border-gold/30">{eq}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/30 text-xs italic">Nenhuma equipe escalada.</p>
                        )}
                      </div>

                      {/* Ambientes */}
                      {obra.ambientes?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Ambientes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {obra.ambientes.map((a) => (
                              <span key={a.id || a.nome} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/60">{a.nome}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
