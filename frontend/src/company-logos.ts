import type { Job } from "./api";

/** Employer-owned career feeds contain an audited company domain. Other job
 * boards frequently set company_domain to their OWN domain, so those must never
 * be shown as the hiring company's logo. */
const EMPLOYER_OWNED_SOURCES = new Set(["greenhouse", "lever", "ashby", "workable", "smartrecruiters"]);
const THIRD_PARTY_SOURCES = new Set(["himalayas", "jobicy", "remotive", "arbeitnow"]);
const THIRD_PARTY_BOARDS = new Set([
  "himalayas.app", "jobicy.com", "remotive.com", "arbeitnow.com", "arbeitnow.nl", "arbeitnow.ch",
  "greenhouse.io", "lever.co", "ashbyhq.com", "apply.workable.com", "smartrecruiters.com",
]);

/** Explicit employer-name mappings for recognized companies on third-party job
 * boards. Never derive logos from the board URL or guess by string concatenation.
 * This is NOT proof of employer verification; it only controls visual identity. */
const KNOWN_EMPLOYER_DOMAINS: Record<string, string> = {
  "abbott": "abbott.com",
  "acquia inc": "acquia.com",
  "airtm": "airtm.com",
  "ashby": "ashbyhq.com",
  "bright vision technologies": "bvteck.com",
  "camunda": "camunda.com",
  "carrot": "get-carrot.com",
  "circuithub": "circuithub.com",
  "cision": "cision.com",
  "coalition technologies": "coalitiontechnologies.com",
  "databricks": "databricks.com",
  "dropbox": "dropbox.com",
  "elevenlabs": "elevenlabs.io",
  "eleve talent": "elevetalent.com",
  "entrupy": "entrupy.com",
  "keynest": "keynest.com",
  "lastpass": "lastpass.com",
  "lemonio": "lemon.io",
  "medtronic": "medtronic.com",
  "microsourcing": "microsourcing.com",
  "remotepeople": "remotepeople.com",
  "revenuecat": "revenuecat.com",
  "rillet": "rillet.com",
  "salesloft": "salesloft.com",
  "scalejet": "scale-jet.com",
  "seeq": "seeq.com",
  "smartling": "smartling.com",
  "spotify": "spotify.com",
  "superside": "superside.com",
  "tala": "tala.co",
  "telus digital": "telusdigital.com",
  "telus international ai inc": "telusdigital.com",
  "tomorrowio": "tomorrow.io",
  "toptal": "toptal.com",
  "twilio": "twilio.com",
};

export type LogoJob = Pick<Job, "employerName" | "companyDomain" | "source">;

const normalizeName = (name: string) => name.trim().toLowerCase()
  .replace(/[’'.,!]/g, "").replace(/\s+/g, " ");

/** Never interpolate arbitrary URLs into img.src. Accept clean DNS names only. */
const normalizeDomain = (raw: string | undefined) => {
  if (!raw) return null;
  const domain = raw.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  return domain.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain)
    ? domain : null;
};

export function employerLogoDomain(job: LogoJob): string | null {
  const source = job.source?.toLowerCase() ?? "";
  const domain = normalizeDomain(job.companyDomain);
  if (EMPLOYER_OWNED_SOURCES.has(source) && domain && !THIRD_PARTY_BOARDS.has(domain)) return domain;
  // Only externally sourced job-board listings can use a curated name mapping.
  // A person submitting a new job cannot claim Spotify's logo by typing its name.
  if (THIRD_PARTY_SOURCES.has(source)) {
    return normalizeDomain(KNOWN_EMPLOYER_DOMAINS[normalizeName(job.employerName)]) ?? null;
  }
  return null;
}

export function employerLogoUrl(job: LogoJob): string | null {
  const domain = employerLogoDomain(job);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null;
}
