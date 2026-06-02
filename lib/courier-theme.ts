import { AppPaletteDark, AppPaletteLight } from '@/constants/app-palette';
import { useColorScheme } from '@/hooks/use-color-scheme';

function courierFromApp(p: typeof AppPaletteLight) {
  return {
    primary: p.primary,
    primaryDeep: p.primaryDeep,
    primaryMuted: p.primaryMuted,
    primarySoft: p.primarySoft,
    accent: p.warning,
    warning: p.warning,
    warningSoft: p.warningSoft,
    bg: p.backgroundAlt,
    card: p.surface,
    surfaceElevated: p.surfaceElevated,
    border: p.border,
    muted: p.textMuted,
    text: p.text,
    textSecondary: p.textSecondary,
    trackStroke: p.borderStrong,
    tabBarInactive: p.tabInactive,
    online: p.primary,
    offline: p.textMuted,
    danger: p.error,
    dangerBg: p.errorSoft,
    dangerText: p.error,
    successBg: p.successSoft,
    successText: p.primary,
    infoBg: p.warningSoft,
    infoText: p.warning,
    inputBg: p.inputBg,
    inputBorder: p.inputBorder,
    placeholder: p.placeholder,
    pillOff: p.surfaceMuted,
    pillOffText: p.textSecondary,
    emptyBg: p.surfaceMuted,
    emptyBorder: p.border,
    emptyText: p.textSecondary,
    emptyHint: p.textMuted,
    divider: p.border,
    iconBg: p.primarySoft,
    iconBorder: p.border,
    pressedBg: p.primarySoft,
    onlinePillBg: p.successSoft,
    onlinePillBorder: p.border,
    modePillBg: p.successSoft,
    modePillText: p.primary,
    internalModePillBg: p.warningSoft,
    internalModePillText: p.warning,
    trackLabel: p.textMuted,
    trackValue: p.text,
    livreurLabel: p.textSecondary,
    sectionTitle: p.textSecondary,
  } as const;
}

const LIGHT = courierFromApp(AppPaletteLight);
const DARK = courierFromApp(AppPaletteDark);

export function useCourierPalette() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return { ...palette, isDark: scheme === 'dark' };
}

export const COURIER_PALETTE = LIGHT;
