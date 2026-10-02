import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const { Pool } = pg;

export interface ClientLicense {
  id: string;
  token: string;
  clientName: string;
  status: "active" | "suspended" | "revoked";
  createdAt: string;
  expiresAt: string;
  metaToken?: string;
  adAccountId?: string;
  businessId?: string;
  pageId?: string;
  pixelId?: string;
  allowedAdAccounts?: string[];
  notes?: string;
}

export interface VerificationResult {
  valid: boolean;
  license?: ClientLicense;
  error?: string;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LICENSES_FILE = path.join(DATA_DIR, "licenses.json");
const DATABASE_URL = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isPostgresReady = false;

// Initialize PostgreSQL if DATABASE_URL is configured
export async function initDatabase(): Promise<void> {
  if (!DATABASE_URL) {
    console.log("[DATABASE] No DATABASE_URL provided. Using persistent JSON store (data/licenses.json).");
    ensureDataDir();
    return;
  }

  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" && !DATABASE_URL.includes("localhost")
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      console.log("[DATABASE] Connected to PostgreSQL successfully!");
      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS client_licenses (
          id VARCHAR(64) PRIMARY KEY,
          token VARCHAR(128) UNIQUE NOT NULL,
          client_name VARCHAR(255) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          meta_token TEXT,
          ad_account_id VARCHAR(64),
          business_id VARCHAR(64),
          page_id VARCHAR(64),
          pixel_id VARCHAR(64),
          allowed_ad_accounts TEXT[],
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_licenses_token ON client_licenses(token);
      `);
      isPostgresReady = true;

      // Migrate existing JSON licenses to PostgreSQL if table is empty
      const countRes = await client.query("SELECT COUNT(*) FROM client_licenses");
      const rowCount = parseInt(countRes.rows[0].count, 10);
      if (rowCount === 0 && fs.existsSync(LICENSES_FILE)) {
        console.log("[DATABASE] Migrating existing local licenses to PostgreSQL...");
        const raw = fs.readFileSync(LICENSES_FILE, "utf-8");
        const existing: ClientLicense[] = JSON.parse(raw);
        for (const lic of existing) {
          await client.query(
            `INSERT INTO client_licenses (id, token, client_name, status, created_at, expires_at, meta_token, ad_account_id, business_id, page_id, pixel_id, allowed_ad_accounts, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO NOTHING`,
            [
              lic.id,
              lic.token,
              lic.clientName,
              lic.status,
              lic.createdAt,
              lic.expiresAt,
              lic.metaToken || null,
              lic.adAccountId || null,
              lic.businessId || null,
              lic.pageId || null,
              lic.pixelId || null,
              lic.allowedAdAccounts || null,
              lic.notes || null,
            ]
          );
        }
        console.log(`[DATABASE] Successfully migrated ${existing.length} licenses to PostgreSQL.`);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[DATABASE ERROR] Failed to connect to PostgreSQL:", err);
    console.log("[DATABASE] Falling back to persistent JSON store.");
    isPostgresReady = false;
  }
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Map PostgreSQL snake_case row to ClientLicense camelCase interface
function rowToLicense(row: any): ClientLicense {
  return {
    id: row.id,
    token: row.token,
    clientName: row.client_name,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    metaToken: row.meta_token || undefined,
    adAccountId: row.ad_account_id || undefined,
    businessId: row.business_id || undefined,
    pageId: row.page_id || undefined,
    pixelId: row.pixel_id || undefined,
    allowedAdAccounts: row.allowed_ad_accounts || undefined,
    notes: row.notes || undefined,
  };
}

// Fallback JSON operations
function loadJsonLicenses(): Map<string, ClientLicense> {
  ensureDataDir();
  const map = new Map<string, ClientLicense>();
  if (!fs.existsSync(LICENSES_FILE)) return map;
  try {
    const raw = fs.readFileSync(LICENSES_FILE, "utf-8");
    const data: ClientLicense[] = JSON.parse(raw);
    for (const lic of data) map.set(lic.token, lic);
  } catch (err) {
    console.error("Failed to read licenses file:", err);
  }
  return map;
}

function saveJsonLicenses(licenses: Map<string, ClientLicense>): void {
  ensureDataDir();
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(Array.from(licenses.values()), null, 2), "utf-8");
}

// ─── UNIFIED ASYNC DB OPERATIONS ───────────────────────────────────────────

export async function getLicenseByToken(token: string): Promise<ClientLicense | null> {
  if (isPostgresReady && pool) {
    const res = await pool.query("SELECT * FROM client_licenses WHERE token = $1", [token]);
    return res.rows.length ? rowToLicense(res.rows[0]) : null;
  }
  return loadJsonLicenses().get(token) || null;
}

export async function getLicenseByIdOrToken(target: string): Promise<ClientLicense | null> {
  if (isPostgresReady && pool) {
    const res = await pool.query(
      "SELECT * FROM client_licenses WHERE id = $1 OR token = $1",
      [target]
    );
    return res.rows.length ? rowToLicense(res.rows[0]) : null;
  }
  for (const lic of loadJsonLicenses().values()) {
    if (lic.id === target || lic.token === target) return lic;
  }
  return null;
}

export async function verifyLicenseAsync(token: string): Promise<VerificationResult> {
  if (!token) return { valid: false, error: "Missing authorization token." };

  const license = await getLicenseByToken(token);
  if (!license) return { valid: false, error: "Invalid license token. Access denied." };

  if (license.status === "suspended") {
    return { valid: false, error: "Subscription suspended. Please contact support." };
  }
  if (license.status === "revoked") {
    return { valid: false, error: "License revoked. Access permanently disabled." };
  }

  const now = new Date();
  const expiresAt = new Date(license.expiresAt);
  if (now > expiresAt) {
    return {
      valid: false,
      error: `Subscription expired on ${expiresAt.toISOString().split("T")[0]}. Please renew your monthly subscription to continue using Meta Ads AI.`,
    };
  }

  return { valid: true, license };
}

export async function createLicenseAsync(params: {
  clientName: string;
  daysValid: number;
  metaToken?: string;
  adAccountId?: string;
  businessId?: string;
  pageId?: string;
  pixelId?: string;
  allowedAdAccounts?: string[];
  notes?: string;
}): Promise<ClientLicense> {
  const id = `lic_${crypto.randomBytes(4).toString("hex")}`;
  const token = `meta_sec_${crypto.randomBytes(16).toString("hex")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.daysValid * 24 * 60 * 60 * 1000);

  const license: ClientLicense = {
    id,
    token,
    clientName: params.clientName,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metaToken: params.metaToken,
    adAccountId: params.adAccountId,
    businessId: params.businessId,
    pageId: params.pageId,
    pixelId: params.pixelId,
    allowedAdAccounts: params.allowedAdAccounts,
    notes: params.notes,
  };

  if (isPostgresReady && pool) {
    await pool.query(
      `INSERT INTO client_licenses (id, token, client_name, status, created_at, expires_at, meta_token, ad_account_id, business_id, page_id, pixel_id, allowed_ad_accounts, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        license.id,
        license.token,
        license.clientName,
        license.status,
        license.createdAt,
        license.expiresAt,
        license.metaToken || null,
        license.adAccountId || null,
        license.businessId || null,
        license.pageId || null,
        license.pixelId || null,
        license.allowedAdAccounts || null,
        license.notes || null,
      ]
    );
  } else {
    const licenses = loadJsonLicenses();
    licenses.set(token, license);
    saveJsonLicenses(licenses);
  }

  return license;
}

export async function renewLicenseAsync(
  tokenOrId: string,
  additionalDays: number
): Promise<ClientLicense | null> {
  const found = await getLicenseByIdOrToken(tokenOrId);
  if (!found) return null;

  const currentExpiry = new Date(found.expiresAt);
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiry = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  found.expiresAt = newExpiry.toISOString();
  found.status = "active";

  if (isPostgresReady && pool) {
    await pool.query(
      "UPDATE client_licenses SET expires_at = $1, status = 'active' WHERE id = $2 OR token = $2",
      [found.expiresAt, tokenOrId]
    );
  } else {
    const licenses = loadJsonLicenses();
    licenses.set(found.token, found);
    saveJsonLicenses(licenses);
  }

  return found;
}

export async function setLicenseStatusAsync(
  tokenOrId: string,
  status: "active" | "suspended" | "revoked"
): Promise<ClientLicense | null> {
  const found = await getLicenseByIdOrToken(tokenOrId);
  if (!found) return null;

  found.status = status;

  if (isPostgresReady && pool) {
    await pool.query(
      "UPDATE client_licenses SET status = $1 WHERE id = $2 OR token = $2",
      [status, tokenOrId]
    );
  } else {
    const licenses = loadJsonLicenses();
    licenses.set(found.token, found);
    saveJsonLicenses(licenses);
  }

  return found;
}

export async function updateLicenseAsync(
  tokenOrId: string,
  updates: Partial<Omit<ClientLicense, "id" | "token" | "createdAt">>
): Promise<ClientLicense | null> {
  const found = await getLicenseByIdOrToken(tokenOrId);
  if (!found) return null;

  Object.assign(found, updates);

  if (isPostgresReady && pool) {
    await pool.query(
      `UPDATE client_licenses
       SET client_name = COALESCE($1, client_name),
           meta_token = COALESCE($2, meta_token),
           ad_account_id = COALESCE($3, ad_account_id),
           business_id = COALESCE($4, business_id),
           page_id = COALESCE($5, page_id),
           pixel_id = COALESCE($6, pixel_id),
           notes = COALESCE($7, notes)
       WHERE id = $8 OR token = $8`,
      [
        updates.clientName ?? null,
        updates.metaToken ?? null,
        updates.adAccountId ?? null,
        updates.businessId ?? null,
        updates.pageId ?? null,
        updates.pixelId ?? null,
        updates.notes ?? null,
        tokenOrId,
      ]
    );
  } else {
    const licenses = loadJsonLicenses();
    licenses.set(found.token, found);
    saveJsonLicenses(licenses);
  }

  return found;
}

export async function deleteLicenseAsync(tokenOrId: string): Promise<boolean> {
  if (isPostgresReady && pool) {
    const res = await pool.query(
      "DELETE FROM client_licenses WHERE id = $1 OR token = $1",
      [tokenOrId]
    );
    return (res.rowCount ?? 0) > 0;
  }
  const licenses = loadJsonLicenses();
  let targetToken: string | undefined;
  for (const [tok, lic] of licenses.entries()) {
    if (tok === tokenOrId || lic.id === tokenOrId) {
      targetToken = tok;
      break;
    }
  }
  if (!targetToken) return false;
  licenses.delete(targetToken);
  saveJsonLicenses(licenses);
  return true;
}

export async function listLicensesAsync(): Promise<ClientLicense[]> {
  if (isPostgresReady && pool) {
    const res = await pool.query("SELECT * FROM client_licenses ORDER BY created_at DESC");
    return res.rows.map(rowToLicense);
  }
  return Array.from(loadJsonLicenses().values());
}
