import { ShoppingBag } from 'lucide-react';

import { EmptyState } from '@/components/dashboard/empty-state';

export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pedidos
        </h1>
      </header>

      <EmptyState
        icon={ShoppingBag}
        title="Você ainda não recebeu pedidos."
        description="Quando alguém comprar suas fotos, o pedido aparecerá aqui."
      />
    </div>
  );
}
