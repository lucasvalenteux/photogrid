'use client';

import * as React from 'react';

import { toE164Br } from '@/lib/format/phone';
import {
  createCartOrder,
  updateCartOrder,
} from '@/lib/services/order-service';
import type { OrderItem } from '@/types';

/**
 * Storefront cart, scoped to a single studio (the storefront route
 * shell determines the studio). State lives entirely on the
 * customer's device — we persist enough to:
 *
 *   - rehydrate the cart on a refresh / new tab,
 *   - prove ownership at checkout (via the captured phone),
 *   - and best-effort sync the cart to a Firestore "lead" doc so the
 *     photographer can see abandoned carts in /dashboard/orders.
 *
 * We deliberately don't sync every mutation to Firestore. Instead we
 * defer the first persistence until the customer gives us their phone
 * — before that we don't have anything useful to attribute the cart
 * to anyway.
 */

const STORAGE_PREFIX = 'photogrid.cart.';

interface CartState {
  /** Identifies the cart's parent gallery so we never mix lines across galleries. */
  galleryId: string | null;
  galleryTitle: string;
  items: OrderItem[];
  /** Customer phone in E.164 (`+5511…`). Null until we capture it. */
  customerPhone: string | null;
  /** Firestore order id once we've persisted the cart. */
  orderId: string | null;
}

interface CartContextValue extends CartState {
  totalCents: number;
  /**
   * Add an item to the cart. Triggers the phone-capture modal if we
   * don't have a phone yet; otherwise upserts the line and persists
   * to Firestore in the background.
   */
  addItem: (input: AddItemInput) => Promise<{ requiresPhone: boolean }>;
  removeItem: (item: OrderItem) => Promise<void>;
  clear: () => Promise<void>;
  hasItem: (type: OrderItem['type'], itemId: string) => boolean;
  /**
   * Confirm a phone (E.164 or human-typed BR) and resume a pending
   * add. Returns false when the phone is unusable.
   */
  capturePhone: (phone: string, pendingItem?: AddItemInput) => Promise<boolean>;
  /** Mark this cart as converted (e.g. checkout completed) so we stop showing the resume banner. */
  markConverted: (orderId: string) => void;
}

export interface AddItemInput {
  galleryId: string;
  galleryTitle: string;
  item: OrderItem;
  /** Required for the first persistence — we copy it onto the order doc. */
  studioId: string;
  studioSlug: string;
}

const CartContext = React.createContext<CartContextValue | null>(null);

interface PersistedCart {
  galleryId: string | null;
  galleryTitle: string;
  items: OrderItem[];
  customerPhone: string | null;
  orderId: string | null;
}

function storageKey(studioId: string): string {
  return `${STORAGE_PREFIX}${studioId}`;
}

function loadFromStorage(studioId: string): PersistedCart | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(studioId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(studioId: string, state: PersistedCart) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(studioId), JSON.stringify(state));
  } catch {
    // QuotaExceeded etc. — cart still works in-memory, just won't survive a reload.
  }
}

function clearStorage(studioId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(studioId));
  } catch {
    // ignore
  }
}

interface CartProviderProps {
  studioId: string;
  children: React.ReactNode;
}

export function CartProvider({ studioId, children }: CartProviderProps) {
  const [state, setState] = React.useState<CartState>({
    galleryId: null,
    galleryTitle: '',
    items: [],
    customerPhone: null,
    orderId: null,
  });

  // Rehydrate from localStorage on first mount. We can't do this in
  // the initialiser because Next.js renders this provider on the
  // server too and `window` isn't available there.
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const persisted = loadFromStorage(studioId);
    if (persisted) {
      setState({
        galleryId: persisted.galleryId,
        galleryTitle: persisted.galleryTitle,
        items: persisted.items,
        customerPhone: persisted.customerPhone,
        orderId: persisted.orderId,
      });
    }
  }, [studioId]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    saveToStorage(studioId, {
      galleryId: state.galleryId,
      galleryTitle: state.galleryTitle,
      items: state.items,
      customerPhone: state.customerPhone,
      orderId: state.orderId,
    });
  }, [studioId, state]);

  const totalCents = React.useMemo(
    () => state.items.reduce((sum, item) => sum + item.priceCents, 0),
    [state.items],
  );

  /** Best-effort Firestore sync. Failures don't surface to the visitor. */
  const persistCart = React.useCallback(
    async (next: {
      studioId: string;
      studioSlug: string;
      galleryId: string;
      galleryTitle: string;
      items: OrderItem[];
      customerPhone: string;
      orderId: string | null;
    }): Promise<string | null> => {
      try {
        if (next.orderId) {
          await updateCartOrder(next.orderId, { items: next.items });
          return next.orderId;
        }
        if (next.items.length === 0) return null;
        const id = await createCartOrder({
          studioId: next.studioId,
          studioSlug: next.studioSlug,
          galleryId: next.galleryId,
          galleryTitle: next.galleryTitle,
          customerPhone: next.customerPhone,
          items: next.items,
        });
        return id;
      } catch (error) {
        console.warn('[cart] failed to persist cart', error);
        return next.orderId;
      }
    },
    [],
  );

  const upsertItem = React.useCallback(
    (input: AddItemInput) =>
      new Promise<OrderItem[]>((resolve) => {
        setState((current) => {
          // If the visitor changed galleries, reset the cart so we
          // don't end up with a mix of unrelated lines + galleries
          // pointing at different price snapshots.
          const sameGallery =
            current.galleryId === null || current.galleryId === input.galleryId;
          const baseItems = sameGallery ? current.items : [];
          const exists = baseItems.find(
            (item) =>
              item.type === input.item.type && item.itemId === input.item.itemId,
          );
          const items = exists
            ? baseItems
            : [...baseItems, input.item];
          resolve(items);
          return {
            ...current,
            galleryId: input.galleryId,
            galleryTitle: input.galleryTitle,
            items,
            orderId: sameGallery ? current.orderId : null,
          };
        });
      }),
    [],
  );

  const addItem = React.useCallback<CartContextValue['addItem']>(
    async (input) => {
      if (!state.customerPhone) {
        // Defer the actual add until the phone modal resolves.
        return { requiresPhone: true };
      }
      const nextItems = await upsertItem(input);
      const orderId = await persistCart({
        studioId: input.studioId,
        studioSlug: input.studioSlug,
        galleryId: input.galleryId,
        galleryTitle: input.galleryTitle,
        items: nextItems,
        customerPhone: state.customerPhone,
        orderId: state.orderId,
      });
      if (orderId && orderId !== state.orderId) {
        setState((current) => ({ ...current, orderId }));
      }
      return { requiresPhone: false };
    },
    [persistCart, state.customerPhone, state.orderId, upsertItem],
  );

  const removeItem = React.useCallback<CartContextValue['removeItem']>(
    async (target) => {
      const nextItems = await new Promise<OrderItem[]>((resolve) => {
        setState((current) => {
          const items = current.items.filter(
            (item) =>
              !(item.type === target.type && item.itemId === target.itemId),
          );
          resolve(items);
          return { ...current, items };
        });
      });
      if (state.orderId && state.customerPhone) {
        try {
          await updateCartOrder(state.orderId, { items: nextItems });
        } catch (error) {
          console.warn('[cart] failed to update cart on remove', error);
        }
      }
    },
    [state.customerPhone, state.orderId],
  );

  const clear = React.useCallback<CartContextValue['clear']>(async () => {
    setState({
      galleryId: null,
      galleryTitle: '',
      items: [],
      customerPhone: state.customerPhone,
      orderId: null,
    });
    clearStorage(studioId);
  }, [state.customerPhone, studioId]);

  const hasItem = React.useCallback<CartContextValue['hasItem']>(
    (type, itemId) =>
      state.items.some((item) => item.type === type && item.itemId === itemId),
    [state.items],
  );

  const capturePhone = React.useCallback<CartContextValue['capturePhone']>(
    async (raw, pendingItem) => {
      const e164 = toE164Br(raw);
      if (!e164) return false;

      // We pull the latest items synchronously by doing the upsert
      // inside this setState so the persisted cart can include the
      // pending add atomically.
      let pendingItems: OrderItem[] | null = null;
      setState((current) => {
        const sameGallery =
          !pendingItem ||
          current.galleryId === null ||
          current.galleryId === pendingItem.galleryId;
        const baseItems = sameGallery ? current.items : [];
        let items = baseItems;
        let galleryId = current.galleryId;
        let galleryTitle = current.galleryTitle;
        if (pendingItem) {
          const exists = baseItems.find(
            (item) =>
              item.type === pendingItem.item.type &&
              item.itemId === pendingItem.item.itemId,
          );
          items = exists ? baseItems : [...baseItems, pendingItem.item];
          galleryId = pendingItem.galleryId;
          galleryTitle = pendingItem.galleryTitle;
        }
        pendingItems = items;
        return {
          ...current,
          galleryId,
          galleryTitle,
          items,
          customerPhone: e164,
          orderId: sameGallery ? current.orderId : null,
        };
      });

      if (pendingItem && pendingItems) {
        const orderId = await persistCart({
          studioId: pendingItem.studioId,
          studioSlug: pendingItem.studioSlug,
          galleryId: pendingItem.galleryId,
          galleryTitle: pendingItem.galleryTitle,
          items: pendingItems,
          customerPhone: e164,
          orderId: null,
        });
        if (orderId) {
          setState((current) => ({ ...current, orderId }));
        }
      }
      return true;
    },
    [persistCart],
  );

  const markConverted = React.useCallback<CartContextValue['markConverted']>(
    (orderId) => {
      // Clear local cart but keep the phone so the visitor doesn't
      // have to re-type it on the next purchase.
      setState((current) => ({
        ...current,
        galleryId: null,
        galleryTitle: '',
        items: [],
        orderId: null,
      }));
      clearStorage(studioId);
      // We intentionally don't mutate `orderId` argument — it's only
      // there to give callers a sentinel they can persist elsewhere
      // (the post-checkout page already knows it).
      void orderId;
    },
    [studioId],
  );

  const value: CartContextValue = React.useMemo(
    () => ({
      ...state,
      totalCents,
      addItem,
      removeItem,
      clear,
      hasItem,
      capturePhone,
      markConverted,
    }),
    [addItem, capturePhone, clear, hasItem, markConverted, removeItem, state, totalCents],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}
