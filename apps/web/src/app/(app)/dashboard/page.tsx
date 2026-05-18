'use client';

import { useRouter } from 'next/navigation';
import { Images } from 'lucide-react';

import { ROUTES } from '@photogrid/config';

import { EmptyState } from '@/components/dashboard/empty-state';
import { useAuth } from '@/lib/hooks/use-auth';

export default function DashboardPage() {
  const router = useRouter();
  const { studio } = useAuth();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Olá{studio?.name ? `, ${studio.name}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comece criando sua primeira galeria — onde você sobe todas as fotos de
          um cliente, escola ou evento e depois monta os álbuns para entregar.
        </p>
      </header>

      <EmptyState
        icon={Images}
        title="Você ainda não possui galerias."
        description="Crie uma galeria para subir suas fotos. Depois você monta álbuns selecionando as fotos para cada cliente."
        actionLabel="Ir para Galerias"
        onAction={() => router.push(ROUTES.galleries)}
      />
    </div>
  );
}
