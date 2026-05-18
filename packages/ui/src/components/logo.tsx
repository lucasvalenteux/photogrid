import * as React from 'react';
import { cn } from '../lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show the wordmark next to the glyph. */
  withWordmark?: boolean;
  /** Size of the glyph in px. Defaults to 24. */
  size?: number;
}

/**
 * Photogrid wordmark + glyph. Pure SVG, monochrome-friendly via currentColor.
 * Uses the brand magenta only on the accent dot.
 */
export const Logo = React.forwardRef<HTMLSpanElement, LogoProps>(
  ({ className, withWordmark = true, size = 24, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('inline-flex items-center gap-2 text-ink', className)}
        aria-label="Photogrid"
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" />
          <rect x="13" y="2" width="9" height="9" rx="2" fill="currentColor" opacity="0.35" />
          <rect x="2" y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.55" />
          <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--color-brand-500)" />
        </svg>
        {withWordmark ? (
          <span className="text-base font-semibold tracking-tight">Photogrid</span>
        ) : null}
      </span>
    );
  },
);
Logo.displayName = 'Logo';
