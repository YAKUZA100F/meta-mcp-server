#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MetaApiClient } from "./services/api.js";
import { registerPageTools } from "./tools/pages.js";
import { registerInstagramTools } from "./tools/instagram.js";
import { registerAdsTools } from "./tools/ads.js";
import { registerAudiencesTools } from "./tools/audiences.js";
import { registerInsightsTools } from "./tools/insights.js";
import { registerThreadsTools } from "./tools/threads.js";
import { registerAdLibraryTools } from "./tools/ad_library.js";
import { registerConversionTools } from "./tools/conversions.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerChartTools } from "./tools/charts.js";
import { registerCommerceTools } from "./tools/commerce.js";
import { registerOniflowTools } from "./tools/oniflow.js";
import { renderLandingPage } from "./landing/renderer.js";
import { renderCrmPage } from "./landing/crm.js";
import {
  getLandingPageBySlugAsync,
  createLandingOrderAsync,
  listOrdersByCrmTokenAsync,
  updateOrderStatusByCrmTokenAsync,
} from "./services/db.js";
import { resolveApiKey } from "./op-fallback.js";
import {
  initDatabase,
  verifyLicense,
  createLicense,
  renewLicense,
  setLicenseStatus,
  updateLicense,
  deleteLicense,
  listLicenses,
  ClientLicense,
} from "./services/licensing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

resolveApiKey("META_ACCESS_TOKEN", "op://Development/Meta Access Token/credential");
resolveApiKey("THREADS_ACCESS_TOKEN", "op://Development/Threads Access Token/credential");

const defaultMetaToken = process.env.META_ACCESS_TOKEN ?? "";
const threadsToken = process.env.THREADS_ACCESS_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin123";

/**
 * Creates and registers all Meta tools onto a given McpServer instance
 * Configured specifically for each client license (Isolated Tenant)
 */
export function createConfiguredMcpServer(client: MetaApiClient, license: ClientLicense): McpServer {
  const server = new McpServer({
    name: "meta-mcp-server",
    version: "2.1.0",
  });

  // Client Account Context Tool (Allows Antigravity to immediately identify the client's ad account)
  server.registerTool(
    "meta_get_assigned_account",
    {
      title: "Get Assigned Account Context",
      description: `Returns the authenticated client's assigned ad account ID, business manager, and subscription status.
Antigravity should call this first to determine the primary ad account ID to operate on.`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                clientName: license.clientName,
                assignedAdAccountId: license.adAccountId ?? "Auto-detect from list_ad_accounts",
                businessId: license.businessId ?? null,
                subscriptionStatus: license.status,
                subscriptionExpiresAt: license.expiresAt,
                message: license.adAccountId
                  ? `Operating on dedicated account: ${license.adAccountId}`
                  : "No specific account hardcoded. Use meta_list_ad_accounts to view authorized accounts.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  registerPageTools(server, client);
  registerInstagramTools(server, client);
  registerAdsTools(server, client);
  registerAudiencesTools(server, client);
  registerInsightsTools(server, client);
  registerThreadsTools(server, client);
  registerAdLibraryTools(server, client);
  registerConversionTools(server, client);
  registerUtilityTools(server, client);
  registerChartTools(server);
  registerCommerceTools(server, client);
  registerOniflowTools(server, license);

  return server;
}

interface ActiveSession {
  transport: SSEServerTransport;
  server: McpServer;
  license: ClientLicense;
  clientApi: MetaApiClient;
  connectedAt: Date;
}

const activeSessions = new Map<string, ActiveSession>();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// CORS setup
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key, X-Meta-Token, X-Ad-Account-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

/**
 * Extracts license token from Authorization header or URL query parameter
 */
function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  if (typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return undefined;
}

// In-Memory Brute-Force Rate Limiter for Admin Access
const failedAdminAttempts = new Map<string, { count: number; lockedUntil: number }>();

/**
 * Admin Authentication Middleware with Brute-Force Lockout
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
  const now = Date.now();
  const attempt = failedAdminAttempts.get(ip);

  if (attempt && attempt.lockedUntil > now) {
    const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
    res.status(429).json({ error: `Too many failed attempts. Temporary lockout for ${waitSec}s.` });
    return;
  }

  const key = req.headers["x-admin-key"] || req.query.adminKey;
  if (!key || key !== ADMIN_SECRET) {
    const current = attempt || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= 5) {
      current.lockedUntil = now + 10 * 60 * 1000; // 10 minutes lockout
      console.warn(`[SECURITY ALERT] IP ${ip} locked out from admin endpoints after 5 failed attempts.`);
    }
    failedAdminAttempts.set(ip, current);
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin key." });
    return;
  }

  failedAdminAttempts.delete(ip);
  next();
}

// ─── ADMIN DASHBOARD & API ──────────────────────────────────────────────────

// Serve Admin UI Dashboard
app.get(["/admin", "/"], (_req: Request, res: Response) => {
  // Look for dashboard.html either in src/admin or dist/admin
  const possiblePaths = [
    path.join(__dirname, "admin", "dashboard.html"),
    path.join(__dirname, "..", "src", "admin", "dashboard.html"),
    path.join(process.cwd(), "src", "admin", "dashboard.html"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      res.sendFile(p);
      return;
    }
  }

  res.send(`<h1>Admin Dashboard</h1><p>Please ensure src/admin/dashboard.html exists.</p>`);
});

// Admin API: Get all clients and summary stats
app.get("/api/admin/clients", requireAdminAuth, async (_req: Request, res: Response) => {
  const clients = await listLicenses();
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const stats = {
    total: clients.length,
    active: clients.filter((c) => c.status === "active" && new Date(c.expiresAt) > now).length,
    expiringSoon: clients.filter(
      (c) =>
        c.status === "active" &&
        new Date(c.expiresAt) > now &&
        new Date(c.expiresAt) <= sevenDaysFromNow
    ).length,
    liveSessions: activeSessions.size,
  };

  res.json({ clients, stats });
});

// Admin API: Create new client
app.post("/api/admin/clients", requireAdminAuth, async (req: Request, res: Response) => {
  const { clientName, daysValid, metaToken, adAccountId, businessId, notes } = req.body;
  if (!clientName) {
    res.status(400).json({ error: "Client name is required." });
    return;
  }

  const client = await createLicense({
    clientName,
    daysValid: parseInt(daysValid ?? "30", 10),
    metaToken,
    adAccountId,
    businessId,
    notes,
  });

  res.json({ success: true, client });
});

// Admin API: Renew client subscription
app.post("/api/admin/clients/:id/renew", requireAdminAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { days } = req.body;
  const updated = await renewLicense(id, parseInt(days ?? "30", 10));

  if (!updated) {
    res.status(404).json({ error: "Client not found." });
    return;
  }

  res.json({ success: true, client: updated });
});

// Admin API: Update client status (active / suspended / revoked)
app.post("/api/admin/clients/:id/status", requireAdminAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;

  if (!["active", "suspended", "revoked"].includes(status)) {
    res.status(400).json({ error: "Invalid status value." });
    return;
  }

  const updated = await setLicenseStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: "Client not found." });
    return;
  }

  // If suspended or revoked, immediately disconnect any active live session for this client
  if (status !== "active") {
    for (const [sessId, sess] of activeSessions.entries()) {
      if (sess.license.id === id || sess.license.token === id) {
        sess.transport.close().catch(() => {});
        activeSessions.delete(sessId);
      }
    }
  }

  res.json({ success: true, client: updated });
});

// Admin API: Update client credentials / settings
app.post("/api/admin/clients/:id/update", requireAdminAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updates = req.body;

  const updated = await updateLicense(id, updates);
  if (!updated) {
    res.status(404).json({ error: "Client not found." });
    return;
  }

  res.json({ success: true, client: updated });
});

// Admin API: Delete client permanently
app.delete("/api/admin/clients/:id", requireAdminAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const success = await deleteLicense(id);
  if (!success) {
    res.status(404).json({ error: "Client not found." });
    return;
  }
  res.json({ success: true });
});

// ─── MCP SSE & CLIENT INTERACTION ───────────────────────────────────────────

// Health Check Endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    activeSessions: activeSessions.size,
    serverTime: new Date().toISOString(),
    version: "2.1.0",
  });
});

// SSE Connection Endpoint with License Authentication
app.get("/sse", async (req: Request, res: Response) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: "Authentication required. Please provide your license key in the Authorization header (Bearer TOKEN) or as ?token=TOKEN parameter.",
    });
    return;
  }

  const verification = await verifyLicense(token);
  if (!verification.valid || !verification.license) {
    console.warn(`[AUTH FAILED] SSE connection attempt rejected: ${verification.error}`);
    res.status(403).json({ error: verification.error });
    return;
  }

  const license = verification.license;
  console.log(`[AUTH SUCCESS] Client '${license.clientName}' (${license.id}) connected via SSE. Valid until: ${license.expiresAt}`);

  // Multi-Tenancy: Support X-Meta-Token header, per-client saved token, or agency master token
  const metaToken = (req.headers["x-meta-token"] as string)?.trim() || license.metaToken || defaultMetaToken;
  const adAccountId = (req.headers["x-ad-account-id"] as string)?.trim() || license.adAccountId;
  const clientApi = new MetaApiClient(metaToken, threadsToken, adAccountId);
  const serverInstance = createConfiguredMcpServer(clientApi, license);

  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;

  activeSessions.set(sessionId, {
    transport,
    server: serverInstance,
    license,
    clientApi,
    connectedAt: new Date(),
  });

  transport.onclose = () => {
    console.log(`[SESSION CLOSED] Client '${license.clientName}' disconnected (Session: ${sessionId}).`);
    activeSessions.delete(sessionId);
  };

  await serverInstance.connect(transport);
});

// Messages Endpoint for SSE client requests (Supports /messages, /message, /sse, /sse/messages)
const handleMessagePost = async (req: Request, res: Response) => {
  let sessionId = (req.query.sessionId as string) || (req.headers["x-session-id"] as string);

  if (!sessionId && req.body && typeof req.body === "object" && req.body.sessionId) {
    sessionId = String(req.body.sessionId);
  }

  // Fallback 1: Match by license token if provided in query or Authorization header
  if (!sessionId) {
    const token = extractToken(req);
    if (token) {
      for (const [sId, sess] of activeSessions.entries()) {
        if (sess.license.token === token) {
          sessionId = sId;
          break;
        }
      }
    }
  }

  // Fallback 2: If only 1 active session exists, route to it
  if (!sessionId && activeSessions.size === 1) {
    sessionId = activeSessions.keys().next().value as string;
  }

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId parameter in query." });
    return;
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Active session not found or connection has timed out. Please reconnect." });
    return;
  }

  // Re-verify that license has not expired during active usage
  const verification = await verifyLicense(session.license.token);
  if (!verification.valid) {
    console.warn(`[AUTH EXPIRED] Session ${sessionId} rejected during POST: ${verification.error}`);
    res.status(403).json({ error: verification.error });
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error(`[SESSION ERROR] Failed to process message for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message." });
    }
  }
};

app.post("/messages", handleMessagePost);
app.post("/message", handleMessagePost);
app.post("/sse", handleMessagePost);
app.post("/sse/messages", handleMessagePost);

// Meta Webhook Verification Endpoint
app.get("/webhook/instagram", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && challenge) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle incoming webhook events
app.post("/webhook/instagram", (req: Request, res: Response) => {
  console.log("Received Webhook Event:", req.body);
  res.status(200).send("EVENT_RECEIVED");
});

// ─── ONIFLOW E-COMMERCE SUITE ROUTES ────────────────────────────────────────

// Secret Mobile CRM Dashboard
app.get("/crm/:crmToken", async (req: Request, res: Response) => {
  const crmToken = String(req.params.crmToken || "");
  try {
    const data = await listOrdersByCrmTokenAsync(crmToken);
    if (!data) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>404 - الرابط غير موجود</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&display=swap" rel="stylesheet">
        </head>
        <body class="bg-slate-950 min-h-screen flex items-center justify-center p-4 font-['Cairo'] text-white">
          <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8 text-center">
            <div class="text-5xl mb-4">🔒</div>
            <h1 class="text-2xl font-black text-rose-500 mb-2">رابط الـ CRM غير صالح!</h1>
            <p class="text-sm text-slate-400 mb-6">يرجى التأكد من الرابط السري الخاص بك المستلم من المساعد الذكي.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }
    const html = renderCrmPage(data.license, data.orders, crmToken);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error("[CRM ERROR]", err);
    res.status(500).send("Internal Server Error");
  }
});

// Update Order Status via CRM
app.post("/api/crm/:crmToken/orders/:id/status", async (req: Request, res: Response) => {
  const crmToken = String(req.params.crmToken || "");
  const id = String(req.params.id || "");
  const { status } = req.body;
  const validStatuses = ["new", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }
  try {
    const updated = await updateOrderStatusByCrmTokenAsync(crmToken, id, status);
    if (!updated) {
      res.status(404).json({ error: "Order not found or unauthorized" });
      return;
    }
    res.json({ success: true, order: updated });
  } catch (err: any) {
    console.error("[CRM STATUS UPDATE ERROR]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export Orders to CSV (with UTF-8 BOM for Arabic Excel support)
app.get("/api/crm/:crmToken/export", async (req: Request, res: Response) => {
  const crmToken = String(req.params.crmToken || "");
  try {
    const data = await listOrdersByCrmTokenAsync(crmToken);
    if (!data) {
      res.status(404).send("Unauthorized or not found");
      return;
    }

    const rows = [
      ["رقم الطلب", "اسم الزبون", "الهاتف", "المدينة", "العنوان", "الكمية", "المجموع (MAD)", "الحالة", "ملاحظات", "تاريخ الطلب"]
    ];

    for (const ord of data.orders) {
      rows.push([
        ord.orderNumber,
        ord.customerName,
        ord.customerPhone,
        ord.customerCity,
        ord.customerAddress || "",
        String(ord.quantity),
        String(ord.totalPrice),
        ord.status,
        ord.notes || "",
        ord.createdAt.slice(0, 19).replace("T", " ")
      ]);
    }

    const csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${encodeURIComponent(data.license.clientName)}-${dateStr}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error("[CRM EXPORT ERROR]", err);
    res.status(500).send("Export failed");
  }
});

// COD Order Submission API
app.post("/api/orders", async (req: Request, res: Response) => {
  const {
    pageId,
    storeSlug,
    productSlug,
    customerName,
    customerPhone,
    customerCity,
    customerAddress,
    quantity,
    totalPrice,
    notes,
  } = req.body;

  if (!customerName || !customerPhone || !customerCity) {
    res.status(400).json({ error: "المرجو ملء جميع الحقول المطلوبة (الاسم، الهاتف، المدينة)." });
    return;
  }

  const cleanPhone = String(customerPhone).replace(/\D/g, "");
  if (cleanPhone.length < 9) {
    res.status(400).json({ error: "رقم الهاتف غير صحيح، يرجى كتابة رقم هاتف مغربي صالح." });
    return;
  }

  try {
    const order = await createLandingOrderAsync({
      pageId: pageId || "",
      storeSlug: storeSlug || "",
      productSlug: productSlug || "",
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerCity: String(customerCity).trim(),
      customerAddress: customerAddress ? String(customerAddress).trim() : undefined,
      quantity: Number(quantity) || 1,
      totalPrice: Number(totalPrice) || 0,
      notes: notes ? String(notes).trim() : undefined,
      sourceIp: (req.ip || req.socket.remoteAddress || "").toString(),
    });

    console.log(`[NEW COD ORDER] #${order.orderNumber} - ${order.customerName} (${order.customerCity}) - ${order.totalPrice} MAD`);
    res.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      message: "تم تسجيل طلبك بنجاح! سنتصل بك في أقرب وقت لتأكيد التوصيل.",
    });
  } catch (err: any) {
    console.error("[CREATE ORDER ERROR]", err);
    res.status(500).json({ error: "فشل تسجيل الطلب، يرجى المحاولة مرة أخرى." });
  }
});

// Public COD Landing Page Route
app.get("/:storeSlug/:productSlug", async (req: Request, res: Response, next: NextFunction) => {
  const storeSlug = String(req.params.storeSlug || "");
  const productSlug = String(req.params.productSlug || "");
  const reserved = ["admin", "api", "sse", "messages", "message", "crm", "webhook", "health", "favicon.ico"];
  if (reserved.includes(storeSlug.toLowerCase())) {
    next();
    return;
  }

  try {
    const page = await getLandingPageBySlugAsync(storeSlug, productSlug);
    if (!page) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>الصفحة غير موجودة | 404</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&display=swap" rel="stylesheet">
        </head>
        <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-['Cairo']">
          <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
            <div class="text-5xl mb-4">🔍</div>
            <h1 class="text-2xl font-black text-slate-800 mb-2">عذرًا، الصفحة غير موجودة!</h1>
            <p class="text-sm text-slate-500 mb-6">المنتج الذي تبحث عنه غير متوفر أو تم تعديل رابطه.</p>
            <a href="/" class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow">العودة للرئيسية</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const html = renderLandingPage(page, page.storeSlug);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error("[LANDING PAGE ERROR]", err);
    res.status(500).send("Internal server error");
  }
});

const PORT = parseInt(process.env.PORT ?? "2222", 10);

async function startServer() {
  await initDatabase();
  app.listen(PORT, "0.0.0.0", () => {
    const publicUrl = process.env.PUBLIC_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : (process.env.NODE_ENV === "production" ? "https://mcp.oniflow.space" : `http://localhost:${PORT}`));
    console.log(`=======================================================`);
    console.log(`  OniFlow MCP Server running on port ${PORT}`);
    console.log(`  Public Domain:   ${publicUrl}`);
    console.log(`  Admin Dashboard: ${publicUrl}/admin`);
    console.log(`  Admin Key:       ${ADMIN_SECRET}`);
    console.log(`  SSE Endpoint:    ${publicUrl}/sse`);
    console.log(`  Database:        ${process.env.DATABASE_URL ? "PostgreSQL" : "Local JSON Store"}`);
    console.log(`  Multi-Tenant:    Per-Client Dedicated Ad Accounts & Tokens`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
