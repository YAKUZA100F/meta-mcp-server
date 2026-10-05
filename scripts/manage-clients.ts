#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import {
  createLicenseAsync,
  renewLicenseAsync,
  setLicenseStatusAsync,
  listLicensesAsync,
  ClientLicense,
  slugify,
} from "../src/services/db.js";

const args = process.argv.slice(2);
const command = args[0];

const DEFAULT_SERVER_URL = process.env.PUBLIC_URL || "https://mcp.oniflow.space";

function printUsage() {
  console.log(`
Usage:
  npx tsx scripts/manage-clients.ts <command> [options]

Commands:
  add <name> <days> [metaToken]     Create a new client license & auto-generate client distribution package
  renew <tokenOrId> <days>         Renew/extend a subscription
  revoke <tokenOrId>               Revoke and disable client access
  list                             List all clients, licenses, and CRM links

Examples:
  npx tsx scripts/manage-clients.ts add "Boutique Amine" 30
  npx tsx scripts/manage-clients.ts renew lic_a1b2 30
  npx tsx scripts/manage-clients.ts list
`);
}

function calculateDaysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function copyFolderRecursiveSync(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source, { withFileTypes: true });
  for (const item of files) {
    const curSource = path.join(source, item.name);
    const curTarget = path.join(target, item.name);
    if (item.isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

function replacePlaceholdersInFile(filePath: string, replacements: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    content = content.replace(regex, value);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

function generateClientPackage(license: ClientLicense, serverUrl: string = DEFAULT_SERVER_URL): string {
  const storeSlug = license.storeSlug || slugify(license.clientName);
  const clientPackageDir = path.join(process.cwd(), "packages", storeSlug);
  const templateDir = path.join(process.cwd(), "CLIENT_PACKAGE_TEMPLATE");

  if (!fs.existsSync(templateDir)) {
    console.warn(`[WARN] CLIENT_PACKAGE_TEMPLATE not found at ${templateDir}. Skipping package folder generation.`);
    return "";
  }

  // 1. Copy template
  copyFolderRecursiveSync(templateDir, clientPackageDir);

  // 2. Ensure creatives & reports folders exist
  fs.mkdirSync(path.join(clientPackageDir, "creatives"), { recursive: true });
  fs.mkdirSync(path.join(clientPackageDir, "reports"), { recursive: true });

  // 3. Prepare replacement map
  const crmUrl = `${serverUrl}/crm/${license.crmToken || "secret"}`;
  const storeUrl = `${serverUrl}/${storeSlug}`;
  const replacements: Record<string, string> = {
    "{{CLIENT_NAME}}": license.clientName,
    "{{CLIENT_TOKEN}}": license.token,
    "{{CRM_TOKEN}}": license.crmToken || "",
    "{{CRM_URL}}": crmUrl,
    "{{STORE_SLUG}}": storeSlug,
    "{{STORE_URL}}": storeUrl,
    "{{CLIENT_ID}}": license.id,
    "{{EXPIRES_AT}}": license.expiresAt.split("T")[0],
    "CLIENT_TOKEN_HERE": license.token,
    "https://mcp.oniflow.space": serverUrl,
  };

  // 4. Replace in key files
  const filesToProcess = [
    path.join(clientPackageDir, "WELCOME_CLIENT.md"),
    path.join(clientPackageDir, "INSTRUCTIONS.md"),
    path.join(clientPackageDir, "mcp_config.json"),
    path.join(clientPackageDir, ".mcp.json"),
    path.join(clientPackageDir, ".agents", "skills", "oniflow", "SKILL.md"),
  ];

  for (const f of filesToProcess) {
    replacePlaceholdersInFile(f, replacements);
  }

  return clientPackageDir;
}

function printClientSummary(license: ClientLicense, packageDir: string, serverUrl: string = DEFAULT_SERVER_URL) {
  const storeSlug = license.storeSlug || slugify(license.clientName);
  const crmUrl = `${serverUrl}/crm/${license.crmToken || "secret"}`;
  const storeUrl = `${serverUrl}/${storeSlug}`;

  console.log("\n=======================================================");
  console.log(` 🚀 Client Created Successfully: ${license.clientName}`);
  console.log("=======================================================");
  console.log(` 🆔 Client ID:      ${license.id}`);
  console.log(` 🏷️ Store Slug:     ${storeSlug}`);
  console.log(` 🟢 Status:         ${license.status.toUpperCase()}`);
  console.log(` ⏳ Expires At:     ${license.expiresAt.split("T")[0]} (${calculateDaysRemaining(license.expiresAt)} days remaining)`);
  console.log(` 🔑 Secret Token:   ${license.token}`);
  console.log("-------------------------------------------------------");
  console.log(" 📱 SECRET CRM LINK (Give directly to client):");
  console.log(` 👉 ${crmUrl}`);
  console.log("-------------------------------------------------------");
  console.log(" 🌐 STORE BASE URL:");
  console.log(` 👉 ${storeUrl}`);
  console.log("-------------------------------------------------------");
  if (packageDir) {
    console.log(" 📦 READY-TO-SEND CLIENT PACKAGE FOLDER:");
    console.log(` 👉 ${packageDir}`);
    console.log(" (You can zip this folder and send it directly to the client via WhatsApp/Telegram)");
  }
  console.log("=======================================================\n");
}

async function main() {
  switch (command) {
    case "add": {
      const name = args[1];
      const days = parseInt(args[2] ?? "30", 10);
      const metaToken = args[3];

      if (!name) {
        console.error("Error: Client name is required.");
        printUsage();
        process.exit(1);
      }

      const license = await createLicenseAsync({
        clientName: name,
        daysValid: isNaN(days) ? 30 : days,
        metaToken,
      });

      const packageDir = generateClientPackage(license);
      printClientSummary(license, packageDir);
      break;
    }

    case "renew": {
      const target = args[1];
      const days = parseInt(args[2] ?? "30", 10);

      if (!target) {
        console.error("Error: Token or ID is required for renewal.");
        printUsage();
        process.exit(1);
      }

      const updated = await renewLicenseAsync(target, isNaN(days) ? 30 : days);
      if (!updated) {
        console.error(`Error: License '${target}' not found.`);
        process.exit(1);
      }

      console.log(`\n✅ Subscription renewed for '${updated.clientName}'.`);
      console.log(`New Expiration Date: ${updated.expiresAt.split("T")[0]} (${calculateDaysRemaining(updated.expiresAt)} days remaining)\n`);
      break;
    }

    case "revoke": {
      const target = args[1];
      if (!target) {
        console.error("Error: Token or ID is required to revoke.");
        printUsage();
        process.exit(1);
      }

      const revoked = await setLicenseStatusAsync(target, "revoked");
      if (!revoked) {
        console.error(`Error: License '${target}' not found.`);
        process.exit(1);
      }

      console.log(`\n🚫 Access revoked for '${revoked.clientName}'. Client can no longer connect.\n`);
      break;
    }

    case "list": {
      const licenses = await listLicensesAsync();
      if (licenses.length === 0) {
        console.log("\nNo client licenses found. Create one using: npx tsx scripts/manage-clients.ts add <name> <days>\n");
        break;
      }

      console.log(`\nRegistered Clients (${licenses.length}):\n`);
      console.table(
        licenses.map((lic) => {
          const daysLeft = calculateDaysRemaining(lic.expiresAt);
          return {
            ID: lic.id,
            Name: lic.clientName,
            Store: lic.storeSlug || slugify(lic.clientName),
            Status: daysLeft <= 0 ? "EXPIRED" : lic.status,
            "Days Left": daysLeft <= 0 ? 0 : daysLeft,
            "Expires At": lic.expiresAt.split("T")[0],
            "CRM Token": lic.crmToken ? lic.crmToken.substring(0, 16) + "..." : "N/A",
          };
        })
      );
      console.log("");
      break;
    }

    default:
      printUsage();
      break;
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
