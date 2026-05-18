import { notFound } from 'next/navigation';

import { fetchPublicStudioBySlug } from '@/lib/services/public-service';

import { CartPageClient } from './cart-page-client';

interface Props {
  searchParams: Promise<{ studio?: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Carrinho',
};

/**
 * `/carrinho?studio=<slug>` — the cart page is a tenant-scoped
 * storefront surface. We resolve the studio server-side so the
 * client component can render the shell with the right branding +
 * Pix details, without exposing any auth or admin data.
 */
export default async function CartPage({ searchParams }: Props) {
  const { studio: slug } = await searchParams;
  if (!slug) notFound();
  const studio = await fetchPublicStudioBySlug(slug);
  if (!studio) notFound();
  return <CartPageClient studio={studio} />;
}
