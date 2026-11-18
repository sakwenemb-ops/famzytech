/**
 * Details of the company that runs Learn Quick, shown on the legal pages.
 * Set them in .env (deploy/.env on the server); the [brackets] show what is still missing.
 */
export function legalInfo() {
  return {
    company: process.env.LEGAL_COMPANY_NAME || "[Nom de l'entreprise / Company name]",
    address: process.env.LEGAL_ADDRESS || "[Adresse, ville, Cameroun / Address, city, Cameroon]",
    registration: process.env.LEGAL_REGISTRATION || "[N° RCCM / NIU]",
    email: process.env.PRIVACY_EMAIL || "privacy@learnquick.cm",
    host: process.env.HOSTING_PROVIDER || "OVHcloud (France)",
    support: process.env.SUPPORT_EMAIL || "support@learnquick.cm",
    court: process.env.LEGAL_COURT_CITY || "Douala",
    whatsapp: process.env.SUPPORT_WHATSAPP || "",
  };
}

/** Date of the current version of the privacy policy. Change it whenever the policy changes. */
export const PRIVACY_UPDATED = "2026-11-18";
/** Date of the current version of the terms of use. Change it whenever the terms change. */
export const TERMS_UPDATED = "2026-11-18";
