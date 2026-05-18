import { MyPurchasesClient } from './my-purchases-client';

interface Props {
  searchParams: Promise<{ phone?: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Minhas compras',
};

/**
 * Customer self-service entry point — no auth, lookup by phone.
 * The phone-input form lives here so a deep link like
 * `/minhas-compras?phone=+5511…` (sent from the checkout) can skip
 * straight to the result.
 */
export default async function MyPurchasesPage({ searchParams }: Props) {
  const { phone } = await searchParams;
  return <MyPurchasesClient initialPhone={phone ?? null} />;
}
