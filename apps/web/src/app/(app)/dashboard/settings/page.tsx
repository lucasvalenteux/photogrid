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
import { updateStudioFaceClustering } from '@/lib/services/studio-service';
import { effectiveFaceClusteringEnabled } from '@/types';

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
            Como sua loja aparece para clientes e nos mecanismos de busca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}
