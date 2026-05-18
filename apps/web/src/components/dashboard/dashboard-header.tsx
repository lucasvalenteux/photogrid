'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { ROUTES } from '@photogrid/config';
import {
  Avatar,
  AvatarFallback,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@photogrid/ui';

import { signOut } from '@/lib/firebase/auth';
import { useAuth } from '@/lib/hooks/use-auth';

function initialsFromName(name: string | null | undefined, email: string | null | undefined) {
  const source = (name && name.trim()) || email || '';
  if (!source) return '?';
  const parts = source.split(/[\s@]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second || first || '?').toUpperCase();
}

export function DashboardHeader() {
  const router = useRouter();
  const { studio, user } = useAuth();

  const onSignOut = async () => {
    try {
      await signOut();
      router.replace(ROUTES.home);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível sair. Tente novamente.');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">Estúdio</span>
          <span className="text-sm font-semibold leading-none text-ink">
            {studio?.name ?? '—'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {studio ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <a
                  href={ROUTES.studio(studio.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  Ver loja
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir página pública</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sair"
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sair</TooltipContent>
        </Tooltip>

        <Avatar>
          <AvatarFallback>{initialsFromName(studio?.name, user?.email)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
