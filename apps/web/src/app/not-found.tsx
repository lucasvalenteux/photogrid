import Link from 'next/link';

import { ROUTES } from '@photogrid/config';
import { Button, Logo } from '@photogrid/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="container-app flex h-16 items-center">
        <Link href={ROUTES.home} aria-label="Photogrid">
          <Logo />
        </Link>
      </header>
      <main className="container-app flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-mono text-sm text-brand-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          Página não encontrada
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A página que você tentou acessar não existe ou foi movida.
        </p>
        <Button asChild className="mt-8">
          <Link href={ROUTES.home}>Voltar para a home</Link>
        </Button>
      </main>
    </div>
  );
}
