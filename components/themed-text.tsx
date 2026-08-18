import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useAppColors } from '@/hooks/use-app-colors';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTextScale } from '@/contexts/text-scale-context';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'muted';
};

const TYPE_STYLES: Record<NonNullable<ThemedTextProps['type']>, TextStyle> = {
  default: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 32, fontWeight: 'bold', lineHeight: 36 },
  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  subtitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  link: { lineHeight: 24, fontSize: 16, fontWeight: '700' },
  muted: { fontSize: 14, lineHeight: 20 },
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const colors = useAppColors();
  const { scale } = useTextScale();
  const defaultColor =
    type === 'muted' ? colors.textMuted : type === 'link' ? colors.primary : colors.text;
  const color = useThemeColor(
    { light: lightColor ?? defaultColor, dark: darkColor ?? defaultColor },
    'text',
  );

  const base = TYPE_STYLES[type];

  // Taille de texte globale : multiplie la taille de base + toute taille inline.
  let scaled: TextStyle | null = null;
  if (scale !== 1) {
    const flat = StyleSheet.flatten([base, style]) as TextStyle;
    const fontScale = (n?: number) => (typeof n === 'number' ? Math.round(n * scale) : undefined);
    scaled = {
      fontSize: fontScale(flat.fontSize),
      lineHeight: flat.lineHeight != null ? fontScale(flat.lineHeight) : undefined,
    };
  }

  // `style` après `{ color }` : la couleur explicite passée par l'appelant doit
  // gagner sur la couleur du thème. Avant, l'ordre inverse écrasait par ex. le
  // blanc du slogan du landing (rendu noir sur l'image en mode clair).
  return (
    <Text
      style={[base, { color }, style, scaled]}
      {...rest}
    />
  );
}
