'use client';

import * as React from 'react';
import { Gauge } from 'lucide-react';
import { toast } from 'sonner';

import {
  Badge,
  Card,
  Skeleton,
  Switch,
} from '@photogrid/ui';

import { updateHomeRedirectSetting } from '@/lib/services/platform-settings-service';

interface AdminPlatformSettingsProps {
  redirectHomeToAutoLogin: boolean;
  loading: boolean;
  error: boolean;
  adminEmail: string;
}

export function AdminPlatformSettings({
  redirectHomeToAutoLogin,
  loading,
  error,
  adminEmail,
}: AdminPlatformSettingsProps) {
  const [saving, setSaving] = React.useState(false);

  const onToggle = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateHomeRedirectSetting({
        enabled,
        updatedBy: adminEmail,
      });
      toast.success(
        enabled ? 'Home redirecionando para /login.' : 'Home pública reativada.',
      );
    } catch (updateError) {
      console.error('[admin] update platform settings error', updateError);
      toast.error('Não foi possível salvar a configuração.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                <Gauge className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Configurações gerais da ferramenta
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Controles globais da experiência pública do Photogrid.
                </p>
              </div>
            </div>
            {error ? (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700"
              >
                Erro ao carregar
              </Badge>
            ) : (
              <Badge variant="success">Ativo</Badge>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Redirecionar home para login automático
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Visitantes em{' '}
                  <span className="font-medium text-foreground">photogrid.store</span>{' '}
                  vão direto para a tela de login.
                </p>
              </div>
              {loading ? (
                <Skeleton className="h-6 w-11 rounded-full" />
              ) : (
                <Switch
                  checked={redirectHomeToAutoLogin}
                  onCheckedChange={onToggle}
                  disabled={saving || error}
                  label="Redirecionar home para login automático"
                />
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-ink p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-sm text-white/60">Status atual</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-36 bg-white/15" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {redirectHomeToAutoLogin ? 'Login direto' : 'Home pública'}
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-white/60">
            Use enquanto a operação ainda é fechada e o foco está em clientes
            já convidados.
          </p>
        </div>
      </div>
    </Card>
  );
}
