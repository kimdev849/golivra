import { Platform } from 'react-native';

/**
 * Espace sous le contenu pour la barre de navigation pleine largeur ancrée en bas.
 * Dimensionnée sur la hauteur réelle de la barre (~66px + padding gestes) pour
 * éviter le vide blanc entre le dernier article et le menu.
 */
// Sur web le tab bar est un flex child normal (pas absolute) → pas de padding.
export const TAB_BAR_CONTENT_PADDING_BOTTOM = Platform.OS === 'web' ? 12 : (Platform.OS === 'android' ? 88 : 84);

/** Padding bas écrans détail plein écran (tab bar masquée). */
export const DETAIL_SCREEN_PADDING_BOTTOM = Platform.OS === 'android' ? 24 : 20;
