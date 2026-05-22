'use client';

import * as React from 'react';
import { Eye, EyeOff, Link as LinkIcon, Lock, ScanFace } from 'lucide-react';

import {
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
  VISIBILITY_LEVELS,
  type Visibility,
} from '@photogrid/config';
import { cn } from '@photogrid/ui';

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (next: Visibility) => void;
  disabled?: boolean;
  /** Customise the surrounding label text — useful per-entity (galeria / álbum). */
  label?: string;
  /** Defaults to all levels; albums pass `ALBUM_VISIBILITY_LEVELS`. */
  levels?: readonly Visibility[];
}

const ICONS: Record<Visibility, React.ComponentType<{ className?: string }>> = {
  public: Eye,
  unlisted: LinkIcon,
  face_gated: ScanFace,
  private: Lock,
};

/**
 * Radio-card selector for the three visibility levels. Inline keyboard
 * navigation: each card is a real radio input behind the scenes, so arrow
 * keys / tab order behave as expected. Visually it presents as a stack of
 * clickable tiles with title + description + icon.
 */
export function VisibilitySelector({
  value,
  onChange,
  disabled,
  label = 'Visibilidade',
  levels = VISIBILITY_LEVELS,
}: VisibilitySelectorProps) {
  const name = React.useId();

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2">
        {levels.map((level) => {
          const Icon = ICONS[level] ?? EyeOff;
          const checked = value === level;
          return (
            <label
              key={level}
              className={cn(
                'group relative flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors',
                'hover:border-brand-500/60 hover:bg-brand-50/40',
                checked
                  ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/40'
                  : 'border-border',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={checked}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              <span
                className={cn(
                  'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                  checked
                    ? 'bg-brand-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {VISIBILITY_LABELS[level]}
                </span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {VISIBILITY_DESCRIPTIONS[level]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface VisibilityBadgeProps {
  visibility: Visibility;
  className?: string;
}

/**
 * Compact pill, used on dashboard cards/headers to surface the level at a
 * glance without taking much visual weight.
 */
export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  const Icon = ICONS[visibility] ?? EyeOff;
  const tone =
    visibility === 'public'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : visibility === 'unlisted'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : visibility === 'face_gated'
          ? 'bg-brand-50 text-brand-700 ring-brand-200'
          : 'bg-slate-100 text-slate-700 ring-slate-300';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tone,
        className,
      )}
    >
      <Icon className="size-3" />
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}
