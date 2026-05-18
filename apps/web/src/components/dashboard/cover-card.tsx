import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@photogrid/ui';

interface CoverCardProps {
  href: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  meta?: string;
  badges?: string[];
  /** Floating element rendered on the top-right of the cover (e.g. visibility pill). */
  topRight?: React.ReactNode;
  className?: string;
}

/**
 * A square-ish card used to represent an album or a session inside a list.
 * Optimised for browsing — large cover, single line of metadata, no clutter.
 */
export function CoverCard({
  href,
  title,
  subtitle,
  coverUrl,
  meta,
  badges,
  topRight,
  className,
}: CoverCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted">
        {coverUrl ? (
          // Plain <img>: the URLs come from Firebase Storage at runtime and the
          // domain is already whitelisted in next.config — but next/image's
          // strict remote loader still bristles at signed query params.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-line">
            <span className="text-xs font-medium uppercase tracking-wide text-mute">
              Sem capa ainda
            </span>
          </div>
        )}
        {topRight ? (
          <div className="absolute right-2 top-2">{topRight}</div>
        ) : null}
      </div>

      <div className="flex flex-1 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {meta ? <span>{meta}</span> : null}
            {badges?.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 translate-y-0.5 text-mute transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
