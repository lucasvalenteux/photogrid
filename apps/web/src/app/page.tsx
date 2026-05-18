import { Benefits } from '@/components/marketing/benefits';
import { CtaFinal } from '@/components/marketing/cta-final';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <Benefits />
        <HowItWorks />
        <CtaFinal />
      </main>
      <MarketingFooter />
    </>
  );
}
