#!/usr/bin/env tsx

import { createLicense, renewLicense, revokeLicense, listLicenses, ClientLicense } from "../src/services/licensing.js";

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
Usage:
  npx tsx scripts/manage-clients.ts <command> [options]

Commands:
  add <name> <days> [metaToken]     Create a new client license
  renew <tokenOrId> <days>         Renew/extend a subscription
  revoke <tokenOrId>               Revoke and disable client access
  list                             List all clients and statuses

Examples:
  npx tsx scripts/manage-clients.ts add "Agency Client 1" 30
  npx tsx scripts/manage-clients.ts renew lic_a1b2 30
  npx tsx scripts/manage-clients.ts list
`);
}

function calculateDaysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function printClientSnippet(license: ClientLicense, serverUrl: string = "https://your-server-ip-or-domain.com") {
  console.log("\n=======================================================");
  console.log(` Client Created Successfully: ${license.clientName}`);
  console.log("=======================================================");
  console.log(` ID:             ${license.id}`);
  console.log(` Status:         ${license.status.toUpperCase()}`);
  console.log(` Expires At:     ${license.expiresAt} (${calculateDaysRemaining(license.expiresAt)} days remaining)`);
  console.log(` License Token:  ${license.token}`);
  console.log("-------------------------------------------------------");
  console.log(" 📋 Send this JSON configuration snippet to the client for Antigravity:");
  console.log("-------------------------------------------------------");
  const config = {
    mcpServers: {
      "meta-ads-ai": {
        url: `${serverUrl}/sse`,
        headers: {
          Authorization: `Bearer ${license.token}`,
        },
      },
    },
  };
  console.log(JSON.stringify(config, null, 2));
  console.log("=======================================================\n");
}

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

    const license = createLicense({
      clientName: name,
      daysValid: isNaN(days) ? 30 : days,
      metaToken,
    });

    printClientSnippet(license);
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

    const updated = renewLicense(target, isNaN(days) ? 30 : days);
    if (!updated) {
      console.error(`Error: License '${target}' not found.`);
      process.exit(1);
    }

    console.log(`\n✅ Subscription renewed for '${updated.clientName}'.`);
    console.log(`New Expiration Date: ${updated.expiresAt} (${calculateDaysRemaining(updated.expiresAt)} days remaining)\n`);
    break;
  }

  case "revoke": {
    const target = args[1];
    if (!target) {
      console.error("Error: Token or ID is required to revoke.");
      printUsage();
      process.exit(1);
    }

    const revoked = revokeLicense(target);
    if (!revoked) {
      console.error(`Error: License '${target}' not found.`);
      process.exit(1);
    }

    console.log(`\n🚫 Access revoked for '${revoked.clientName}'. Client can no longer connect.\n`);
    break;
  }

  case "list": {
    const licenses = listLicenses();
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
          Status: daysLeft <= 0 ? "EXPIRED" : lic.status,
          "Days Left": daysLeft <= 0 ? 0 : daysLeft,
          "Expires At": lic.expiresAt.split("T")[0],
          Token: lic.token.substring(0, 16) + "...",
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
