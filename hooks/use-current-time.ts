import { useEffect, useState } from 'react';

/**
 * Renvoie la date courante et la rafraîchit toutes les `intervalMs`
 * millisecondes. Utilisé pour recalculer en direct le statut ouvert/fermé
 * des commerces : quand l'heure d'ouverture passe (ex. 7h30), l'écran se
 * re-rend et le statut se met à jour sans attendre un refetch réseau.
 */
export function useCurrentTime(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
