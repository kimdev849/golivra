import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';
import {
  getBiometricLockEnabled,
  isBiometricHardwareAvailable,
  promptBiometricUnlock,
} from '@/lib/biometric-lock';

type Props = { children: ReactNode };

/**
 * Verrouillage biométrique optionnel (paramètres) : Face ID / empreinte.
 *
 * C'est l'UNIQUE point de verrouillage de l'app :
 *  - au démarrage à froid (une fois) ;
 *  - au retour d'un VRAI arrière-plan (le téléphone a affiché une autre app).
 *
 * Points importants (anti-« pagaille ») :
 *  - L'état `inactive` est IGNORÉ : il survient aussi pour la boîte de dialogue
 *    biométrique elle-même, le clavier ou le panneau de notifications. Le
 *    verrouiller dessus relançait le déverrouillage « encore et encore ».
 *  - Délai de grâce de 15 s : une bascule rapide entre deux apps ne redemande
 *    pas le code (seul un vrai retour après 15 s + verrouille).
 *  - Annulation / échec : on reste sur l'écran verrouillé avec un bouton
 *    « Déverrouiller » — jamais de déconnexion ni de renvoi vers la connexion.
 */
const LOCK_GRACE_MS = 15_000;

export function BiometricAppGate({ children }: Props) {
  const colors = useAppColors();
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);
  const promptingRef = useRef(false);

  const tryUnlock = useCallback(() => {
    if (promptingRef.current) return;
    promptingRef.current = true;
    void promptBiometricUnlock('Déverrouiller GoLivra')
      .then((ok) => setUnlocked(ok))
      .finally(() => {
        promptingRef.current = false;
      });
  }, []);

  // Démarrage à froid : si le verrou est actif, on verrouille immédiatement
  // (l'écran de garde est au-dessus du splash) et on propose le déverrouillage.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const hardware = await isBiometricHardwareAvailable();
      if (!alive || !hardware) return;
      const isEnabled = await getBiometricLockEnabled();
      if (!alive || !isEnabled) return;
      setEnabled(true);
      setUnlocked(false);
      tryUnlock();
    })();
    return () => {
      alive = false;
    };
  }, [tryUnlock]);

  // Retour au premier plan : ne verrouille que depuis un VRAI arrière-plan.
  // Le réglage est RE-VÉRIFIÉ à chaque retour : si l'utilisateur a désactivé
  // le verrou dans les paramètres, on ne le demande plus (sans redémarrage).
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;

      if (next === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (prev !== 'background' || next !== 'active') return;

      const elapsed =
        backgroundedAt.current != null ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (elapsed < LOCK_GRACE_MS) return; // bascule rapide : pas de redemande

      void (async () => {
        const isEnabled = await getBiometricLockEnabled();
        if (!isEnabled) {
          setEnabled(false);
          setUnlocked(true);
          return;
        }
        setEnabled(true);
        setUnlocked(false);
        tryUnlock();
      })();
    });

    return () => sub.remove();
  }, [tryUnlock]);

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <View style={[styles.lock, { backgroundColor: colors.background }]}>
      <ThemedText type="subtitle" style={{ color: colors.text, textAlign: 'center' }}>
        GoLivra est verrouillée
      </ThemedText>
      <ThemedText style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
        Utilisez Face ID ou votre empreinte pour continuer
      </ThemedText>
      <Pressable
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={tryUnlock}>
        <ThemedText style={{ color: colors.onPrimary, fontWeight: '800' }}>
          Déverrouiller
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  btn: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
