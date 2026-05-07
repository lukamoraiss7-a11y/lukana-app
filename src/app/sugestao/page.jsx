'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SugestaoPage() {
  const [nome,  setNome]  = useState('');
  const [texto, setTexto] = useState('');
  const [sent,  setSent]  = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!nome.trim() || !texto.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'sugestao', texto: texto.trim(), autor: nome.trim() }),
      });
      setSent(true);
    } catch { alert('Erro ao enviar. Tente novamente.'); }
    setSaving(false);
  };

  if (sent) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="w-14 h-14 text-gold mb-5">
          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>
        <p className="text-white font-bold text-lg mb-2">Sugestão enviada!</p>
        <p className="text-white/40 text-sm mb-8 text-center">Obrigado, {nome}. A liderança vai receber.</p>
        <Link href="/" className="px-6 py-3 bg-gold text-navy font-bold rounded-xl text-sm">Voltar ao início</Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col p-6 bg-navy pt-16">
      <Link href="/" className="text-white/30 text-xs mb-8 inline-block">← Voltar</Link>
      <h1 className="text-white font-bold text-xl mb-1">Sugestão de melhoria</h1>
      <p className="text-white/40 text-sm mb-8">Anônimo ou com nome — vai direto pra liderança.</p>

      <div className="space-y-3 max-w-sm w-full">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome (opcional)"
          autoCapitalize="words"
          className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="O que você mudaria? Processo, ferramenta, comunicação, ambiente..."
          className="w-full px-4 py-3.5 rounded-xl text-sm bg-white/10 text-white border border-white/20 placeholder:text-white/30 focus:outline-none focus:border-gold resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!texto.trim() || saving}
          className="w-full py-3.5 bg-gold text-navy font-bold rounded-xl disabled:opacity-40"
        >
          {saving ? 'Enviando...' : 'Enviar sugestão'}
        </button>
      </div>
    </main>
  );
}
