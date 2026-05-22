'use client';

import * as React from 'react';
import { Building2, Edit3, TestTube2, Trash2 } from 'lucide-react';

import { APP_DOMAIN } from '@photogrid/config';
import { Badge, Button, Card, Skeleton, cn } from '@photogrid/ui';

import { dateLabel, formatBytes, formatCount, isTestStudio } from '@/lib/admin/format';
import {
  resolveStudioOwnerEmail,
  type StudioAdminDetail,
} from '@/lib/admin/metrics';
import { formatCents } from '@/lib/format/currency';
import type { AccountAccessLogDoc, StudioDoc, UserDoc } from '@/types';

interface AdminStudiosSectionProps {
  loading: boolean;
  studios: StudioAdminDetail[];
  users: UserDoc[];
  accessLogs: AccountAccessLogDoc[];
  onEdit: (studio: StudioDoc) => void;
  onDelete: (detail: StudioAdminDetail) => void;
}

export function AdminStudiosSection({
  loading,
  studios,
  users,
  accessLogs,
  onEdit,
  onDelete,
}: AdminStudiosSectionProps) {
  const [filter, setFilter] = React.useState<'all' | 'production' | 'test'>('all');
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return studios.filter((row) => {
      if (filter === 'production' && isTestStudio(row.studio)) return false;
      if (filter === 'test' && !isTestStudio(row.studio)) return false;
      if (!q) return true;
      const ownerEmail = resolveStudioOwnerEmail(
        row.owner,
        row.studio.ownerId,
        row.studio.id,
        users,
        accessLogs,
      ).toLowerCase();
      return (
        row.studio.name.toLowerCase().includes(q) ||
        row.studio.slug.toLowerCase().includes(q) ||
        ownerEmail.includes(q)
      );
    });
  }, [accessLogs, filter, query, studios, users]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Estúdios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão compacta por conta — expanda detalhes no painel de contas.
          </p>
        </div>
        <Badge variant="brand">{formatCount(studios.length)}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Todos
        </FilterChip>
        <FilterChip active={filter === 'production'} onClick={() => setFilter('production')}>
          Produção
        </FilterChip>
        <FilterChip active={filter === 'test'} onClick={() => setFilter('test')}>
          Teste
        </FilterChip>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nome, slug ou email…"
          className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum estúdio encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Estúdio</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Conteúdo</th>
                  <th className="px-4 py-3 font-medium">Vendas</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Loja</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  const ownerEmail = resolveStudioOwnerEmail(
                    row.owner,
                    row.studio.ownerId,
                    row.studio.id,
                    users,
                    accessLogs,
                  );
                  return (
                    <tr key={row.studio.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {row.studio.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.studio.logoUrl}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Building2 className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {row.studio.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dateLabel(row.studio.createdAt)}
                              {isTestStudio(row.studio) ? (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800"
                                >
                                  Teste
                                </Badge>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p className="max-w-[200px] truncate" title={ownerEmail}>
                          {ownerEmail}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatCount(row.galleries)} gal · {formatCount(row.albums)} álb ·{' '}
                        {formatCount(row.photos)} fotos
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">
                          {formatCents(row.revenueCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCount(row.paidOrders)} pagos
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatBytes(row.storageBytes)}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://${APP_DOMAIN}/${row.studio.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-brand-700 hover:underline"
                        >
                          /{row.studio.slug}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(row.studio)}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => onDelete(row)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
