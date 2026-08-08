import type { TimelineStep } from '@/lib/datetime';
import type { VendorCommerceType } from '@/lib/vendor-theme';
import type { ProductOptionGroup } from '@/lib/vendor-product-types';

export type VendorShop = {
  id: string;
  type: VendorCommerceType;
  nom: string;
  categorie: string;
  enLigne: boolean;
  avatar: string | null;
  description?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  adresse_quartier?: string | null;
  adresse_ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  statut_moderation?: string | null;
  /** Si true : livraison par le commerce (pas de livreur GoLivra sur les nouvelles commandes). */
  livraison_propre?: boolean;
  /** Temps de préparation (min) affiché au client : restaurant → delai_preparation_min, boutique → delai_livraison_min. */
  delaiPreparationMin: number;
};

export type VendorOrderStatus =
  | 'en_attente'
  | 'acceptee'
  | 'a_preparer'
  | 'en_preparation'
  | 'prete'
  | 'en_livraison'
  | 'livree'
  | 'annulee';

export type VendorDeliveryMode = 'golivra' | 'propre';

export type VendorOrderLine = {
  id: string;
  nom: string;
  detail?: string;
  quantite: number;
  prixUnitaire: number;
  image?: string | null;
};

export type VendorOrder = {
  id: string;
  sous_commande_id?: string;
  ref: string;
  statut: VendorOrderStatus;
  statut_brut?: string;
  mode_livraison?: VendorDeliveryMode;
  establishmentType?: VendorCommerceType;
  clientNom: string;
  clientTel: string;
  adresse: string;
  creeLeLabel: string;
  /**
   * Part du vendeur = SOUS-TOTAL PRODUITS (jamais les frais de livraison).
   * C'est le montant que le commerce recevra pour ses plats/articles.
   */
  prixTotal: number;
  /** Sous-total produits (explicite, backé par sc.sous_total). */
  sousTotal?: number;
  /** Frais de livraison GoLivra — NE COMPTENT PAS dans les revenus du vendeur. */
  fraisLivraison: number;
  noteClient?: string;
  lignes: VendorOrderLine[];
  livreur?: { nom: string; tel: string };
  livraison_statut?: string | null;
  /**
   * Nouveau parcours : statut du paiement client (en_attente / valide / echoue).
   * La commande n'est « réellement confirmée » qu'une fois le paiement validé —
   * la préparation ne démarre qu'à ce moment-là.
   */
  paiement_statut?: string | null;
  /** Délai de paiement du client (5 min après acceptation) — effacé dès paiement. */
  paiement_limite_at?: string | null;
  /** Délai d'acceptation (5 min après création). Présent si la commande est encore en attente. */
  acceptation_limite_at?: string | null;
  created_at?: string;
  commande_timeline?: TimelineStep[];
  sous_commande_timeline?: TimelineStep[];
  livraison_timeline?: TimelineStep[];
  livree_at_label?: string | null;
  attribuee_at_label?: string | null;
  created_at_label?: string | null;
};

export type VendorProduct = {
  id: string;
  nom: string;
  prix: number;
  /** Prix barré / promo si renseigné côté API. */
  prixPromo?: number | null;
  promoDebutAt?: string | null;
  promoFinAt?: string | null;
  stock: number;
  stockIllimite?: boolean;
  enLigne: boolean;
  description?: string | null;
  imageUrl?: string | null;
  imagesUrls?: string[];
  reference?: string | null;
  unite?: string | null;
  enVedette?: boolean;
  categorieId?: string | null;
  tags?: string[];
  allergenes?: string[];
  typeProduit?: string | null;
  etatProduit?: string | null;
  marque?: string | null;
  poidsKg?: number | null;
  dimensions?: { l?: number; w?: number; h?: number } | null;
  optionGroups?: ProductOptionGroup[] | null;
};

export type VendorStats = {
  revenus7j: number;
  revenusTrend: string;
  commandes: number;
  commandesTrend: string;
  produitsVendus: number;
  produitsTrend: string;
  topProduits: { nom: string; ventes: number }[];
  averageOrderValue: number;
  inventorySummary: {
    outOfStock: number;
    lowStock: number;
    total: number;
  };
  dailyRevenues: { date: string; amount: number; label: string }[];
  engagement?: {
    totalVues: number;
    totalClics: number;
    totalVentes: number;
    tauxConversionPct: number;
    topVus: { id: string; nom: string; vues: number }[];
    topCliques: { id: string; nom: string; clics: number }[];
  };
};

export type VendorEngagementInput = {
  total_vues?: number;
  total_clics?: number;
  total_ventes?: number;
  taux_conversion_pct?: number;
  taux_achat_pct?: number;
  top_vus?: { id?: string; produit_id?: string; nom?: string; vues?: number; nb_vues?: number }[];
  top_cliques?: { id?: string; produit_id?: string; nom?: string; clics?: number; nb_clics?: number }[];
};

export function countsFromOrders(orders: VendorOrder[]) {
  const all = orders.length;
  const prep = orders.filter(
    (o) =>
      o.statut === 'en_attente' ||
      o.statut === 'en_preparation' ||
      o.statut === 'a_preparer' ||
      o.statut === 'prete',
  ).length;
  const ship = orders.filter((o) => o.statut === 'en_livraison').length;
  const prete = orders.filter((o) => o.statut === 'prete').length;
  return {
    all,
    aPreparer: orders.filter((o) => o.statut === 'a_preparer').length,
    prep,
    ship,
    prete,
  };
}

export function computeVendorStats(
  orders: VendorOrder[],
  products: VendorProduct[],
  periodDays = 7,
  engagement?: VendorEngagementInput | null,
): VendorStats {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const recent = orders.filter((o) => {
    if (!o.created_at) return false;
    const date = new Date(o.created_at);
    return date >= since;
  });

  const periodLabel = periodDays === 7 ? '7 jours' : periodDays === 30 ? '30 jours' : `${periodDays} jours`;

  // Seules les commandes PAYÉES comptent dans les revenus (le client paie après
  // acceptation ; tant qu'il n'a pas payé, rien n'est gagné).
  const validRecent = recent.filter((o) => o.statut !== 'annulee' && o.paiement_statut === 'valide');

  // Part du vendeur = produits uniquement (sousTotal / prixTotal), JAMAIS les
  // frais de livraison (argent du livreur / GoLivra logistique).
  const vendorShare = (o: VendorOrder) => o.sousTotal ?? o.prixTotal;

  const revenus7j = validRecent.reduce((acc, o) => acc + vendorShare(o), 0);
  const produitsVendus = validRecent.reduce((acc, o) => acc + o.lignes.reduce((s, l) => s + l.quantite, 0), 0);
  const averageOrderValue = validRecent.length > 0 ? revenus7j / validRecent.length : 0;

  const productSales = new Map<string, number>();
  for (const o of validRecent) {
    for (const l of o.lignes) {
      productSales.set(l.nom, (productSales.get(l.nom) || 0) + l.quantite);
    }
  }
  const topProduits = [...productSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, ventes]) => ({ nom, ventes }));

  // Inventaire
  const inventorySummary = {
    outOfStock: products.filter((p) => !p.stockIllimite && p.stock <= 0).length,
    lowStock: products.filter((p) => !p.stockIllimite && p.stock > 0 && p.stock <= 5).length,
    total: products.length,
  };

  // Daily Revenues for Chart
  const dailyRevenues: { date: string; amount: number; label: string }[] = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = dayNames[d.getDay()];
    const amount = validRecent
      .filter(o => o.created_at?.startsWith(dateStr))
      .reduce((acc, o) => acc + vendorShare(o), 0);
    
    dailyRevenues.push({
      date: dateStr,
      amount,
      label: i === 0 ? 'Auj.' : dayLabel
    });
  }

  const out: VendorStats = {
    revenus7j,
    revenusTrend: recent.length > 0 ? `${recent.length} cmd. (${periodLabel})` : `— (${periodLabel})`,
    commandes: recent.length,
    commandesTrend: `${orders.length} total`,
    produitsVendus,
    produitsTrend: `${products.filter((p) => p.enLigne).length} en ligne`,
    topProduits,
    averageOrderValue,
    inventorySummary,
    dailyRevenues,
  };

  if (engagement) {
    out.engagement = {
      totalVues: engagement.total_vues ?? 0,
      totalClics: engagement.total_clics ?? 0,
      totalVentes: engagement.total_ventes ?? 0,
      tauxConversionPct: engagement.taux_conversion_pct ?? engagement.taux_achat_pct ?? 0,
      topVus: (engagement.top_vus ?? []).map((t) => ({
        id: t.id ?? t.produit_id ?? '',
        nom: t.nom ?? 'Article inconnu',
        vues: t.vues ?? t.nb_vues ?? 0,
      })),
      topCliques: (engagement.top_cliques ?? []).map((t) => ({
        id: t.id ?? t.produit_id ?? '',
        nom: t.nom ?? 'Article inconnu',
        clics: t.clics ?? t.nb_clics ?? 0,
      })),
    };
  }

  return out;
}
