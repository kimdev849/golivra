/**
 * Palette GoLivra — clair + sombre.
 * Deux couleurs marque issues du logo :
 *   - vert profond (`GOLIVRA_GREEN`) →identité principale
 *   - jaune/orange chaud (`GOLIVRA_YELLOW`) →accent & call-to-action secondaire
 * Les fonds clairs utilisent des neutres légèrement teintés vert pour rester cohérents.
 */

export type ColorSchemeName = 'light' | 'dark';

export type AppPalette = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryBright: string;
  primaryDeep: string;
  primarySoft: string;
  primaryMuted: string;
  onPrimary: string;
  /** Jaune/orange du logo — utilisé pour accents, badges, gradients, CTA secondaires. */
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentSoft: string;
  accentMuted: string;
  onAccent: string;
  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabInactive: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  overlay: string;
  heroGlow: string;
  statusBar: 'light' | 'dark';
};

/** Vert marque GoLivra — référence principale de l'identité. */
export const GOLIVRA_GREEN = '#0B6B45';
export const GOLIVRA_GREEN_DEEP = '#0C4F36';

/**
 * Vert profond quasi-noir — fond du splash (démarrage) harmonisé avec le
 * logo `app.icon.png` (analyse de l'image : coins ≈ #03291A, centre ≈ #206020).
 * Le vert vif de la marque (#0B6B45) jurait avec le logo sombre.
 */
export const GOLIVRA_GREEN_SPLASH = '#062A1B';
export const GOLIVRA_GREEN_SPLASH_DEEP = '#03160D';

/** Jaune/orange du logo (évoque la couleur "LIVRA" et le teardrop du pin). */
export const GOLIVRA_YELLOW = '#F5A524';
export const GOLIVRA_YELLOW_DEEP = '#D27A09';
export const GOLIVRA_YELLOW_BRIGHT = '#FFB940';

/** Ombre / halo associés au vert (pas une autre teinte de vert). */
export const GOLIVRA_BRAND_SHADOW = '#0C3020';

export function rgbaBrand(alpha: number): string {
  return `rgba(11, 107, 69, ${alpha})`;
}

export function rgbaAccent(alpha: number): string {
  return `rgba(245, 165, 36, ${alpha})`;
}

/**
 * Dégradé marque "vitesse + énergie" : vert → jaune → vert.
 * Utilisé sur le hero, le FAB, les bannières, les boutons primaires premium.
 */
export function brandGradient3(colors: AppPalette): readonly [string, string, string] {
  return [colors.primaryDeep, colors.accent, colors.primary] as const;
}

/** Dégradé purement jaune pour accents (boutons promo, badges "nouveau", etc.). */
export function accentGradient2(colors: AppPalette): readonly [string, string] {
  return [colors.accent, colors.accentDeep] as const;
}

export const AppPaletteLight: AppPalette = {
  background: '#FFFFFF',
  backgroundAlt: '#F6FAF7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F4F6F5',
  border: '#E8F2EC',
  borderStrong: '#D6E6DC',
  text: '#11181C',
  textSecondary: '#355245',
  textMuted: '#6A8578',
  textInverse: '#FFFFFF',
  primary: GOLIVRA_GREEN,
  primaryBright: GOLIVRA_GREEN,
  primaryDeep: GOLIVRA_GREEN_DEEP,
  primarySoft: '#EAF4EE',
  primaryMuted: rgbaBrand(0.12),
  onPrimary: '#FFFFFF',
  accent: GOLIVRA_YELLOW,
  accentBright: GOLIVRA_YELLOW_BRIGHT,
  accentDeep: GOLIVRA_YELLOW_DEEP,
  accentSoft: '#FFF5E0',
  accentMuted: rgbaAccent(0.18),
  onAccent: '#1A1A1A',
  success: GOLIVRA_GREEN,
  successSoft: '#ECFDF3',
  error: '#B42318',
  errorSoft: '#FEF3F2',
  warning: GOLIVRA_YELLOW_DEEP,
  warningSoft: '#FFF5D6',
  tabBarBg: 'rgba(255,255,255,0.94)',
  tabBarBorder: '#E8F2EC',
  tabInactive: '#6A8075',
  inputBg: '#FFFFFF',
  inputBorder: '#ECF4EF',
  placeholder: '#95ACA0',
  overlay: 'rgba(12, 48, 32, 0.45)',
  heroGlow: '#EAF4EE',
  statusBar: 'dark',
};

// Vert plus clair pour le mode sombre : #0B6B45 sur fond #0B0C0E donne
// un contraste ~2.5:1 (bien en dessous du minimum WCAG 4.5:1).
const GOLIVRA_GREEN_DARK = '#4CAF50';

export const AppPaletteDark: AppPalette = {
  background: '#0B0C0E',
  backgroundAlt: '#101214',
  surface: '#15171A',
  surfaceElevated: '#1C1F24',
  surfaceMuted: '#121416',
  border: '#2A2F36',
  borderStrong: '#363C45',
  text: '#EDEDEF',
  textSecondary: '#C4C8CC',
  textMuted: '#8B939C',
  textInverse: '#0B0C0E',
  primary: GOLIVRA_GREEN_DARK,
  primaryBright: GOLIVRA_GREEN_DARK,
  primaryDeep: GOLIVRA_GREEN_DEEP,
  primarySoft: rgbaBrand(0.15),
  primaryMuted: rgbaBrand(0.2),
  onPrimary: '#FFFFFF',
  accent: GOLIVRA_YELLOW,
  accentBright: GOLIVRA_YELLOW_BRIGHT,
  accentDeep: GOLIVRA_YELLOW_DEEP,
  accentSoft: 'rgba(245, 165, 36, 0.14)',
  accentMuted: 'rgba(245, 165, 36, 0.22)',
  onAccent: '#0B0C0E',
  success: GOLIVRA_GREEN_DARK,
  successSoft: rgbaBrand(0.12),
  error: '#F87171',
  errorSoft: 'rgba(248, 113, 113, 0.12)',
  warning: GOLIVRA_YELLOW_BRIGHT,
  warningSoft: rgbaAccent(0.15),
  tabBarBg: 'rgba(15, 17, 20, 0.94)',
  tabBarBorder: '#2A2F36',
  tabInactive: '#7A848E',
  inputBg: '#1C1F24',
  inputBorder: '#2A2F36',
  placeholder: '#6B7280',
  overlay: 'rgba(0, 0, 0, 0.65)',
  heroGlow: rgbaBrand(0.08),
  statusBar: 'light',
};

export function paletteForScheme(scheme: ColorSchemeName): AppPalette {
  return scheme === 'dark' ? AppPaletteDark : AppPaletteLight;
}
