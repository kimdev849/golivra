import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, User, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAppColors } from '@/hooks/use-app-colors';
import { LUCIDE_STROKE } from '@/constants/icons';

type Props = {
  visible: boolean;
  onLogin: () => void;
  onSignup: () => void;
  onDismiss: () => void;
};

/**
 * Bottom sheet élégant pour demander la connexion à un utilisateur invité.
 *
 * S'affiche quand l'utilisateur tente une action nécessitant un compte
 * (favoris, profil, commande…). Design épuré, sans agressivité.
 */
export function GuestLoginSheet({ visible, onLogin, onSignup, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />

      {/* Sheet */}
      <Animated.View
        entering={FadeInDown.duration(300).springify().damping(18)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}>
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={8}>
          <X size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        </Pressable>

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <User size={32} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Continuez avec GoLivra
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Connectez-vous pour enregistrer vos favoris,{'\n'}gérer vos commandes et suivre vos livraisons.
        </Text>

        {/* CTA Login */}
        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            { opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={onLogin}
          activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginBtnGradient}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />
          </LinearGradient>
        </Pressable>

        {/* CTA Signup */}
        <Pressable
          style={({ pressed }) => [
            styles.signupBtn,
            { borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={onSignup}
          activeOpacity={0.9}>
          <Text style={[styles.signupBtnText, { color: colors.primary }]}>
            Créer un compte gratuit
          </Text>
        </Pressable>

        {/* Merchant link */}
        <Pressable onPress={onSignup} style={styles.merchantLink} hitSlop={6}>
          <Text style={[styles.merchantText, { color: colors.textMuted }]}>
            🏪 Vous avez un commerce ?{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              Inscrivez-le ici
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
    gap: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  loginBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  loginBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  signupBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  signupBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  merchantLink: {
    marginTop: 4,
    paddingVertical: 4,
  },
  merchantText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
