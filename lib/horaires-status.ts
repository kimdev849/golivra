import type { EnterpriseHoraires } from '@/lib/enterprise';

/**
 * Logique pure des horaires d'ouverture (statut ouvert/fermé + prochaine
 * ouverture). Aucune dépendance React Native → testable en Node.
 */

/**
 * Retourne la date/heure en timezone de Brazzaville (Africa/Brazzaville, UTC+1).
 * Les horaires des commerces sont exprimés en heure locale de Brazzaville,
 * pas en UTC. Sans cette conversion, un navigateur en UTC verrait les
 * commerces fermés 1h trop tôt (ex. « fermé à 12h29 UTC » alors qu'il
 * est 13h29 à Brazzaville).
 */
function nowInBrazzaville(): Date {
  const now = new Date();
  // Convertir en heure de Brazzaville (UTC+1)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const BRAZZA_OFFSET = 1 * 60_000; // UTC+1
  return new Date(utcMs + BRAZZA_OFFSET);
}

/** Index JS des jours : 0=dimanche … 6=samedi (même base que `Date.getDay()`). */
export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** "09:00:00" → "9h", "14:30:00" → "14h30". */
export function formatHourLabel(h: string | null | undefined): string {
  if (!h) return '';
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(h);
  const hh = Number(m[1]);
  const mm = m[2];
  return mm === '00' ? `${hh}h` : `${hh}h${mm}`;
}

function toMinutes(h: string | null | undefined): number | null {
  if (!h) return null;
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Statut ouvert/fermé à l'instant T (mêmes règles que le backend : plages,
 * chevauchement minuit).
 *
 * `nextLabel` indique la prochaine ouverture en commençant AUJOURD'HUI :
 * « aujourd'hui à 9h », « demain à 9h » ou « jeudi à 9h ». Un commerce qui
 * ouvre plus tard dans la journée ne doit PAS être affiché « fermé
 * aujourd'hui ».
 */
export function computeOpenStatus(
  horaires: EnterpriseHoraires[],
  now: Date = nowInBrazzaville(),
): { open: boolean; todayHours: string; nextLabel: string } {
  const todayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayPlages = horaires.filter((h) => Number(h.jour) === todayIdx);
  const inWindow = (p: EnterpriseHoraires) => {
    const start = toMinutes(p.ouverture);
    const end = toMinutes(p.fermeture);
    if (start == null || end == null) return false;
    if (end > start) return nowMin >= start && nowMin < end;
    return nowMin >= start || nowMin < end; // chevauchement minuit
  };
  const open = todayPlages.some(inWindow);

  const todayHours = todayPlages
    .map((p) => `${formatHourLabel(p.ouverture)}–${formatHourLabel(p.fermeture)}`)
    .join(', ');

  const hourLabelOf = (minutes: number) =>
    formatHourLabel(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`,
    );

  let nextLabel = '';
  // La recherche commence AUJOURD'HUI (offset 0) : si le commerce ouvre plus
  // tard dans la journée (ex. 7h maintenant, ouverture 9h), on l'indique au
  // lieu de laisser croire qu'il est fermé toute la journée.
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    let plages = horaires
      .filter((h) => Number(h.jour) === day.getDay())
      .map((p) => toMinutes(p.ouverture))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);
    if (offset === 0) {
      // Aujourd'hui : uniquement les ouvertures pas encore commencées.
      plages = plages.filter((m) => m > nowMin);
    }
    if (plages.length > 0) {
      const start = plages[0];
      const when =
        offset === 0
          ? `aujourd'hui à ${hourLabelOf(start)}`
          : offset === 1
            ? `demain à ${hourLabelOf(start)}`
            : `${DAY_LONG[day.getDay()]} à ${hourLabelOf(start)}`;
      nextLabel = when;
      break;
    }
  }

  return { open, todayHours, nextLabel };
}

/** Minutes → "HH:MM" (boucle sur 24 h pour les plages qui chevauchent minuit). */
function minutesToHHMM(total: number): string {
  const m = Math.max(0, Math.floor(Number(total) || 0));
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Faisabilité d'une commande à l'instant T (mêmes règles que le backend) :
 * une commande n'est possible que si la préparation (`prepMinutes`) peut se
 * terminer avant la fermeture de la plage en cours. Gère les plages qui
 * chevauchent minuit (ex. 22:00 → 02:00).
 */
export function computeOrderFeasibility(
  horaires: EnterpriseHoraires[],
  prepMinutes = 0,
  now: Date = nowInBrazzaville(),
): { peutCommander: boolean; fermeture: string | null; derniereCommande: string | null } {
  const list = Array.isArray(horaires) ? horaires : [];
  if (list.length === 0) return { peutCommander: false, fermeture: null, derniereCommande: null };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay();
  const prep = Math.max(0, Math.floor(Number(prepMinutes) || 0));

  const active = list.find((w) => {
    if (Number(w.jour) !== todayIdx) return false;
    const start = toMinutes(w.ouverture);
    const end = toMinutes(w.fermeture);
    if (start == null || end == null) return false;
    if (end > start) return nowMin >= start && nowMin < end;
    return nowMin >= start || nowMin < end;
  });
  if (!active) return { peutCommander: false, fermeture: null, derniereCommande: null };

  const startMin = toMinutes(active.ouverture)!;
  let closeMin = toMinutes(active.fermeture)!;
  // Plage qui chevauche minuit et on est AVANT minuit : la fermeture est demain.
  if (closeMin <= startMin && nowMin >= startMin) closeMin += 1440;

  const peutCommander = nowMin + prep <= closeMin;
  const cutoff = closeMin - prep;
  return {
    peutCommander,
    fermeture: formatHourLabel(active.fermeture),
    derniereCommande: minutesToHHMM(cutoff),
  };
}

export type LiveStatusOptions = {
  /** Temps de préparation (min) pour la règle « trop tard pour commander ». */
  prepMinutes?: number;
  kind: 'boutique' | 'restaurant';
  /** Le vendeur a fermé manuellement (serveur `ouvert === false`). */
  fermeManuellement?: boolean;
  /** Aucun horaire défini (serveur `accepte_commandes === false`). */
  sansHoraires?: boolean;
};

export type LiveStatus = {
  estFerme: boolean;
  tropTard: boolean;
  commandesBloquees: boolean;
  /** « Ouvert » · « Fermé · rouvre aujourd'hui à 9h » · « Plus de commandes aujourd'hui ». */
  label: string;
  /** Pastille colorée : success | warning | error. */
  tone: 'success' | 'warning' | 'error';
  /** Bannière rouge (fermé). */
  messageFermeture: string;
  /** Bannière jaune (trop tard pour commander). */
  messageCommande: string | null;
  derniereCommandeLabel: string | null;
};

/**
 * Statut ouvert/fermé recalculé EN DIRECT côté client, à l'heure locale
 * (`now`). Le serveur calcule ce statut à l'instant de la requête et le cache
 * client le fige (jusqu'à plusieurs minutes) : sans ce recalcul local, un
 * commerce qui ouvre à 7h30 resterait affiché « Réouverture à 7h30 » à 7h53
 * et le panier resterait bloqué.
 */
export function computeLiveStatus(
  horaires: EnterpriseHoraires[],
  options: LiveStatusOptions,
  now: Date = nowInBrazzaville(),
): LiveStatus {
  const list = Array.isArray(horaires) ? horaires : [];
  const kind = options.kind === 'boutique' ? 'boutique' : 'restaurant';
  const typeRef = kind === 'boutique' ? 'cette boutique' : 'ce restaurant';
  const typeCap = kind === 'boutique' ? 'Cette boutique' : 'Ce restaurant';
  const fermeRef =
    kind === 'boutique'
      ? 'Cette boutique est actuellement fermée.'
      : 'Ce restaurant est actuellement fermé.';
  const prep = Math.max(0, Math.floor(Number(options.prepMinutes) || 0));

  // Fermeture manuelle par le vendeur (toggle « ouvert/fermé » du dashboard)
  // → prioritaire, même si les horaires n'ont pas encore été chargés.
  if (options.fermeManuellement) {
    return {
      estFerme: true,
      tropTard: false,
      commandesBloquees: true,
      label: 'Fermé pour le moment',
      tone: 'error',
      messageFermeture: 'Fermé pour le moment.',
      messageCommande: null,
      derniereCommandeLabel: null,
    };
  }

  // Aucun horaire → on ne peut pas recalculer : on s'appuie sur le serveur
  // (ou on laisse ouvert par défaut si l'info n'est pas arrivée).
  if (list.length === 0) {
    if (options.sansHoraires) {
      return {
        estFerme: true,
        tropTard: false,
        commandesBloquees: true,
        label: 'Fermé pour le moment',
        tone: 'warning',
        messageFermeture: `${typeCap} n'a pas encore défini ses horaires d'ouverture.`,
        messageCommande: null,
        derniereCommandeLabel: null,
      };
    }
    return {
      estFerme: false,
      tropTard: false,
      commandesBloquees: false,
      label: 'Ouvert',
      tone: 'success',
      messageFermeture: fermeRef,
      messageCommande: null,
      derniereCommandeLabel: null,
    };
  }

  const { open, nextLabel } = computeOpenStatus(list, now);
  const feas = computeOrderFeasibility(list, prep, now);

  if (!open) {
    const suite = nextLabel ? ` Réouverture ${nextLabel}.` : '';
    return {
      estFerme: true,
      tropTard: false,
      commandesBloquees: true,
      label: nextLabel ? `Fermé · rouvre ${nextLabel}` : 'Fermé',
      tone: 'error',
      messageFermeture: `${fermeRef}${suite}`,
      messageCommande: null,
      derniereCommandeLabel: null,
    };
  }

  if (!feas.peutCommander) {
    return {
      estFerme: false,
      tropTard: true,
      commandesBloquees: true,
      label: 'Plus de commandes aujourd\'hui',
      tone: 'warning',
      messageFermeture: fermeRef,
      messageCommande: `Il est trop tard pour commander aujourd'hui : ${typeRef} ferme à ${feas.fermeture ?? ''} et la préparation prend ${prep} min.`,
      derniereCommandeLabel: feas.derniereCommande
        ? `Dernière commande possible à ${feas.derniereCommande.replace(':', 'h')}.`
        : null,
    };
  }

  return {
    estFerme: false,
    tropTard: false,
    commandesBloquees: false,
    label: 'Ouvert',
    tone: 'success',
    messageFermeture: fermeRef,
    messageCommande: null,
    derniereCommandeLabel: feas.derniereCommande
      ? `Dernière commande possible à ${feas.derniereCommande.replace(':', 'h')}.`
      : null,
  };
}

/** Résumé compact pour l'affichage vendeur. */
export function summarizeHoraires(horaires: EnterpriseHoraires[]): string {
  const openDays = horaires.filter((h) => toMinutes(h.ouverture) != null && toMinutes(h.fermeture) != null);
  if (openDays.length === 0) return 'Aucun jour défini';
  if (openDays.length === 7) {
    const first = openDays[0];
    const same =
      openDays.every(
        (h) => h.ouverture === first.ouverture && h.fermeture === first.fermeture,
      );
    if (same) return `Tous les jours · ${formatHourLabel(first.ouverture)}–${formatHourLabel(first.fermeture)}`;
  }
  const byHour = new Map<string, string[]>();
  for (const h of openDays) {
    const key = `${formatHourLabel(h.ouverture)}–${formatHourLabel(h.fermeture)}`;
    const list = byHour.get(key) || [];
    list.push(DAY_SHORT[Number(h.jour)]);
    byHour.set(key, list);
  }
  return [...byHour.entries()]
    .map(([hours, days]) => `${days.join(', ')} · ${hours}`)
    .join('  |  ');
}
