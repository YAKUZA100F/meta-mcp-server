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
  crmToken?: string;
  storeSlug?: string;
}

export interface LandingPage {
  id: string;
  clientId: string;
  storeSlug: string;
  productSlug: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  description: string;
  features: string[];
  images: string[];
  pixelId?: string;
  whatsappNumber?: string;
  themeColor?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LandingOrder {
  id: string;
  pageId: string;
  clientId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  quantity: number;
  totalPrice: number;
  notes?: string;
  status: "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
  sourceIp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  license?: ClientLicense;
  error?: string;
}

export function slugify(text: string): string {
  if (!text) return "store";
  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u0621-\u064A-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "store-" + Math.floor(Math.random() * 1000);
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LICENSES_FILE = path.join(DATA_DIR, "licenses.json");
const LANDING_PAGES_FILE = path.join(DATA_DIR, "landing_pages.json");
const ORDERS_FILE = path.join(DATA_DIR, "landing_orders.json");
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
    const isLocalOrInternal = DATABASE_URL.includes("localhost") || 
                              DATABASE_URL.includes("127.0.0.1") || 
                              DATABASE_URL.includes("oniflow") || 
                              DATABASE_URL.includes("172.") || 
                              DATABASE_URL.includes("sslmode=disable");
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: (process.env.NODE_ENV === "production" && !isLocalOrInternal)
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
          notes TEXT,
          crm_token VARCHAR(64),
          store_slug VARCHAR(64)
        );
        ALTER TABLE client_licenses ADD COLUMN IF NOT EXISTS crm_token VARCHAR(64);
        ALTER TABLE client_licenses ADD COLUMN IF NOT EXISTS store_slug VARCHAR(64);
        CREATE INDEX IF NOT EXISTS idx_licenses_token ON client_licenses(token);
        CREATE INDEX IF NOT EXISTS idx_licenses_crm ON client_licenses(crm_token);
        CREATE INDEX IF NOT EXISTS idx_licenses_store ON client_licenses(store_slug);

        CREATE TABLE IF NOT EXISTS landing_pages (
          id VARCHAR(64) PRIMARY KEY,
          client_id VARCHAR(64) REFERENCES client_licenses(id) ON DELETE CASCADE,
          store_slug VARCHAR(64) NOT NULL,
          product_slug VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          compare_at_price NUMERIC(10, 2),
          currency VARCHAR(10) DEFAULT 'MAD',
          description TEXT,
          features JSONB DEFAULT '[]',
          images JSONB DEFAULT '[]',
          pixel_id VARCHAR(64),
          whatsapp_number VARCHAR(32),
          theme_color VARCHAR(16) DEFAULT '#16a34a',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(store_slug, product_slug)
        );
        CREATE INDEX IF NOT EXISTS idx_landing_slug ON landing_pages(store_slug, product_slug);
        CREATE INDEX IF NOT EXISTS idx_landing_client ON landing_pages(client_id);

        CREATE TABLE IF NOT EXISTS landing_orders (
          id VARCHAR(64) PRIMARY KEY,
          page_id VARCHAR(64) REFERENCES landing_pages(id) ON DELETE CASCADE,
          client_id VARCHAR(64) REFERENCES client_licenses(id) ON DELETE CASCADE,
          order_number VARCHAR(32) NOT NULL UNIQUE,
          customer_name VARCHAR(128) NOT NULL,
          customer_phone VARCHAR(32) NOT NULL,
          customer_city VARCHAR(64) NOT NULL,
          customer_address TEXT,
          quantity INTEGER DEFAULT 1,
          total_price NUMERIC(10, 2) NOT NULL,
          notes TEXT,
          status VARCHAR(32) DEFAULT 'new',
          source_ip VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_orders_client ON landing_orders(client_id);
        CREATE INDEX IF NOT EXISTS idx_orders_created ON landing_orders(created_at DESC);
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
          const crmTok = lic.crmToken || `crm_sec_${lic.id}`;
          const sSlug = lic.storeSlug || slugify(lic.clientName);
          await client.query(
            `INSERT INTO client_licenses (id, token, client_name, status, created_at, expires_at, meta_token, ad_account_id, business_id, page_id, pixel_id, allowed_ad_accounts, notes, crm_token, store_slug)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
              crmTok,
              sSlug,
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
    crmToken: row.crm_token || `crm_sec_${row.id}`,
    storeSlug: row.store_slug || slugify(row.client_name),
  };
}

function rowToLandingPage(row: any): LandingPage {
  return {
    id: row.id,
    clientId: row.client_id,
    storeSlug: row.store_slug,
    productSlug: row.product_slug,
    title: row.title,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : undefined,
    currency: row.currency || "MAD",
    description: row.description || "",
    features: Array.isArray(row.features) ? row.features : (typeof row.features === "string" ? JSON.parse(row.features) : []),
    images: Array.isArray(row.images) ? row.images : (typeof row.images === "string" ? JSON.parse(row.images) : []),
    pixelId: row.pixel_id || undefined,
    whatsappNumber: row.whatsapp_number || undefined,
    themeColor: row.theme_color || "#16a34a",
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function rowToOrder(row: any): LandingOrder {
  return {
    id: row.id,
    pageId: row.page_id,
    clientId: row.client_id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerCity: row.customer_city,
    customerAddress: row.customer_address || undefined,
    quantity: Number(row.quantity) || 1,
    totalPrice: Number(row.total_price),
    notes: row.notes || undefined,
    status: row.status || "new",
    sourceIp: row.source_ip || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
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
    for (const lic of data) {
      if (!lic.crmToken) lic.crmToken = `crm_sec_${lic.id}`;
      if (!lic.storeSlug) lic.storeSlug = slugify(lic.clientName);
      map.set(lic.token, lic);
    }
  } catch (err) {
    console.error("Failed to read licenses file:", err);
  }
  return map;
}

function saveJsonLicenses(licenses: Map<string, ClientLicense>): void {
  ensureDataDir();
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(Array.from(licenses.values()), null, 2), "utf-8");
}

function loadJsonLandingPages(): Map<string, LandingPage> {
  ensureDataDir();
  const map = new Map<string, LandingPage>();
  if (!fs.existsSync(LANDING_PAGES_FILE)) return map;
  try {
    const raw = fs.readFileSync(LANDING_PAGES_FILE, "utf-8");
    const data: LandingPage[] = JSON.parse(raw);
    for (const p of data) map.set(p.id, p);
  } catch (err) {
    console.error("Failed to read landing pages file:", err);
  }
  return map;
}

function saveJsonLandingPages(pages: Map<string, LandingPage>): void {
  ensureDataDir();
  fs.writeFileSync(LANDING_PAGES_FILE, JSON.stringify(Array.from(pages.values()), null, 2), "utf-8");
}

function loadJsonOrders(): Map<string, LandingOrder> {
  ensureDataDir();
  const map = new Map<string, LandingOrder>();
  if (!fs.existsSync(ORDERS_FILE)) return map;
  try {
    const raw = fs.readFileSync(ORDERS_FILE, "utf-8");
    const data: LandingOrder[] = JSON.parse(raw);
    for (const o of data) map.set(o.id, o);
  } catch (err) {
    console.error("Failed to read orders file:", err);
  }
  return map;
}

function saveJsonOrders(orders: Map<string, LandingOrder>): void {
  ensureDataDir();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(Array.from(orders.values()), null, 2), "utf-8");
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

  const crmToken = `crm_sec_${crypto.randomBytes(16).toString("hex")}`;
  const storeSlug = slugify(params.clientName);

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
    crmToken,
    storeSlug,
  };

  if (isPostgresReady && pool) {
    await pool.query(
      `INSERT INTO client_licenses (id, token, client_name, status, created_at, expires_at, meta_token, ad_account_id, business_id, page_id, pixel_id, allowed_ad_accounts, notes, crm_token, store_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
        license.crmToken,
        license.storeSlug,
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

// ─── LANDING PAGES & ORDERS OPERATIONS ────────────────────────────────────────

export async function createLandingPageAsync(params: {
  clientId: string;
  storeSlug: string;
  productSlug: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  currency?: string;
  description?: string;
  features?: string[];
  images?: string[];
  pixelId?: string;
  whatsappNumber?: string;
  themeColor?: string;
}): Promise<LandingPage> {
  const id = `lp_${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const page: LandingPage = {
    id,
    clientId: params.clientId,
    storeSlug: slugify(params.storeSlug),
    productSlug: slugify(params.productSlug),
    title: params.title,
    price: params.price,
    compareAtPrice: params.compareAtPrice,
    currency: params.currency || "MAD",
    description: params.description || "",
    features: params.features || [],
    images: params.images || [],
    pixelId: params.pixelId,
    whatsappNumber: params.whatsappNumber,
    themeColor: params.themeColor || "#16a34a",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  if (isPostgresReady && pool) {
    await pool.query(
      `INSERT INTO landing_pages (id, client_id, store_slug, product_slug, title, price, compare_at_price, currency, description, features, images, pixel_id, whatsapp_number, theme_color, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (store_slug, product_slug) DO UPDATE
       SET title = EXCLUDED.title, price = EXCLUDED.price, compare_at_price = EXCLUDED.compare_at_price, description = EXCLUDED.description,
           features = EXCLUDED.features, images = EXCLUDED.images, pixel_id = EXCLUDED.pixel_id, whatsapp_number = EXCLUDED.whatsapp_number,
           theme_color = EXCLUDED.theme_color, is_active = EXCLUDED.is_active, updated_at = NOW()`,
      [
        page.id,
        page.clientId,
        page.storeSlug,
        page.productSlug,
        page.title,
        page.price,
        page.compareAtPrice || null,
        page.currency,
        page.description,
        JSON.stringify(page.features),
        JSON.stringify(page.images),
        page.pixelId || null,
        page.whatsappNumber || null,
        page.themeColor,
        page.isActive,
        page.createdAt,
        page.updatedAt,
      ]
    );
  } else {
    const pages = loadJsonLandingPages();
    for (const [key, existing] of pages.entries()) {
      if (existing.storeSlug === page.storeSlug && existing.productSlug === page.productSlug) {
        pages.delete(key);
      }
    }
    pages.set(page.id, page);
    saveJsonLandingPages(pages);
  }

  return page;
}

export async function getLandingPageBySlugAsync(storeSlug: string, productSlug: string): Promise<LandingPage | null> {
  const normStore = slugify(storeSlug);
  const normProduct = slugify(productSlug);

  if (isPostgresReady && pool) {
    const res = await pool.query(
      "SELECT * FROM landing_pages WHERE store_slug = $1 AND product_slug = $2 AND is_active = TRUE",
      [normStore, normProduct]
    );
    return res.rows.length ? rowToLandingPage(res.rows[0]) : null;
  }

  const pages = loadJsonLandingPages();
  for (const page of pages.values()) {
    if (page.storeSlug === normStore && page.productSlug === normProduct && page.isActive) {
      return page;
    }
  }
  return null;
}

export async function listLandingPagesByClientAsync(clientId: string): Promise<LandingPage[]> {
  if (isPostgresReady && pool) {
    const res = await pool.query(
      "SELECT * FROM landing_pages WHERE client_id = $1 ORDER BY created_at DESC",
      [clientId]
    );
    return res.rows.map(rowToLandingPage);
  }

  const pages = loadJsonLandingPages();
  const result: LandingPage[] = [];
  for (const page of pages.values()) {
    if (page.clientId === clientId) {
      result.push(page);
    }
  }
  return result;
}

export async function createLandingOrderAsync(params: {
  pageId: string;
  storeSlug: string;
  productSlug: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  quantity: number;
  totalPrice: number;
  notes?: string;
  sourceIp?: string;
}): Promise<LandingOrder> {
  const id = `ord_${crypto.randomBytes(6).toString("hex")}`;
  const orderNumber = `ONF-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  let clientId = "";
  const page = await getLandingPageBySlugAsync(params.storeSlug, params.productSlug);
  if (page) {
    clientId = page.clientId;
  }

  const order: LandingOrder = {
    id,
    pageId: params.pageId || (page ? page.id : ""),
    clientId,
    orderNumber,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerCity: params.customerCity,
    customerAddress: params.customerAddress,
    quantity: params.quantity,
    totalPrice: params.totalPrice,
    notes: params.notes,
    status: "new",
    sourceIp: params.sourceIp,
    createdAt: now,
    updatedAt: now,
  };

  if (isPostgresReady && pool) {
    await pool.query(
      `INSERT INTO landing_orders (id, page_id, client_id, order_number, customer_name, customer_phone, customer_city, customer_address, quantity, total_price, notes, status, source_ip, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        order.id,
        order.pageId || null,
        order.clientId || null,
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.customerCity,
        order.customerAddress || null,
        order.quantity,
        order.totalPrice,
        order.notes || null,
        order.status,
        order.sourceIp || null,
        order.createdAt,
        order.updatedAt,
      ]
    );
  } else {
    const orders = loadJsonOrders();
    orders.set(order.id, order);
    saveJsonOrders(orders);
  }

  return order;
}

export async function getClientByCrmTokenAsync(crmToken: string): Promise<ClientLicense | null> {
  if (!crmToken) return null;

  if (isPostgresReady && pool) {
    const res = await pool.query(
      "SELECT * FROM client_licenses WHERE crm_token = $1",
      [crmToken]
    );
    if (res.rows.length) return rowToLicense(res.rows[0]);
  }

  const licenses = loadJsonLicenses();
  for (const lic of licenses.values()) {
    if (lic.crmToken === crmToken) return lic;
  }
  return null;
}

export async function listOrdersByClientAsync(clientId: string): Promise<LandingOrder[]> {
  if (isPostgresReady && pool) {
    const res = await pool.query(
      "SELECT * FROM landing_orders WHERE client_id = $1 ORDER BY created_at DESC",
      [clientId]
    );
    return res.rows.map(rowToOrder);
  }

  const orders = loadJsonOrders();
  const list: LandingOrder[] = [];
  for (const o of orders.values()) {
    if (o.clientId === clientId) list.push(o);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listOrdersByCrmTokenAsync(crmToken: string): Promise<{ license: ClientLicense; orders: LandingOrder[] } | null> {
  const license = await getClientByCrmTokenAsync(crmToken);
  if (!license) return null;

  const orders = await listOrdersByClientAsync(license.id);
  return { license, orders };
}

export async function updateOrderStatusByCrmTokenAsync(
  crmToken: string,
  orderId: string,
  status: "new" | "confirmed" | "shipped" | "delivered" | "cancelled"
): Promise<LandingOrder | null> {
  const license = await getClientByCrmTokenAsync(crmToken);
  if (!license) return null;

  if (isPostgresReady && pool) {
    const res = await pool.query(
      `UPDATE landing_orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
      [status, orderId, license.id]
    );
    return res.rows.length ? rowToOrder(res.rows[0]) : null;
  }

  const orders = loadJsonOrders();
  const order = orders.get(orderId);
  if (!order || order.clientId !== license.id) return null;

  order.status = status;
  order.updatedAt = new Date().toISOString();
  orders.set(orderId, order);
  saveJsonOrders(orders);
  return order;
}
