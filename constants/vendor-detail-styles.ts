import { StyleSheet } from 'react-native';

import type { AppPalette } from '@/constants/app-palette';
import type { VendorOrderStatus } from '@/lib/vendor-types';

export function vendorStatusBadge(s: VendorOrderStatus, c: AppPalette) {
  switch (s) {
    case 'en_preparation':
      return { bg: c.warningSoft, text: c.warning };
    case 'en_livraison':
      return { bg: c.primarySoft, text: c.primaryDeep };
    case 'prete':
      return { bg: c.successSoft, text: c.success };
    default:
      return { bg: c.surfaceMuted, text: c.textSecondary };
  }
}

export function createVendorOrderDetailStyles(c: AppPalette) {
  return StyleSheet.create({
    screen: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    ref: { fontSize: 16, color: c.text },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    bigPrice: { fontSize: 22, color: c.text, marginTop: 12 },
    time: { fontSize: 13, color: c.textMuted, marginTop: 6 },
    deliveryBox: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 16,
      marginBottom: 8,
    },
    deliveryTitle: { fontSize: 13, fontWeight: '800' },
    deliveryHint: { fontSize: 13, color: c.textSecondary, marginTop: 4, lineHeight: 18 },
    livreur: { fontSize: 12, color: c.primary, marginTop: 6, fontWeight: '600' },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: c.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    blockVal: { fontSize: 16, color: c.text },
    phoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 6 },
    addr: { flex: 1, fontSize: 15, color: c.text, lineHeight: 22 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lineRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    lineThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.surfaceMuted },
    lineName: { fontSize: 15, color: c.text },
    lineDet: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    linePrice: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    sumBox: {
      marginTop: 22,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    sumLab: { fontSize: 15, color: c.textSecondary },
    sumVal: { fontSize: 15, fontWeight: '700', color: c.text },
    sumTotal: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    totalLab: { fontSize: 17, color: c.text },
    totalVal: { fontSize: 18, color: c.text },
    outlineBtn: {
      marginTop: 16,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    outlineTxt: { fontWeight: '800', fontSize: 15 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    primaryBtn: {
      marginTop: 20,
      borderRadius: 12,
      paddingVertical: 15,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    primaryTxt: { color: c.onPrimary, fontWeight: '800', fontSize: 15 },
  });
}

export function createVendorPreparationStyles(c: AppPalette) {
  return StyleSheet.create({
    screen: { flex: 1 },
    ruleHint: {
      fontSize: 13,
      color: c.textMuted,
      lineHeight: 19,
      marginTop: 8,
      marginBottom: 12,
      fontWeight: '600',
    },
    stepRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    stepCol: { flex: 1, alignItems: 'center', gap: 6 },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.border },
    stepTxt: { fontSize: 10, textAlign: 'center', color: c.textMuted, fontWeight: '600' },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginVertical: 16,
      backgroundColor: c.surface,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    pillTxt: { fontSize: 11, fontWeight: '800' },
    total: { fontSize: 20, marginTop: 10, color: c.text },
    h3: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
    article: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: c.surfaceMuted },
    det: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    primary: {
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    primaryTxt: { color: c.onPrimary, fontWeight: '800', fontSize: 15 },
    outline: {
      borderWidth: 1.5,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 14,
    },
    outlineTxt: { fontWeight: '800', fontSize: 14 },
  });
}
