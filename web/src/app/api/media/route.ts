import { NextResponse } from "next/server";
import { authorize } from "../../lib/supabase/authorize";
import { ASSET_BUCKET, cleanImage, ownPath } from "../../lib/brand-media";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await authorize(request); if (auth.response) return auth.response;
  const path = new URL(request.url).searchParams.get("path");
  if (!ownPath(path,auth.user.id)) return NextResponse.json({error:"Asset unavailable."},{status:404});
  const {data,error}=await auth.supabase.storage.from(ASSET_BUCKET).createSignedUrl(path,3600,{download:new URL(request.url).searchParams.has("download")?"marketpilot-graphic":undefined});
  if(error||!data?.signedUrl)return NextResponse.json({error:"Asset unavailable. The image may have been removed from storage."},{status:404});
  return NextResponse.redirect(data.signedUrl,{status:307,headers:{"Cache-Control":"private, max-age=1800"}});
}
export async function POST(request: Request) {
  const auth = await authorize(request); if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length")) > 3000000) return NextResponse.json({error:"Image must be below 2 MB."},{status:413});
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 2000000) return NextResponse.json({error:"Choose a PNG, JPEG or WebP image below 2 MB."},{status:400});
    const bytes = await cleanImage(Buffer.from(await file.arrayBuffer()));
    const path = `${auth.user.id}/brand/${crypto.randomUUID()}.png`;
    const {error} = await auth.supabase.storage.from(ASSET_BUCKET).upload(path,bytes,{contentType:"image/png",upsert:false,cacheControl:"3600"});
    if (error) return NextResponse.json({error:"Upload failed. Run the V2 migration to enable private brand storage."},{status:503});
    return NextResponse.json({path});
  } catch { return NextResponse.json({error:"Unable to read this image. Use PNG, JPEG or WebP below 2 MB."},{status:400}); }
}
