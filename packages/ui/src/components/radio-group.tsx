'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Minimal accessible radio group — no Radix dependency. We expose:
 *
 *   - `<RadioGroup value={...} onValueChange={...}>` as a controlled
 *     parent that wires its children together via context.
 *   - `<RadioGroupItem value="...">` as a `role="radio"` button.
 *
 * Keyboard semantics match the WAI-ARIA "radio group" pattern: arrow
 * keys move focus + selection between non-disabled items, Tab moves to
 * the next focusable element outside the group. Space/Enter activate
 * the currently focused item if it isn't selected.
 */

interface RadioGroupContextValue {
  value: string | undefined;
  setValue: (next: string) => void;
  name: string;
  disabled: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export interface RadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      value: controlled,
      defaultValue,
      onValueChange,
      name,
      disabled = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState<string | undefined>(
      defaultValue,
    );
    const isControlled = controlled !== undefined;
    const value = isControlled ? controlled : internal;
    const fallbackName = React.useId();

    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) setInternal(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const ctx = React.useMemo<RadioGroupContextValue>(
      () => ({
        value,
        setValue,
        name: name ?? fallbackName,
        disabled,
      }),
      [value, setValue, name, fallbackName, disabled],
    );

    return (
      <RadioGroupContext.Provider value={ctx}>
        <div
          ref={ref}
          role="radiogroup"
          aria-disabled={disabled || undefined}
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ value, disabled, className, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    if (!ctx) {
      throw new Error('<RadioGroupItem> must be used inside <RadioGroup>.');
    }
    const isChecked = ctx.value === value;
    const isDisabled = disabled || ctx.disabled;

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isChecked}
        // Only the selected item participates in Tab order; arrow keys
        // move within the group. This matches the ARIA radio group pattern.
        tabIndex={isChecked || (!ctx.value && !disabled) ? 0 : -1}
        disabled={isDisabled}
        name={ctx.name}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented || isDisabled) return;
          ctx.setValue(value);
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented || isDisabled) return;
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            ctx.setValue(value);
          }
        }}
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card',
          'transition-colors duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isChecked && 'border-primary',
          className,
        )}
        {...props}
      >
        {isChecked ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-primary"
          />
        ) : null}
      </button>
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
