'use client';

import {
  Building2,
  Cloud,
  Database,
  Gauge,
  ImageIcon,
  Server,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Badge, Card, Skeleton } from '@photogrid/ui';

import { formatBytes, formatCount, formatPercent } from '@/lib/admin/format';
import type { PlatformOverview } from '@/lib/admin/metrics';
import { formatCents } from '@/lib/format/currency';

interface AdminOverviewSectionProps {
  loading: boolean;
  overview: PlatformOverview | null;
}

export function AdminOverviewSection({ loading, overview }: AdminOverviewSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Resumo da ferramenta
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Produção em tempo real — estúdios de teste ficam fora das métricas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita"
          value={loading || !overview ? null : formatCents(overview.revenueCents)}
          hint={loading || !overview ? '' : `${formatCents(overview.pendingCents)} a receber`}
          icon={Wallet}
        />
        <KpiCard
          label="Contas"
          value={loading || !overview ? null : formatCount(overview.productionUsers)}
          hint={
            loading || !overview
              ? ''
              : `${formatCount(overview.activeAccounts7d)} ativas · 7d`
          }
          icon={Users}
        />
        <KpiCard
          label="Estúdios"
          value={loading || !overview ? null : formatCount(overview.productionStudios)}
          hint={loading || !overview ? '' : `${formatCount(overview.testStudios)} teste`}
          icon={Building2}
        />
        <KpiCard
          label="Fotos"
          value={loading || !overview ? null : formatCount(overview.photos)}
          hint={loading || !overview ? '' : formatBytes(overview.storageBytes)}
          icon={ImageIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Produto e vendas</h3>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <InlineStat
              label="Galerias"
              value={loading || !overview ? null : formatCount(overview.galleries)}
            />
            <InlineStat
              label="Álbuns"
              value={loading || !overview ? null : formatCount(overview.albums)}
            />
            <InlineStat
              label="Clientes"
              value={loading || !overview ? null : formatCount(overview.clients)}
            />
            <InlineStat
              label="Acessos log"
              value={loading || !overview ? null : formatCount(overview.totalAccessEvents)}
            />
            <InlineStat
              label="Pedidos"
              value={loading || !overview ? null : formatCount(overview.orders)}
            />
            <InlineStat
              label="Pagos"
              value={loading || !overview ? null : formatCount(overview.paidOrders)}
            />
            <InlineStat
              label="Pendentes"
              value={loading || !overview ? null : formatCount(overview.pendingOrders)}
            />
            <InlineStat
              label="Conversão"
              value={
                loading || !overview ? null : formatPercent(overview.conversionRate)
              }
            />
          </div>
        </Card>

        <OperationsPanel loading={loading} overview={overview} />
      </div>
    </section>
  );
}

function OperationsPanel({
  loading,
  overview,
}: {
  loading: boolean;
  overview: PlatformOverview | null;
}) {
  const rows = [
    {
      icon: Database,
      title: 'Firestore',
      value:
        loading || !overview
          ? null
          : `${formatCount(overview.firestoreDocs)} docs`,
      status: 'Conectado' as const,
    },
    {
      icon: Cloud,
      title: 'Storage',
      value: loading || !overview ? null : formatBytes(overview.storageBytes),
      status: 'Estimado' as const,
    },
    {
      icon: Server,
      title: 'Railway',
      value: 'Pendente',
      status: 'Pendente' as const,
    },
    {
      icon: Gauge,
      title: 'Vercel',
      value: 'Pendente',
      status: 'Pendente' as const,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Consumo e operação</h3>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.title} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <row.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground">{row.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {row.value === null ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span className="text-xs font-medium tabular-nums text-ink">
                  {row.value}
                </span>
              )}
              <Badge
                variant={row.status === 'Conectado' ? 'success' : 'outline'}
                className="text-[10px]"
              >
                {row.status}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 border-t border-border bg-muted/30 text-center text-xs">
        <FooterKpi
          label="Pagos"
          value={loading || !overview ? '—' : formatCount(overview.paidOrders)}
        />
        <FooterKpi
          label="Pendes."
          value={loading || !overview ? '—' : formatCount(overview.pendingOrders)}
        />
        <FooterKpi
          label="Carrinhos"
          value={loading || !overview ? '—' : formatCount(overview.cartOrders)}
        />
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </p>
      )}
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function InlineStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {value === null ? (
        <Skeleton className="mt-1.5 h-5 w-12" />
      ) : (
        <p className="mt-1 text-base font-semibold tabular-nums text-ink">{value}</p>
      )}
    </div>
  );
}

function FooterKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border px-2 py-2 last:border-r-0">
      <p className="font-semibold text-ink">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
