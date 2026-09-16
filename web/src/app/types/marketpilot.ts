export const PLATFORMS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Pinterest", "X"] as const;
export type Platform = typeof PLATFORMS[number];
export type ContentStatus = "Draft" | "Approved" | "Posted";

export interface BusinessProfile {
  name: string;
  description: string;
  services: string;
  audience: string;
  market: string;
  tone: string;
  contact: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  socialHandles?: string;
  contactDetails?: { label: string; value: string }[];
  businessType?: string;
  expectedOutcome?: string;
  keywords?: string;
  brandColor?: string;
  logoPath?: string;
  referencePaths?: string[];
}

export interface CampaignInput {
  product: string;
  goal: string;
  audience: string;
  offer: string;
  platforms: Platform[];
  duration: number;
  postsPerDay?: number;
  tone: string;
  instructions: string;
}

export interface Strategy {
  angle: string;
  painPoints: string[];
  coreMessage: string;
  approach: string;
  cta: string;
}

export interface ContentItem {
  id: string;
  campaignId: string;
  day: number;
  slot?: number;
  date: string;
  platform: Platform;
  platforms?: Platform[];
  type: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  graphicPath?: string;
  status: ContentStatus;
}

export interface Campaign {
  id: string;
  createdAt: string;
  input: CampaignInput;
  strategy: Strategy;
  contents: ContentItem[];
}

export interface Graphic { id: string; path: string; kind: "post" | "ad" | "banner"; format: "square" | "portrait" | "landscape"; headline: string; created_at: string; demo: boolean; }
export function destinations(content: ContentItem): Platform[] { return content.platforms?.length ? content.platforms : [content.platform]; }
