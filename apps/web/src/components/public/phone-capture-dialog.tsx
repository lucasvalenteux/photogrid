'use client';

import * as React from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@photogrid/ui';

import { formatBrPhone, isValidBrPhone } from '@/lib/format/phone';

interface PhoneCaptureDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Resolves to true when the phone passed validation and was accepted. */
  onConfirm: (phone: string) => Promise<boolean>;
  /** Defaults to "Para acompanhar suas compras…" — checkout overrides it. */
  description?: string;
  /** Optional initial value (E.164 or formatted) — used by the checkout step to pre-fill. */
  initialValue?: string;
}

/**
 * Two-step UX: visitor adds something to cart → modal asks for the
 * phone → modal closes → item is persisted.
 *
 * The input mask is applied client-side as the user types (BR format
 * `(XX) 9XXXX-XXXX`); we accept both mobile (11 digits) and landline
 * (10 digits). `onConfirm` returns a boolean instead of throwing so we
 * can render a friendly inline error without surfacing exceptions.
 */
export function PhoneCaptureDialog({
  open,
  onOpenChange,
  onConfirm,
  description,
  initialValue,
}: PhoneCaptureDialogProps) {
  const [value, setValue] = React.useState(() => formatBrPhone(initialValue ?? ''));
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setValue(formatBrPhone(initialValue ?? ''));
    setError(null);
    setSubmitting(false);
    // Slight defer so Radix can finish opening before focus moves in.
    const handle = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(handle);
  }, [open, initialValue]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!isValidBrPhone(value)) {
      setError('Digite um celular ou telefone válido com DDD.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onConfirm(value);
      if (!ok) {
        setError('Não conseguimos registrar este número. Tente outro.');
        return;
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Qual é seu celular?</DialogTitle>
          <DialogDescription>
            {description ??
              'Vamos usar para você acompanhar a compra e receber os arquivos depois do pagamento.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cart-phone">Celular com DDD</Label>
            <Input
              id="cart-phone"
              ref={inputRef}
              inputMode="tel"
              autoComplete="tel"
              value={value}
              onChange={(event) => {
                setError(null);
                setValue(formatBrPhone(event.target.value));
              }}
              placeholder="(11) 99999-9999"
              disabled={submitting}
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Não enviamos spam — só usamos para confirmar pagamentos
                e liberar os arquivos.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
