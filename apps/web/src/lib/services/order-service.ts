import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  orderDoc,
  ordersCollection,
} from '@/lib/firebase/firestore';
import type {
  OrderDoc,
  OrderItem,
  OrderStatus,
} from '@/types';

export interface CreateCartOrderInput {
  studioId: string;
  studioSlug: string;
  galleryId: string;
  galleryTitle: string;
  customerPhone: string;
  items: OrderItem[];
}

export interface CreateManualPendingOrderInput {
  studioId: string;
  studioSlug: string;
  galleryId: string;
  galleryTitle: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
}

/**
 * Persist an abandoned cart (status `cart`) the first time a visitor
 * gives us their phone. Subsequent add-to-cart actions update the same
 * doc via `updateCartOrder`, so we don't pile up one Firestore doc per
 * click on the storefront.
 *
 * The doc is intentionally created by an unauthenticated visitor —
 * see `firestore.rules` for the policy that allows it while still
 * blocking forged status transitions.
 */
export async function createCartOrder(
  input: CreateCartOrderInput,
): Promise<string> {
  const ref = doc(ordersCollection());
  const now = new Date().toISOString();
  const payload: OrderDoc = {
    id: ref.id,
    studioId: input.studioId,
    studioSlug: input.studioSlug,
    galleryId: input.galleryId,
    galleryTitle: input.galleryTitle,
    customerPhone: input.customerPhone,
    customerName: null,
    items: input.items,
    totalCents: input.items.reduce((sum, item) => sum + item.priceCents, 0),
    status: 'cart',
    accessToken: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Owner-side manual order, created directly from /dashboard/orders. */
export async function createManualPendingOrder(
  input: CreateManualPendingOrderInput,
): Promise<string> {
  const ref = doc(ordersCollection());
  const now = new Date().toISOString();
  const payload: OrderDoc = {
    id: ref.id,
    studioId: input.studioId,
    studioSlug: input.studioSlug,
    galleryId: input.galleryId,
    galleryTitle: input.galleryTitle,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    items: input.items,
    totalCents: input.items.reduce((sum, item) => sum + item.priceCents, 0),
    status: 'pending',
    accessToken: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export interface UpdateCartOrderInput {
  items: OrderItem[];
}

/**
 * Replace the items of an existing cart doc. Used while the visitor
 * is still adding / removing things on the storefront, before
 * checkout. We always rewrite the full items array (instead of using
 * `arrayUnion` / `arrayRemove`) so the totalCents snapshot is
 * consistent with the line items.
 */
export async function updateCartOrder(
  orderId: string,
  input: UpdateCartOrderInput,
): Promise<void> {
  const totalCents = input.items.reduce(
    (sum, item) => sum + item.priceCents,
    0,
  );
  await updateDoc(orderDoc(orderId), {
    items: input.items,
    totalCents,
    updatedAt: serverTimestamp(),
  });
}

export interface ConfirmCheckoutInput {
  customerName: string;
  customerPhone: string;
}

/**
 * Promote a cart to a `pending` order. Called when the visitor clicks
 * "Pagamento realizado" on the checkout page — the studio still needs
 * to confirm receipt of the Pix payment manually.
 */
export async function confirmCheckout(
  orderId: string,
  input: ConfirmCheckoutInput,
): Promise<void> {
  await updateDoc(orderDoc(orderId), {
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    status: 'pending' satisfies OrderStatus,
    updatedAt: serverTimestamp(),
  });
}

/** Owner-side: flip a pending order to paid and mint an access token. */
export async function markOrderAsPaid(
  orderId: string,
  accessToken: string,
): Promise<void> {
  await updateDoc(orderDoc(orderId), {
    status: 'paid' satisfies OrderStatus,
    accessToken,
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Owner-side: cancel a pending or abandoned order. */
export async function cancelOrder(orderId: string): Promise<void> {
  await updateDoc(orderDoc(orderId), {
    status: 'cancelled' satisfies OrderStatus,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getOrder(orderId: string): Promise<OrderDoc | null> {
  const snap = await getDoc(orderDoc(orderId));
  return snap.exists() ? snap.data() : null;
}

/**
 * Lookup orders for the customer self-service page (`/minhas-compras`).
 * Matches by phone in E.164 form to avoid format drift. Returns every
 * non-cart status — visitors don't need to see their own abandoned
 * carts surfaced as past purchases.
 */
export async function fetchOrdersByPhone(
  phone: string,
): Promise<OrderDoc[]> {
  const snap = await getDocs(
    query(
      ordersCollection(),
      where('customerPhone', '==', phone),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs
    .map((d) => d.data())
    .filter((o) => o.status !== 'cart');
}

/** Resolve a direct token link to the order it grants access to. */
export async function fetchOrderByAccessToken(
  token: string,
): Promise<OrderDoc | null> {
  const snap = await getDocs(
    query(ordersCollection(), where('accessToken', '==', token)),
  );
  const first = snap.docs[0];
  if (!first) return null;
  return first.data();
}

/**
 * Subscription used by the owner's `/dashboard/orders` page. We split
 * orders into:
 *   - pending: status === 'pending'  → top table, action: mark paid
 *   - paid:    status === 'paid'     → secondary table, with access link
 *   - carts:   status === 'cart'     → "carrinhos não finalizados"
 */
export function subscribeToStudioOrders(
  studioId: string,
  onChange: (orders: OrderDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    ordersCollection(),
    where('studioId', '==', studioId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}

/**
 * Generate a URL-safe random token for the customer's direct access
 * link. We use 24 bytes of randomness rendered base32 — enough entropy
 * to make brute-forcing infeasible while keeping the link short
 * enough to share over WhatsApp without word-wrapping.
 */
export function generateAccessToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base32 alphabet keeps the token URL-safe and case-insensitive.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let out = '';
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length];
  }
  return out;
}
