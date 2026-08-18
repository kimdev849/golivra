import { View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';
import { formatDateTimeFr, type TimelineStep } from '@/lib/datetime';

type Props = {
  steps: TimelineStep[];
  title?: string;
  emptyMessage?: string;
};

export function EventTimeline({ steps, title, emptyMessage = 'Aucun horaire enregistré pour le moment.' }: Props) {
  const colors = useAppColors();
  const items = steps.filter((s) => s?.at);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {title ? (
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]}>
          {title}
        </ThemedText>
      ) : null}
      {items.length === 0 ? (
        <ThemedText style={[styles.empty, { color: colors.textMuted }]}>{emptyMessage}</ThemedText>
      ) : (
        items.map((step, index) => {
          const isLast = index === items.length - 1;
          return (
            <View key={`${step.key}-${step.at}`} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isLast ? colors.primary : colors.surface,
                      borderColor: isLast ? colors.primary : colors.borderStrong,
                    },
                  ]}
                />
                {!isLast ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
              </View>
              <View style={styles.body}>
                <ThemedText
                  style={[
                    styles.label,
                    { color: isLast ? colors.primaryDeep : colors.text, fontWeight: isLast ? '800' : '600' },
                  ]}>
                  {step.label}
                </ThemedText>
                <ThemedText style={[styles.when, { color: colors.textMuted }]}>
                  {step.label_fr || formatDateTimeFr(step.at)}
                </ThemedText>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 15, marginBottom: 4 },
  empty: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 14, minHeight: 46 },
  rail: { width: 18, alignItems: 'center' },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 3,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
    borderRadius: 1,
    minHeight: 24,
  },
  body: { flex: 1, gap: 2, paddingBottom: 10 },
  label: { fontSize: 14, lineHeight: 19 },
  when: { fontSize: 12, fontWeight: '600' },
});
