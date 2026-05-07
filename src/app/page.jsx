import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-navy">
      <Link href="/" className="mb-12 text-center select-none">
        <img src="/logo.png" alt="Lukana Marcenaria" className="h-16 w-auto mb-4 brightness-0 invert sepia saturate-[3] hue-rotate-[5deg]" />
        <div className="text-white/40 text-sm">Operação diária</div>
      </Link>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <Link
          href="/ceo"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base bg-gold text-navy active:opacity-80 transition-opacity"
        >
          Sou Diretor
        </Link>
        <Link
          href="/login?next=/ceo&role=ariel"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base bg-gold/80 text-navy active:opacity-80 transition-opacity"
        >
          Head de Gestão
        </Link>
        <Link
          href="/gerente"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base text-white border-2 border-white/30 bg-white/5 active:opacity-80 transition-opacity"
        >
          Sou Gerente
        </Link>
        <Link
          href="/login?next=/coordenadores&role=coordenador_obra"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base text-white border-2 border-white/30 bg-white/5 active:opacity-80 transition-opacity"
        >
          Coord. de Obra
        </Link>
        <Link
          href="/login?next=/coordenadores&role=coordenador_projetos"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base text-white border-2 border-white/30 bg-white/5 active:opacity-80 transition-opacity"
        >
          Coord. de Projetos
        </Link>
        <Link
          href="/equipe"
          className="block w-full py-4 rounded-2xl text-center font-bold text-base text-white border-2 border-white/30 bg-white/5 active:opacity-80 transition-opacity"
        >
          Sou da Equipe
        </Link>

        <Link
          href="/projetos"
          className="block w-full py-3 rounded-2xl text-center font-semibold text-sm text-white/50 border border-white/10 bg-white/5 active:opacity-80 transition-opacity"
        >
          Projetos
        </Link>

        <div className="h-px bg-white/10 my-1" />

        <Link
          href="/material"
          className="block w-full py-3 rounded-2xl text-center font-semibold text-sm text-white/50 border border-white/10 bg-white/5 active:opacity-80 transition-opacity"
        >
          MATERIAL
        </Link>
        <Link
          href="/cnc"
          className="block w-full py-3 rounded-2xl text-center font-semibold text-sm text-white/50 border border-white/10 bg-white/5 active:opacity-80 transition-opacity"
        >
          Registrar Corte CNC / Seccionadora
        </Link>
        <Link
          href="/sugestao"
          className="block w-full py-3 rounded-2xl text-center font-semibold text-sm text-white/50 border border-white/10 bg-white/5 active:opacity-80 transition-opacity"
        >
          Sugestão de melhoria
        </Link>
      </div>
    </main>
  );
}
