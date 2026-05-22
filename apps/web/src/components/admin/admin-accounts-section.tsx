'use client';

import * as React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

import { isSystemAdmin } from '@/lib/admin/access';
import { Badge, Button, Card, Skeleton, cn } from '@photogrid/ui';

import { dateLabel, dateTimeLabel, formatCount } from '@/lib/admin/format';
import type { AccountAdminDetail } from '@/lib/admin/metrics';
import type { AccountAccessEvent } from '@/types';

const EVENT_LABELS: Record<AccountAccessEvent, string> = {
  login: 'Login',
  dashboard_view: 'Dashboard',
  admin_view: 'Admin',
  onboarding_view: 'Onboarding',
};

interface AdminAccountsSectionProps {
  loading: boolean;
  accounts: AccountAdminDetail[];
  onDelete: (account: AccountAdminDetail) => void;
}

export function AdminAccountsSection({
  loading,
  accounts,
  onDelete,
}: AdminAccountsSectionProps) {
  const [query, setQuery] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (row) =>
        row.displayEmail.toLowerCase().includes(q) ||
        row.user.email.toLowerCase().includes(q) ||
        (row.studio?.name ?? '').toLowerCase().includes(q) ||
        (row.studio?.slug ?? '').toLowerCase().includes(q),
    );
  }, [accounts, query]);

  const totalAccess = accounts.reduce((sum, row) => sum + row.accessCount, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Contas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Usuários, acessos e logs — clique na linha para ver detalhes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand">{formatCount(accounts.length)} contas</Badge>
          <Badge variant="outline">{formatCount(totalAccess)} acessos</Badge>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar email ou estúdio…"
        className="h-9 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm"
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma conta encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Estúdio</th>
                  <th className="px-3 py-3 font-medium">Acessos</th>
                  <th className="px-3 py-3 font-medium">Dias ativos</th>
                  <th className="px-3 py-3 font-medium">Último acesso</th>
                  <th className="px-3 py-3 font-medium">Criada em</th>
                  <th className="px-3 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  const expanded = expandedId === row.user.id;
                  const missingProfileEmail =
                    !row.user.email?.trim() &&
                    row.displayEmail.includes('@') &&
                    !row.displayEmail.startsWith('UID ');
                  const deleteBlocked =
                    isSystemAdmin(row.displayEmail) || isSystemAdmin(row.user.email);

                  return (
                    <React.Fragment key={row.user.id}>
                      <tr
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() =>
                          setExpandedId((current) =>
                            current === row.user.id ? null : row.user.id,
                          )
                        }
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          <ChevronDown
                            className={cn(
                              'size-4 transition-transform',
                              expanded && 'rotate-180',
                            )}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-[220px] truncate font-medium text-foreground">
                            {row.displayEmail}
                          </p>
                          {missingProfileEmail ? (
                            <p className="text-[11px] text-amber-700">
                              Email vindo dos logs de acesso
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {row.studio ? (
                            <span className="truncate">
                              {row.studio.name}
                              <span className="font-mono text-xs"> /{row.studio.slug}</span>
                            </span>
                          ) : (
                            <Badge variant="outline">Onboarding</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatCount(row.accessCount)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-muted-foreground">
                          {formatCount(row.uniqueAccessDays)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {dateTimeLabel(row.lastAccessAt)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {dateLabel(row.user.createdAt)}
                        </td>
                        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={deleteBlocked}
                            title={
                              deleteBlocked
                                ? 'Conta de administrador do sistema'
                                : 'Excluir conta'
                            }
                            onClick={() => onDelete(row)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-muted/15">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(EVENT_LABELS) as AccountAccessEvent[]).map(
                                (event) => (
                                  <Badge key={event} variant="outline" className="text-xs">
                                    {EVENT_LABELS[event]}:{' '}
                                    {formatCount(row.accessByEvent[event])}
                                  </Badge>
                                ),
                              )}
                            </div>
                            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Logs de acesso
                            </p>
                            {row.logs.length === 0 ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                Nenhum acesso registrado ainda.
                              </p>
                            ) : (
                              <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
                                <table className="w-full min-w-[520px] text-left text-xs">
                                  <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Quando</th>
                                      <th className="px-3 py-2 font-medium">Evento</th>
                                      <th className="px-3 py-2 font-medium">Rota</th>
                                      <th className="px-3 py-2 font-medium">Dispositivo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {row.logs.map((log) => (
                                      <tr key={log.id}>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {dateTimeLabel(log.createdAt)}
                                        </td>
                                        <td className="px-3 py-2">{EVENT_LABELS[log.event]}</td>
                                        <td className="px-3 py-2 font-mono text-muted-foreground">
                                          {log.path ?? '—'}
                                        </td>
                                        <td
                                          className="max-w-[180px] truncate px-3 py-2 text-muted-foreground"
                                          title={log.userAgent ?? undefined}
                                        >
                                          {shortUserAgent(log.userAgent)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
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

function shortUserAgent(value: string | null | undefined): string {
  if (!value) return '—';
  if (value.includes('iPhone')) return 'iPhone';
  if (value.includes('Android')) return 'Android';
  if (value.includes('Mac OS')) return 'Mac';
  if (value.includes('Windows')) return 'Windows';
  return value.slice(0, 36);
}
