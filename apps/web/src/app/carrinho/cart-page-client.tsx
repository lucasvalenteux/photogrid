'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  APP_DOMAIN,
  ROUTES,
} from '@photogrid/config';
import { ArrowLeft, ArrowRight, Check, Copy, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Input,
  Label,
  cn,
} from '@photogrid/ui';

import { ProtectedPhoto } from '@/components/public/protected-photo';
import { StorefrontShell } from '@/components/public/storefront-shell';
import { useCart } from '@/lib/cart/cart-context';
import { formatCents } from '@/lib/format/currency';
import { displayBrPhone, formatBrPhone, isValidBrPhone, toE164Br } from '@/lib/format/phone';
import { confirmCheckout } from '@/lib/services/order-service';
import {
  effectiveStudioSecurity,
  type OrderItem,
  type StudioDoc,
  type StudioSecuritySettings,
} from '@/types';

interface CartPageClientProps {
  studio: StudioDoc;
}

type Step = 'items' | 'confirm' | 'pay';

const PIX_KEY_LABEL: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'Email',
  phone: 'Celular',
  random: 'Chave aleatória',
};

export function CartPageClient({ studio }: CartPageClientProps) {
  return (
    <StorefrontShell studio={studio}>
      <CartInner studio={studio} />
    </StorefrontShell>
  );
}

/**
 * Three-step checkout living inside the storefront shell:
 *
 *   1. items   — review the cart, remove lines, see the total.
 *   2. confirm — confirm name + phone before showing payment details.
 *   3. pay     — render the studio's Pix info + total, with the
 *                "pagamento realizado" trigger that promotes the
 *                cart to `pending` in Firestore.
 *
 * We don't navigate between steps with the router so the cart
 * context (held by the storefront shell wrapper) stays mounted —
 * losing it mid-checkout would drop the local items.
 */
function CartInner({ studio }: { studio: StudioDoc }) {
  const cart = useCart();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('items');
  const security = React.useMemo(
    () => effectiveStudioSecurity(studio),
    [studio],
  );
  const studioUrl = `${APP_DOMAIN}/${studio.slug}`;

  // Name + phone draft (used in step 2). We pre-fill from whatever the
  // cart context already knows so returning customers don't re-type.
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState(() =>
    displayBrPhone(cart.customerPhone),
  );
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => {
    setPhone(displayBrPhone(cart.customerPhone));
  }, [cart.customerPhone]);

  const onRemove = async (item: OrderItem) => {
    try {
      await cart.removeItem(item);
      toast.success('Item removido.');
    } catch (error) {
      console.error('[cart] remove failed', error);
      toast.error('Não foi possível remover agora.');
    }
  };

  const advanceFromItems = () => {
    if (cart.items.length === 0) return;
    setStep('confirm');
  };

  const confirmCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setConfirmError('Digite seu nome.');
      return;
    }
    const e164 = toE164Br(phone);
    if (!e164) {
      setConfirmError('Verifique o celular.');
      return;
    }
    setSubmitting(true);
    setConfirmError(null);
    try {
      // The cart context guarantees an orderId once we have a phone +
      // at least one item. Persist (or update) the phone on the cart
      // doc so the dashboard table shows the customer name.
      await cart.capturePhone(phone);
      setStep('pay');
    } catch (error) {
      console.error('[cart] capture phone failed', error);
      setConfirmError('Algo deu errado. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const onPaymentDone = async () => {
    if (submitting) return;
    if (!cart.orderId) {
      // No order id means the cart was never persisted (e.g. user
      // cleared storage). Fall back to client-side state — push them
      // to /minhas-compras anyway with the phone they confirmed.
      const e164 = toE164Br(phone);
      if (e164) {
        router.push(`${ROUTES.myPurchases}?phone=${encodeURIComponent(e164)}`);
      } else {
        router.push(ROUTES.myPurchases);
      }
      return;
    }
    setSubmitting(true);
    try {
      const e164 = toE164Br(phone) ?? cart.customerPhone ?? '';
      await confirmCheckout(cart.orderId, {
        customerName: name.trim(),
        customerPhone: e164,
      });
      const orderId = cart.orderId;
      cart.markConverted(orderId);
      toast.success('Pedido registrado. Confirme o pagamento com o estúdio.');
      router.push(`${ROUTES.myPurchases}?phone=${encodeURIComponent(e164)}`);
    } catch (error) {
      console.error('[cart] confirm checkout failed', error);
      toast.error('Não conseguimos confirmar agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0 && step === 'items') {
    return (
      <section className="container-app py-16 sm:py-24">
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ShoppingCart className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-ink">
            Carrinho vazio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Adicione fotos ou álbuns na loja do estúdio para finalizar
            a compra.
          </p>
          <Link
            href={ROUTES.studio(studio.slug)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Voltar para {studio.name}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-app py-10 sm:py-14">
      <Link
        href={ROUTES.studio(studio.slug)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Continuar comprando
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {step === 'items' && 'Seu carrinho'}
          {step === 'confirm' && 'Quase lá'}
          {step === 'pay' && 'Pagamento'}
        </h1>
        <StepIndicator step={step} />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {step === 'items' ? (
            <CartItems
              items={cart.items}
              onRemove={onRemove}
              studioName={studio.name}
              studioUrl={studioUrl}
              studioLogoUrl={studio.logoUrl}
              security={security}
            />
          ) : null}
          {step === 'confirm' ? (
            <CustomerForm
              name={name}
              phone={phone}
              onNameChange={setName}
              onPhoneChange={setPhone}
              onSubmit={confirmCustomer}
              error={confirmError}
              submitting={submitting}
              onBack={() => setStep('items')}
            />
          ) : null}
          {step === 'pay' ? (
            <PaymentPanel
              studio={studio}
              totalCents={cart.totalCents}
              onDone={onPaymentDone}
              onBack={() => setStep('confirm')}
              submitting={submitting}
              customerName={name}
            />
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CartSummary
            items={cart.items}
            totalCents={cart.totalCents}
            cta={
              step === 'items' ? (
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={advanceFromItems}
                  disabled={cart.items.length === 0}
                >
                  Continuar
                  <ArrowRight className="size-4" />
                </Button>
              ) : null
            }
          />
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Subcomponents                                                              */
/* ------------------------------------------------------------------------ */

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ['items', 'confirm', 'pay'];
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {order.map((s, i) => {
        const reached = order.indexOf(step) >= i;
        return (
          <span
            key={s}
            className={cn(
              'inline-flex h-1.5 w-6 rounded-full transition-colors',
              reached ? 'bg-brand-500' : 'bg-muted',
            )}
          />
        );
      })}
    </div>
  );
}

function CartItems({
  items,
  onRemove,
  studioName,
  studioUrl,
  studioLogoUrl,
  security,
}: {
  items: OrderItem[];
  onRemove: (item: OrderItem) => Promise<void>;
  studioName: string;
  studioUrl: string;
  studioLogoUrl?: string | null;
  security: Required<StudioSecuritySettings>;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item, index) => (
        <li key={`${item.type}:${item.itemId}`} className="flex items-center gap-4 p-4 sm:p-5">
          <div className="size-16 shrink-0">
            {item.thumbnailUrl ? (
              <ProtectedPhoto
                src={item.thumbnailUrl}
                alt={cartItemLabel(item, index)}
                studioName={studioName}
                studioUrl={studioUrl}
                studioLogoUrl={studioLogoUrl}
                security={security}
                interactive="none"
                className="size-16"
              />
            ) : (
              <div className="size-16 rounded-lg bg-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {item.type === 'album' ? 'Álbum' : 'Foto'}
              </Badge>
              <p className="truncate text-sm font-medium text-foreground">
                {cartItemLabel(item, index)}
              </p>
            </div>
            {item.type === 'album' && typeof item.photoCount === 'number' ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.photoCount} {item.photoCount === 1 ? 'foto' : 'fotos'}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {formatCents(item.priceCents)}
            </p>
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label="Remover item"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Remover
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Display label for cart lines. We deliberately hide raw photo
 * filenames (which can leak storage paths / camera serials) and
 * substitute a friendly "Foto N" tag. Albums keep their title since
 * that's the photographer's curated copy.
 */
function cartItemLabel(item: OrderItem, index: number): string {
  if (item.type === 'album') return item.title || 'Álbum';
  return `Foto ${String(index + 1).padStart(2, '0')}`;
}

function CartSummary({
  items,
  totalCents,
  cta,
}: {
  items: OrderItem[];
  totalCents: number;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Resumo
      </h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>Itens</dt>
          <dd>{items.length}</dd>
        </div>
        <div className="flex items-center justify-between text-base font-semibold text-ink">
          <dt>Total</dt>
          <dd>{formatCents(totalCents)}</dd>
        </div>
      </dl>
      {cta}
    </div>
  );
}

function CustomerForm({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onSubmit,
  error,
  submitting,
  onBack,
}: {
  name: string;
  phone: string;
  onNameChange: (next: string) => void;
  onPhoneChange: (next: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Seus dados
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="cart-name">Nome completo</Label>
        <Input
          id="cart-name"
          autoComplete="name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Como o estúdio pode te chamar?"
          disabled={submitting}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cart-phone-confirm">Celular com DDD</Label>
        <Input
          id="cart-phone-confirm"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => onPhoneChange(formatBrPhone(event.target.value))}
          placeholder="(11) 99999-9999"
          disabled={submitting}
          required
        />
        <p className="text-xs text-muted-foreground">
          Confirme o número — usaremos para liberar os arquivos depois
          do pagamento.
        </p>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <Button
          type="submit"
          loading={submitting}
          disabled={!isValidBrPhone(phone) || name.trim().length < 2}
        >
          Ir para pagamento
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

function PaymentPanel({
  studio,
  totalCents,
  onDone,
  onBack,
  submitting,
  customerName,
}: {
  studio: StudioDoc;
  totalCents: number;
  onDone: () => Promise<void> | void;
  onBack: () => void;
  submitting: boolean;
  customerName: string;
}) {
  const payment = studio.payment;
  const method = payment?.method ?? 'pix';

  if (method !== 'pix' || !payment?.pix?.key) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Pagamento
        </h2>
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          Este estúdio ainda não configurou um método de pagamento. Entre
          em contato direto com o fotógrafo para finalizar a compra.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const pix = payment.pix;
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Pagamento via Pix
      </h2>

      <PixKeyCard
        keyType={pix.keyType}
        keyValue={pix.key}
        totalCents={totalCents}
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <PixMeta label="Beneficiário" value={pix.beneficiaryName} />
        <PixMeta label="Cidade" value={pix.city} />
        {customerName ? <PixMeta label="Em nome de" value={customerName} /> : null}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <Button type="button" loading={submitting} onClick={() => void onDone()}>
          Pagamento realizado
          <Check className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Hero block of the payment panel. Pix key + total are the two
 * numbers the visitor needs to act on — so we render them at the
 * largest type on the page and put the copy button right next to the
 * key. Anything else (beneficiary / city / customer name) goes into
 * the smaller meta row below.
 */
function PixKeyCard({
  keyType,
  keyValue,
  totalCents,
}: {
  keyType: string;
  keyValue: string;
  totalCents: number;
}) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast.success('Chave copiada.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Chave Pix · {PIX_KEY_LABEL[keyType] ?? keyType}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p
        className="mt-2 break-all font-mono text-base font-semibold text-ink sm:text-lg"
        title={keyValue}
      >
        {keyValue}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Total a pagar
        </span>
        <span className="text-2xl font-semibold tabular-nums text-ink">
          {formatCents(totalCents)}
        </span>
      </div>
    </div>
  );
}

function PixMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

