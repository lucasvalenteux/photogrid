'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { cpf, cnpj } from 'cpf-cnpj-validator';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  cn,
} from '@photogrid/ui';

import { updateStudioPayment } from '@/lib/services/studio-service';
import type {
  PaymentMethod,
  PixKeyType,
  StudioDoc,
  StudioPixSettings,
} from '@/types';

interface PaymentSettingsCardProps {
  studio: Pick<StudioDoc, 'id' | 'payment'>;
}

const KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'Email',
  phone: 'Telefone',
  random: 'Chave aleatória',
};

const KEY_TYPE_PLACEHOLDER: Record<PixKeyType, string> = {
  cpf: '123.456.789-00',
  cnpj: '12.345.678/0001-00',
  email: 'voce@exemplo.com',
  phone: '+5511999999999',
  random: '00000000-0000-0000-0000-000000000000',
};

// Limites do BR Code (EMV) — o payload Pix trunca silenciosamente
// se passar disso, então preferimos avisar o usuário antes.
const NAME_MAX = 25;
const CITY_MAX = 15;

interface PixFormState {
  keyType: PixKeyType;
  key: string;
  beneficiaryName: string;
  city: string;
}

const EMPTY_PIX: PixFormState = {
  keyType: 'cpf',
  key: '',
  beneficiaryName: '',
  city: '',
};

export function PaymentSettingsCard({ studio }: PaymentSettingsCardProps) {
  const persistedMethod: PaymentMethod = studio.payment?.method ?? 'pix';
  const [method, setMethod] = React.useState<PaymentMethod>(persistedMethod);
  const [pix, setPix] = React.useState<PixFormState>(() => ({
    ...EMPTY_PIX,
    ...studio.payment?.pix,
  }));
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof PixFormState, string>>>({});

  // Sync local state when the persisted doc changes (e.g. after a save
  // or a snapshot from another tab). We flatten the dependency list to
  // primitives so React skips spurious updates from a fresh object ref.
  const persistedPix = studio.payment?.pix;
  React.useEffect(() => {
    setMethod(studio.payment?.method ?? 'pix');
    setPix({ ...EMPTY_PIX, ...studio.payment?.pix });
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    studio.payment?.method,
    persistedPix?.keyType,
    persistedPix?.key,
    persistedPix?.beneficiaryName,
    persistedPix?.city,
  ]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof PixFormState, string>> = {};
    const trimmedKey = pix.key.trim();
    if (!trimmedKey) {
      next.key = 'Informe a chave Pix.';
    } else if (pix.keyType === 'cpf' && !cpf.isValid(trimmedKey)) {
      next.key = 'CPF inválido.';
    } else if (pix.keyType === 'cnpj' && !cnpj.isValid(trimmedKey)) {
      next.key = 'CNPJ inválido.';
    } else if (pix.keyType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedKey)) {
      next.key = 'Email inválido.';
    } else if (pix.keyType === 'phone' && !/^\+?\d{10,15}$/.test(trimmedKey.replace(/\D/g, '+'))) {
      // We accept either E.164 (+5511…) or local digits — strip everything
      // that isn't a digit or leading +. Banks normalise this same way.
      next.key = 'Telefone inválido. Use o formato +55DDDNNNNNNNNN.';
    } else if (
      pix.keyType === 'random' &&
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        trimmedKey,
      )
    ) {
      next.key = 'Chave aleatória inválida.';
    }

    const trimmedName = pix.beneficiaryName.trim();
    if (!trimmedName) {
      next.beneficiaryName = 'Informe o nome do beneficiário.';
    } else if (trimmedName.length > NAME_MAX) {
      next.beneficiaryName = `Máximo ${NAME_MAX} caracteres.`;
    }

    const trimmedCity = pix.city.trim();
    if (!trimmedCity) {
      next.city = 'Informe a cidade.';
    } else if (trimmedCity.length > CITY_MAX) {
      next.city = `Máximo ${CITY_MAX} caracteres.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (saving) return;
    if (method === 'pix' && !validate()) return;
    setSaving(true);
    try {
      const payment =
        method === 'pix'
          ? {
              method: 'pix' as const,
              pix: {
                keyType: pix.keyType,
                key: pix.key.trim(),
                beneficiaryName: pix.beneficiaryName.trim(),
                city: pix.city.trim(),
              } satisfies StudioPixSettings,
            }
          : { method: 'automatic' as const };
      await updateStudioPayment(studio.id, payment);
      toast.success('Pagamento atualizado.');
    } catch (error) {
      console.error('[payment] save failed', error);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento</CardTitle>
        <CardDescription>
          Como você quer receber pelas vendas das suas fotos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <RadioGroup
          value={method}
          onValueChange={(next) => setMethod(next as PaymentMethod)}
        >
          <PaymentOption
            id="payment-automatic"
            value="automatic"
            disabled
            title={
              <span className="inline-flex items-center gap-2">
                Cobrança automática
                <Badge variant="outline">em breve</Badge>
              </span>
            }
            description="Receba direto na sua conta via Pagar.me ou Mercado Pago. Sem repasse manual."
          />
          <PaymentOption
            id="payment-pix"
            value="pix"
            title="Pix"
            description="O cliente paga via QR Code / copia-e-cola no checkout."
          />
        </RadioGroup>

        {method === 'pix' ? (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pix-key-type">Tipo da chave</Label>
                <select
                  id="pix-key-type"
                  value={pix.keyType}
                  onChange={(event) =>
                    setPix((current) => ({
                      ...current,
                      keyType: event.target.value as PixKeyType,
                    }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(Object.keys(KEY_TYPE_LABEL) as PixKeyType[]).map((t) => (
                    <option key={t} value={t}>
                      {KEY_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix-key">Chave Pix</Label>
                <Input
                  id="pix-key"
                  value={pix.key}
                  onChange={(event) =>
                    setPix((current) => ({ ...current, key: event.target.value }))
                  }
                  placeholder={KEY_TYPE_PLACEHOLDER[pix.keyType]}
                  aria-invalid={Boolean(errors.key)}
                />
                {errors.key ? <FieldError message={errors.key} /> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pix-name">
                Nome do beneficiário{' '}
                <span className="text-xs text-muted-foreground">
                  ({pix.beneficiaryName.length}/{NAME_MAX})
                </span>
              </Label>
              <Input
                id="pix-name"
                value={pix.beneficiaryName}
                onChange={(event) =>
                  setPix((current) => ({
                    ...current,
                    beneficiaryName: event.target.value,
                  }))
                }
                maxLength={NAME_MAX}
                aria-invalid={Boolean(errors.beneficiaryName)}
              />
              {errors.beneficiaryName ? (
                <FieldError message={errors.beneficiaryName} />
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pix-city">
                Cidade{' '}
                <span className="text-xs text-muted-foreground">
                  ({pix.city.length}/{CITY_MAX})
                </span>
              </Label>
              <Input
                id="pix-city"
                value={pix.city}
                onChange={(event) =>
                  setPix((current) => ({ ...current, city: event.target.value }))
                }
                maxLength={CITY_MAX}
                aria-invalid={Boolean(errors.city)}
              />
              {errors.city ? <FieldError message={errors.city} /> : null}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={onSave}
            loading={saving}
            disabled={method === 'automatic'}
          >
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PaymentOptionProps {
  id: string;
  value: PaymentMethod;
  title: React.ReactNode;
  description: string;
  disabled?: boolean;
}

function PaymentOption({
  id,
  value,
  title,
  description,
  disabled,
}: PaymentOptionProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors',
        'hover:bg-muted/30',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
      )}
    >
      <RadioGroupItem
        id={id}
        value={value}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-xs text-destructive">{message}</p>;
}
