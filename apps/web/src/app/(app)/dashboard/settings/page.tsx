'use client';

import { APP_DOMAIN } from '@photogrid/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { useAuth } from '@/lib/hooks/use-auth';

export default function SettingsPage() {
  const { studio, user } = useAuth();

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
