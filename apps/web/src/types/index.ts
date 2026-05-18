/**
 * Domain types shared across the web app.
 *
 * Hierarchy:
 *   studio → gallery → photo            (photos live in galleries)
 *                 └─→ album → photoIds  (curated selections, referencing photos)
 */

import type { Visibility } from '@photogrid/config';

export interface UserDoc {
  id: string;
  email: string;
  studioId: string | null;
  createdAt: string;
}

export interface PlatformSettingsDoc {
  id: 'platform';
  redirectHomeToAutoLogin?: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/**
 * Per-studio photo-protection toggles. Every flag defaults to `false`
 * (no protection) for backwards compatibility — see
 * `effectiveStudioSecurity` for the canonical reader.
 *
 * These settings only affect the **public storefront**. The owner's
 * dashboard always shows clean, undimmed photos so editing decisions
 * aren't compromised.
 */
export interface StudioSecuritySettings {
  /** Dims photos with a CSS opacity reduction + dark overlay. */
  dimPhotos?: boolean;
  /** Tiled watermark with the studio name across each photo. */
  watermark?: boolean;
  /**
   * Disables the browser context menu, image drag, and the click-through
   * link that exposes the raw image URL.
   */
  disableRightClick?: boolean;
  /**
   * Anti-AI defenses for users who screenshot the gallery and try to
   * "remove watermark / upscale" via generative AI.
   *
   * Adds a procedural fractal-noise overlay above the photo. The noise
   * survives screenshots (it's a real CSS layer) and falls in the
   * frequency band that diffusion / super-resolution models hallucinate
   * over — denoisers either preserve the pattern (defeating the
   * upscale) or smear it (visible artefacts around faces and edges).
   *
   * Independent from the `watermark` setting: turning this on does not
   * change how the studio name is rendered.
   *
   * Also opts the storefront into `noai` / `noimageai` meta tags so
   * well-behaved AI crawlers (GPTBot, CCBot, Claude-Web, Google-Extended,
   * etc.) won't ingest the photos for training.
   */
  antiAi?: boolean;
}

/**
 * Brazilian payment configuration for the studio. Two methods are
 * supported in the data model — only `pix` is wired in the UI today,
 * with `automatic` reserved for future Pagar.me / Mercado Pago
 * onboarding.
 */
export type PaymentMethod = 'automatic' | 'pix';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface StudioPixSettings {
  keyType: PixKeyType;
  /** CPF/CNPJ digits, email, E.164 phone, or UUID — depends on keyType. */
  key: string;
  /** Beneficiary name; capped at 25 chars by the Pix BR Code spec. */
  beneficiaryName: string;
  /** Beneficiary city; capped at 15 chars by the Pix BR Code spec. */
  city: string;
}

export interface StudioAutomaticPaymentSettings {
  provider?: 'pagarme' | 'mercadopago' | 'stripe';
  accountId?: string;
  status: 'pending' | 'connected' | 'error';
}

export interface StudioPaymentSettings {
  method: PaymentMethod;
  pix?: StudioPixSettings;
  automatic?: StudioAutomaticPaymentSettings;
}

/**
 * Default monetary values applied across the studio's storefront.
 * Stored as integer cents (BRL) to avoid floating-point drift on the
 * checkout total. Each gallery can override these values individually
 * via `GalleryDoc.pricing`.
 */
export interface StudioPricingSettings {
  /** Default price (in cents) charged per individual photo. */
  pricePerPhotoCents?: number;
  /** Default price (in cents) charged when the visitor buys a full album. */
  pricePerAlbumCents?: number;
}

/**
 * Per-gallery price override. Missing fields fall back to the studio
 * default; an explicit `0` is honoured (you can configure a free
 * gallery without removing the studio-level defaults).
 */
export interface GalleryPricing {
  pricePerPhotoCents?: number;
  pricePerAlbumCents?: number;
}

export type StorefrontThemeId =
  | 'default'
  | 'paper'
  | 'graphite'
  | 'rose'
  | 'sand'
  | 'ocean'
  | 'aurora'
  | 'sunset'
  | 'lavender'
  | 'forest';

export interface StudioDoc {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  /**
   * Public storefront logo. When unset the storefront shell falls back
   * to the default Camera icon avatar. `logoStoragePath` is the raw
   * Storage object path (no token), kept around so we can delete the
   * previous file when the photographer uploads a new one.
   */
  logoUrl?: string | null;
  logoStoragePath?: string | null;
  /**
   * Whether automatic face detection / album suggestions run for this
   * studio. Optional for backwards compatibility — undefined is treated
   * as `true` by `effectiveFaceClusteringEnabled`.
   */
  faceClusteringEnabled?: boolean;
  /**
   * Enables a public storefront search where a visitor uploads a face photo
   * and receives public photos/albums that likely contain that person.
   */
  publicFaceSearchEnabled?: boolean;
  /** Public storefront photo-protection toggles. */
  security?: StudioSecuritySettings;
  /** Payment / payout configuration used by the future checkout. */
  payment?: StudioPaymentSettings;
  /** Default monetary values for items sold across the storefront. */
  pricing?: StudioPricingSettings;
  /** Background theme applied to the public storefront. */
  storefrontTheme?: StorefrontThemeId;
  /** Internal admin flag: excluded from system-wide admin metrics. */
  isTest?: boolean;
  createdAt: string;
}

/**
 * Backwards-compatible reader for the studio's face-clustering preference.
 * Treats missing values as enabled so existing studios keep behaving the
 * way they did before the toggle existed.
 */
export function effectiveFaceClusteringEnabled(
  studio: Pick<StudioDoc, 'faceClusteringEnabled'> | null | undefined,
): boolean {
  if (!studio) return true;
  return studio.faceClusteringEnabled !== false;
}

export function effectivePublicFaceSearchEnabled(
  studio: Pick<StudioDoc, 'publicFaceSearchEnabled'> | null | undefined,
): boolean {
  return studio?.publicFaceSearchEnabled === true;
}

/**
 * Resolve a studio's photo-protection settings to a fully-populated
 * object with explicit booleans. Lets callers destructure safely
 * without `?? false` everywhere they read a flag.
 */
export function effectiveStudioSecurity(
  studio: Pick<StudioDoc, 'security'> | null | undefined,
): Required<StudioSecuritySettings> {
  const s = studio?.security ?? {};
  return {
    dimPhotos: s.dimPhotos === true,
    watermark: s.watermark === true,
    disableRightClick: s.disableRightClick === true,
    antiAi: s.antiAi === true,
  };
}

export interface GalleryDoc {
  id: string;
  studioId: string;
  title: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  /** Total photos uploaded to this gallery. */
  photoCount: number;
  /** Total albums (selections) created from this gallery. */
  albumCount: number;
  /**
   * Access level. Optional for backwards compatibility — undefined is
   * interpreted as `public` by `effectiveVisibility`.
   */
  visibility?: Visibility;
  /**
   * Per-gallery price overrides for the cart. Missing fields fall back
   * to the studio defaults (`StudioDoc.pricing`).
   */
  pricing?: GalleryPricing;
  createdAt: string;
}

/**
 * Resolve the effective prices for items inside a gallery. Gallery
 * overrides win; otherwise we use the studio default; otherwise zero.
 * Returns explicit numbers (never `undefined`) so cart math stays
 * total-safe.
 */
export function resolveGalleryPrices(
  gallery: Pick<GalleryDoc, 'pricing'> | null | undefined,
  studio: Pick<StudioDoc, 'pricing'> | null | undefined,
): { pricePerPhotoCents: number; pricePerAlbumCents: number } {
  const galleryPricing = gallery?.pricing ?? {};
  const studioPricing = studio?.pricing ?? {};
  return {
    pricePerPhotoCents:
      typeof galleryPricing.pricePerPhotoCents === 'number'
        ? galleryPricing.pricePerPhotoCents
        : typeof studioPricing.pricePerPhotoCents === 'number'
          ? studioPricing.pricePerPhotoCents
          : 0,
    pricePerAlbumCents:
      typeof galleryPricing.pricePerAlbumCents === 'number'
        ? galleryPricing.pricePerAlbumCents
        : typeof studioPricing.pricePerAlbumCents === 'number'
          ? studioPricing.pricePerAlbumCents
          : 0,
  };
}

export interface AlbumDoc {
  id: string;
  studioId: string;
  galleryId: string;
  /** Display name — typically the client's name (e.g. "Família Silva"). */
  title: string;
  subjectName?: string | null;
  coverPhotoUrl?: string | null;
  /**
   * References to photos in the parent gallery that belong to this album.
   * Order is preserved and used for display.
   */
  photoIds: string[];
  /** Access level — see GalleryDoc.visibility. */
  visibility?: Visibility;
  createdAt: string;
}

export interface PhotoDoc {
  id: string;
  studioId: string;
  galleryId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  storagePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  contentType: string | null;
  fileName: string;
  createdAt: string;
}

export interface SlugReservation {
  slug: string;
  studioId: string;
  ownerId: string;
  createdAt: string;
}

/**
 * A visual "person" inside a gallery — produced by InsightFace clustering
 * on the FastAPI backend. Open clusters appear as album suggestions; once
 * the photographer promotes one, status flips to `promoted` and `albumId`
 * points at the freshly-created album.
 */
export type FaceClusterStatus = 'open' | 'promoted' | 'dismissed';

export interface FaceClusterDoc {
  id: string;
  galleryId: string;
  studioId: string;
  centroid: number[];
  photoCount: number;
  photoIds: string[];
  representativePhotoId: string | null;
  representativePhotoUrl: string | null;
  representativeThumbnailUrl: string | null;
  /** Bounding box on the representative photo: [x1, y1, x2, y2] in pixels. */
  representativeBbox: number[] | null;
  representativeScore: number;
  status: FaceClusterStatus;
  albumId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------ */
/* Orders / cart                                                              */
/* ------------------------------------------------------------------------ */

/**
 * Lifecycle of a public-storefront purchase, from "interested visitor"
 * to "delivered files".
 *
 *   cart     — interest only. Items + phone captured, but the visitor
 *              didn't reach checkout. Shown in the "Carrinhos não
 *              finalizados" tab so the photographer can chase the lead.
 *   pending  — visitor confirmed name/phone and clicked "pagamento
 *              realizado". Awaiting Pix proof; admin marks it paid.
 *   paid     — admin marked it paid. `accessToken` is then minted and
 *              the customer can download originals.
 *   cancelled — admin or customer dropped the order.
 */
export type OrderStatus = 'cart' | 'pending' | 'paid' | 'cancelled';

export type OrderItemType = 'photo' | 'album';

/**
 * One line item on an order. Prices are snapshotted from
 * `resolveGalleryPrices` at the moment of add-to-cart so later changes
 * to the gallery / studio defaults can't retroactively alter checkouts.
 */
export interface OrderItem {
  type: OrderItemType;
  /** photoId or albumId, depending on `type`. */
  itemId: string;
  /** Resolved title used for display in cart/dashboard. */
  title: string;
  /** Best-effort thumbnail for the cart summary. */
  thumbnailUrl: string | null;
  /** Photo count when `type === 'album'` (purely informational). */
  photoCount?: number | null;
  /** Snapshot price for this line (BRL cents). */
  priceCents: number;
}

export interface OrderDoc {
  id: string;
  studioId: string;
  galleryId: string;
  /** Storefront slug at the time of purchase — denormalised for the dashboard table. */
  studioSlug: string;
  /** Gallery title at the time of purchase. */
  galleryTitle: string;
  /** Customer phone in E.164 (e.g. `+5511999999999`). */
  customerPhone: string;
  /** Captured only at checkout, not on initial cart save. */
  customerName: string | null;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  /**
   * Random URL-safe token that grants direct download access to the
   * paid order via `/minhas-compras/[token]`. Minted only when the
   * order transitions to `paid`.
   */
  accessToken: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when status transitions to `paid`. */
  paidAt: string | null;
}

export interface ClientDoc {
  id: string;
  studioId: string;
  name: string;
  /** Customer phone in E.164 (e.g. `+5511999999999`). */
  phone: string;
  createdAt: string;
  updatedAt: string;
}
