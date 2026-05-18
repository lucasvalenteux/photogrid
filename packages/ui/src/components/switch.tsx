'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Minimal accessible toggle switch — no Radix dependency. Behaves like a
 * controlled checkbox (`role="switch"`, `aria-checked`) so screen readers
 * and keyboards handle it correctly. Tab focus + Space/Enter toggle the
 * state via the underlying <button>.
 */
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible label for assistive tech when no visible <label> is wired in. */
  label?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, label, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented) return;
          onCheckedChange(!checked);
        }}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
          'transition-colors duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-muted',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-150 ease-out',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
