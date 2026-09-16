import { BusinessProfile, Campaign } from "../types/marketpilot";
import { validCampaigns, validProfile } from "./validation";

const PROFILE_KEY = "marketpilot.profile";
const CAMPAIGNS_KEY = "marketpilot.campaigns";

export const defaultProfile: BusinessProfile = {
  name: "MarketPilot Studio",
  description: "We build practical software systems and modern websites for growing businesses.",
  services: "Custom software, business websites, management systems, automation",
  audience: "Small and medium-sized businesses",
  market: "Sri Lanka",
  tone: "Professional, direct, modern",
  contact: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  socialHandles: "",
  contactDetails: [],
};

export function loadProfile(): BusinessProfile {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile;
    const profile = JSON.parse(raw);
    if (!validProfile(profile)) { localStorage.setItem(`${PROFILE_KEY}.recovery`, raw); throw new Error("Invalid saved profile"); }
    return profile;
  } catch {
    preserveRecovery(PROFILE_KEY);
    return defaultProfile;
  }
}

export function saveProfile(profile: BusinessProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadCampaigns(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return [];
    const campaigns = JSON.parse(raw);
    if (!validCampaigns(campaigns)) { localStorage.setItem(`${CAMPAIGNS_KEY}.recovery`, raw); throw new Error("Invalid saved campaigns"); }
    return campaigns;
  } catch {
    preserveRecovery(CAMPAIGNS_KEY);
    return [];
  }
}

export function saveCampaigns(campaigns: Campaign[]) {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

function preserveRecovery(key: string) {
  try { const raw = localStorage.getItem(key); if (raw) localStorage.setItem(`${key}.recovery`, raw); } catch { /* Storage may be unavailable. */ }
}
export function storageWarning(): string {
  try {
    if (localStorage.getItem(`${PROFILE_KEY}.recovery`) || localStorage.getItem(`${CAMPAIGNS_KEY}.recovery`)) return "Some saved data could not be loaded. The original was kept in browser recovery storage. Restore a workspace backup to recover your data.";
  } catch { return "Browser storage is unavailable. Export a backup before leaving to keep your work."; }
  return "";
}
