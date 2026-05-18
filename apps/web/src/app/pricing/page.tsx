import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';

export const metadata: Metadata = {
  title: 'Preços',
  description: 'Comece grátis. Atualize quando crescer.',
};

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="container-app py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Comece grátis. Cresça quando quiser.
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            Em breve mais detalhes. Por enquanto, todas as funcionalidades estão liberadas
            durante o beta.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href={ROUTES.login}>Começar grátis</Link>
            </Button>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
