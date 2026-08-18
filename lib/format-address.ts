import { QUARTIERS_BRAZZAVILLE } from '@/constants/quartiers-brazzaville';
import { validateAddress, validateAddressLabel, validateLandmark } from '@/lib/form-validation';

/** Champs alignés sur la table `adresses` (schéma v3). */
export type DeliveryAddressFields = {
  /** Nom court affiché (ex. "Maison", "Travail") — optionnel (nullable côté serveur). */
  libelle?: string | null;
  quartier: string;
  ligne1: string;
  instructions?: string | null;
  point_reperes?: string | null;
  ville?: string;
  pays?: string;
};

export function formatDeliveryAddressText(fields: DeliveryAddressFields): string {
  const parts = [
    fields.quartier?.trim(),
    fields.ligne1?.trim(),
    fields.point_reperes?.trim(),
    fields.instructions?.trim(),
    fields.ville?.trim() || 'Brazzaville',
    fields.pays?.trim() || 'Congo',
  ].filter(Boolean);
  return parts.join(' · ');
}

const NUMERIC_ONLY_REGEX = /^[0-9\s]+$/;

export function isDeliveryAddressComplete(fields: Partial<DeliveryAddressFields>): boolean {
  const q = String(fields.quartier || '').trim();
  const l = String(fields.ligne1 || '').trim();
  if (!q) return false;
  if (l.length < 4) return false;
  if (NUMERIC_ONLY_REGEX.test(l)) return false;
  return true;
}

export function deliveryAddressError(fields: Partial<DeliveryAddressFields>): string | null {
  // Nom de l'adresse (optionnel) : s'il est saisi, il doit être un vrai nom
  // (« Maison », « Travail », « Chez maman »…) — pas des symboles comme
  // « @$%3ddf ».
  const libelle = String(fields.libelle ?? '').trim();
  if (libelle) {
    const lb = validateAddressLabel(libelle);
    if (!lb.ok) return lb.message;
  }
  const q = String(fields.quartier || '').trim();
  const l = String(fields.ligne1 || '').trim();
  if (!q) return 'Choisissez un arrondissement.';
  if (!l) return 'Indiquez une adresse détaillée.';
  // Délègue au validateur partagé (miroir du backend, lib/validators.js) :
  // les règles d'adresse ne vivent qu'à un seul endroit, plus de dérive
  // entre les formulaires et le panier.
  const r = validateAddress(l);
  if (!r.ok) return r.message;
  // « Point de repère » et « Instructions livreur » (optionnels) : s'ils sont
  // saisis, ils doivent être un vrai repère / une vraie instruction — pas de
  // poubelle comme « @#####^ », « !!! » ou « 12345 ».
  const pointReperes = String(fields.point_reperes ?? '').trim();
  if (pointReperes) {
    const pr = validateLandmark(pointReperes);
    if (!pr.ok) return pr.message;
  }
  const instructions = String(fields.instructions ?? '').trim();
  if (instructions) {
    const ins = validateLandmark(instructions);
    if (!ins.ok) return ins.message;
  }
  return null;
}

/** Reprend un quartier existant ou propose « Autre » si seule l’adresse texte est connue. */
export function quartierForForm(stored: string | null | undefined, hasLigne1: boolean): string {
  const q = String(stored || '').trim();
  if (q && (QUARTIERS_BRAZZAVILLE as readonly string[]).includes(q)) return q;
  if (q) return q;
  if (hasLigne1) return 'Autre';
  return '';
}

export function snapshotFromFields(fields: DeliveryAddressFields) {
  return {
    libelle: fields.libelle?.trim() || null,
    quartier: fields.quartier.trim(),
    ligne1: fields.ligne1.trim(),
    instructions: fields.instructions?.trim() || null,
    point_reperes: fields.point_reperes?.trim() || null,
    ville: fields.ville?.trim() || 'Brazzaville',
    pays: fields.pays?.trim() || 'Congo',
  };
}

/** Nom affichable d'une adresse (retombe sur "Domicile" si absent). */
export function addressLabel(libelle?: string | null): string {
  const l = (libelle ?? '').trim();
  return l || 'Domicile';
}
