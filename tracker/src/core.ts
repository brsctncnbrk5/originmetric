export const SESSION_TIMEOUT_MS = 30 * 60_000;
export const MAX_UTM_LENGTH = 200;

export interface StoredSession {
  id: string;
  lastActivity: number;
  campaignKey: string;
}

export interface CampaignParts {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerHost: string | null;
  gclid: boolean;
  fbclid: boolean;
  msclkid: boolean;
}

export function capUtm(value: string | null): string | null {
  if (value === null || value.length === 0) return null;
  return Array.from(value).slice(0, MAX_UTM_LENGTH).join("");
}

export function campaignKey(parts: CampaignParts, externalReferrer: boolean): string {
  const utms = [
    parts.utmSource,
    parts.utmMedium,
    parts.utmCampaign,
    parts.utmContent,
    parts.utmTerm,
  ];
  if (utms.some((value) => value !== null)) return `u:${utms.map((v) => v ?? "").join("|")}`;
  if (parts.gclid) return "c:g";
  if (parts.fbclid) return "c:f";
  if (parts.msclkid) return "c:m";
  return externalReferrer && parts.referrerHost ? `r:${parts.referrerHost}` : "";
}

export function shouldStartNewSession(
  session: StoredSession | null,
  now: number,
  nextCampaignKey: string,
): boolean {
  if (session === null) return true;
  if (now - session.lastActivity > SESSION_TIMEOUT_MS) return true;
  return nextCampaignKey.length > 0 && nextCampaignKey !== session.campaignKey;
}

export function screenClass(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
