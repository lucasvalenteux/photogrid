'use client';

import * as React from 'react';
import { Check, Lock } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@photogrid/ui';

/**
 * "Planos" card rendered at the bottom of /dashboard/settings.
 *
 * Today there's a single live plan (Free). The Pro and Studio entries
 * are placeholder cards rendered locked + dimmed so the photographer
 * sees the roadmap and so we don't have to scramble layout later.
 *
 * When we wire real paid plans, the only changes needed are:
 *   - lift `current` from the persisted studio doc (e.g. studio.plan)
 *   - flip `comingSoon` to false
 *   - hook the "Mudar de plano" button to a checkout/upgrade flow
 */

interface PlanRow {
  id: 'free' | 'pro' | 'studio';
  name: string;
  price: string;
  description: string;
  features: string[];
  comingSoon?: boolean;
}

const PLANS: PlanRow[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 'R$ 0',
    description: 'Comece sem fricção. Tudo o que o Photogrid faz hoje.',
    features: [
      'Galerias e álbuns ilimitados',
      'Loja pública em photogrid.store/seu-nome',
      'Detecção de pessoas com sugestões de álbum',
      'Proteção anti-IA, marca d\u2019água e bloqueio de print',
      'Pix manual para receber das vendas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Em breve',
    description: 'Para quem trafega muitas galerias por mês.',
    features: [
      'Cobrança automática (Pagar.me / Mercado Pago)',
      'Domínio próprio (seuestudio.com.br)',
      'Relatórios de venda por galeria',
      'Marca personalizada no checkout',
    ],
    comingSoon: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 'Em breve',
    description: 'Estúdios com múltiplos fotógrafos e equipe.',
    features: [
      'Usuários adicionais com permissões',
      'Integração com laboratórios de impressão',
      'Contratos digitais e termos de uso',
      'Suporte prioritário',
    ],
    comingSoon: true,
  },
];

interface PlansCardProps {
  /**
   * Plan id the studio is currently on. Defaults to `'free'` since we
   * haven't shipped paid tiers yet and no studio docs carry the field.
   */
  current?: 'free' | 'pro' | 'studio';
}

export function PlansCard({ current = 'free' }: PlansCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planos</CardTitle>
        <CardDescription>
          Você está no plano gratuito. Em breve teremos planos pagos com
          ferramentas avançadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCardItem
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === current}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface PlanCardItemProps {
  plan: PlanRow;
  isCurrent: boolean;
}

function PlanCardItem({ plan, isCurrent }: PlanCardItemProps) {
  const locked = plan.comingSoon && !isCurrent;

  return (
    <div
      className={cn(
        'relative flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors',
        isCurrent
          ? 'border-brand-300 bg-brand-50/40 ring-1 ring-inset ring-brand-200'
          : 'border-border bg-card',
        locked && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">{plan.description}</p>
        </div>
        {isCurrent ? <Badge variant="brand">Atual</Badge> : null}
        {locked ? <Badge variant="outline">em breve</Badge> : null}
      </div>

      <p className="text-lg font-semibold tracking-tight text-ink">
        {plan.price}
        {plan.id === 'free' ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            / sempre
          </span>
        ) : null}
      </p>

      <ul className="mt-1 space-y-1.5 text-xs text-foreground">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            {locked ? (
              <Lock
                aria-hidden="true"
                className="mt-0.5 size-3 shrink-0 text-muted-foreground"
              />
            ) : (
              <Check
                aria-hidden="true"
                className="mt-0.5 size-3 shrink-0 text-brand-500"
              />
            )}
            <span className={cn(locked && 'text-muted-foreground')}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
