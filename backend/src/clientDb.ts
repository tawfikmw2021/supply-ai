import { Pool } from 'pg';

function makePoolConfig(database: string) {
  return {
    host:     process.env.PG_HOST     ?? 'localhost',
    port:     Number(process.env.PG_PORT ?? 5432),
    database,
    user:     process.env.PG_USER     ?? 'postgres',
    password: process.env.PG_PASSWORD ?? '',
    max:      Number(process.env.PG_MAX_CONNECTIONS ?? 10),
  };
}

// All allowed table names (whitelist for security) — all lowercase
export const ALLOWED_TABLES = new Set([
  'agent','articleretire','article','banque','bonachat','bonachatclient','boncaisse',
  'camion','carte','categoriearticle','categorieoperation','chauffeur','cheque',
  'chequecadeau','client','codebarrearticle','codebarrearticleretire','commandeclient',
  'commandefournisseur','comptecomptable','compte','devisclient','entree','etatcheque',
  'etatordredefabrication','etat','factureclient','facturefournisseur','famillearticle',
  'familleclient','famillefournisseur','fonction','formejuridique','fournipar','fournisseur',
  'grillecarte','groupecategorie','groupementachat','groupementreglementvente','groupementvente',
  'importation','inventaire','journal','journee','libelletarifgros','ligneboncaisse',
  'lignecommandeclient','lignecommandefournisseur','lignedevisclient','ligneentree',
  'lignefactureclient','lignefacturefournisseur','ligneinventaire','lignejournee',
  'lignelivraisonclient','lignelivraisonfournisseur','ligneordredefabrication','lignepromotion',
  'lignereglementclient','lignereglementfournisseur','ligneremisecheque','lignesms',
  'lignesortie','lignetransfert','livraisonclient','livraisonfournisseur','localisation',
  'log','marque','modereglement','mouvementcaisse','mouvementstock','nomenclature','notes',
  'notification','numeroordre','operationfidelite','operation','ordredefabrication','page',
  'poids','promotion','qteparlocal','rayon','reglementboncaisse','reglementclient',
  'reglementfournisseur','remisecheque','remisefamille','representant','retenusource',
  'rubrique','sms','soldecarte','sortie','tarifclient','tariffamille','tarifgros',
  'ticketresto','titre','traite','transfert','tva','typecategorie','typechequecadeau',
  'typecompte','typemouvement','typeoperation','typereglement','typeticketresto',
  'unite','unitearticle','unitecolisage','vendeur','ville',
]);

// Default pool — used for health checks and backward compat
export const pgPool = new Pool(makePoolConfig(process.env.PG_DATABASE ?? 'supply'));
pgPool.on('error', (err) => console.error('[pgPool] unexpected error:', err.message));

// Per-account pools: connects to supply_{accountId}
const accountPools = new Map<number, Pool>();

export function getAccountPool(accountId: number): Pool {
  if (accountPools.has(accountId)) return accountPools.get(accountId)!;
  const pool = new Pool(makePoolConfig(`supply_${accountId}`));
  pool.on('error', (err) => console.error(`[pgPool:supply_${accountId}] unexpected error:`, err.message));
  accountPools.set(accountId, pool);
  return pool;
}

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  pool: Pool = pgPool
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function pgQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  pool: Pool = pgPool
): Promise<T | undefined> {
  const rows = await pgQuery<T>(sql, params, pool);
  return rows[0];
}

// Cache primary key per (accountId:table)
const pkCache = new Map<string, string>();

export async function getTablePk(table: string, pool: Pool = pgPool, accountId = 0): Promise<string | null> {
  const key = `${accountId}:${table}`;
  if (pkCache.has(key)) return pkCache.get(key)!;
  const rows = await pgQuery<{ column_name: string }>(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = $1
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
    LIMIT 1
  `, [table], pool);
  const pk = rows[0]?.column_name ?? null;
  pkCache.set(key, pk as string);
  return pk;
}

// Cache text columns per (accountId:table)
const textColsCache = new Map<string, string[]>();

export async function getTextColumns(table: string, pool: Pool = pgPool, accountId = 0): Promise<string[]> {
  const key = `${accountId}:${table}`;
  if (textColsCache.has(key)) return textColsCache.get(key)!;
  const rows = await pgQuery<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
      AND data_type IN ('character varying','text','char','character')
    ORDER BY ordinal_position
    LIMIT 10
  `, [table], pool);
  const cols = rows.map(r => r.column_name);
  textColsCache.set(key, cols);
  return cols;
}
