import sharp from "sharp";
export const ASSET_BUCKET = "marketpilot-assets";
export function ownPath(path: unknown, userId: string): path is string {
  return typeof path === "string" && path.startsWith(`${userId}/`) && /^[a-zA-Z0-9/_.-]+$/.test(path) && !path.includes("..") && path.length < 300;
}
export async function cleanImage(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 25000000, animated: false });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format || "")) throw new Error("Use a PNG, JPEG or WebP image.");
  return image.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
}
export const mediaUrl = (path: string) => `/api/media?path=${encodeURIComponent(path)}`;
