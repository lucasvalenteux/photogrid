import type { StorefrontThemeId } from '@/types';

export interface StorefrontThemePreset {
  id: StorefrontThemeId;
  label: string;
  description: string;
  swatchClassName: string;
  backgroundClassName: string;
  headerClassName: string;
  footerClassName: string;
}

/**
 * Public storefront background presets. We store only the preset id in
 * Firestore and keep every class here so Tailwind can see/generate the
 * styles at build time. Includes conservative solid backgrounds plus a
 * few modern gradients for studios that want a stronger visual identity.
 */
export const STOREFRONT_THEME_PRESETS: StorefrontThemePreset[] = [
  {
    id: 'default',
    label: 'Padrão',
    description: 'Claro e neutro',
    swatchClassName: 'bg-background',
    backgroundClassName: 'bg-background',
    headerClassName: 'border-border bg-background/85',
    footerClassName: 'border-border bg-card',
  },
  {
    id: 'paper',
    label: 'Papel',
    description: 'Off-white quente',
    swatchClassName: 'bg-[#f7f1e8]',
    backgroundClassName: 'bg-[#f7f1e8]',
    headerClassName: 'border-[#eadfce] bg-[#f7f1e8]/85',
    footerClassName: 'border-[#eadfce] bg-[#fffaf2]/90',
  },
  {
    id: 'graphite',
    label: 'Grafite',
    description: 'Cinza editorial',
    swatchClassName: 'bg-[#e6e6e6]',
    backgroundClassName: 'bg-[#e6e6e6]',
    headerClassName: 'border-[#d2d2d2] bg-[#e6e6e6]/85',
    footerClassName: 'border-[#d2d2d2] bg-[#f3f3f3]/90',
  },
  {
    id: 'rose',
    label: 'Rosé',
    description: 'Sólido suave',
    swatchClassName: 'bg-[#fff1f2]',
    backgroundClassName: 'bg-[#fff1f2]',
    headerClassName: 'border-rose-200/70 bg-[#fff1f2]/85',
    footerClassName: 'border-rose-200/70 bg-white/70',
  },
  {
    id: 'sand',
    label: 'Areia',
    description: 'Sólido editorial',
    swatchClassName: 'bg-[#efe4d1]',
    backgroundClassName: 'bg-[#efe4d1]',
    headerClassName: 'border-[#d8c8ad] bg-[#efe4d1]/85',
    footerClassName: 'border-[#d8c8ad] bg-[#f8efdf]/90',
  },
  {
    id: 'ocean',
    label: 'Oceano',
    description: 'Azul profundo',
    swatchClassName: 'bg-[#e8f3ff]',
    backgroundClassName: 'bg-[#e8f3ff]',
    headerClassName: 'border-sky-200/70 bg-[#e8f3ff]/85',
    footerClassName: 'border-sky-200/70 bg-white/70',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Gradiente frio',
    swatchClassName: 'bg-gradient-to-br from-cyan-100 via-white to-violet-100',
    backgroundClassName: 'bg-gradient-to-br from-cyan-100 via-white to-violet-100',
    headerClassName: 'border-white/60 bg-white/55',
    footerClassName: 'border-white/60 bg-white/55',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Gradiente quente',
    swatchClassName: 'bg-gradient-to-br from-orange-100 via-rose-50 to-fuchsia-100',
    backgroundClassName:
      'bg-gradient-to-br from-orange-100 via-rose-50 to-fuchsia-100',
    headerClassName: 'border-white/60 bg-white/55',
    footerClassName: 'border-white/60 bg-white/55',
  },
  {
    id: 'lavender',
    label: 'Lavanda',
    description: 'Gradiente delicado',
    swatchClassName: 'bg-gradient-to-br from-violet-100 via-white to-pink-100',
    backgroundClassName: 'bg-gradient-to-br from-violet-100 via-white to-pink-100',
    headerClassName: 'border-white/60 bg-white/55',
    footerClassName: 'border-white/60 bg-white/55',
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Verde moderno',
    swatchClassName: 'bg-gradient-to-br from-emerald-100 via-stone-50 to-lime-100',
    backgroundClassName:
      'bg-gradient-to-br from-emerald-100 via-stone-50 to-lime-100',
    headerClassName: 'border-white/60 bg-white/55',
    footerClassName: 'border-white/60 bg-white/55',
  },
];

export function getStorefrontThemePreset(
  id: StorefrontThemeId | null | undefined,
): StorefrontThemePreset {
  const fallback = STOREFRONT_THEME_PRESETS[0];
  if (!fallback) {
    throw new Error('Missing default storefront theme preset.');
  }
  return (
    STOREFRONT_THEME_PRESETS.find((preset) => preset.id === id) ??
    fallback
  );
}
