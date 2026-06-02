import { z } from 'zod';

// ─── Utilisateur / Auth ────────────────────────────────────────────────────────
export const AuthMeSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().nullable(),
  telephone: z.string(),
  role: z.string().nullable().optional(),
  role_id: z.union([z.string(), z.number()]).optional(),
  roleId: z.union([z.string(), z.number()]).optional(),
  image_url: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  cree_le: z.string().optional(),
  created_at: z.string().optional(),
});
export type AuthMeZod = z.infer<typeof AuthMeSchema>;

// ─── Entreprise (Restaurant / Boutique) ────────────────────────────────────────
export const EnterprisePublicSchema = z
  .object({
    id: z.string().uuid(),
    nom: z.string(),
    type: z.enum(['restaurant', 'boutique']),
    categorie_nom: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    banniere_url: z.string().nullable().optional(),
    note_moyenne: z.number().nullable().optional(),
    nb_avis: z.number().optional().default(0),
    est_ouvert: z.boolean().optional().default(true),
    temps_preparation_min: z.number().nullable().optional(),
    adresse_ville: z.string().nullable().optional(),
    adresse_quartier: z.string().nullable().optional(),
  })
  .transform((v) => ({
    ...v,
    note_moyenne: v.note_moyenne ?? undefined,
  }));
export type EnterprisePublicZod = z.infer<typeof EnterprisePublicSchema>;

// ─── Produit ───────────────────────────────────────────────────────────────────
export const ProductPublicSchema = z.object({
  id: z.string().uuid(),
  nom: z.string(),
  description: z.string().nullable().optional(),
  prix: z.number(),
  prixPromo: z.number().nullable().optional(),
  prix_promo: z.number().nullable().optional(),
  promo_debut_at: z.string().nullable().optional(),
  promo_fin_at: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  entreprise_id: z.string().uuid(),
  categorie_id: z.string().uuid().nullable().optional(),
  disponible: z.boolean().optional().default(true),
  en_vedette: z.boolean().optional().default(false),
  popularite: z.number().optional().default(0),
  unite: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type ProductPublicZod = z.infer<typeof ProductPublicSchema>;

// ─── Commande (Vendor) ─────────────────────────────────────────────────────────
export const VendorOrderLineSchema = z.object({
  id: z.string().uuid(),
  nom: z.string(),
  detail: z.string().optional(),
  quantite: z.number(),
  prixUnitaire: z.number(),
  image: z.string().nullable().optional(),
});

export const VendorOrderSchema = z.object({
  id: z.string().uuid(),
  sous_commande_id: z.string().uuid().optional(),
  ref: z.string(),
  statut: z.enum([
    'en_attente',
    'acceptee',
    'a_preparer',
    'en_preparation',
    'prete',
    'en_livraison',
    'livree',
    'annulee',
  ]),
  statut_brut: z.string().optional(),
  mode_livraison: z.enum(['golivra', 'propre']).optional(),
  clientNom: z.string(),
  clientTel: z.string(),
  adresse: z.string(),
  creeLeLabel: z.string(),
  prixTotal: z.number(),
  fraisLivraison: z.number(),
  noteClient: z.string().optional(),
  lignes: z.array(VendorOrderLineSchema),
  livraison_statut: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type VendorOrderZod = z.infer<typeof VendorOrderSchema>;

// ─── Commande (Client) ─────────────────────────────────────────────────────────
export const ClientOrderStatusSchema = z.enum([
  'en_attente_vendeur',
  'en_attente',
  'commande_creee',
  'partiellement_acceptee',
  'acceptee',
  'a_preparer',
  'en_preparation',
  'prete',
  'livreur_en_route_pickup',
  'en_livraison',
  'collectee',
  'livree',
  'partiellement_livree',
  'annulee',
  'refusee',
  'remboursee',
  'probleme',
]);
export type ClientOrderStatusZod = z.infer<typeof ClientOrderStatusSchema>;

export const ClientOrderListItemSchema = z.object({
  id: z.string().uuid(),
  entreprise_id: z.string().uuid().nullable(),
  statut: z.union([ClientOrderStatusSchema, z.null()]),
  adresse_livraison: z.string().nullable().optional(),
  cree_le: z.string().nullable().optional(),
  prix_total: z.union([z.number(), z.string()]).nullable().optional(),
});
export type ClientOrderListItemZod = z.infer<typeof ClientOrderListItemSchema>;
