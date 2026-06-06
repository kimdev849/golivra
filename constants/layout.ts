import { Platform } from 'react-native';

/** Espace sous le contenu pour tab bar pill + FAB panier (flottante). */
export const TAB_BAR_CONTENT_PADDING_BOTTOM = Platform.OS === 'android' ? 142 : 136;

/** Padding bas écrans détail plein écran (tab bar masquée). */
export const DETAIL_SCREEN_PADDING_BOTTOM = Platform.OS === 'android' ? 24 : 20;
