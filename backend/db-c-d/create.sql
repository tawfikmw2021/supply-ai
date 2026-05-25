-- ============================================================
--  PostgreSQL DDL script
--  Converted from SQL Server (QUICAILLERIE_KHALED_2023_DB)
--  Date: 2026-05-23
-- ============================================================
-- Usage: psql -U <user> -d <database> -f create.sql
-- ============================================================

SET client_encoding = 'UTF8';
-- agent definition

-- Drop table

-- DROP TABLE agent;

CREATE TABLE agent (
	IdAgent SERIAL NOT NULL,
	Nom varchar(500) NULL,
	CONSTRAINT PK_Agent PRIMARY KEY (IdAgent)
);


-- articleretire definition

-- Drop table

-- DROP TABLE articleretire;

CREATE TABLE articleretire (
	IdArticle int NOT NULL,
	CODE varchar(50) NULL,
	Nom varchar(350) NULL,
	Description text NULL,
	CodeBarre varchar(50) NULL,
	PrixAchatHT decimal(18,12) NULL,
	PrixVenteHT decimal(18,12) NULL,
	PrixRevientHT decimal(18,12) NULL,
	PrixAchatTTC decimal(18,12) NULL,
	PrixVenteTTC decimal(18,12) NULL,
	PrixRevientTTC decimal(18,12) NULL,
	PoidBrut decimal(18,12) NULL,
	PoidNet decimal(18,12) NULL,
	UnitePoid varchar(50) NULL,
	Volume decimal(18,3) NULL,
	Conditionnement int NULL,
	Dimension1 decimal(18,3) NULL,
	Dimension2 decimal(18,3) NULL,
	Dimension3 decimal(18,3) NULL,
	image bytea NULL,
	PieceAchat varchar(50) NULL,
	PieceVente varchar(50) NULL,
	DernierPrixAchat decimal(18,12) NULL,
	DernierPrixVente decimal(18,12) NULL,
	IdTva int NULL,
	IdFamilleArticle int NULL,
	IdUnite int NULL,
	IdCategorieArticle int NULL,
	IdMarque int NULL,
	HorsStock smallint NULL,
	IdRayon int NULL,
	HtTtc int NULL,
	Marge decimal(18,12) NULL,
	PMoyen decimal(18,12) NULL,
	Caisse smallint NULL,
	IdPage int NULL,
	Couleur int NULL,
	Imprimante varchar(150) NULL,
	Bascule smallint NULL,
	Fidelite smallint NULL,
	IdCcomptableAchat int NULL,
	IdCcomptableVente int NULL,
	Fodec smallint NULL,
	Sommeil smallint NULL,
	Remise numeric(18,12) NULL,
	DesignationCourte varchar(250) NULL,
	AlerteStock smallint NULL,
	FraisParUnite decimal(18,12) NULL,
	FraisFixes decimal(18,12) NULL,
	DelaisDeFabrication int NULL,
	TypeNomenclature varchar(150) NULL,
	DroitConsommation numeric(18,12) NULL,
	Publier smallint NULL,
	IdProduit varchar(250) NULL,
	IdCategorie varchar(250) NULL,
	DateCreation timestamp NULL,
	VenteHt smallint NULL,
	CONSTRAINT PK_ArticleRetire PRIMARY KEY (IdArticle)
);


-- banque definition

-- Drop table

-- DROP TABLE banque;

CREATE TABLE banque (
	IdBanque SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Nom varchar(250) NULL,
	Adresse varchar(250) NULL,
	IdComptable int NULL,
	Principale smallint NULL,
	CONSTRAINT PK_Banque PRIMARY KEY (IdBanque)
);


-- bonachatclient definition

-- Drop table

-- DROP TABLE bonachatclient;

CREATE TABLE bonachatclient (
	IdBonAchatClient SERIAL NOT NULL,
	NumeroBonAchat varchar(50) NULL,
	CodeSociete varchar(50) NULL,
	IdClient int NULL,
	DateEdition timestamp NULL,
	Montant decimal(18,3) NULL,
	DateExpiration timestamp NULL,
	CONSTRAINT PK_BonAchatClient PRIMARY KEY (IdBonAchatClient)
);


-- camion definition

-- Drop table

-- DROP TABLE camion;

CREATE TABLE camion (
	IdCamion SERIAL NOT NULL,
	Matricule varchar(350) NULL,
	CONSTRAINT PK_Camion PRIMARY KEY (IdCamion)
);


-- carte definition

-- Drop table

-- DROP TABLE carte;

CREATE TABLE carte (
	IdCarte SERIAL NOT NULL,
	Code varchar(50) NULL,
	LibelleCarte varchar(250) NULL,
	ExclureAvecRemise smallint NULL,
	SeuilPoints int NULL,
	MontantGain decimal(18,6) NULL,
	MontantAchat decimal(18,6) NULL,
	PointAquis int NULL,
	PointsInitial int NULL,
	NatureGain varchar(250) NULL,
	Tarif varchar(350) NULL,
	IdFamilleClient int NULL,
	FideliteActive smallint NULL,
	CONSTRAINT PK_Carte PRIMARY KEY (IdCarte)
);


-- categoriearticle definition

-- Drop table

-- DROP TABLE categoriearticle;

CREATE TABLE categoriearticle (
	IdCategorieArticle SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	IdFamilleArticle int NULL,
	CONSTRAINT PK_CategorieArticle PRIMARY KEY (IdCategorieArticle)
);


-- chauffeur definition

-- Drop table

-- DROP TABLE chauffeur;

CREATE TABLE chauffeur (
	IdChauffeur SERIAL NOT NULL,
	Nom varchar(350) NULL,
	CONSTRAINT PK_Chauffeur PRIMARY KEY (IdChauffeur)
);


-- cheque definition

-- Drop table

-- DROP TABLE cheque;

CREATE TABLE cheque (
	IdCheque SERIAL NOT NULL,
	Numero varchar(50) NULL,
	Montant decimal(18,3) NULL,
	IdFournisseur int NULL,
	date timestamp NULL,
	Lieu varchar(150) NULL,
	IdEtatCheque int NULL,
	Reference varchar(250) NULL,
	ChequeRendu smallint NULL,
	NumeroCompte varchar(250) NULL,
	NumeroVersement varchar(250) NULL,
	DatePaiement timestamp NULL,
	Barre smallint NULL,
	idCompte int NULL,
	DateValeur timestamp NULL,
	Note varchar(500) NULL,
	Agent varchar(250) NULL,
	CONSTRAINT PK_Cheque PRIMARY KEY (IdCheque)
);


-- chequecadeau definition

-- Drop table

-- DROP TABLE chequecadeau;

CREATE TABLE chequecadeau (
	IdBonCaisse int NULL,
	CodeBarre varchar(30) NOT NULL,
	TransfertEnTresorerie smallint NULL,
	CONSTRAINT PK_ChequeCadeau PRIMARY KEY (CodeBarre)
);


-- codebarrearticleretire definition

-- Drop table

-- DROP TABLE codebarrearticleretire;

CREATE TABLE codebarrearticleretire (
	IdArticle int NOT NULL,
	CodeBarre varchar(64) NOT NULL,
	CONSTRAINT PK_CodeBarreArticleRetire PRIMARY KEY (CodeBarre)
);


-- comptecomptable definition

-- Drop table

-- DROP TABLE comptecomptable;

CREATE TABLE comptecomptable (
	IdCompte SERIAL NOT NULL,
	NumeroCompte varchar(50) NULL,
	LibelleCompte varchar(250) NULL,
	TypeCompte varchar(50) NULL,
	ClasseCompte varchar(50) NULL,
	CONSTRAINT PK_Ccomptable PRIMARY KEY (IdCompte)
);


-- etat definition

-- Drop table

-- DROP TABLE etat;

CREATE TABLE etat (
	IdEtat SERIAL NOT NULL,
	LibelleEtat varchar(50) NULL,
	CONSTRAINT PK_Etat PRIMARY KEY (IdEtat)
);


-- etatcheque definition

-- Drop table

-- DROP TABLE etatcheque;

CREATE TABLE etatcheque (
	IdEtat SERIAL NOT NULL,
	Libelle varchar(150) NULL,
	CONSTRAINT PK_EtatCheque PRIMARY KEY (IdEtat)
);


-- etatordredefabrication definition

-- Drop table

-- DROP TABLE etatordredefabrication;

CREATE TABLE etatordredefabrication (
	IdTypeOrdre int NOT NULL,
	LibelleOrdreFabrication varchar(50) NULL,
	CONSTRAINT PK_TypeOrdreDeFabrication PRIMARY KEY (IdTypeOrdre)
);


-- famillearticle definition

-- Drop table

-- DROP TABLE famillearticle;

CREATE TABLE famillearticle (
	IdFamilleArticle int NOT NULL,
	CODE varchar(50) NULL,
	Libelle varchar(250) NULL,
	IdTva int NULL,
	HorsStock int NULL,
	IdCcomptableAchat int NULL,
	IdCcomptableVente int NULL,
	CONSTRAINT PK_FamilleArticle PRIMARY KEY (IdFamilleArticle)
);
ALTER TABLE famillearticle ADD CONSTRAINT FamilleArticle_IdFamilleArticle_Positif CHECK ((idfamillearticle>=(0) AND idfamillearticle<=(99)));


-- familleclient definition

-- Drop table

-- DROP TABLE familleclient;

CREATE TABLE familleclient (
	IdFamilleClient SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Libelle varchar(250) NULL,
	Remise numeric(18,3) NULL,
	CONSTRAINT PK_FamilleClient PRIMARY KEY (IdFamilleClient)
);


-- famillefournisseur definition

-- Drop table

-- DROP TABLE famillefournisseur;

CREATE TABLE famillefournisseur (
	IdFamilleFournisseur SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Libelle varchar(250) NULL,
	Remise numeric(18,3) NULL,
	CONSTRAINT PK_FamilleFournisseur PRIMARY KEY (IdFamilleFournisseur)
);


-- fonction definition

-- Drop table

-- DROP TABLE fonction;

CREATE TABLE fonction (
	IdFonction SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_Fonction PRIMARY KEY (IdFonction)
);


-- formejuridique definition

-- Drop table

-- DROP TABLE formejuridique;

CREATE TABLE formejuridique (
	IdFormeJuridique SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_FormeJuridique PRIMARY KEY (IdFormeJuridique)
);


-- grillecarte definition

-- Drop table

-- DROP TABLE grillecarte;

CREATE TABLE grillecarte (
	IdGrilleCarte SERIAL NOT NULL,
	IdCarte int NULL,
	debut decimal(18,12) NULL,
	fin decimal(18,12) NULL,
	coefficient decimal(18,12) NULL,
	CONSTRAINT PK_GrilleCarte PRIMARY KEY (IdGrilleCarte)
);


-- groupementachat definition

-- Drop table

-- DROP TABLE groupementachat;

CREATE TABLE groupementachat (
	Prefixe1 varchar(50) NOT NULL,
	IdPiece1 int NOT NULL,
	Prefixe2 varchar(50) NOT NULL,
	IdPiece2 int NOT NULL,
	CONSTRAINT PK_GroupementAchat PRIMARY KEY (Prefixe1,IdPiece1,Prefixe2,IdPiece2)
);


-- groupementreglementvente definition

-- Drop table

-- DROP TABLE groupementreglementvente;

CREATE TABLE groupementreglementvente (
	IdReglement int NOT NULL,
	IdPiece1 int NOT NULL,
	Prefixe1 varchar(50) NOT NULL,
	IdPiece2 int NOT NULL,
	Prefixe2 varchar(50) NOT NULL,
	CONSTRAINT PK_GroupementReglementVente PRIMARY KEY (IdReglement,IdPiece1,Prefixe1,IdPiece2,Prefixe2)
);


-- groupementvente definition

-- Drop table

-- DROP TABLE groupementvente;

CREATE TABLE groupementvente (
	Prefixe1 varchar(5) NOT NULL,
	IdPiece1 int NOT NULL,
	Prefixe2 varchar(5) NOT NULL,
	IdPiece2 int NOT NULL,
	CONSTRAINT PK_GroupementVente PRIMARY KEY (Prefixe1,IdPiece1,Prefixe2,IdPiece2)
);


-- importation definition

-- Drop table

-- DROP TABLE importation;

CREATE TABLE importation (
	Id int NOT NULL,
	Rubrique varchar(500) NULL,
	Compte int NULL,
	CategorieOperation int NULL,
	CONSTRAINT PK_Importation PRIMARY KEY (Id)
);


-- inventaire definition

-- Drop table

-- DROP TABLE inventaire;

CREATE TABLE inventaire (
	IdInventaire SERIAL NOT NULL,
	DateInventaire timestamp NULL,
	Prefixe varchar(50) NULL,
	Libelle varchar(350) NULL,
	"local" varchar(250) NULL,
	IdLocal int NULL,
	Validee smallint NULL,
	Du timestamp NULL,
	Au timestamp NULL,
	Duree int NULL,
	Tournee varchar(500) NULL,
	CONSTRAINT PK_Inventaire PRIMARY KEY (IdInventaire)
);


-- journal definition

-- Drop table

-- DROP TABLE journal;

CREATE TABLE journal (
	IdJournal SERIAL NOT NULL,
	CodeJournal varchar(50) NULL,
	Libelle varchar(250) NULL,
	TypeJournal varchar(250) NULL,
	CONSTRAINT PK_Journal PRIMARY KEY (IdJournal)
);


-- journee definition

-- Drop table

-- DROP TABLE journee;

CREATE TABLE journee (
	IdJournee SERIAL NOT NULL,
	Caissier varchar(150) NULL,
	Caisse varchar(50) NULL,
	DateJournee timestamp NULL,
	Fond numeric(18,3) NULL,
	Espece numeric(18,3) NULL,
	Cheque numeric(18,3) NULL,
	Carte numeric(18,3) NULL,
	ChequeCadeau numeric(18,3) NULL,
	TicketResto numeric(18,3) NULL,
	BonAchat numeric(18,3) NULL,
	B50 numeric(18,0) NULL,
	B20 numeric(18,0) NULL,
	B10 numeric(18,0) NULL,
	B5 numeric(18,0) NULL,
	P5 numeric(18,0) NULL,
	P2 numeric(18,0) NULL,
	P1 numeric(18,0) NULL,
	P05 numeric(18,0) NULL,
	P02 numeric(18,0) NULL,
	P01 numeric(18,0) NULL,
	P005 numeric(18,0) NULL,
	P002 numeric(18,0) NULL,
	P001 numeric(18,0) NULL,
	TotalJournee numeric(18,3) NULL,
	TotalZ numeric(18,3) NULL,
	EspeceLibre numeric(18,3) NULL,
	Credit numeric(18,3) NULL,
	Encaissement numeric(18,3) NULL,
	Entree numeric(18,3) NULL,
	Sortie numeric(18,3) NULL,
	TotalBlFactures numeric(18,3) NULL,
	TransfertEnTresorerie smallint NULL,
	CONSTRAINT PK_Journee PRIMARY KEY (IdJournee)
);


-- libelletarifgros definition

-- Drop table

-- DROP TABLE libelletarifgros;

CREATE TABLE libelletarifgros (
	CodeTarif varchar(50) NOT NULL,
	LibelleTarif varchar(500) NULL,
	CONSTRAINT PK_LibelleTarifGros PRIMARY KEY (CodeTarif)
);


-- lignejournee definition

-- Drop table

-- DROP TABLE lignejournee;

CREATE TABLE lignejournee (
	IdLigneJournee SERIAL NOT NULL,
	IdJournee int NOT NULL,
	Montant numeric(18,3) NULL,
	nombre int NULL,
	nombreticket int NULL,
	TransfertEnTresorerie smallint NULL,
	CONSTRAINT PK_LigneJournee PRIMARY KEY (IdLigneJournee,IdJournee)
);


-- lignesms definition

-- Drop table

-- DROP TABLE lignesms;

CREATE TABLE lignesms (
	id SERIAL NOT NULL,
	nom varchar(250) NULL,
	numero varchar(50) NULL,
	idSms int NULL,
	Envoye smallint NULL,
	Echec smallint NULL,
	IdClient int NULL,
	CONSTRAINT PK_LigneSms PRIMARY KEY (id)
);


-- localisation definition

-- Drop table

-- DROP TABLE localisation;

CREATE TABLE localisation (
	IdLocal SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Libelle varchar(50) NULL,
	Responsable varchar(250) NULL,
	Tel varchar(50) NULL,
	RaisonSociale varchar(500) NULL,
	Adresse varchar(500) NULL,
	Tva varchar(50) NULL,
	Fax varchar(50) NULL,
	Email varchar(250) NULL,
	CONSTRAINT PK_Localisation PRIMARY KEY (IdLocal)
);


-- log definition

-- Drop table

-- DROP TABLE log;

CREATE TABLE log (
	IdLog SERIAL NOT NULL,
	Utilisateur varchar(150) NULL,
	DateLog timestamp NULL,
	TypeMessage varchar(50) NULL,
	Message varchar(500) NULL,
	Dossier varchar(150) NULL,
	Machine varchar(150) NULL,
	CONSTRAINT PK_Log PRIMARY KEY (IdLog)
);


-- marque definition

-- Drop table

-- DROP TABLE marque;

CREATE TABLE marque (
	IdMarque SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_Marque PRIMARY KEY (IdMarque)
);


-- mouvementcaisse definition

-- Drop table

-- DROP TABLE mouvementcaisse;

CREATE TABLE mouvementcaisse (
	IdMouvementCaisse SERIAL NOT NULL,
	IdTypeMouvement int NULL,
	DateMouvement timestamp NULL,
	Montant decimal(18,3) NULL,
	Commentaire varchar(250) NULL,
	IdRubrique int NULL,
	Caisse int NULL,
	Caissier varchar(250) NULL,
	TransfertEnTresorerie smallint NULL,
	Cloture smallint NULL,
	Heure timestamp NULL,
	CONSTRAINT PK_MouvementCaisse PRIMARY KEY (IdMouvementCaisse)
);


-- notes definition

-- Drop table

-- DROP TABLE notes;

CREATE TABLE notes (
	IdNote SERIAL NOT NULL,
	Sujet varchar(250) NULL,
	Texte varchar(1500) NULL,
	Utilisateur varchar(150) NULL,
	TypeNote varchar(150) NULL,
	DateNote timestamp NULL,
	Importance varchar(250) NULL,
	CONSTRAINT PK_Notes PRIMARY KEY (IdNote)
);


-- notification definition

-- Drop table

-- DROP TABLE notification;

CREATE TABLE notification (
	IdNotification SERIAL NOT NULL,
	DateNotification timestamp NULL,
	Utilisateur varchar(150) NULL,
	Dossier varchar(150) NULL,
	Machine varchar(150) NULL,
	Message varchar(150) NULL,
	TypeMessage varchar(50) NULL,
	CONSTRAINT PK_Notification PRIMARY KEY (IdNotification)
);


-- numeroordre definition

-- Drop table

-- DROP TABLE numeroordre;

CREATE TABLE numeroordre (
	IdFactureClient int NULL,
	IdDevisClient int NULL,
	IdLivraisonClient int NULL,
	IdCommandeClient int NULL,
	IdOrder int NOT NULL,
	IdAvoirClient int NULL,
	IdRetourClient int NULL,
	CONSTRAINT PK_NumeroOrdre PRIMARY KEY (IdOrder)
);


-- page definition

-- Drop table

-- DROP TABLE page;

CREATE TABLE page (
	IdPage SERIAL NOT NULL,
	LibellePage varchar(250) NULL,
	CONSTRAINT PK_Page PRIMARY KEY (IdPage)
);


-- poids definition

-- Drop table

-- DROP TABLE poids;

CREATE TABLE poids (
	IdPoid SERIAL NOT NULL,
	Code varchar(50) NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_Poids PRIMARY KEY (IdPoid)
);


-- promotion definition

-- Drop table

-- DROP TABLE promotion;

CREATE TABLE promotion (
	IdPromotion SERIAL NOT NULL,
	DateDebut timestamp NULL,
	DateFin timestamp NULL,
	Motif varchar(1000) NULL,
	HeureDebut time NULL,
	HeureFin time NULL,
	CONSTRAINT PK_Promotion PRIMARY KEY (IdPromotion)
);


-- rayon definition

-- Drop table

-- DROP TABLE rayon;

CREATE TABLE rayon (
	IdRayon SERIAL NOT NULL,
	Libelle varchar(250) NULL,
	CONSTRAINT PK_Rayon PRIMARY KEY (IdRayon)
);


-- remisecheque definition

-- Drop table

-- DROP TABLE remisecheque;

CREATE TABLE remisecheque (
	IdRemiseCheque SERIAL NOT NULL,
	DateRemiseCheque timestamp NULL,
	NumeroCompte varchar(250) NULL,
	TitulaireDuCompte varchar(500) NULL,
	NombreTotalCheques int NULL,
	Lieu varchar(250) NULL,
	MemeAgence smallint NULL,
	AutresAgences smallint NULL,
	TotalCheques numeric(18,3) NULL,
	NombreInterBanque int NULL,
	CONSTRAINT PK_RemiseCheque PRIMARY KEY (IdRemiseCheque)
);


-- remisefamille definition

-- Drop table

-- DROP TABLE remisefamille;

CREATE TABLE remisefamille (
	IdFamilleArticle int NOT NULL,
	IdFamilleClient int NOT NULL,
	Remise numeric(18,3) NULL,
	CONSTRAINT PK_RemiseFamille PRIMARY KEY (IdFamilleArticle,IdFamilleClient)
);


-- representant definition

-- Drop table

-- DROP TABLE representant;

CREATE TABLE representant (
	IdRepresentant SERIAL NOT NULL,
	Code varchar(50) NULL,
	Nom varchar(500) NULL,
	Adresse varchar(500) NULL,
	Tel varchar(500) NULL,
	Email varchar(500) NULL,
	Commission numeric(18,3) NULL,
	IdVille int NULL,
	ReportSolde numeric(18,3) NULL,
	IdClient int NULL,
	AgentResponsable varchar(500) NULL,
	CONSTRAINT PK_Representant PRIMARY KEY (IdRepresentant)
);


-- retenusource definition

-- Drop table

-- DROP TABLE retenusource;

CREATE TABLE retenusource (
	IdRetenu int NOT NULL,
	DateRetenu date NULL,
	MontantBrut decimal(18,12) NULL,
	MontantRetenu decimal(18,12) NULL,
	PourcentRetenu decimal(18,12) NULL,
	MontantNet decimal(18,12) NULL,
	IdFournisseur int NULL,
	IdReglement int NULL,
	CONSTRAINT PK_RetenuSource PRIMARY KEY (IdRetenu)
);


-- rubrique definition

-- Drop table

-- DROP TABLE rubrique;

CREATE TABLE rubrique (
	IdRubrique SERIAL NOT NULL,
	LibelleRubrique varchar(250) NULL,
	CONSTRAINT PK_Rubrique PRIMARY KEY (IdRubrique)
);


-- sms definition

-- Drop table

-- DROP TABLE sms;

CREATE TABLE sms (
	idSms SERIAL NOT NULL,
	Texte varchar(180) NULL,
	date timestamp NULL,
	NombreDeMessages char(10) NULL,
	CONSTRAINT PK_Sms PRIMARY KEY (idSms)
);


-- soldecarte definition

-- Drop table

-- DROP TABLE soldecarte;

CREATE TABLE soldecarte (
	Carte varchar(150) NOT NULL,
	Solde numeric(18,3) NULL,
	Points int NULL,
	CONSTRAINT PK_SoldeCarte PRIMARY KEY (Carte)
);


-- ticketresto definition

-- Drop table

-- DROP TABLE ticketresto;

CREATE TABLE ticketresto (
	IdBonCaisse int NULL,
	CodeBarre varchar(30) NOT NULL,
	TransfertEnTresorerie smallint NULL,
	CONSTRAINT PK_TicketResto PRIMARY KEY (CodeBarre)
);


-- titre definition

-- Drop table

-- DROP TABLE titre;

CREATE TABLE titre (
	IdTitre SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_Titre PRIMARY KEY (IdTitre)
);


-- traite definition

-- Drop table

-- DROP TABLE traite;

CREATE TABLE traite (
	IdLettre SERIAL NOT NULL,
	Creation timestamp NULL,
	Echeance timestamp NULL,
	Montant decimal(18,3) NULL,
	Lieu varchar(150) NULL,
	Valeur varchar(300) NULL,
	Acceptation varchar(150) NULL,
	IdFournisseur int NULL,
	Protestable smallint NULL,
	IdCompte int NULL,
	DatePaiement timestamp NULL,
	Numero varchar(250) NULL,
	ETAT varchar(50) NULL,
	Reference varchar(250) NULL,
	Note varchar(500) NULL,
	Agent varchar(250) NULL,
	CONSTRAINT PK_Traite PRIMARY KEY (IdLettre)
);


-- tva definition

-- Drop table

-- DROP TABLE tva;

CREATE TABLE tva (
	IdTva SERIAL NOT NULL,
	MontantTVA decimal(18,3) NULL,
	IdCcomptableAchat int NULL,
	IdCcomptableVente int NULL,
	CONSTRAINT PK_TVA PRIMARY KEY (IdTva)
);


-- typecategorie definition

-- Drop table

-- DROP TABLE typecategorie;

CREATE TABLE typecategorie (
	IdTypecategorie SERIAL NOT NULL,
	TypeCategorie varchar(150) NULL,
	CONSTRAINT PK_TypeCategorie PRIMARY KEY (IdTypecategorie)
);


-- typechequecadeau definition

-- Drop table

-- DROP TABLE typechequecadeau;

CREATE TABLE typechequecadeau (
	IdChequeCadeau SERIAL NOT NULL,
	Societe varchar(250) NULL,
	Prefixe varchar(6) NULL,
	Longeur int NULL,
	CONSTRAINT PK_TypeTypeChequeCadeau PRIMARY KEY (IdChequeCadeau)
);


-- typecompte definition

-- Drop table

-- DROP TABLE typecompte;

CREATE TABLE typecompte (
	IdTypeCompte SERIAL NOT NULL,
	LibelleType varchar(250) NULL,
	CONSTRAINT PK_TypeCompte PRIMARY KEY (IdTypeCompte)
);


-- typemouvement definition

-- Drop table

-- DROP TABLE typemouvement;

CREATE TABLE typemouvement (
	IdTypeMouvement SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_TypeMouvement PRIMARY KEY (IdTypeMouvement)
);


-- typeoperation definition

-- Drop table

-- DROP TABLE typeoperation;

CREATE TABLE typeoperation (
	IdTypeOperation SERIAL NOT NULL,
	LibelletypeOperation varchar(250) NULL,
	CONSTRAINT PK_TypeOperation PRIMARY KEY (IdTypeOperation)
);


-- typereglement definition

-- Drop table

-- DROP TABLE typereglement;

CREATE TABLE typereglement (
	IdTypeReglement SERIAL NOT NULL,
	Libelle varchar(50) NULL,
	CONSTRAINT PK_TypeReglement PRIMARY KEY (IdTypeReglement)
);


-- typeticketresto definition

-- Drop table

-- DROP TABLE typeticketresto;

CREATE TABLE typeticketresto (
	IdTicket SERIAL NOT NULL,
	Societe varchar(250) NULL,
	Prefixe varchar(6) NULL,
	Longeur int NULL,
	CONSTRAINT PK_TypeTicketResto PRIMARY KEY (IdTicket)
);


-- unite definition

-- Drop table

-- DROP TABLE unite;

CREATE TABLE unite (
	Idunite SERIAL NOT NULL,
	Code varchar(20) NULL,
	Libelle varchar(250) NULL,
	QteUnitaire decimal(18,3) NULL,
	CONSTRAINT PK_Unite PRIMARY KEY (Idunite)
);


-- unitecolisage definition

-- Drop table

-- DROP TABLE unitecolisage;

CREATE TABLE unitecolisage (
	IdUniteColisage SERIAL NOT NULL,
	UniteColisage varchar(250) NULL,
	CONSTRAINT PK_UniteColisage PRIMARY KEY (IdUniteColisage)
);


-- vendeur definition

-- Drop table

-- DROP TABLE vendeur;

CREATE TABLE vendeur (
	IdVendeur SERIAL NOT NULL,
	Nom varchar(250) NULL,
	CONSTRAINT PK_Vendeur PRIMARY KEY (IdVendeur)
);


-- ville definition

-- Drop table

-- DROP TABLE ville;

CREATE TABLE ville (
	IdVille SERIAL NOT NULL,
	Libelle varchar(500) NULL,
	CONSTRAINT PK_Ville PRIMARY KEY (IdVille)
);


-- article definition

-- Drop table

-- DROP TABLE article;

CREATE TABLE article (
	IdArticle int NOT NULL,
	CODE varchar(50) NULL,
	Nom varchar(350) NULL,
	Description text NULL,
	CodeBarre varchar(50) NULL,
	PrixAchatHT decimal(18,12) NULL,
	PrixVenteHT decimal(18,12) NULL,
	PrixRevientHT decimal(18,12) NULL,
	PrixAchatTTC decimal(18,12) NULL,
	PrixVenteTTC decimal(18,12) NULL,
	PrixRevientTTC decimal(18,12) NULL,
	PoidBrut decimal(18,12) NULL,
	PoidNet decimal(18,12) NULL,
	UnitePoid varchar(50) NULL,
	Volume decimal(18,3) NULL,
	Conditionnement int NULL,
	Dimension1 decimal(18,3) NULL,
	Dimension2 decimal(18,3) NULL,
	Dimension3 decimal(18,3) NULL,
	image bytea NULL,
	PieceAchat varchar(50) NULL,
	PieceVente varchar(50) NULL,
	DernierPrixAchat decimal(18,12) NULL,
	DernierPrixVente decimal(18,12) NULL,
	IdTva int NULL,
	IdFamilleArticle int NULL,
	IdUnite int NULL,
	IdCategorieArticle int NULL,
	IdMarque int NULL,
	HorsStock smallint NULL,
	IdRayon int NULL,
	HtTtc int NULL,
	Marge decimal(18,12) NULL,
	PMoyen decimal(18,12) NULL,
	Caisse smallint NULL,
	IdPage int NULL,
	Couleur int NULL,
	Imprimante varchar(150) NULL,
	Bascule smallint NULL,
	Fidelite smallint DEFAULT 0 NULL,
	IdCcomptableAchat int NULL,
	IdCcomptableVente int NULL,
	Fodec smallint NULL,
	Sommeil smallint NULL,
	Remise numeric(18,12) NULL,
	DesignationCourte varchar(250) NULL,
	AlerteStock smallint NULL,
	FraisParUnite decimal(18,12) NULL,
	FraisFixes decimal(18,12) NULL,
	DelaisDeFabrication int NULL,
	TypeNomenclature varchar(150) NULL,
	DroitConsommation numeric(18,12) NULL,
	Publier smallint NULL,
	IdProduit varchar(250) NULL,
	IdCategorie varchar(250) NULL,
	DateCreation timestamp NULL,
	VenteHt smallint NULL,
	CONSTRAINT PK_Article PRIMARY KEY (IdArticle),
	CONSTRAINT FK_Article_CategorieArticle FOREIGN KEY (IdCategorieArticle) REFERENCES categoriearticle(IdCategorieArticle),
	CONSTRAINT FK_Article_CompteComptable FOREIGN KEY (IdCcomptableAchat) REFERENCES comptecomptable(IdCompte),
	CONSTRAINT FK_Article_CompteComptable1 FOREIGN KEY (IdCcomptableVente) REFERENCES comptecomptable(IdCompte),
	CONSTRAINT FK_Article_FamilleArticle FOREIGN KEY (IdFamilleArticle) REFERENCES famillearticle(IdFamilleArticle)
);


-- codebarrearticle definition

-- Drop table

-- DROP TABLE codebarrearticle;

CREATE TABLE codebarrearticle (
	IdArticle int NOT NULL,
	CodeBarre varchar(64) NOT NULL,
	CONSTRAINT PK_CodeBarreArticle_1 PRIMARY KEY (CodeBarre),
	CONSTRAINT FK_CodeBarreArticle_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle)
);


-- compte definition

-- Drop table

-- DROP TABLE compte;

CREATE TABLE compte (
	IdCompte SERIAL NOT NULL,
	NumeroCompte varchar(50) NULL,
	Titulaire varchar(250) NULL,
	LibelleCompte varchar(150) NULL,
	Commentaires varchar(150) NULL,
	IdTypeCompte int NULL,
	IdBanque int NULL,
	SoldeInitial decimal(18,3) NULL,
	DateCreation timestamp NULL,
	Rib1 varchar(50) NULL,
	Rib2 varchar(50) NULL,
	Rib3 varchar(50) NULL,
	Rib4 varchar(50) NULL,
	Cloture smallint NULL,
	Couleur int NULL,
	CONSTRAINT PK_Compte PRIMARY KEY (IdCompte),
	CONSTRAINT FK_Compte_TypeCompte FOREIGN KEY (IdTypeCompte) REFERENCES typecompte(IdTypeCompte)
);


-- entree definition

-- Drop table

-- DROP TABLE entree;

CREATE TABLE entree (
	IdEntree SERIAL NOT NULL,
	Reference varchar(350) NULL,
	DateEntree timestamp NULL,
	Prefixe varchar(10) NULL,
	Description text NULL,
	IdLocal int NULL,
	Validee smallint NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	CONSTRAINT PK_Entree PRIMARY KEY (IdEntree),
	CONSTRAINT FK_Entree_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- groupecategorie definition

-- Drop table

-- DROP TABLE groupecategorie;

CREATE TABLE groupecategorie (
	IdGroupeCategorie SERIAL NOT NULL,
	LibelleGroupecategorie varchar(150) NULL,
	IdTypeCategorie int NULL,
	CONSTRAINT PK_GroupeCategorie PRIMARY KEY (IdGroupeCategorie),
	CONSTRAINT FK_GroupeCategorie_TypeCategorie1 FOREIGN KEY (IdTypeCategorie) REFERENCES typecategorie(IdTypecategorie)
);


-- lignecommandefournisseur definition

-- Drop table

-- DROP TABLE lignecommandefournisseur;

CREATE TABLE lignecommandefournisseur (
	IdLigneCommandeFournisseur SERIAL NOT NULL,
	IdCommandeFournisseur int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,12) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Fodec decimal(18,12) NULL,
	validite timestamp NULL,
	PrixVenteNet decimal(18,12) NULL,
	PrixUhtNet decimal(18,12) NULL,
	PrixUttcNet decimal(18,12) NULL,
	Marge decimal(18,12) NULL,
	Remise2 decimal(18,12) NULL,
	DroitConsommation decimal(18,12) NULL,
	Dateligne timestamp NULL,
	CONSTRAINT PK_LigneCommandeFournisseur PRIMARY KEY (IdLigneCommandeFournisseur),
	CONSTRAINT FK_LigneCommandeFournisseur_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle)
);


-- ligneentree definition

-- Drop table

-- DROP TABLE ligneentree;

CREATE TABLE ligneentree (
	IdLigneEntree SERIAL NOT NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte numeric(18,3) NULL,
	PrixAHT numeric(18,12) NULL,
	PrixVHT numeric(18,12) NULL,
	PrixATTC numeric(18,12) NULL,
	PrixVTTC numeric(18,12) NULL,
	IdUnite int NULL,
	Tva numeric(18,3) NULL,
	IdEntree int NULL,
	CodeBarre varchar(50) NULL,
	Reference varchar(500) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneEntree PRIMARY KEY (IdLigneEntree),
	CONSTRAINT FK_LigneEntree_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneEntree_Entree FOREIGN KEY (IdEntree) REFERENCES entree(IdEntree),
	CONSTRAINT FK_LigneEntree_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- ligneinventaire definition

-- Drop table

-- DROP TABLE ligneinventaire;

CREATE TABLE ligneinventaire (
	IdLigneInventaire SERIAL NOT NULL,
	IdInventaire int NULL,
	IdArticle int NULL,
	QteTheorique numeric(18,6) NULL,
	QteReelle numeric(18,6) NULL,
	QteMin numeric(18,6) NULL,
	QteAlerte numeric(18,6) NULL,
	Nom varchar(350) NULL,
	IdFamilleArticle int NULL,
	IdCategorieArticle int NULL,
	IdMarque int NULL,
	PrixAchatHT numeric(18,12) NULL,
	PrixVenteHT numeric(18,12) NULL,
	PrixAchatTTC numeric(18,12) NULL,
	PrixVenteTTC numeric(18,12) NULL,
	PrixMoyen numeric(18,12) NULL,
	QteInventaire numeric(18,6) NULL,
	IdUnite int NULL,
	Tva numeric(18,12) NULL,
	QteEcart numeric(18,6) NULL,
	CONSTRAINT PK_LigneInventaire PRIMARY KEY (IdLigneInventaire),
	CONSTRAINT FK_LigneInventaire_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneInventaire_Inventaire FOREIGN KEY (IdInventaire) REFERENCES inventaire(IdInventaire),
	CONSTRAINT FK_LigneInventaire_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- lignepromotion definition

-- Drop table

-- DROP TABLE lignepromotion;

CREATE TABLE lignepromotion (
	IdArticle int NOT NULL,
	IdPromotion int NOT NULL,
	Remise numeric(18,12) NULL,
	Commentaire varchar(250) NULL,
	NomArticle varchar(250) NULL,
	CONSTRAINT PK_LignePromotion PRIMARY KEY (IdArticle,IdPromotion),
	CONSTRAINT FK_LignePromotion_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle)
);


-- ligneremisecheque definition

-- Drop table

-- DROP TABLE ligneremisecheque;

CREATE TABLE ligneremisecheque (
	IdLigneRemiseCheque int NOT NULL,
	IdRemiseCheque int NULL,
	Nom varchar(1024) NULL,
	NumCheques varchar(50) NULL,
	Banque varchar(500) NULL,
	Localites varchar(500) NULL,
	Montants numeric(18,3) NULL,
	CONSTRAINT PK_LigneRemiseCheque PRIMARY KEY (IdLigneRemiseCheque),
	CONSTRAINT FK_LigneRemiseCheque_RemiseCheque FOREIGN KEY (IdRemiseCheque) REFERENCES remisecheque(IdRemiseCheque)
);


-- modereglement definition

-- Drop table

-- DROP TABLE modereglement;

CREATE TABLE modereglement (
	IdModeReglement SERIAL NOT NULL,
	Libelle varchar(250) NULL,
	Code varchar(50) NULL,
	IdBanque int NULL,
	IdTypeReglement int NULL,
	Ccomptable varchar(50) NULL,
	Echeance varchar(250) NULL,
	Jours int NULL,
	IdJournal int NULL,
	CONSTRAINT PK_Reglement PRIMARY KEY (IdModeReglement),
	CONSTRAINT FK_ModeReglement_Banque FOREIGN KEY (IdBanque) REFERENCES banque(IdBanque),
	CONSTRAINT FK_ModeReglement_TypeReglement FOREIGN KEY (IdTypeReglement) REFERENCES typereglement(IdTypeReglement)
);


-- mouvementstock definition

-- Drop table

-- DROP TABLE mouvementstock;

CREATE TABLE mouvementstock (
	IdMouvement SERIAL NOT NULL,
	DateMouvement timestamp NULL,
	Libelle varchar(350) NULL,
	PrefixePiece varchar(50) NULL,
	IdPiece int NULL,
	IdArticle int NULL,
	Qte decimal(18,3) NULL,
	IdLignePiece int NULL,
	IdUnite int NULL,
	Idlocal int NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_MouvementStock PRIMARY KEY (IdMouvement),
	CONSTRAINT FK_MouvementStock_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_MouvementStock_Localisation FOREIGN KEY (Idlocal) REFERENCES localisation(IdLocal),
	CONSTRAINT FK_MouvementStock_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- nomenclature definition

-- Drop table

-- DROP TABLE nomenclature;

CREATE TABLE nomenclature (
	IdNomenclature SERIAL NOT NULL,
	IdArticleCompose int NOT NULL,
	IdArticleBase int NOT NULL,
	Qte decimal(18,6) NULL,
	CONSTRAINT PK_Nomenclature_1 PRIMARY KEY (IdNomenclature),
	CONSTRAINT FK_Nomenclature_Article1 FOREIGN KEY (IdArticleCompose) REFERENCES article(IdArticle),
	CONSTRAINT FK_Nomenclature_Article2 FOREIGN KEY (IdArticleBase) REFERENCES article(IdArticle)
);


-- ordredefabrication definition

-- Drop table

-- DROP TABLE ordredefabrication;

CREATE TABLE ordredefabrication (
	IdOrdreDeFabrication SERIAL NOT NULL,
	Prefixe varchar(10) NULL,
	DateOrdreDeFabrication timestamp NULL,
	IdArticle int NULL,
	IdLocal int NULL,
	QteFabriquee decimal(18,3) NULL,
	DateDebutFabrication timestamp NULL,
	DateFinFabrication timestamp NULL,
	Commentaire varchar(500) NULL,
	IdEtat int NULL,
	PrixRevientTotal decimal(18,12) NULL,
	Valide smallint NULL,
	FraisParUnite decimal(18,12) NULL,
	FraisFixe decimal(18,12) NULL,
	CONSTRAINT PK_OrdreDeFabrication PRIMARY KEY (IdOrdreDeFabrication),
	CONSTRAINT FK_OrdreDeFabrication_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- qteparlocal definition

-- Drop table

-- DROP TABLE qteparlocal;

CREATE TABLE qteparlocal (
	IdArticle int NOT NULL,
	IdLocal int NOT NULL,
	QteReelle decimal(18,3) NULL,
	QteTheorique decimal(18,3) NULL,
	QteMin decimal(18,3) NULL,
	QteAlerte decimal(18,3) NULL,
	QteMax decimal(18,3) NULL,
	CONSTRAINT PK_QteParLocal PRIMARY KEY (IdArticle,IdLocal),
	CONSTRAINT FK_QteParLocal_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_QteParLocal_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- sortie definition

-- Drop table

-- DROP TABLE sortie;

CREATE TABLE sortie (
	IdSortie SERIAL NOT NULL,
	Reference varchar(350) NULL,
	DateSortie timestamp NULL,
	Prefixe varchar(10) NULL,
	Description text NULL,
	IdLocal int NULL,
	Validee smallint NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	CONSTRAINT PK_Sortie PRIMARY KEY (IdSortie),
	CONSTRAINT FK_Sortie_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- tariffamille definition

-- Drop table

-- DROP TABLE tariffamille;

CREATE TABLE tariffamille (
	IdFamilleClient int NOT NULL,
	IdArticle int NOT NULL,
	IdUnite int NOT NULL,
	Remise decimal(18,6) NULL,
	PrixHT decimal(18,12) NULL,
	PrixTTC decimal(18,12) NULL,
	CONSTRAINT PK_TarifFamille PRIMARY KEY (IdFamilleClient,IdArticle,IdUnite),
	CONSTRAINT FK_TarifFamille_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_TarifFamille_FamilleClient FOREIGN KEY (IdFamilleClient) REFERENCES familleclient(IdFamilleClient),
	CONSTRAINT FK_TarifFamille_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- tarifgros definition

-- Drop table

-- DROP TABLE tarifgros;

CREATE TABLE tarifgros (
	IdTarif SERIAL NOT NULL,
	IdArticle int NULL,
	Qte numeric(18,12) NULL,
	Remise1 numeric(18,12) NULL,
	Remise2 numeric(18,12) NULL,
	Remise3 numeric(18,12) NULL,
	Remise4 numeric(18,12) NULL,
	Remise5 numeric(18,12) NULL,
	Remise6 numeric(18,12) NULL,
	Marge1 numeric(18,12) NULL,
	Marge2 numeric(18,12) NULL,
	Marge3 numeric(18,12) NULL,
	Marge4 numeric(18,12) NULL,
	Marge5 numeric(18,12) NULL,
	Marge6 numeric(18,12) NULL,
	CONSTRAINT PK_TarifGros PRIMARY KEY (IdTarif),
	CONSTRAINT FK_TarifGros_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle)
);


-- transfert definition

-- Drop table

-- DROP TABLE transfert;

CREATE TABLE transfert (
	IdTransfert SERIAL NOT NULL,
	DateTransfert timestamp NULL,
	Reference varchar(350) NULL,
	Prefixe varchar(50) NULL,
	SourceLocal int NULL,
	DestinationLocal int NULL,
	Validee smallint NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	Du timestamp NULL,
	Au timestamp NULL,
	Duree int NULL,
	Tournee varchar(500) NULL,
	CONSTRAINT PK_Transfert PRIMARY KEY (IdTransfert),
	CONSTRAINT FK_Transfert_Localisation FOREIGN KEY (SourceLocal) REFERENCES localisation(IdLocal),
	CONSTRAINT FK_Transfert_Localisation1 FOREIGN KEY (DestinationLocal) REFERENCES localisation(IdLocal)
);


-- unitearticle definition

-- Drop table

-- DROP TABLE unitearticle;

CREATE TABLE unitearticle (
	IdArticle int NOT NULL,
	IdUnite int NOT NULL,
	UBase int NULL,
	PrixVenteHT decimal(18,12) NULL,
	PrixAchatHT decimal(18,12) NULL,
	PrixVenteTTC decimal(18,12) NULL,
	PrixAchatTTC decimal(18,12) NULL,
	CodeBarre varchar(50) NULL,
	Remise decimal(18,12) NULL,
	CONSTRAINT PK_UniteArticle PRIMARY KEY (IdArticle,IdUnite),
	CONSTRAINT FK_UniteArticle_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_UniteArticle_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- categorieoperation definition

-- Drop table

-- DROP TABLE categorieoperation;

CREATE TABLE categorieoperation (
	IdCategorieOperation SERIAL NOT NULL,
	LibelleCategorieOperation varchar(250) NULL,
	IdGroupeCategorie int NULL,
	CONSTRAINT PK_CategorieOperation PRIMARY KEY (IdCategorieOperation),
	CONSTRAINT FK_CategorieOperation_GroupeCategorie FOREIGN KEY (IdGroupeCategorie) REFERENCES groupecategorie(IdGroupeCategorie)
);


-- client definition

-- Drop table

-- DROP TABLE client;

CREATE TABLE client (
	IdClient SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Nom varchar(250) NULL,
	Adresse varchar(500) NULL,
	Cp varchar(50) NULL,
	Ville varchar(250) NULL,
	Email varchar(250) NULL,
	Tel varchar(50) NULL,
	Fax varchar(50) NULL,
	Portable varchar(50) NULL,
	Pays varchar(250) NULL,
	Remise decimal(18,3) NULL,
	CodeTva varchar(150) NULL,
	CCb varchar(50) NULL,
	RegistredeCommerce varchar(50) NULL,
	Interlocuteur varchar(250) NULL,
	TelInterlocuteur varchar(50) NULL,
	EmailInterlocuteur varchar(250) NULL,
	FaxInterlocuteur varchar(250) NULL,
	IdBanque int NULL,
	IdFamilleClient int NULL,
	IdModeReglement int NULL,
	IdFormeJuridique int NULL,
	IdTitre int NULL,
	IdFonction int NULL,
	ReportSolde decimal(18,3) NULL,
	FideliteActivee smallint NULL,
	CodeBarre varchar(150) NULL,
	DateCreationCarte timestamp NULL,
	DateExpirationCarte timestamp NULL,
	Anniversaire timestamp NULL,
	ReportPoint int DEFAULT 0 NULL,
	Points int DEFAULT 0 NULL,
	IdCarte int NULL,
	IdCcomptable int NULL,
	exonere smallint NULL,
	CreditAutorise smallint NULL,
	Tarif varchar(30) NULL,
	ClientLivraison smallint NULL,
	PlafondSolde numeric(18,3) NULL,
	IdVille int NULL,
	AdresseLivraison varchar(500) NULL,
	VilleLivraison varchar(500) NULL,
	CpLivraison varchar(50) NULL,
	AgentResponsable varchar(500) NULL,
	CONSTRAINT PK_Client PRIMARY KEY (IdClient),
	CONSTRAINT FK_Client_Banque FOREIGN KEY (IdBanque) REFERENCES banque(IdBanque),
	CONSTRAINT FK_Client_FamilleClient FOREIGN KEY (IdFamilleClient) REFERENCES familleclient(IdFamilleClient),
	CONSTRAINT FK_Client_Fonction FOREIGN KEY (IdFonction) REFERENCES fonction(IdFonction),
	CONSTRAINT FK_Client_FormeJuridique FOREIGN KEY (IdFormeJuridique) REFERENCES formejuridique(IdFormeJuridique),
	CONSTRAINT FK_Client_ModeReglement FOREIGN KEY (IdModeReglement) REFERENCES modereglement(IdModeReglement),
	CONSTRAINT FK_Client_Titre FOREIGN KEY (IdTitre) REFERENCES titre(IdTitre)
);


-- commandeclient definition

-- Drop table

-- DROP TABLE commandeclient;

CREATE TABLE commandeclient (
	IdCommandeClient SERIAL NOT NULL,
	IdClient int NULL,
	DateCommande timestamp NULL,
	RemiseGlobale decimal(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTTC decimal(18,12) NULL,
	Reference varchar(250) NULL,
	Validee smallint NULL,
	Timbre numeric(18,3) NULL,
	Groupee smallint NULL,
	Comptabilisee smallint NULL,
	Avoir smallint NULL,
	Solde numeric(18,12) NULL,
	TotalTVA numeric(18,12) NULL,
	IdEtat int NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	NumeroOrdre int NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	Heure timestamp NULL,
	Longitude numeric(24,16) NULL,
	Latitude numeric(24,16) NULL,
	TimbreCaisse numeric(18,3) NULL,
	IdRepresentant int NULL,
	CONSTRAINT PK_CommandeClient PRIMARY KEY (IdCommandeClient),
	CONSTRAINT FK_CommandeClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient)
);


-- devisclient definition

-- Drop table

-- DROP TABLE devisclient;

CREATE TABLE devisclient (
	IdDevisClient SERIAL NOT NULL,
	IdClient int NULL,
	DateDevis timestamp NULL,
	RemiseGlobale decimal(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTTC decimal(18,12) NULL,
	Reference varchar(250) NULL,
	Validee smallint NULL,
	Timbre numeric(18,3) NULL,
	Groupee smallint NULL,
	Comptabilisee smallint NULL,
	Avoir smallint NULL,
	Solde numeric(18,12) NULL,
	TotalTVA numeric(18,12) NOT NULL,
	IdEtat int NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	NumeroOrdre int NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	Heure timestamp NULL,
	Longitude numeric(24,16) NULL,
	Latitude numeric(24,16) NULL,
	TimbreCaisse numeric(18,3) NULL,
	IdRepresentant int NULL,
	CONSTRAINT PK_DevisClient PRIMARY KEY (IdDevisClient),
	CONSTRAINT FK_DevisClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient),
	CONSTRAINT FK_DevisClient_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- factureclient definition

-- Drop table

-- DROP TABLE factureclient;

CREATE TABLE factureclient (
	IdFactureClient SERIAL NOT NULL,
	IdClient int NULL,
	DateFacture timestamp NULL,
	RemiseGlobale decimal(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTTC decimal(18,12) NULL,
	Reference varchar(1000) NULL,
	Validee smallint NULL,
	Timbre numeric(18,3) NULL,
	Groupee smallint NULL,
	Comptabilisee smallint NULL,
	Avoir smallint NULL,
	Solde numeric(18,12) NULL,
	TotalTVA numeric(18,12) NULL,
	IdEtat int NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	NumeroOrdre int NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	Heure timestamp NULL,
	Longitude numeric(24,16) NULL,
	Latitude numeric(24,16) NULL,
	TimbreCaisse numeric(18,3) NULL,
	IdRepresentant int NULL,
	CONSTRAINT PK_FactureClient PRIMARY KEY (IdFactureClient),
	CONSTRAINT FK_FactureClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient)
);


-- fournisseur definition

-- Drop table

-- DROP TABLE fournisseur;

CREATE TABLE fournisseur (
	IdFournisseur SERIAL NOT NULL,
	CODE varchar(50) NULL,
	Nom varchar(250) NULL,
	Adresse varchar(500) NULL,
	Cp varchar(50) NULL,
	Ville varchar(150) NULL,
	Tel varchar(50) NULL,
	Fax varchar(50) NULL,
	Mobile varchar(50) NULL,
	Email varchar(150) NULL,
	CodeTva varchar(150) NULL,
	RegistreCommerce varchar(50) NULL,
	DLivraison int NULL,
	Remise decimal(18,3) NULL,
	Interlocuteur varchar(250) NULL,
	IdFamilleFournisseur int NULL,
	IdBanque int NULL,
	IdFonction int NULL,
	IdTitre int NULL,
	IdModeReglement int NULL,
	IdFormeJuridique int NULL,
	TelInterlocuteur varchar(50) NULL,
	EmailInterlocuteur varchar(250) NULL,
	FaxInterlocuteur varchar(50) NULL,
	Logo bytea NULL,
	ReportSolde decimal(18,3) NULL,
	IdCcomptable int NULL,
	CompteBancaire varchar(150) NULL,
	Assujetti smallint DEFAULT 0 NULL,
	IdVille int NULL,
	CONSTRAINT PK_Fournisseur PRIMARY KEY (IdFournisseur),
	CONSTRAINT FK_Fournisseur_Banque FOREIGN KEY (IdBanque) REFERENCES banque(IdBanque),
	CONSTRAINT FK_Fournisseur_FamilleFournisseur FOREIGN KEY (IdFamilleFournisseur) REFERENCES famillefournisseur(IdFamilleFournisseur),
	CONSTRAINT FK_Fournisseur_Fonction FOREIGN KEY (IdFonction) REFERENCES fonction(IdFonction),
	CONSTRAINT FK_Fournisseur_FormeJuridique FOREIGN KEY (IdFormeJuridique) REFERENCES formejuridique(IdFormeJuridique),
	CONSTRAINT FK_Fournisseur_ModeReglement FOREIGN KEY (IdModeReglement) REFERENCES modereglement(IdModeReglement),
	CONSTRAINT FK_Fournisseur_Titre FOREIGN KEY (IdTitre) REFERENCES titre(IdTitre)
);


-- lignecommandeclient definition

-- Drop table

-- DROP TABLE lignecommandeclient;

CREATE TABLE lignecommandeclient (
	IdLigneCommandeClient SERIAL NOT NULL,
	IdCommandeClient int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Reference varchar(50) NULL,
	Fodec numeric(18,12) NULL,
	DroitConsommation numeric(18,12) NULL,
	Legende bytea NULL,
	PrixAchatNet numeric(18,12) NULL,
	Marge numeric(18,12) NULL,
	Code varchar(50) NULL,
	CodeBarre varchar(50) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneCommandeClient PRIMARY KEY (IdLigneCommandeClient),
	CONSTRAINT FK_LigneCommandeClient_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneCommandeClient_CommandeClient FOREIGN KEY (IdCommandeClient) REFERENCES commandeclient(IdCommandeClient)
);


-- lignedevisclient definition

-- Drop table

-- DROP TABLE lignedevisclient;

CREATE TABLE lignedevisclient (
	IdLigneDevisClient SERIAL NOT NULL,
	IdDevisClient int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Reference varchar(50) NULL,
	Fodec numeric(18,12) NULL,
	DroitConsommation numeric(18,12) NULL,
	Legende bytea NULL,
	PrixAchatNet numeric(18,12) NULL,
	Marge numeric(18,12) NULL,
	Code varchar(50) NULL,
	CodeBarre varchar(50) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneDevisClient PRIMARY KEY (IdLigneDevisClient),
	CONSTRAINT FK_LigneDevisClient_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneDevisClient_DevisClient FOREIGN KEY (IdDevisClient) REFERENCES devisclient(IdDevisClient)
);


-- lignefactureclient definition

-- Drop table

-- DROP TABLE lignefactureclient;

CREATE TABLE lignefactureclient (
	IdLigneFactureClient SERIAL NOT NULL,
	IdFactureClient int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,12) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,6) NULL,
	Reference varchar(50) NULL,
	Fodec numeric(18,6) NULL,
	DroitConsommation numeric(18,12) NULL,
	Legende bytea NULL,
	PrixAchatNet decimal(18,12) NULL,
	Marge decimal(18,12) NULL,
	Code varchar(50) NULL,
	CodeBarre varchar(50) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneFactureClient PRIMARY KEY (IdLigneFactureClient),
	CONSTRAINT FK_LigneFactureClient_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneFactureClient_FactureClient FOREIGN KEY (IdFactureClient) REFERENCES factureclient(IdFactureClient)
);


-- ligneordredefabrication definition

-- Drop table

-- DROP TABLE ligneordredefabrication;

CREATE TABLE ligneordredefabrication (
	IdLigneOrdreDeFabrication SERIAL NOT NULL,
	IdOrdreDeFabrication int NULL,
	IdArticleBase int NULL,
	Qte decimal(18,12) NULL,
	PrixAchatHT decimal(18,12) NULL,
	PrixAchatTTC decimal(18,12) NULL,
	QteT decimal(18,12) NULL,
	CONSTRAINT PK_LigneOrdreDeFabrication PRIMARY KEY (IdLigneOrdreDeFabrication),
	CONSTRAINT FK_LigneOrdreDeFabrication_OrdreDeFabrication FOREIGN KEY (IdOrdreDeFabrication) REFERENCES ordredefabrication(IdOrdreDeFabrication)
);


-- lignesortie definition

-- Drop table

-- DROP TABLE lignesortie;

CREATE TABLE lignesortie (
	IdLigneSortie SERIAL NOT NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte numeric(18,3) NULL,
	PrixAHT numeric(18,12) NULL,
	PrixVHT numeric(18,12) NULL,
	PrixATTC numeric(18,12) NULL,
	PrixVTTC numeric(18,12) NULL,
	IdUnite int NULL,
	Tva numeric(18,12) NULL,
	IdSortie int NULL,
	CodeBarre varchar(50) NULL,
	Reference varchar(500) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneSortie PRIMARY KEY (IdLigneSortie),
	CONSTRAINT FK_LigneSortie_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneSortie_Sortie FOREIGN KEY (IdSortie) REFERENCES sortie(IdSortie),
	CONSTRAINT FK_LigneSortie_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- lignetransfert definition

-- Drop table

-- DROP TABLE lignetransfert;

CREATE TABLE lignetransfert (
	IdLigneTransfert SERIAL NOT NULL,
	IdArticle int NULL,
	Description varchar(250) NULL,
	Qte numeric(18,3) NULL,
	PrixVHT numeric(18,12) NULL,
	PrixAHT numeric(18,12) NULL,
	PrixATTC numeric(18,12) NULL,
	PrixVTTC numeric(18,12) NULL,
	IdUnite int NULL,
	Tva numeric(18,12) NULL,
	IdTransfert int NULL,
	CodeBarre varchar(50) NULL,
	Reference varchar(500) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneTransfert PRIMARY KEY (IdLigneTransfert),
	CONSTRAINT FK_LigneTransfert_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneTransfert_Transfert FOREIGN KEY (IdTransfert) REFERENCES transfert(IdTransfert),
	CONSTRAINT FK_LigneTransfert_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- livraisonclient definition

-- Drop table

-- DROP TABLE livraisonclient;

CREATE TABLE livraisonclient (
	IdLivraisonClient SERIAL NOT NULL,
	IdClient int NULL,
	DateLivraison timestamp NULL,
	RemiseGlobale decimal(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTTC decimal(18,12) NULL,
	Reference varchar(1000) NULL,
	Validee smallint NULL,
	Timbre numeric(18,3) NULL,
	Groupee smallint NULL,
	Comptabilisee smallint NULL,
	Avoir smallint NULL,
	Solde numeric(18,12) NULL,
	TotalTVA numeric(18,12) NULL,
	IdEtat int NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	Chauffeur varchar(350) NULL,
	Camion varchar(350) NULL,
	NumeroOrdre int NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	Heure timestamp NULL,
	Longitude numeric(24,16) NULL,
	Latitude numeric(24,16) NULL,
	TimbreCaisse numeric(18,3) NULL,
	IdRepresentant int NULL,
	CONSTRAINT PK_LivraisonClient PRIMARY KEY (IdLivraisonClient),
	CONSTRAINT FK_LivraisonClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient),
	CONSTRAINT FK_LivraisonClient_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- livraisonfournisseur definition

-- Drop table

-- DROP TABLE livraisonfournisseur;

CREATE TABLE livraisonfournisseur (
	IdLivraisonFournisseur SERIAL NOT NULL,
	DateLivraison timestamp NULL,
	IdFournisseur int NULL,
	RemiseGlobale numeric(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTVA numeric(18,12) NULL,
	TotalTTC numeric(18,12) NULL,
	Reference varchar(1024) NULL,
	Validee smallint NULL,
	Groupee smallint NULL,
	Comptabilise smallint NULL,
	Avoir smallint NULL,
	Timbre numeric(18,3) NULL,
	Solde numeric(18,12) NULL,
	IdEtat int NULL,
	Fodec decimal(18,3) NULL,
	Caissier varchar(250) NULL,
	Commentaire varchar(500) NULL,
	DroitConsommation numeric(18,12) NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	AgentPointage varchar(350) NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	CONSTRAINT PK_LivraisonFournisseur PRIMARY KEY (IdLivraisonFournisseur),
	CONSTRAINT FK_LivraisonFournisseur_Fournisseur FOREIGN KEY (IdFournisseur) REFERENCES fournisseur(IdFournisseur),
	CONSTRAINT FK_LivraisonFournisseur_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- operation definition

-- Drop table

-- DROP TABLE operation;

CREATE TABLE operation (
	IdOperation SERIAL NOT NULL,
	IdTypeOperation int NULL,
	IdCategorieOperation int NULL,
	LibelleOperation varchar(250) NULL,
	IdTypeReglement int NULL,
	IdCompte int NULL,
	Reference varchar(250) NULL,
	Tier varchar(250) NULL,
	DateOperation timestamp NULL,
	Notes varchar(250) NULL,
	Montant decimal(18,6) NULL,
	Debit decimal(18,6) NULL,
	Credit decimal(18,6) NULL,
	Pointage varchar(20) NULL,
	VirDep smallint NULL,
	LinkVir int NULL,
	CONSTRAINT PK_Operation PRIMARY KEY (IdOperation),
	CONSTRAINT FK_Operation_CategorieOperation FOREIGN KEY (IdCategorieOperation) REFERENCES categorieoperation(IdCategorieOperation),
	CONSTRAINT FK_Operation_Compte FOREIGN KEY (IdCompte) REFERENCES compte(IdCompte),
	CONSTRAINT FK_Operation_TypeOperation1 FOREIGN KEY (IdTypeOperation) REFERENCES typeoperation(IdTypeOperation)
);


-- reglementboncaisse definition

-- Drop table

-- DROP TABLE reglementboncaisse;

CREATE TABLE reglementboncaisse (
	IdReglement SERIAL NOT NULL,
	Prefixe varchar(50) NULL,
	IdClient int NOT NULL,
	DateReglement timestamp NULL,
	IdModeReglement int NOT NULL,
	Montant numeric(18,12) NULL,
	Caissier varchar(150) NULL,
	Caisse int NULL,
	Piece varchar(250) NULL,
	Commentaire varchar(150) NULL,
	IdBonCaisse int NULL,
	Comptabilise smallint NULL,
	TransfertEnTresorerie smallint NULL,
	Heure timestamp NULL,
	CONSTRAINT PK_ReglementBonCaisse PRIMARY KEY (IdReglement),
	CONSTRAINT FK_ReglementBonCaisse_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient)
);


-- reglementclient definition

-- Drop table

-- DROP TABLE reglementclient;

CREATE TABLE reglementclient (
	IdReglementClient SERIAL NOT NULL,
	Prefixe varchar(50) NULL,
	IdClient int NOT NULL,
	DateReglement timestamp NULL,
	IdModeReglement int NOT NULL,
	Montant numeric(18,12) NULL,
	Commentaire varchar(250) NULL,
	TransfertCompta smallint NULL,
	Valide smallint NULL,
	Caissier varchar(150) NULL,
	TransfertTresorerie smallint NULL,
	Piece varchar(150) NULL,
	Retenu smallint NULL,
	PourcentRetenu decimal(18,3) NULL,
	Echeance timestamp NULL,
	IdDepot int NULL,
	TransfertEnTresorerie smallint NULL,
	IdRepresentant int NULL,
	CONSTRAINT PK_ReglementClient PRIMARY KEY (IdReglementClient),
	CONSTRAINT FK_ReglementClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient),
	CONSTRAINT FK_ReglementClient_ModeReglement FOREIGN KEY (IdModeReglement) REFERENCES modereglement(IdModeReglement)
);


-- reglementfournisseur definition

-- Drop table

-- DROP TABLE reglementfournisseur;

CREATE TABLE reglementfournisseur (
	IdReglementFournisseur SERIAL NOT NULL,
	Prefixe varchar(50) NULL,
	IdFournisseur int NOT NULL,
	DateReglement timestamp NULL,
	IdModeReglement int NOT NULL,
	Montant numeric(18,12) NULL,
	Commentaire varchar(250) NULL,
	TransfertCompta smallint NULL,
	Valide smallint NULL,
	Caissier varchar(150) NULL,
	TransfertTresorerie smallint NULL,
	Piece varchar(150) NULL,
	Retenu smallint NULL,
	PourcentRetenu decimal(18,3) NULL,
	Echeance timestamp NULL,
	IdDepot int NULL,
	TransfertEnTresorerie smallint NULL,
	CONSTRAINT PK_ReglementFournisseur PRIMARY KEY (IdReglementFournisseur),
	CONSTRAINT FK_ReglementFournisseur_Fournisseur FOREIGN KEY (IdFournisseur) REFERENCES fournisseur(IdFournisseur),
	CONSTRAINT FK_ReglementFournisseur_ModeReglement FOREIGN KEY (IdModeReglement) REFERENCES modereglement(IdModeReglement)
);


-- tarifclient definition

-- Drop table

-- DROP TABLE tarifclient;

CREATE TABLE tarifclient (
	IdClient int NOT NULL,
	IdArticle int NOT NULL,
	IdUnite int NOT NULL,
	Remise decimal(18,6) NULL,
	PrixHT decimal(18,12) NULL,
	PrixTTC decimal(18,12) NULL,
	CONSTRAINT PK_TarifClient PRIMARY KEY (IdClient,IdArticle,IdUnite),
	CONSTRAINT FK_TarifClient_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_TarifClient_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient),
	CONSTRAINT FK_TarifClient_Unite FOREIGN KEY (IdUnite) REFERENCES unite(Idunite)
);


-- bonachat definition

-- Drop table

-- DROP TABLE bonachat;

CREATE TABLE bonachat (
	IdBonAchat SERIAL NOT NULL,
	IdClient int NULL,
	Points int NULL,
	DateBonAchat timestamp NULL,
	Montant decimal(18,6) NULL,
	Bonus decimal(18,6) NULL,
	CONSTRAINT PK_BonAchat PRIMARY KEY (IdBonAchat),
	CONSTRAINT FK_BonAchat_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient)
);


-- boncaisse definition

-- Drop table

-- DROP TABLE boncaisse;

CREATE TABLE boncaisse (
	IdBonCaisse SERIAL NOT NULL,
	IdClient int NULL,
	IdLocal int NULL,
	DateBon timestamp NULL,
	RemiseGlobale decimal(18,12) NULL,
	Prefixe varchar(50) NULL,
	IdModeReglement int NULL,
	TotalTTC decimal(18,12) NULL,
	Reference varchar(1000) NULL,
	Validee smallint NULL,
	Caissier varchar(250) NULL,
	TotalTVA decimal(18,12) NULL,
	Groupee smallint NULL,
	Heure timestamp NULL,
	Caisse int NULL,
	Cloture smallint NULL,
	EspeceRendu decimal(18,6) DEFAULT 0 NULL,
	MontantBonAchat decimal(18,6) NULL,
	TypeBon int NULL,
	CodeBarre varchar(150) NULL,
	PointsFidelite int NULL,
	Vendeur varchar(250) NULL,
	Bonus decimal(18,12) NULL,
	EnCours smallint NULL,
	ResteAPayer decimal(18,12) NULL,
	SoldeCarte decimal(18,12) NULL,
	MontantTicketResto decimal(18,12) NULL,
	MontantChequeCadeau decimal(18,12) NULL,
	EspeceRecu decimal(18,12) NULL,
	Timbre decimal(18,3) NULL,
	CONSTRAINT PK_BonClient PRIMARY KEY (IdBonCaisse),
	CONSTRAINT FK_BonCaisse_Client FOREIGN KEY (IdClient) REFERENCES client(IdClient)
);


-- commandefournisseur definition

-- Drop table

-- DROP TABLE commandefournisseur;

CREATE TABLE commandefournisseur (
	IdCommandeFournisseur SERIAL NOT NULL,
	DateCommande timestamp NULL,
	IdFournisseur int NULL,
	RemiseGlobale numeric(18,6) NULL,
	Prefixe varchar(50) NULL,
	IdModeReglement int NULL,
	TotalTVA numeric(18,6) NULL,
	TotalTTC numeric(18,6) NULL,
	Reference varchar(1024) NULL,
	Validee smallint NULL,
	Groupee smallint NULL,
	Comptabilise smallint NULL,
	Avoir smallint NULL,
	Timbre numeric(18,3) NULL,
	Solde numeric(18,6) NULL,
	IdEtat int NULL,
	Fodec decimal(18,3) NULL,
	Caissier varchar(250) NULL,
	Commentaire varchar(500) NULL,
	DroitConsommation numeric(18,6) NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	AgentPointage varchar(350) NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	CONSTRAINT PK_CommandeFournisseur PRIMARY KEY (IdCommandeFournisseur),
	CONSTRAINT FK_CommandeFournisseur_Fournisseur FOREIGN KEY (IdFournisseur) REFERENCES fournisseur(IdFournisseur),
	CONSTRAINT FK_CommandeFournisseur_Localisation FOREIGN KEY (IdLocal) REFERENCES localisation(IdLocal)
);


-- facturefournisseur definition

-- Drop table

-- DROP TABLE facturefournisseur;

CREATE TABLE facturefournisseur (
	IdFactureFournisseur SERIAL NOT NULL,
	DateFacture timestamp NULL,
	IdFournisseur int NULL,
	RemiseGlobale numeric(18,12) NULL,
	Prefixe varchar(10) NULL,
	IdModeReglement int NULL,
	TotalTVA numeric(18,12) NULL,
	TotalTTC numeric(18,12) NULL,
	Reference varchar(1024) NULL,
	Validee smallint NULL,
	Groupee smallint NULL,
	Comptabilise smallint NULL,
	Avoir smallint NULL,
	Timbre numeric(18,3) NULL,
	Solde numeric(18,12) NULL,
	IdEtat int NULL,
	Fodec decimal(18,12) NULL,
	Caissier varchar(250) NULL,
	Commentaire varchar(500) NULL,
	DroitConsommation decimal(18,12) NULL,
	IdLocal int NULL,
	Agent varchar(350) NULL,
	AgentPointage varchar(350) NULL,
	AvanceImpot numeric(18,12) NULL,
	CalculerAvance smallint NULL,
	Note1 varchar(1000) NULL,
	Note2 varchar(1000) NULL,
	Note3 varchar(1000) NULL,
	Note4 varchar(1000) NULL,
	Note5 varchar(1000) NULL,
	CONSTRAINT PK_FactureFournisseur PRIMARY KEY (IdFactureFournisseur),
	CONSTRAINT FK_FactureFournisseur_Fournisseur FOREIGN KEY (IdFournisseur) REFERENCES fournisseur(IdFournisseur)
);


-- fournipar definition

-- Drop table

-- DROP TABLE fournipar;

CREATE TABLE fournipar (
	IdArticle int NOT NULL,
	IdFournisseur int NOT NULL,
	Reference varchar(50) NULL,
	PrixAchatHT decimal(18,12) NULL,
	PrixAchatTTC decimal(18,12) NULL,
	Principal smallint NULL,
	Delai int NULL,
	Remise decimal(18,3) NULL,
	CONSTRAINT PK_FourniPar PRIMARY KEY (IdArticle,IdFournisseur),
	CONSTRAINT FK_FourniPar_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_FourniPar_Fournisseur FOREIGN KEY (IdFournisseur) REFERENCES fournisseur(IdFournisseur)
);


-- ligneboncaisse definition

-- Drop table

-- DROP TABLE ligneboncaisse;

CREATE TABLE ligneboncaisse (
	IdLigneBonCaisse SERIAL NOT NULL,
	IdBonCaisse int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUHT decimal(18,12) NULL,
	prixUTTC decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	MontantRemise decimal(18,12) NULL,
	Reference varchar(250) NULL,
	Fodec decimal(18,12) NULL,
	Legende bytea NULL,
	Code varchar(50) NULL,
	CodeBarre varchar(50) NULL,
	DateLigne timestamp NULL,
	PrixAchatNet decimal(18,12) NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneBonClient PRIMARY KEY (IdLigneBonCaisse),
	CONSTRAINT FK_LigneBonCaisse_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneBonClient_BonClient FOREIGN KEY (IdBonCaisse) REFERENCES boncaisse(IdBonCaisse)
);


-- lignefacturefournisseur definition

-- Drop table

-- DROP TABLE lignefacturefournisseur;

CREATE TABLE lignefacturefournisseur (
	IdLigneFactureFournisseur SERIAL NOT NULL,
	IdFactureFournisseur int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Fodec decimal(18,12) NULL,
	validite timestamp NULL,
	PrixVenteNet decimal(18,12) NULL,
	PrixUhtNet decimal(18,12) NULL,
	PrixUttcNet decimal(18,12) NULL,
	Marge decimal(18,12) NULL,
	Remise2 decimal(18,12) NULL,
	DroitConsommation decimal(18,12) NULL,
	DateLigne timestamp NULL,
	CONSTRAINT PK_LigneFactureFournisseur PRIMARY KEY (IdLigneFactureFournisseur),
	CONSTRAINT FK_LigneFactureFournisseur_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneFactureFournisseur_FactureFournisseur FOREIGN KEY (IdFactureFournisseur) REFERENCES facturefournisseur(IdFactureFournisseur)
);


-- lignelivraisonclient definition

-- Drop table

-- DROP TABLE lignelivraisonclient;

CREATE TABLE lignelivraisonclient (
	IdLigneLivraison SERIAL NOT NULL,
	IdLivraisonClient int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Reference varchar(50) NULL,
	Fodec numeric(18,12) NULL,
	DroitConsommation numeric(18,12) NULL,
	Legende bytea NULL,
	PrixAchatNet numeric(18,12) NULL,
	Marge numeric(18,12) NULL,
	Code varchar(50) NULL,
	CodeBarre varchar(50) NULL,
	DateLigne timestamp NULL,
	DateLot timestamp NULL,
	CONSTRAINT PK_LigneLivraisonClient PRIMARY KEY (IdLigneLivraison),
	CONSTRAINT FK_LigneLivraisonClient_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneLivraisonClient_LivraisonClient FOREIGN KEY (IdLivraisonClient) REFERENCES livraisonclient(IdLivraisonClient)
);


-- lignelivraisonfournisseur definition

-- Drop table

-- DROP TABLE lignelivraisonfournisseur;

CREATE TABLE lignelivraisonfournisseur (
	IdLigneLivraisonFournisseur SERIAL NOT NULL,
	IdLivraisonFournisseur int NULL,
	IdArticle int NULL,
	Description varchar(500) NULL,
	Qte decimal(18,6) NULL,
	PrixUht decimal(18,12) NULL,
	PrixUttc decimal(18,12) NULL,
	IdUnite int NULL,
	MontantTVA decimal(18,12) NULL,
	Remise decimal(18,12) NULL,
	Fodec decimal(18,12) NULL,
	validite timestamp NULL,
	PrixVenteNet decimal(18,12) NULL,
	PrixUhtNet decimal(18,12) NULL,
	PrixUttcNet decimal(18,12) NULL,
	Marge decimal(18,12) NULL,
	Remise2 decimal(18,12) NULL,
	DroitConsommation decimal(18,12) NULL,
	DateLigne timestamp NULL,
	CONSTRAINT PK_LigneLivraisonFournisseur PRIMARY KEY (IdLigneLivraisonFournisseur),
	CONSTRAINT FK_LigneLivraisonFournisseur_Article FOREIGN KEY (IdArticle) REFERENCES article(IdArticle),
	CONSTRAINT FK_LigneLivraisonFournisseur_LivraisonFournisseur FOREIGN KEY (IdLivraisonFournisseur) REFERENCES livraisonfournisseur(IdLivraisonFournisseur)
);


-- lignereglementclient definition

-- Drop table

-- DROP TABLE lignereglementclient;

CREATE TABLE lignereglementclient (
	IdReglement int NOT NULL,
	PrefixeReglement varchar(10) NOT NULL,
	IdPiece int NOT NULL,
	PrefixePiece varchar(10) NULL,
	MontantReglement numeric(18,12) NULL,
	CONSTRAINT PK_LigneReglementClient_1 PRIMARY KEY (IdReglement,PrefixeReglement,IdPiece),
	CONSTRAINT FK_LigneReglementClient_ReglementClient FOREIGN KEY (IdReglement) REFERENCES reglementclient(IdReglementClient)
);


-- lignereglementfournisseur definition

-- Drop table

-- DROP TABLE lignereglementfournisseur;

CREATE TABLE lignereglementfournisseur (
	IdReglement int NOT NULL,
	PrefixeReglement varchar(10) NOT NULL,
	IdPiece int NOT NULL,
	PrefixePiece varchar(10) NULL,
	MontantReglement numeric(18,12) NULL,
	CONSTRAINT PK_LigneReglementFournisseur PRIMARY KEY (IdReglement,PrefixeReglement,IdPiece),
	CONSTRAINT FK_LigneReglementFournisseur_ReglementFournisseur FOREIGN KEY (IdReglement) REFERENCES reglementfournisseur(IdReglementFournisseur)
);


-- operationfidelite definition

-- Drop table

-- DROP TABLE operationfidelite;

CREATE TABLE operationfidelite (
	IdOperation SERIAL NOT NULL,
	CodeBarre int NULL,
	IdBonCaisse int NULL,
	Points int NULL,
	CONSTRAINT PK_OperationFidelite PRIMARY KEY (IdOperation),
	CONSTRAINT FK_OperationFidelite_BonCaisse FOREIGN KEY (IdBonCaisse) REFERENCES boncaisse(IdBonCaisse)
);