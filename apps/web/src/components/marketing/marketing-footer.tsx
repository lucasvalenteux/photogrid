import Link from 'next/link';

import { APP_NAME, ROUTES } from '@photogrid/config';
import { Logo } from '@photogrid/ui';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-app flex flex-col items-center justify-between gap-6 py-10 md:flex-row">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.
          </span>
        </div>
        <nav className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link href={ROUTES.login} className="hover:text-foreground">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
