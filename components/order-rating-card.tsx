import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { StarRatingInput } from '@/components/star-rating-input';
import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { submitEnterpriseReview } from '@/lib/reviews';
import { validateDescription } from '@/lib/form-validation';

type Props = {
  sousCommandeId: string;
  merchantName: string;
  onRated: () => void;
};

function createRatingStyles(c: AppPalette) {
  return StyleSheet.create({
    box: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    question: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textSecondary,
    },
    merchant: {
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
    },
    commentInput: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      minHeight: 72,
      textAlignVertical: 'top',
      backgroundColor: c.inputBg,
      color: c.text,
    },
    error: {
      fontSize: 12,
      color: c.error,
      fontWeight: '600',
    },
    btn: {
      marginTop: 4,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.45,
    },
    btnPressed: {
      opacity: 0.92,
    },
    btnText: {
      color: c.onPrimary,
      fontWeight: '800',
      fontSize: 14,
    },
    doneBox: {
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor: c.successSoft,
    },
    doneText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.success,
      textAlign: 'center',
    },
  });
}

export function OrderRatingCard({ sousCommandeId, merchantName, onRated }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createRatingStyles(colors), [colors]);
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (note < 1 || submitting || done) return;
    setError(null);
    const commentCheck = validateDescription(commentaire, 500);
    if (!commentCheck.ok) {
      setError(commentCheck.message);
      return;
    }
    setSubmitting(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await submitEnterpriseReview(token, sousCommandeId, note, commentaire.trim());
      setDone(true);
      onRated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneBox}>
        <ThemedText style={styles.doneText}>Merci pour votre note !</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <ThemedText style={styles.question}>Votre commande s&apos;est bien passée ?</ThemedText>
      <ThemedText style={styles.merchant} numberOfLines={1}>
        {merchantName}
      </ThemedText>
      <StarRatingInput value={note} onChange={setNote} disabled={submitting} size={30} />
      <TextInput
        style={styles.commentInput}
        placeholder="Commentaire (optionnel)"
        placeholderTextColor={colors.placeholder}
        value={commentaire}
        onChangeText={setCommentaire}
        editable={!submitting && !done}
        multiline
        maxLength={500}
      />
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          (note < 1 || submitting) && styles.btnDisabled,
          pressed && note >= 1 && !submitting && styles.btnPressed,
        ]}
        disabled={note < 1 || submitting}
        onPress={() => void submit()}>
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          <ThemedText style={styles.btnText}>Envoyer la note</ThemedText>
        )}
      </Pressable>
    </View>
  );
}
