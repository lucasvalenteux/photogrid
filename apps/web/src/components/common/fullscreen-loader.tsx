import { Logo } from '@photogrid/ui';

export function FullscreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex animate-pulse flex-col items-center gap-3">
        <Logo withWordmark={false} size={32} />
        <span className="text-xs font-medium text-muted-foreground">Carregando…</span>
      </div>
    </div>
  );
}
