import type { BusinessProfile, Campaign, CampaignInput, ContentItem, Strategy } from "../types/marketpilot";

import { PLATFORMS } from "../types/marketpilot";
const platforms: readonly string[] = PLATFORMS;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
export const validDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function validProfile(v: unknown): v is BusinessProfile {
  return record(v) && ["businessType", "expectedOutcome", "keywords", "logoPath", "phone", "whatsapp", "email", "address", "socialHandles"].every(k => v[k] === undefined || (typeof v[k] === "string" && (v[k] as string).length <= 10000)) && (v.contactDetails === undefined || (Array.isArray(v.contactDetails) && v.contactDetails.length <= 20 && v.contactDetails.every(x => record(x) && typeof x.label === "string" && x.label.length <= 80 && typeof x.value === "string" && x.value.length <= 500))) && (v.brandColor === undefined || (typeof v.brandColor === "string" && /^#[0-9a-f]{6}$/i.test(v.brandColor))) && (v.referencePaths === undefined || (strings(v.referencePaths) && v.referencePaths.length <= 5 && v.referencePaths.every(p => p.length <= 300))) && ["name", "description", "services", "audience", "market", "tone", "contact"].every(k => typeof v[k] === "string" && (v[k] as string).length <= 10000);
}
export function validInput(v: unknown): v is CampaignInput {
  return record(v) && ["product", "goal", "audience", "offer", "tone", "instructions"].every(k => typeof v[k] === "string" && (v[k] as string).length <= 10000) && typeof v.product === "string" && !!v.product.trim() && strings(v.platforms) && v.platforms.length > 0 && v.platforms.length <= platforms.length && new Set(v.platforms).size === v.platforms.length && v.platforms.every(p => platforms.includes(p)) && Number.isInteger(v.duration) && Number(v.duration) >= 1 && Number(v.duration) <= 14 && (v.postsPerDay === undefined || (Number.isInteger(v.postsPerDay) && Number(v.postsPerDay) >= 1 && Number(v.postsPerDay) <= 5));
}
export function validStrategy(v: unknown): v is Strategy {
  return record(v) && ["angle", "coreMessage", "approach", "cta"].every(k => typeof v[k] === "string") && strings(v.painPoints);
}
export function validContent(v: unknown): v is Omit<ContentItem, "id" | "campaignId" | "status"> {
  return record(v) && (v.graphicPath === undefined || (typeof v.graphicPath === "string" && v.graphicPath.length <= 300)) && (v.slot === undefined || (Number.isInteger(v.slot) && Number(v.slot) >= 1 && Number(v.slot) <= 5)) && (v.platforms === undefined || (strings(v.platforms) && v.platforms.length > 0 && v.platforms.length <= platforms.length && new Set(v.platforms).size === v.platforms.length && v.platforms.every(p => platforms.includes(p)))) && Number.isInteger(v.day) && Number(v.day) > 0 && validDate(v.date) && typeof v.platform === "string" && platforms.includes(v.platform) && ["type", "hook", "body", "cta"].every(k => typeof v[k] === "string") && strings(v.hashtags);
}
export function validCampaigns(v: unknown): v is Campaign[] {
  if (!Array.isArray(v)) return false;
  const ids = new Set<string>();
  return v.every(c => record(c) && typeof c.id === "string" && !ids.has(c.id) && !!ids.add(c.id) && typeof c.createdAt === "string" && !Number.isNaN(Date.parse(c.createdAt)) && validInput(c.input) && validStrategy(c.strategy) && Array.isArray(c.contents) && c.contents.every(x => record(x) && typeof x.id === "string" && !ids.has(x.id) && !!ids.add(x.id) && x.campaignId === c.id && ["Draft", "Approved", "Posted"].includes(String(x.status)) && validContent(x)));
}
