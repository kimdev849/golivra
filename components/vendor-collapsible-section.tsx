import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import type { AppPalette } from '@/constants/app-palette';

type Props = {
  title: string;
  accent: string;
  colors: AppPalette;
  Icon?: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Section repliable « Informations supplémentaires » : l'essentiel reste
 * visible, les options avancées se déplient sans quitter la page.
 *
 * Contrôlée par le parent (`open`/`onToggle`) pour pouvoir l'ouvrir
 * automatiquement quand une erreur de validation se trouve dedans.
 */
export function VendorCollapsibleSection({
  title,
  accent,
  colors,
  Icon,
  open,
  onToggle,
  children,
}: Props) {
  const toggle = () => {
    void Haptics.selectionAsync();
    onToggle();
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.header,
          { borderColor: colors.border, backgroundColor: colors.surface },
          pressed && styles.headerPressed,
        ]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        {Icon ? (
          <View style={[styles.headerIcon, { backgroundColor: accent }]}>
            <Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        ) : null}
        <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
        <ChevronDown
          size={18}
          color={colors.textMuted}
          strokeWidth={LUCIDE_STROKE}
          style={open ? styles.chevronOpen : undefined}
        />
      </Pressable>
      {open ? (
        <View style={[styles.body, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  headerPressed: { opacity: 0.88 },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 2,
  },
});
