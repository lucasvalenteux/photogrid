'use client';

import * as React from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { Button, cn } from '@photogrid/ui';

import { useCart, type AddItemInput } from '@/lib/cart/cart-context';
import { formatCents } from '@/lib/format/currency';

import { PhoneCaptureDialog } from './phone-capture-dialog';

interface AddToCartButtonProps {
  /** Pre-built `AddItemInput` minus the `studio*` fields — they come from props. */
  payload: Omit<AddItemInput, 'studioId' | 'studioSlug'>;
  studioId: string;
  studioSlug: string;
  /** Optional visual size — defaults to `sm`. */
  size?: 'sm' | 'lg';
  /** Show the resolved price in the label ("Adicionar – R$ 19,90"). */
  showPrice?: boolean;
  className?: string;
}

/**
 * Reusable storefront button. The flow:
 *
 *   1. Click "Adicionar ao carrinho".
 *   2. If the visitor hasn't given us a phone yet, open the capture
 *      dialog. The dialog calls `capturePhone` which seeds the cart
 *      with the pending item atomically.
 *   3. Otherwise, append the item via `addItem`.
 *   4. After the add, the button flips to a checkmark state for a
 *      moment so the visitor gets visual confirmation.
 */
export function AddToCartButton({
  payload,
  studioId,
  studioSlug,
  size = 'sm',
  showPrice = false,
  className,
}: AddToCartButtonProps) {
  const cart = useCart();
  const [pending, setPending] = React.useState(false);
  const [phoneOpen, setPhoneOpen] = React.useState(false);
  const [pendingItem, setPendingItem] = React.useState<AddItemInput | null>(null);
  const [justAdded, setJustAdded] = React.useState(false);

  const inCart = cart.hasItem(payload.item.type, payload.item.itemId);

  React.useEffect(() => {
    if (!justAdded) return;
    const handle = window.setTimeout(() => setJustAdded(false), 1800);
    return () => window.clearTimeout(handle);
  }, [justAdded]);

  const onClick = async () => {
    if (pending || inCart) return;
    const fullPayload: AddItemInput = { ...payload, studioId, studioSlug };

    setPending(true);
    try {
      const result = await cart.addItem(fullPayload);
      if (result.requiresPhone) {
        setPendingItem(fullPayload);
        setPhoneOpen(true);
        return;
      }
      setJustAdded(true);
      toast.success(itemAddedToast(payload.item.title));
    } catch (error) {
      console.error('[cart] add error', error);
      toast.error('Não foi possível adicionar agora.');
    } finally {
      setPending(false);
    }
  };

  const handlePhoneConfirmed = async (phone: string) => {
    if (!pendingItem) return false;
    const ok = await cart.capturePhone(phone, pendingItem);
    if (!ok) return false;
    setPendingItem(null);
    setJustAdded(true);
    toast.success(itemAddedToast(pendingItem.item.title));
    return true;
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={inCart || justAdded ? 'outline' : 'primary'}
        onClick={onClick}
        loading={pending}
        disabled={pending || inCart}
        className={cn('gap-2', className)}
      >
        {inCart || justAdded ? (
          <Check className="size-4" />
        ) : (
          <ShoppingCart className="size-4" />
        )}
        {labelFor({
          inCart,
          justAdded,
          showPrice,
          priceCents: payload.item.priceCents,
        })}
      </Button>

      <PhoneCaptureDialog
        open={phoneOpen}
        onOpenChange={(next) => {
          setPhoneOpen(next);
          if (!next) setPendingItem(null);
        }}
        onConfirm={handlePhoneConfirmed}
      />
    </>
  );
}

function itemAddedToast(title: string): string {
  if (!title) return 'Adicionado ao carrinho.';
  return `“${title}” no carrinho.`;
}

function labelFor({
  inCart,
  justAdded,
  showPrice,
  priceCents,
}: {
  inCart: boolean;
  justAdded: boolean;
  showPrice: boolean;
  priceCents: number;
}): string {
  if (inCart) return 'No carrinho';
  if (justAdded) return 'Adicionado';
  if (showPrice && priceCents > 0) {
    return `Adicionar — ${formatCents(priceCents)}`;
  }
  return 'Adicionar ao carrinho';
}
