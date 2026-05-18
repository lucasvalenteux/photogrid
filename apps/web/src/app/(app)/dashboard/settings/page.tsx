'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { APP_DOMAIN } from '@photogrid/config';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Label,
  Switch,
  cn,
} from '@photogrid/ui';

import { PaymentSettingsCard } from '@/components/dashboard/payment-settings-card';
import { PlansCard } from '@/components/dashboard/plans-card';
import { PricingSettingsCard } from '@/components/dashboard/pricing-settings-card';
import { StudioLogoUploader } from '@/components/dashboard/studio-logo-uploader';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  STOREFRONT_THEME_PRESETS,
  getStorefrontThemePreset,
  type StorefrontThemePreset,
} from '@/lib/storefront-themes';
import {
  updateStudioFaceClustering,
  updateStudioName,
  updateStudioPublicFaceSearch,
  updateStudioSecurity,
  updateStudioStorefrontTheme,
} from '@/lib/services/studio-service';
import {
  effectiveFaceClusteringEnabled,
  effectivePublicFaceSearchEnabled,
  effectiveStudioSecurity,
  type StorefrontThemeId,
} from '@/types';

type SecurityKey =
  | 'dimPhotos'
  | 'watermark'
  | 'disableRightClick'
  | 'screenshotShield'
  | 'protectCovers'
  | 'antiAi';

export default function SettingsPage() {
  const { studio, user } = useAuth();

  // Face-clustering toggle. We mirror the persisted value into local state
  // for instant visual feedback and roll it back if the Firestore write
  // fails. `effectiveFaceClusteringEnabled` defaults missing values to
  // true, matching the behaviour before the toggle existed.
  const persistedEnabled = effectiveFaceClusteringEnabled(studio);
  const [faceEnabled, setFaceEnabled] = React.useState(persistedEnabled);
  const [savingFace, setSavingFace] = React.useState(false);
  const persistedPublicFaceSearch = effectivePublicFaceSearchEnabled(studio);
  const [publicFaceSearchEnabled, setPublicFaceSearchEnabled] = React.useState(
    persistedPublicFaceSearch,
  );
  const [savingPublicFaceSearch, setSavingPublicFaceSearch] = React.useState(false);

  React.useEffect(() => {
    setFaceEnabled(persistedEnabled);
  }, [persistedEnabled]);
  React.useEffect(() => {
    setPublicFaceSearchEnabled(persistedPublicFaceSearch);
  }, [persistedPublicFaceSearch]);

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

  const onTogglePublicFaceSearch = async (next: boolean) => {
    if (!studio || savingPublicFaceSearch) return;
    setPublicFaceSearchEnabled(next);
    setSavingPublicFaceSearch(true);
    try {
      await updateStudioPublicFaceSearch(studio.id, next);
      toast.success(
        next
          ? 'Busca pública com detecção de face ativada.'
          : 'Busca pública com detecção de face desativada.',
      );
    } catch (error) {
      console.error('[settings] failed to update public face search flag', error);
      toast.error('Não foi possível salvar. Tente novamente.');
      setPublicFaceSearchEnabled(!next);
    } finally {
      setSavingPublicFaceSearch(false);
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
    screenshotShield: false,
    protectCovers: false,
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
    persistedSecurity.screenshotShield,
    persistedSecurity.protectCovers,
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

  // Editable studio name. We keep the input controlled and only flip the
  // Save button to enabled when the value actually changed — avoids
  // spurious writes when the user clicks in and out without typing.
  const [nameDraft, setNameDraft] = React.useState(studio?.name ?? '');
  const [savingName, setSavingName] = React.useState(false);
  React.useEffect(() => {
    setNameDraft(studio?.name ?? '');
  }, [studio?.name]);
  const nameDirty =
    Boolean(studio) && nameDraft.trim().length >= 2 && nameDraft.trim() !== studio?.name;

  const onSaveName = async () => {
    if (!studio || savingName || !nameDirty) return;
    setSavingName(true);
    try {
      await updateStudioName(studio.id, nameDraft);
      toast.success('Nome atualizado.');
    } catch (error) {
      console.error('[settings] failed to update studio name', error);
      const message =
        error instanceof Error ? error.message : 'Não foi possível salvar.';
      toast.error(message);
    } finally {
      setSavingName(false);
    }
  };

  const persistedTheme = getStorefrontThemePreset(studio?.storefrontTheme).id;
  const [theme, setTheme] = React.useState<StorefrontThemeId>(persistedTheme);
  const [savingTheme, setSavingTheme] = React.useState(false);
  React.useEffect(() => {
    setTheme(persistedTheme);
  }, [persistedTheme]);

  const onChangeTheme = async (next: StorefrontThemeId) => {
    if (!studio || savingTheme || next === theme) return;
    const previous = theme;
    setTheme(next);
    setSavingTheme(true);
    try {
      await updateStudioStorefrontTheme(studio.id, next);
      toast.success('Tema da loja atualizado.');
    } catch (error) {
      console.error('[settings] failed to update storefront theme', error);
      toast.error('Não foi possível salvar o tema.');
      setTheme(previous);
    } finally {
      setSavingTheme(false);
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
        <CardContent className="space-y-5">
          {studio ? <StudioLogoUploader studio={studio} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="studio-name">Nome</Label>
            <div className="flex items-center gap-2">
              <Input
                id="studio-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                disabled={!studio || savingName}
                placeholder="Nome do estúdio"
              />
              <Button
                size="sm"
                onClick={onSaveName}
                disabled={!nameDirty}
                loading={savingName}
              >
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="studio-slug">Endereço público</Label>
            <Input
              id="studio-slug"
              defaultValue={`${APP_DOMAIN}/${studio?.slug ?? ''}`}
              disabled
            />
          </div>

          <StorefrontThemePicker
            selected={theme}
            disabled={!studio || savingTheme}
            onChange={onChangeTheme}
          />
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

      {studio ? <PaymentSettingsCard studio={studio} /> : null}

      <PricingSettingsCard studio={studio} />

      <Card>
        <CardHeader>
          <CardTitle>Detecção de faces</CardTitle>
          <CardDescription>
            Agrupe automaticamente fotos com as mesmas pessoas e receba
            sugestões de álbuns dentro de cada galeria.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <div className="flex items-start justify-between gap-6 pb-4">
            <div className="space-y-1">
              <Label htmlFor="face-clustering" className="text-sm font-medium text-ink">
                Detectar faces na Galeria e recomendar albuns
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
              label="Detectar faces na Galeria e recomendar albuns"
            />
          </div>
          <div className="flex items-start justify-between gap-6 pt-4">
            <div className="space-y-1">
              <Label htmlFor="public-face-search" className="text-sm font-medium text-ink">
                Busca pública com detectação de face
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibe na loja pública um campo para o cliente subir uma foto de
                rosto e encontrar fotos e álbuns compatíveis.
              </p>
            </div>
            <Switch
              id="public-face-search"
              checked={publicFaceSearchEnabled}
              onCheckedChange={onTogglePublicFaceSearch}
              disabled={!studio || savingPublicFaceSearch || !faceEnabled}
              label="Busca pública com detectação de face"
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Visibilidade</CardTitle>
            <CardDescription>
              Proteções aplicadas às fotos no seu site público. Ative o que
              faz sentido para o seu fluxo de venda.
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Opções avançadas de visibilidade"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              <DropdownMenuLabel>Opções avançadas</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={security.protectCovers}
                disabled={!studio || savingSecurity.protectCovers}
                onCheckedChange={(next) =>
                  onToggleSecurity('protectCovers', next === true)
                }
              >
                Aplicar regras nas capas dos álbuns
              </DropdownMenuCheckboxItem>
              <p className="px-2 pb-2 pt-1 text-xs leading-5 text-muted-foreground">
                Desativado por padrão. Quando desligado, capas ficam limpas e
                as proteções valem apenas para fotos internas.
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
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
            id="security-screenshot"
            label="Dificultar capturas de tela"
            description="Ao detectar atalhos comuns de print ou impressão, cobre as fotos públicas com uma camada preta antes da captura sempre que o navegador permitir."
            checked={security.screenshotShield}
            disabled={!studio || savingSecurity.screenshotShield}
            onChange={(next) => onToggleSecurity('screenshotShield', next)}
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

      <PlansCard />
    </div>
  );
}

interface StorefrontThemePickerProps {
  selected: StorefrontThemeId;
  disabled?: boolean;
  onChange: (theme: StorefrontThemeId) => void;
}

function StorefrontThemePicker({
  selected,
  disabled,
  onChange,
}: StorefrontThemePickerProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium text-ink">Fundo da loja pública</Label>
        <p className="text-sm text-muted-foreground">
          Escolha uma cor ou degradê para personalizar o fundo da sua loja.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STOREFRONT_THEME_PRESETS.map((preset) => (
          <ThemeOption
            key={preset.id}
            preset={preset}
            selected={selected === preset.id}
            disabled={disabled}
            onSelect={() => onChange(preset.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeOption({
  preset,
  selected,
  disabled,
  onSelect,
}: {
  preset: StorefrontThemePreset;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group rounded-xl border bg-card p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-border',
      )}
    >
      <span
        className={cn(
          'block h-16 rounded-lg border border-black/5 shadow-inner',
          preset.swatchClassName,
        )}
        aria-hidden="true"
      />
      <span className="mt-2 block text-xs font-medium text-foreground">
        {preset.label}
      </span>
      <span className="block text-[11px] text-muted-foreground">
        {preset.description}
      </span>
    </button>
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
