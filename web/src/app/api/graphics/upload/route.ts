import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorize } from "../../../lib/supabase/authorize";
import { ASSET_BUCKET } from "../../../lib/brand-media";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length") || 0) > 12_000_000) return NextResponse.json({ error: "Use an image below 10 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a PNG, JPEG or WebP image." }, { status: 400 });
    if (file.size > 10_000_000) return NextResponse.json({ error: "Use an image below 10 MB." }, { status: 413 });
    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source,{limitInputPixels:25000000}).metadata();
    if(!["png","jpeg","webp"].includes(metadata.format||""))return NextResponse.json({error:"Choose a PNG, JPEG or WebP image."},{status:400});
    const output = await sharp(source,{limitInputPixels:25000000,animated:false}).rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).flatten({background:"#ffffff"}).jpeg({quality:82,mozjpeg:true}).toBuffer();
    const width = metadata.width || 1, height = metadata.height || 1, ratio = width / height;
    const format = ratio > 1.35 ? "landscape" : ratio < 0.9 ? "portrait" : "square";
    const id = crypto.randomUUID(), path = `${auth.user.id}/graphics/${id}.jpg`;
    const headline = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 100) || "Uploaded artwork";
    const { error: uploadError } = await auth.supabase.storage.from(ASSET_BUCKET).upload(path, output, { contentType: "image/jpeg", upsert: false,cacheControl:"3600" });
    if (uploadError) return NextResponse.json({ error: "Unable to upload artwork. Check the V2 storage migration." }, { status: 503 });
    const { data, error } = await auth.supabase.from("marketpilot_graphics").insert({ id, user_id: auth.user.id, path, kind: "post", format, headline, demo: false }).select("id,path,kind,format,headline,created_at,demo").single();
    if (error) {
      await auth.supabase.storage.from(ASSET_BUCKET).remove([path]);
      return NextResponse.json({ error: "Unable to add artwork to the graphics library. Run the V2 migration and retry." }, { status: 503 });
    }
    return NextResponse.json({ graphic: data }, { headers });
  } catch {
    return NextResponse.json({ error: "The uploaded file is not a valid PNG, JPEG or WebP image." }, { status: 400 });
  }
}
