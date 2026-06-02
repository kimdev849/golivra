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
  prixTotal: number;
  fraisLivraison: number;
  noteClient?: string;
  lignes: VendorOrderLine[];
  livreur?: { nom: string; tel: string };
  livraison_statut?: string | null;
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
  top_vus?: { id?: string; produit_id?: string; nom?: string; vues?: number }[];
  top_cliques?: { id?: string; produit_id?: string; nom?: string; clics?: number }[];
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
  const now = Date.now();
  const since = now - periodDays * 24 * 60 * 60 * 1000;
  const recent = orders.filter((o) => {
    if (!o.created_at) return false;
    return new Date(o.created_at).getTime() >= since;
  });
  const periodLabel = periodDays === 7 ? '7 jours' : periodDays === 30 ? '30 jours' : `${periodDays} jours`;
  const revenus7j = recent
    .filter((o) => o.statut !== 'annulee')
    .reduce((acc, o) => acc + o.prixTotal, 0);
  const produitsVendus = recent
    .filter((o) => o.statut !== 'annulee')
    .reduce((acc, o) => acc + o.lignes.reduce((s, l) => s + l.quantite, 0), 0);

  const productSales = new Map<string, number>();
  for (const o of recent) {
    if (o.statut === 'annulee') continue;
    for (const l of o.lignes) {
      productSales.set(l.nom, (productSales.get(l.nom) || 0) + l.quantite);
    }
  }
  const topProduits = [...productSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, ventes]) => ({ nom, ventes }));

  const lowStock = products.filter((p) => p.stock <= 5).length;
  void lowStock;

  const out: VendorStats = {
    revenus7j,
    revenusTrend: recent.length > 0 ? `${recent.length} cmd. (${periodLabel})` : `— (${periodLabel})`,
    commandes: recent.length,
    commandesTrend: `${orders.length} total`,
    produitsVendus,
    produitsTrend: `${products.filter((p) => p.enLigne).length} en ligne`,
    topProduits,
  };

  if (engagement) {
    out.engagement = {
      totalVues: engagement.total_vues ?? 0,
      totalClics: engagement.total_clics ?? 0,
      totalVentes: engagement.total_ventes ?? 0,
      tauxConversionPct: engagement.taux_conversion_pct ?? engagement.taux_achat_pct ?? 0,
      topVus: (engagement.top_vus ?? []).map((t) => ({
        id: t.id ?? t.produit_id ?? '',
        nom: t.nom ?? 'Produit',
        vues: t.vues ?? 0,
      })),
      topCliques: (engagement.top_cliques ?? []).map((t) => ({
        id: t.id ?? t.produit_id ?? '',
        nom: t.nom ?? 'Produit',
        clics: t.clics ?? 0,
      })),
    };
  }

  return out;
}
