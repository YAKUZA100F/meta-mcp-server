export * from "./db.js";

// Re-export common names for backwards compatibility
import {
  initDatabase,
  verifyLicenseAsync,
  createLicenseAsync,
  renewLicenseAsync,
  setLicenseStatusAsync,
  updateLicenseAsync,
  deleteLicenseAsync,
  listLicensesAsync,
  ClientLicense,
  VerificationResult,
} from "./db.js";

export {
  initDatabase,
  verifyLicenseAsync as verifyLicense,
  createLicenseAsync as createLicense,
  renewLicenseAsync as renewLicense,
  setLicenseStatusAsync as setLicenseStatus,
  updateLicenseAsync as updateLicense,
  deleteLicenseAsync as deleteLicense,
  listLicensesAsync as listLicenses,
};
