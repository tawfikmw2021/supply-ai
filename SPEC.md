# SPEC — Groupes d'écrans & Connexion PostgreSQL (QUICAILLERIE_KHALED_2023_DB)

## Contexte

La base PostgreSQL migrée (`db/postgresql/`) contient **115 tables** issues de `QUICAILLERIE_KHALED_2023_DB`.
Le backend actuel utilise SQLite (`better-sqlite3`) pour ses propres tables (`accounts`, `users`, `clients`, `products`, …).

L'objectif est de :
1. Définir les **groupes d'écrans** UI à créer à partir des tables PostgreSQL.
2. Brancher le backend sur PostgreSQL pour remplacer (ou enrichir) la connexion client actuelle.

---

## Partie 1 — Groupes d'écrans

### Groupe 1 : Référentiels (Paramètres)

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `Agent` | `IdAgent` | `Nom` |
| `Banque` | `IdBanque` | `CODE`, `Nom`, `Adresse` |
| `Camion` | `IdCamion` | `Matricule` |
| `Chauffeur` | `IdChauffeur` | `Nom` |
| `Ville` | `IdVille` | `Libelle` |
| `Fonction` | `IdFonction` | `Libelle` |
| `FormeJuridique` | `IdFormeJuridique` | `Libelle` |
| `Titre` | `IdTitre` | `Libelle` |
| `Representant` | `IdRepresentant` | `Nom`, `Prenom`, `Tel` |
| `Vendeur` | `IdVendeur` | `Nom`, `Code` |
| `Marque` | `IdMarque` | `Libelle` |
| `Rayon` | `IdRayon` | `Libelle` |
| `Page` | `IdPage` | `Libelle`, `Couleur` |
| `Poids` | `IdPoids` | `Libelle`, `Coefficient` |
| `Unite` | `Idunite` | `Libelle`, `CODE` |
| `UniteColisage` | `IdUniteColisage` | `Libelle` |
| `Tva` | `IdTva` | `MontantTVA` |
| `TypeReglement` | `IdTypeReglement` | `Libelle` |
| `TypeCompte` | `IdTypeCompte` | `Libelle` |
| `TypeMouvement` | `IdTypeMouvement` | `Libelle` |
| `TypeOperation` | `IdTypeOperation` | `Libelle` |
| `TypeTicketResto` | `IdTypeTicketResto` | `Libelle`, `Montant` |
| `TypeChequeCadeau` | `IdTypeChequeCadeau` | `Libelle`, `Montant` |
| `Etat` | `IdEtat` | `LibelleEtat` |
| `EtatCheque` | `IdEtat` | `Libelle` |
| `EtatOrdreDeFabrication` | `IdTypeOrdre` | `LibelleOrdreFabrication` |

**Écrans à créer :**
- `/params` → liste de toutes les tables de référence, navigables par onglet
- Chaque onglet : tableau + modal de création/édition/suppression
- Opérations CRUD standard sur chaque table

---

### Groupe 2 : Articles & Stock

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `FamilleArticle` | `IdFamilleArticle` | `CODE`, `Libelle`, `IdTva` |
| `CategorieArticle` | `IdCategorieArticle` | `Libelle`, `IdFamilleArticle` |
| `GroupeCategorie` | `IdGroupeCategorie` | `Libelle`, `IdTypeCategorie` |
| `TypeCategorie` | `IdTypecategorie` | `Libelle` |
| `Article` | `IdArticle` | `CODE`, `Nom`, `CodeBarre`, `PrixVenteTTC`, `PrixAchatHT`, `IdFamilleArticle`, `HorsStock`, `AlerteStock` |
| `CodeBarreArticle` | `CodeBarre` | `IdArticle`, `CodeBarre` |
| `ArticleRetire` | `IdArticle` | mêmes colonnes qu'`Article` |
| `CodeBarreArticleRetire` | `CodeBarre` | `IdArticle` |
| `QteParLocal` | `(IdArticle, IdLocal)` | `Quantite`, `QteMinimum`, `QteMaximum` |
| `MouvementStock` | `IdMouvement` | `IdArticle`, `Quantite`, `IdTypeMouvement`, `Date` |
| `Inventaire` | `IdInventaire` | `DateInventaire`, `Libelle`, `Local`, `Validee` |
| `LigneInventaire` | `IdLigneInventaire` | `IdInventaire`, `IdArticle`, `QteTheorique`, `QteReel` |
| `Promotion` | `IdPromotion` | `Libelle`, `DateDebut`, `DateFin` |
| `LignePromotion` | `IdLignePromotion` | `IdPromotion`, `IdArticle`, `Prix` |
| `TarifGros` | `(IdArticle, CodeTarif)` | `PrixTarif` |
| `LibelleTarifGros` | `CodeTarif` | `LibelleTarif` |
| `UniteArticle` | `IdUniteArticle` | `IdArticle`, `IdUnite`, `Coefficient` |
| `Nomenclature` | `IdNomenclature` | `IdArticleCompose`, `IdArticleBase`, `Quantite` |
| `OrdreDeFabrication` | `IdOrdreDeFabrication` | `Reference`, `DateCreation`, `IdLocal` |
| `LigneOrdreDeFabrication` | `IdLigneOrdre` | `IdOrdreDeFabrication`, `IdArticle`, `Quantite` |
| `Localisation` | `IdLocal` | `CODE`, `Libelle`, `RaisonSociale`, `Adresse` |

**Écrans à créer :**
- `/articles` → liste avec recherche par code/nom/barcode, filtre famille/catégorie
  - Fiche article : onglets `Infos`, `Prix`, `Stock par local`, `Mouvements`, `Codes-barres`, `Tarifs gros`, `Unités`, `Nomenclature`
- `/stock/inventaires` → liste des inventaires, saisie des lignes
- `/stock/mouvements` → journal des mouvements (entrées/sorties/ajustements)
- `/stock/promotions` → gestion des promotions et lignes de promotion
- `/articles/familles` → familles et catégories articles (sous-onglets)
- `/stock/localisations` → dépôts / locaux

---

### Groupe 3 : Clients & Fidélité

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `FamilleClient` | `IdFamilleClient` | `CODE`, `Libelle`, `Remise` |
| `Client` | `IdClient` | `CODE`, `Nom`, `Prenom`, `Tel`, `Adresse`, `IdFamilleClient`, `IdModeReglement`, `Solde` |
| `TarifClient` | `IdTarifClient` | `IdClient`, `IdArticle`, `Prix`, `IdUnite` |
| `RemiseFamille` | `IdRemiseFamille` | `IdFamilleArticle`, `IdFamilleClient`, `Remise` |
| `Carte` | `IdCarte` | `Code`, `LibelleCarte`, `SeuilPoints`, `MontantGain` |
| `GrilleCarte` | `IdGrilleCarte` | `IdCarte`, `debut`, `fin`, `coefficient` |
| `BonAchatClient` | `IdBonAchatClient` | `IdClient`, `NumeroBonAchat`, `Montant`, `DateExpiration` |
| `SoldeCarte` | `IdSoldeCarte` | `IdCarte`, `Solde`, `DateSolde` |
| `OperationFidelite` | `IdOperationFidelite` | `IdBonCaisse`, `Points`, `Date` |

**Écrans à créer :**
- `/clients` → liste avec recherche, filtre par famille
  - Fiche client : onglets `Infos`, `Tarifs`, `Solde`, `Fidélité`, `Historique`
- `/clients/familles` → familles clients + grilles de remise
- `/fidelite` → cartes de fidélité, grilles de points, bons d'achat

---

### Groupe 4 : Fournisseurs & Achats

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `FamilleFournisseur` | `IdFamilleFournisseur` | `CODE`, `Libelle` |
| `Fournisseur` | `IdFournisseur` | `CODE`, `Nom`, `Tel`, `Adresse`, `IdFamilleFournisseur`, `Solde` |
| `FourniPar` | `(IdArticle, IdFournisseur)` | `PrixAchat`, `Reference` |
| `CommandeFournisseur` | `IdCommandeFournisseur` | `Reference`, `Date`, `IdFournisseur`, `Etat`, `IdLocal` |
| `LigneCommandeFournisseur` | `IdLigneCommandeFournisseur` | `IdCommandeFournisseur`, `IdArticle`, `Quantite`, `PrixUnitaire` |
| `LivraisonFournisseur` | `IdLivraisonFournisseur` | `Reference`, `Date`, `IdFournisseur`, `IdLocal` |
| `LigneLivraisonFournisseur` | `IdLigneLivraisonFournisseur` | `IdLivraisonFournisseur`, `IdArticle`, `Quantite` |
| `FactureFournisseur` | `IdFactureFournisseur` | `Reference`, `Date`, `IdFournisseur`, `TotalTTC` |
| `LigneFactureFournisseur` | `IdLigneFactureFournisseur` | `IdFactureFournisseur`, `IdArticle`, `Quantite`, `PrixUnitaire` |
| `ReglementFournisseur` | `IdReglementFournisseur` | `Date`, `IdFournisseur`, `Montant`, `IdModeReglement` |
| `LigneReglementFournisseur` | `IdLigneReglementFournisseur` | `IdReglement` |

**Écrans à créer :**
- `/fournisseurs` → liste + fiche fournisseur
- `/achats/commandes` → commandes fournisseurs (liste + détail lignes)
- `/achats/livraisons` → bons de livraison fournisseur
- `/achats/factures` → factures fournisseur
- `/achats/reglements` → règlements fournisseur

---

### Groupe 5 : Ventes & Facturation Client

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `DevisClient` | `IdDevisClient` | `Reference`, `Date`, `IdClient`, `TotalTTC` |
| `LigneDevisClient` | `IdLigneDevisClient` | `IdDevisClient`, `IdArticle`, `Quantite`, `PrixUnitaire` |
| `CommandeClient` | `IdCommandeClient` | `Reference`, `Date`, `IdClient`, `TotalTTC` |
| `LigneCommandeClient` | `IdLigneCommandeClient` | `IdCommandeClient`, `IdArticle`, `Quantite` |
| `LivraisonClient` | `IdLivraisonClient` | `Reference`, `Date`, `IdClient`, `IdLocal` |
| `LigneLivraisonClient` | `IdLigneLivraisonClient` | `IdLivraisonClient`, `IdArticle`, `Quantite` |
| `FactureClient` | `IdFactureClient` | `Reference`, `Date`, `IdClient`, `TotalTTC`, `Validee` |
| `LigneFactureClient` | `IdLigneFactureClient` | `IdFactureClient`, `IdArticle`, `Quantite`, `PrixUnitaire` |
| `ReglementClient` | `IdReglementClient` | `Date`, `IdClient`, `Montant`, `IdModeReglement` |
| `LigneReglementClient` | `IdLigneReglementClient` | `IdReglement` |
| `BonCaisse` | `IdBonCaisse` | `Reference`, `Date`, `IdClient`, `TotalTTC` |
| `LigneBonCaisse` | `IdLigneBonCaisse` | `IdBonCaisse`, `IdArticle`, `Quantite` |
| `ReglementBonCaisse` | `IdReglementBonCaisse` | `IdBonCaisse`, `IdClient`, `Montant` |
| `BonAchat` | `IdBonAchat` | `IdClient`, `Montant`, `DateExpiration` |

**Écrans à créer :**
- `/ventes/devis` → devis client
- `/ventes/commandes` → commandes client
- `/ventes/livraisons` → bons de livraison client
- `/ventes/factures` → factures client (liste + impression)
- `/ventes/reglements` → règlements client
- `/caisse/bons` → bons de caisse (ticket caisse)

---

### Groupe 6 : Caisse & Trésorerie

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `Journee` | `IdJournee` | `Caissier`, `DateJournee`, `TotalJournee`, `TransfertEnTresorerie` |
| `LigneJournee` | `IdLigneJournee` | `IdJournee`, `Montant`, `nombre` |
| `MouvementCaisse` | `IdMouvementCaisse` | `Date`, `Montant`, `Type`, `Libelle` |
| `Cheque` | `IdCheque` | `Numero`, `Montant`, `Date`, `IdFournisseur`, `IdEtatCheque` |
| `RemiseCheque` | `IdRemiseCheque` | `Date`, `Montant`, `Reference` |
| `LigneRemiseCheque` | `IdLigneRemiseCheque` | `IdRemiseCheque` |
| `TicketResto` | `IdTicketResto` | `Numero`, `Montant`, `Date` |
| `Traite` | `IdTraite` | `Numero`, `Montant`, `DateEcheance` |
| `ModeReglement` | `IdModeReglement` | `Libelle`, `IdTypeReglement`, `IdBanque` |

**Écrans à créer :**
- `/caisse/journees` → clôture de journée, récapitulatif espèces/chèques
- `/caisse/mouvements` → mouvements de caisse (entrées/sorties)
- `/tresorerie/cheques` → portefeuille chèques, remises en banque
- `/tresorerie/traites` → traites
- `/tresorerie/ticketsresto` → tickets restaurant

---

### Groupe 7 : Comptabilité

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `CompteComptable` | `IdCompte` | `NumeroCompte`, `LibelleCompte`, `TypeCompte` |
| `Compte` | `IdCompte` | `NumeroCompte`, `Libelle`, `IdTypeCompte` |
| `Journal` | `IdJournal` | `CodeJournal`, `Libelle`, `TypeJournal` |
| `Operation` | `IdOperation` | `Date`, `IdCompte`, `Montant`, `IdCategorieOperation`, `IdTypeOperation` |
| `CategorieOperation` | `IdCategorieOperation` | `Libelle`, `IdGroupeCategorie` |
| `GroupeCategorie` | `IdGroupeCategorie` | `Libelle`, `IdTypeCategorie` |
| `Importation` | `Id` | `Rubrique`, `Compte`, `CategorieOperation` |
| `GroupementAchat` | composite | `Prefixe1`, `IdPiece1`, `Prefixe2`, `IdPiece2` |
| `GroupementVente` | composite | même structure |
| `GroupementReglementVente` | composite | `IdReglement`, pièces groupées |

**Écrans à créer :**
- `/comptabilite/comptes` → plan comptable
- `/comptabilite/operations` → saisie et consultation des opérations
- `/comptabilite/journaux` → journaux comptables
- `/comptabilite/categories` → catégories d'opération, groupes

---

### Groupe 8 : Logistique & Fabrication

Tables concernées :

| Table | Clé primaire | Colonnes principales |
|-------|-------------|----------------------|
| `Entree` | `IdEntree` | `Reference`, `Date`, `IdLocal` |
| `LigneEntree` | `IdLigneEntree` | `IdEntree`, `IdArticle`, `Quantite` |
| `Sortie` | `IdSortie` | `Reference`, `Date`, `IdLocal` |
| `LigneSortie` | `IdLigneSortie` | `IdSortie`, `IdArticle`, `Quantite` |
| `Transfert` | `IdTransfert` | `Date`, `SourceLocal`, `DestinationLocal` |
| `LigneTransfert` | `IdLigneTransfert` | `IdTransfert`, `IdArticle`, `Quantite` |
| `OrdreDeFabrication` | `IdOrdreDeFabrication` | `Reference`, `Date`, `IdLocal`, `IdEtatOF` |
| `LigneOrdreDeFabrication` | `IdLigneOrdre` | `IdOrdreDeFabrication`, `IdArticle`, `Quantite` |

**Écrans à créer :**
- `/logistique/entrees` → entrées de stock (sans facture)
- `/logistique/sorties` → sorties de stock
- `/logistique/transferts` → transferts inter-dépôts
- `/fabrication/ordres` → ordres de fabrication + lignes

---

### Groupe 9 : Système & Divers

Tables concernées :

| Table | Usage |
|-------|-------|
| `Log` | Journal applicatif (lecture seule) |
| `Notes` | Notes libres |
| `Notification` | Notifications internes |
| `Sms` / `LigneSms` | Campagnes SMS |
| `NumeroOrdre` | Compteurs de numérotation auto |
| `Rubrique` | Rubriques d'importation comptable |

**Écrans à créer :**
- `/system/logs` → consultation du journal (read-only, filtrable par date/niveau)
- `/system/numerotation` → paramétrage des préfixes et compteurs
- `/system/sms` → envoi/suivi SMS
- `/system/notifications` → centre de notifications

---

## Partie 2 — Connexion PostgreSQL dans le backend

### 2.1 Installer le driver

```bash
cd backend
npm install pg
npm install --save-dev @types/pg
```

---

### 2.2 Variables d'environnement

Dans `backend/.env` (ou `.env.local`), ajouter :

```env
# PostgreSQL — base client (QUICAILLERIE_KHALED_2023_DB migrée)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=supply
PG_USER=postgres
PG_PASSWORD=your_password
PG_MAX_CONNECTIONS=10
```

---

### 2.3 Créer `backend/src/clientDb.ts`

Ce fichier expose un **Pool** PostgreSQL réutilisable, et des helpers typés.

```ts
// backend/src/clientDb.ts
import { Pool, QueryResult } from 'pg';

export const pgPool = new Pool({
  host:     process.env.PG_HOST     ?? 'localhost',
  port:     Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'supply',
  user:     process.env.PG_USER     ?? 'postgres',
  password: process.env.PG_PASSWORD ?? '',
  max:      Number(process.env.PG_MAX_CONNECTIONS ?? 10),
});

pgPool.on('error', (err) => {
  console.error('[pgPool] unexpected error:', err.message);
});

/** Helper : query avec paramètres, retourne les rows */
export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result: QueryResult<T> = await pgPool.query(sql, params);
  return result.rows;
}

/** Helper : query qui retourne une seule row ou undefined */
export async function pgQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0];
}
```

---

### 2.4 Modifier `backend/src/routes/clients.ts`

Remplacer les requêtes SQLite par des requêtes sur la table PostgreSQL `"Client"`.

```ts
// backend/src/routes/clients.ts
import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { pgQuery, pgQueryOne } from '../clientDb';
import * as audit from '../audit';

const router = Router();

// ── Mapping PostgreSQL "Client" → format API ─────────────────────────────────
function mapClient(row: Record<string, unknown>) {
  return {
    id:        row['IdClient'],
    code:      row['CODE'],
    name:      row['Nom'],
    firstname: row['Prenom'],
    phone:     row['Tel1'] ?? row['Tel2'],
    email:     row['Email'],
    address:   row['Adresse'],
    city:      row['Ville'],
    balance:   row['Solde'],
    family_id: row['IdFamilleClient'],
    tax_id:    row['MatriculeImp'],
    notes:     row['Observations'],
    created_at: row['DateCreation'],
  };
}

// GET /clients — liste paginée
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) ?? '';
    const page   = Math.max(1, Number(req.query.page ?? 1));
    const limit  = Math.min(100, Number(req.query.limit ?? 50));
    const offset = (page - 1) * limit;

    const rows = await pgQuery(
      `SELECT * FROM "Client"
       WHERE ($1 = '' OR "Nom" ILIKE $1 OR "CODE" ILIKE $1 OR "Tel1" ILIKE $1)
       ORDER BY "IdClient" DESC
       LIMIT $2 OFFSET $3`,
      [search ? `%${search}%` : '', limit, offset]
    );
    res.json({ clients: rows.map(mapClient) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /clients/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const row = await pgQueryOne(
      `SELECT * FROM "Client" WHERE "IdClient" = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ message: 'Client not found' }); return; }
    res.json({ client: mapClient(row) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /clients
router.post('/', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code = '', phone = '', email = '', address = '' } = req.body;
    if (!name) { res.status(400).json({ message: 'name is required' }); return; }
    const rows = await pgQuery(
      `INSERT INTO "Client" ("CODE","Nom","Tel1","Email","Adresse")
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [code, name, phone, email, address]
    );
    const client = mapClient(rows[0]);
    audit.log(req, 'Client', 'INSERT', client.id as number, client);
    res.status(201).json({ client });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /clients/:id
router.put('/:id', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, phone, email, address } = req.body;
    const rows = await pgQuery(
      `UPDATE "Client" SET
         "CODE"    = COALESCE($1, "CODE"),
         "Nom"     = COALESCE($2, "Nom"),
         "Tel1"    = COALESCE($3, "Tel1"),
         "Email"   = COALESCE($4, "Email"),
         "Adresse" = COALESCE($5, "Adresse")
       WHERE "IdClient" = $6
       RETURNING *`,
      [code ?? null, name ?? null, phone ?? null, email ?? null, address ?? null, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ message: 'Client not found' }); return; }
    const client = mapClient(rows[0]);
    audit.log(req, 'Client', 'UPDATE', Number(req.params.id), client);
    res.json({ client });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /clients/:id
router.delete('/:id', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await pgQuery(
      `DELETE FROM "Client" WHERE "IdClient" = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ message: 'Client not found' }); return; }
    audit.log(req, 'Client', 'DELETE', Number(req.params.id), { deleted: mapClient(rows[0]) });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
```

---

### 2.5 Enregistrer le pool dans `backend/src/index.ts`

Ajouter au démarrage (après les imports) :

```ts
import { pgPool } from './clientDb';

// Vérifier la connexion PostgreSQL au démarrage
pgPool.query('SELECT 1').then(() => {
  console.log('✓ PostgreSQL connecté');
}).catch((err: Error) => {
  console.error('✗ PostgreSQL connexion échouée:', err.message);
});
```

Et à l'arrêt propre (en bas du fichier) :

```ts
process.on('SIGTERM', () => pgPool.end());
process.on('SIGINT',  () => pgPool.end());
```

---

### 2.6 Pattern générique pour les autres routes

Pour chaque nouveau groupe d'écrans, créer `backend/src/routes/<groupe>.ts` en suivant ce patron :

```ts
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { pgQuery, pgQueryOne } from '../clientDb';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await pgQuery(`SELECT * FROM "<Table>" ORDER BY "<PK>" DESC`);
  res.json({ items: rows });
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = await pgQueryOne(`SELECT * FROM "<Table>" WHERE "<PK>" = $1`, [req.params.id]);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json({ item: row });
});

// POST / PUT / DELETE : même pattern que clients.ts

export default router;
```

Enregistrer la route dans `index.ts` :

```ts
import articlesRouter from './routes/articles';
app.use('/articles', articlesRouter);
```

---

### 2.7 Checklist d'implémentation

- [ ] `npm install pg @types/pg` dans `backend/`
- [ ] Ajouter variables `PG_*` dans `.env`
- [ ] Créer `backend/src/clientDb.ts` (Pool + helpers)
- [ ] Modifier `backend/src/routes/clients.ts` → requêtes PostgreSQL
- [ ] Ajouter `pgPool.query('SELECT 1')` dans `index.ts` (health check)
- [ ] Ajouter `process.on('SIGTERM/SIGINT', pgPool.end)` dans `index.ts`
- [ ] Créer routes pour chaque groupe d'écrans (articles, fournisseurs, ventes…)
- [ ] Enregistrer chaque route dans `index.ts`
- [ ] Créer les vues Vue correspondantes dans `frontend/src/views/`
- [ ] Ajouter les routes Vue dans `frontend/src/router/index.ts`
- [ ] Ajouter les entrées de menu dans le layout (`AppLayout.vue`)

---

### 2.8 Mapping des types PostgreSQL → TypeScript

| PostgreSQL | TypeScript |
|------------|-----------|
| `SERIAL` / `int` | `number` |
| `varchar` / `text` | `string` |
| `decimal` / `numeric` | `string` (pg retourne des strings pour la précision) → convertir avec `parseFloat()` |
| `smallint` | `number` (0 ou 1, remplace les booléens) |
| `timestamp` | `string` (ISO 8601) |
| `bytea` (image) | `Buffer` → encoder en base64 pour l'API |

> **Note :** Le driver `pg` retourne les valeurs `decimal`/`numeric` sous forme de chaînes pour éviter les pertes de précision JavaScript. Utiliser `parseFloat(row.PrixVenteTTC)` dans le mapping.
