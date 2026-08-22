import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';

export const DESKTOP_MAX_WIDTH = 1200;
export const DESKTOP_PADDING = 48;
export const MOBILE_PADDING = 20;

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override maxWidth (default 1200). */
  maxWidth?: number;
  /** Extra padding on top (e.g. safe area). */
  paddingTop?: number;
  /** Extra padding on bottom. */
  paddingBottom?: number;
};

/**
 * Conteneur responsive partagé pour tous les écrans web/mobile.
 *
 * - **Mobile** : padding horizontal 16px, pleine largeur.
 * - **Desktop (web ≥ 768px)** : centré à maxWidth 1200px, padding 32px,
 *   fond opaque derrière pour éviter les fuites visuelles.
 */
export function DesktopLayout({
  children,
  style,
  maxWidth = DESKTOP_MAX_WIDTH,
  paddingTop,
  paddingBottom,
}: Props) {
  const isDesktop = useIsWebDesktop();

  return (
    <View
      style={[
        styles.root,
        isDesktop && {
          maxWidth,
          alignSelf: 'center',
          width: '100%',
          paddingHorizontal: DESKTOP_PADDING,
        },
        !isDesktop && {
          paddingHorizontal: MOBILE_PADDING,
        },
        paddingTop != null ? { paddingTop } : undefined,
        paddingBottom != null ? { paddingBottom } : undefined,
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Section avec titre + contenu — sépare visuellement les blocs.
 */
export function DesktopSection({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionDot} />
            <View style={styles.sectionLine} />
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  sectionLine: {
    height: 1,
    flex: 1,
  },
});
