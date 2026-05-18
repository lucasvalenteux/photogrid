import { Users } from 'lucide-react';

import { EmptyState } from '@/components/dashboard/empty-state';

export default function ClientsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Clientes
        </h1>
      </header>

      <EmptyState
        icon={Users}
        title="Você ainda não tem clientes cadastrados."
        description="Conforme você compartilhar galerias, os clientes aparecerão aqui automaticamente."
      />
    </div>
  );
}
