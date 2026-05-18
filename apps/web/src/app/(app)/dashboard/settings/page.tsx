'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { APP_DOMAIN } from '@photogrid/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';
import {
  updateStudioFaceClustering,
  updateStudioSecurity,
} from '@/lib/services/studio-service';
import {
  effectiveFaceClusteringEnabled,
  effectiveStudioSecurity,
} from '@/types';

type SecurityKey = 'dimPhotos' | 'watermark' | 'disableRightClick' | 'antiAi';

export default function SettingsPage() {
  const { studio, user } = useAuth();

  // Face-clustering toggle. We mirror the persisted value into local state
  // for instant visual feedback and roll it back if the Firestore write
  // fails. `effectiveFaceClusteringEnabled` defaults missing values to
  // true, matching the behaviour before the toggle existed.
  const persistedEnabled = effectiveFaceClusteringEnabled(studio);
  const [faceEnabled, setFaceEnabled] = React.useState(persistedEnabled);
  const [savingFace, setSavingFace] = React.useState(false);

  React.useEffect(() => {
    setFaceEnabled(persistedEnabled);
  }, [persistedEnabled]);

  const onToggleFace = async (next: boolean) => {
    if (!studio || savingFace) return;
    setFaceEnabled(next);
    setSavingFace(true);
    try {
      await updateStudioFaceClustering(studio.id, next);
      toast.success(
        next
          ? 'Detecção de faces ativada.'
          : 'Detecção de faces desativada.',
      );
    } catch (error) {
      console.error('[settings] failed to update face clustering flag', error);
      toast.error('Não foi possível salvar. Tente novamente.');
      setFaceEnabled(!next);
    } finally {
      setSavingFace(false);
    }
  };

  // Photo-protection toggles. We keep the local state per-key so each
  // switch can show an independent "busy" indicator without blocking the
  // others. Optimistic — the UI flips immediately and rolls back on
  // failure, the same pattern used for face clustering above.
  const persistedSecurity = effectiveStudioSecurity(studio);
  const [security, setSecurity] = React.useState(persistedSecurity);
  const [savingSecurity, setSavingSecurity] = React.useState<
    Record<SecurityKey, boolean>
  >({
    dimPhotos: false,
    watermark: false,
    disableRightClick: false,
    antiAi: false,
  });

  React.useEffect(() => {
    setSecurity(persistedSecurity);
    // We don't depend on the object identity (would loop) — flatten to
    // the boolean primitives so React skips spurious updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    persistedSecurity.dimPhotos,
    persistedSecurity.watermark,
    persistedSecurity.disableRightClick,
    persistedSecurity.antiAi,
  ]);

  const onToggleSecurity = async (key: SecurityKey, next: boolean) => {
    if (!studio || savingSecurity[key]) return;
    setSecurity((current) => ({ ...current, [key]: next }));
    setSavingSecurity((current) => ({ ...current, [key]: true }));
    try {
      await updateStudioSecurity(studio.id, key, next);
    } catch (error) {
      console.error('[settings] failed to update security flag', error);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSecurity((current) => ({ ...current, [key]: !next }));
    } finally {
      setSavingSecurity((current) => ({ ...current, [key]: false }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Configurações
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Estúdio</CardTitle>
          <CardDescription>Informações públicas do seu estúdio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="studio-name">Nome</Label>
            <Input id="studio-name" defaultValue={studio?.name ?? ''} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-slug">Endereço público</Label>
            <Input id="studio-slug" defaultValue={`${APP_DOMAIN}/${studio?.slug ?? ''}`} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>Informações da sua conta de acesso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" defaultValue={user?.email ?? ''} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detecção de faces</CardTitle>
          <CardDescription>
            Agrupe automaticamente fotos com as mesmas pessoas e receba
            sugestões de álbuns dentro de cada galeria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="face-clustering" className="text-sm font-medium text-ink">
                Ativar detecção de faces
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando desativado, novas fotos não são analisadas e nenhum
                álbum sugerido aparece na sua conta.
              </p>
            </div>
            <Switch
              id="face-clustering"
              checked={faceEnabled}
              onCheckedChange={onToggleFace}
              disabled={!studio || savingFace}
              label="Ativar detecção de faces"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Senha, sessões ativas e autenticação em duas etapas.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibilidade</CardTitle>
          <CardDescription>
            Proteções aplicadas às fotos no seu site público. Ative o que
            faz sentido para o seu fluxo de venda.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SecurityRow
            id="security-dim"
            label="Escurecer fotos"
            description="Aplica uma camada sutil em cima da foto para tornar o screenshot menos atraente."
            checked={security.dimPhotos}
            disabled={!studio || savingSecurity.dimPhotos}
            onChange={(next) => onToggleSecurity('dimPhotos', next)}
          />
          <SecurityRow
            id="security-watermark"
            label="Marca d'água com o nome do estúdio"
            description="Repete o nome do estúdio diagonalmente sobre cada foto."
            checked={security.watermark}
            disabled={!studio || savingSecurity.watermark}
            onChange={(next) => onToggleSecurity('watermark', next)}
          />
          <SecurityRow
            id="security-rightclick"
            label="Bloquear botão direito e download"
            description="Desativa o menu de contexto, o arraste do mouse e o link que abre a foto em alta resolução."
            checked={security.disableRightClick}
            disabled={!studio || savingSecurity.disableRightClick}
            onChange={(next) => onToggleSecurity('disableRightClick', next)}
          />
          <SecurityRow
            id="security-antiai"
            label="Proteção anti-IA"
            description="Sobrepõe uma camada de ruído quase imperceptível que gera artefatos quando alguém usa IA pra limpar ou recriar o print. Também sinaliza às IAs (GPTBot, Claude, Google-Extended, etc.) que o conteúdo não deve ser usado para treinamento."
            checked={security.antiAi}
            disabled={!studio || savingSecurity.antiAi}
            onChange={(next) => onToggleSecurity('antiAi', next)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface SecurityRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function SecurityRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: SecurityRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        label={label}
      />
    </div>
  );
}
