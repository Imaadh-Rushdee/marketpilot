import { NextResponse } from "next/server";
import sharp, { type OverlayOptions } from "sharp";
import { authorize } from "../../lib/supabase/authorize";
import { ASSET_BUCKET, ownPath } from "../../lib/brand-media";
import { validProfile } from "../../lib/validation";
import { consume, usage, userPlan } from "../../lib/subscription";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = {"Cache-Control":"private, no-store"};
const sizes = {square:[1080,1080],portrait:[1080,1350],landscape:[1600,900]} as const;
const escape = (s: string) => s.replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
function lines(text: string, length: number) {
  const result: string[] = []; let current="";
  for (const word of text.split(/\s+/)) { if ((current+" "+word).length>length && current) {result.push(current);current=word;} else current+=(current?" ":"")+word; }
  if(current) result.push(current); return result;
}
async function supportingCopy(profile:Record<string,unknown>,headline:string,prompt:string) {
  const fallback=String(profile.expectedOutcome||profile.description||profile.services||"").trim().split(/(?<=[.!?])\s/)[0].slice(0,120);
  const key=process.env.GEMINI_API_KEY;if(!key)return fallback;
  try { const model=process.env.GEMINI_MODEL||"gemini-3.6-flash"; const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:AbortSignal.timeout(8000),body:JSON.stringify({contents:[{parts:[{text:`Write one supporting line for a social ad. Use 8 to 14 words, maximum 110 characters. Complement the headline without repeating it or the call to action. Do not invent claims, prices or guarantees. Return only the sentence. Business: ${JSON.stringify(profile)}. Headline: ${headline}. Creative brief: ${prompt}.`}]}],generationConfig:{temperature:.45,maxOutputTokens:40}})}); if(!response.ok)return fallback; const data=await response.json(); const text=String(data?.candidates?.[0]?.content?.parts?.map((part:{text?:string})=>part.text||"").join("")||"").replace(/[\r\n]+/g," ").replace(/^["']|["']$/g,"").trim(); return text.slice(0,120)||fallback; } catch { return fallback; }
}
export async function GET(request: Request) {
  const auth=await authorize(request); if(auth.response) return auth.response;
  const {data,error}=await auth.supabase.from("marketpilot_graphics").select("id,path,kind,format,headline,created_at,demo").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(100);
  return error ? NextResponse.json({error:"Run the V2 migration to enable your graphics library."},{status:503,headers}) : NextResponse.json({graphics:data,configured:!!(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_AI_API_TOKEN)},{headers});
}
export async function POST(request: Request) {
  const auth=await authorize(request); if(auth.response) return auth.response;
  let body;
  try {const raw=await request.text();if(raw.length>100000) return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(raw);} catch {return NextResponse.json({error:"Invalid graphics request."},{status:400});}
  if(body && body.description===undefined) body.description="";
  if(!validProfile(body?.profile) || !["post","ad","banner"].includes(body.kind) || !Object.hasOwn(sizes,body.format) || typeof body.prompt!=="string" || !body.prompt.trim() || body.prompt.length>4000 || typeof body.headline!=="string" || !body.headline.trim() || body.headline.length>100 || typeof body.description!=="string" || body.description.length>160 || typeof body.cta!=="string" || body.cta.length>60)
    return NextResponse.json({error:"Add a creative brief, headline (up to 100 characters) and CTA (up to 60 characters)."},{status:400});
  if(!body.profile.name.trim() || body.profile.name === "MarketPilot Studio") return NextResponse.json({error:"Complete the Business profile with the customer's real business name before creating branded graphics."},{status:400});
  if(body.headline.split(/\s+/).some((word:string)=>word.length>26)) return NextResponse.json({error:"Use headline words below 27 characters."},{status:400});
  try{const plan=await userPlan(auth.supabase,auth.user.id),used=await usage(auth.supabase,auth.user.id,"graphics");if(used>=plan.graphicsPerWeek)return NextResponse.json({error:`Your ${plan.name} plan image limit resets next week.`},{status:429});}catch{return NextResponse.json({error:"Run the subscriptions migration before generating graphics."},{status:503});}
  // Check library readiness before calling the image provider.
  const {error:setupError}=await auth.supabase.from("marketpilot_graphics").select("id").eq("user_id",auth.user.id).limit(1);
  if(setupError) return NextResponse.json({error:"Run the V2 migration before generating graphics."},{status:503});
  try {
    const [width,height]=sizes[body.format as keyof typeof sizes];
    const profile=body.profile; const color=profile.brandColor || "#5299f5";
    const copyPromise=body.description.trim()?Promise.resolve(body.description.trim()):supportingCopy(profile,body.headline,body.prompt);
    let logo: Buffer | undefined; let reference: Buffer | undefined;
    for(const path of [profile.logoPath,...(profile.referencePaths || [])].filter(Boolean)) {
      if(!ownPath(path,auth.user.id)) return NextResponse.json({error:"A brand asset belongs to a different account. Re-upload it in your business profile."},{status:400});
      const {data,error}=await auth.supabase.storage.from(ASSET_BUCKET).download(path);
      if(error || !data) return NextResponse.json({error:"A brand asset is unavailable. Re-upload it or remove it from your profile."},{status:400});
      const bytes=Buffer.from(await data.arrayBuffer());
      if(bytes.length>10000000) throw new Error("Asset too large");
      if(path===profile.logoPath) logo=bytes;
      else if(!reference) reference=bytes;
      await sharp(bytes,{limitInputPixels:25000000}).metadata();
    }
    const cloudflareAccount=process.env.CLOUDFLARE_ACCOUNT_ID;
    const cloudflareToken=process.env.CLOUDFLARE_AI_API_TOKEN;
    const demo=process.env.MARKETPILOT_DEMO_MODE==="true";
    if(!demo&&(!cloudflareAccount||!cloudflareToken)) return NextResponse.json({error:"AI image generation is not configured. Add the Cloudflare Workers AI account ID and token; fallback templates are no longer presented as finished posts."},{status:503});
    let background: Buffer;
    if(demo) background=Buffer.from(`<svg width="${width}" height="${height}"><defs><linearGradient id="g"><stop stop-color="#121c33"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width*.8}" cy="${height*.3}" r="${width*.3}" fill="white" opacity=".08"/></svg>`);
    else {
      const account=cloudflareAccount!; const token=cloudflareToken!;
      const model=process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
      const prompt=`Create a premium, vivid, photorealistic advertising image for a ${body.kind}, aspect ratio ${body.format==="square"?"1:1":body.format==="portrait"?"4:5":"16:9"}. Show a clear, relevant human or product subject in a believable commercial scene with depth, expressive lighting, strong composition and brand-color accents (${color}). Business: ${JSON.stringify({type:profile.businessType,description:profile.description,services:profile.services,audience:profile.audience,keywords:profile.keywords})}. Creative direction: ${body.prompt}. Compose the main subject in the upper or right side so a designer can place copy in the lower-left area. Fill the frame. Avoid empty space, flat gradients, abstract circles, generic template backgrounds, text, logos, watermarks, prices, testimonials and unsupported product claims.`;
      const base=process.env.CLOUDFLARE_AI_BASE_URL || "https://api.cloudflare.com";
      if(!/^@cf\/[a-z0-9-]+\/[a-z0-9.-]+$/i.test(model)) return NextResponse.json({error:"CLOUDFLARE_IMAGE_MODEL is invalid."},{status:500});
      const response=await fetch(`${base}/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${model}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({prompt:prompt.slice(0,2048),steps:4})});
      if(!response.ok) {let detail="";try{const problem=await response.json();detail=String(problem?.errors?.[0]?.message||problem?.error||"").slice(0,240);}catch{}console.warn("Cloudflare image generation rejected",{status:response.status,model,detail});return NextResponse.json({error:response.status===429?"The free daily image allowance or rate limit has been reached. Try again later.":detail?`Cloudflare rejected the image request: ${detail}`:`Cloudflare image generation rejected (${response.status}). Check the configured account, token and model.`},{status:502});}
      const contentType=response.headers.get("content-type") || "";
      if(contentType.startsWith("image/")) background=Buffer.from(await response.arrayBuffer());
      else {
        const result=await response.json();
        if(!result?.success || typeof result?.result?.image!=="string") return NextResponse.json({error:"The free image model returned no image. Try a different creative brief."},{status:502});
        background=Buffer.from(result.result.image,"base64");
      }
      if(!background.length || background.length>20000000) throw new Error("Invalid image size");
    }
    const margin=Math.round(width*.065), font=Math.round(width*(body.format==="landscape"?.055:.075));
    const headline=lines(body.headline,Math.max(12,Math.floor((width-margin*2)/(font*.59))));
    if(headline.length>3) return NextResponse.json({error:"Shorten the headline to fit three lines."},{status:400});
    const description=await copyPromise,descriptionFont=Math.round(font*.42);
    const descriptionLines=lines(description,Math.max(18,Math.floor((width-margin*2)/(descriptionFont*.54)))).slice(0,2);
    const textY=Math.round(height*(body.format==="landscape"?.38:.48));
    const descriptionY=Math.round(textY+headline.length*font*1.16+font*.2);
    const ctaY=Math.min(Math.round(height-font*.95-margin),Math.round(descriptionY+descriptionLines.length*descriptionFont*1.32+font*.25));
    const ctaWidth=Math.min(Math.round(width*.55),Math.max(Math.round(width*.24),body.cta.length*Math.round(font*.3)+Math.round(width*.07)));
    const brandMark=logo?"":`<text x="${margin}" y="${Math.round(height*.16)}" fill="white" font-family="Arial,DejaVu Sans,sans-serif" font-size="${Math.round(font*.3)}" font-weight="700" letter-spacing="2">${escape(profile.name.slice(0,55).toUpperCase())}</text><rect x="${margin}" y="${Math.round(height*.19)}" width="${Math.round(width*.09)}" height="7" rx="4" fill="${color}"/>`;
    const svg=Buffer.from(`<svg width="${width}" height="${height}"><defs><linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#050911" stop-opacity=".97"/><stop offset=".52" stop-color="#050911" stop-opacity=".62"/><stop offset="1" stop-color="#050911" stop-opacity="0"/></linearGradient><linearGradient id="left"><stop stop-color="#050911" stop-opacity=".8"/><stop offset=".62" stop-color="#050911" stop-opacity=".2"/><stop offset="1" stop-color="#050911" stop-opacity="0"/></linearGradient></defs><rect y="${Math.round(height*.24)}" width="100%" height="${Math.round(height*.76)}" fill="url(#bottom)"/>${body.format==="landscape"?'<rect width="72%" height="100%" fill="url(#left)"/>':""}${brandMark}<text fill="white" stroke="#050911" stroke-width="${Math.max(1,Math.round(font*.025))}" paint-order="stroke" font-family="Arial,DejaVu Sans,sans-serif" font-weight="800" font-size="${font}">${headline.map((line,i)=>`<tspan x="${margin}" y="${textY+i*font*1.16}">${escape(line)}</tspan>`).join("")}</text><text fill="white" opacity=".86" font-family="Arial,DejaVu Sans,sans-serif" font-weight="400" font-size="${descriptionFont}">${descriptionLines.map((line,i)=>`<tspan x="${margin}" y="${descriptionY+i*descriptionFont*1.32}">${escape(line)}</tspan>`).join("")}</text>${body.cta?`<rect x="${margin}" y="${ctaY}" width="${ctaWidth}" height="${Math.round(font*.82)}" rx="${Math.round(font*.41)}" fill="${color}"/><text x="${margin+Math.round(font*.4)}" y="${ctaY+Math.round(font*.56)}" fill="white" font-family="Arial,DejaVu Sans,sans-serif" font-weight="700" font-size="${Math.round(font*.3)}">${escape(body.cta)}</text>`:""}${demo?`<text x="${margin}" y="${height-24}" fill="white" opacity=".7" font-family="Arial,DejaVu Sans,sans-serif" font-size="18">DEMO TEMPLATE - NOT AI GENERATED</text>`:""}</svg>`);
    const layers: OverlayOptions[]=[];
    if(reference) layers.push({input:await sharp(reference,{limitInputPixels:25000000}).resize(Math.round(width*.46),height,{fit:"cover"}).png().toBuffer(),left:Math.round(width*.54),top:0});
    layers.push({input:svg});
    if(logo) layers.push({input:await sharp(logo,{limitInputPixels:25000000}).trim().resize(Math.round(width*.2),Math.round(height*.11),{fit:"inside"}).png().toBuffer(),left:margin,top:margin});
    const output=await sharp(background,{limitInputPixels:25000000}).resize(width,height,{fit:"cover"}).composite(layers).png().toBuffer();
    const id=crypto.randomUUID(),path=`${auth.user.id}/graphics/${id}.png`;
    const {error:uploadError}=await auth.supabase.storage.from(ASSET_BUCKET).upload(path,output,{contentType:"image/png",upsert:false});
    if(uploadError) return NextResponse.json({error:"Unable to save the image. Check the V2 storage migration."},{status:503});
    const {data,error}=await auth.supabase.from("marketpilot_graphics").insert({id,user_id:auth.user.id,path,kind:body.kind,format:body.format,headline:body.headline,demo}).select("id,path,kind,format,headline,created_at,demo").single();
    if(error) {await auth.supabase.storage.from(ASSET_BUCKET).remove([path]);return NextResponse.json({error:"Unable to save your graphic to the library. Please retry."},{status:503});}
    await consume(auth.supabase,"graphics",1);return NextResponse.json({graphic:data},{headers});
  } catch {return NextResponse.json({error:"Graphics generation timed out or failed. Your existing library is unchanged. Please retry."},{status:502});}
}
export async function DELETE(request: Request) {
  const auth=await authorize(request);if(auth.response) return auth.response;
  const id=new URL(request.url).searchParams.get("id");if(!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Invalid graphic."},{status:400});
  const {data,error}=await auth.supabase.from("marketpilot_graphics").select("path").eq("user_id",auth.user.id).eq("id",id).maybeSingle();
  if(error || !data || !ownPath(data.path,auth.user.id)) return NextResponse.json({error:"Graphic unavailable."},{status:404});
  const {error:removeError}=await auth.supabase.storage.from(ASSET_BUCKET).remove([data.path]);if(removeError) return NextResponse.json({error:"Unable to remove image. Retry."},{status:503});
  const {error:deleteError}=await auth.supabase.from("marketpilot_graphics").delete().eq("user_id",auth.user.id).eq("id",id);
  return deleteError ? NextResponse.json({error:"Unable to remove library entry. Retry."},{status:503}) : NextResponse.json({ok:true});
}
