import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-3xl font-semibold tracking-tight">Panel SDM AMADEUS</div>
      <div className="max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Dashboard principal en construcción. Ya puedes revisar el Dashboard Ejecutivo.
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/executive">Abrir Dashboard Ejecutivo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/captura">Captura diaria (Sadama / Amadeus)</Link>
        </Button>
      </div>
    </main>
  );
}
