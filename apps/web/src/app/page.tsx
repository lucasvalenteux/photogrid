import { Benefits } from '@/components/marketing/benefits';
import { CtaFinal } from '@/components/marketing/cta-final';
import { Hero } from '@/components/marketing/hero';
import { HomeRedirectGate } from '@/components/marketing/home-redirect-gate';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';

export default function HomePage() {
  return (
    <>
      <HomeRedirectGate />
      <MarketingNav />
      <main>
        <Hero />
        <Benefits />
        <CtaFinal />
      </main>
      <MarketingFooter />
    </>
  );
}
