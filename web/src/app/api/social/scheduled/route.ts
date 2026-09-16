import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import sharp from "sharp";
import {ASSET_BUCKET,ownPath} from "../../../lib/brand-media";
import {open} from "../../../lib/social";
import {validCampaigns} from "../../../lib/validation";
import {destinations,type Campaign,type ContentItem} from "../../../types/marketpilot";

export const runtime="nodejs";export const maxDuration=60;
const times=["09:00","12:00","15:00","18:00","21:00"];
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const caption=(c:ContentItem,max:number)=>[c.hook,c.body,c.cta,c.hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0,max);
async function graph(url:string,init?:RequestInit){const r=await fetch(url,{...init,signal:AbortSignal.timeout(20000)}),d=await r.json();if(!r.ok||d?.error)throw new Error(String(d?.error?.message||"Social platform rejected the post.").slice(0,240));return d;}
async function ready(id:string,token:string){for(const delay of [2000,3000,5000]){await wait(delay);const q=new URLSearchParams({fields:"status_code,status",access_token:token}),d=await graph(`https://graph.instagram.com/v23.0/${encodeURIComponent(id)}?${q}`),code=String(d.status_code||"").toUpperCase();if(code==="FINISHED"||code==="PUBLISHED")return;if(code==="ERROR"||code==="EXPIRED")throw new Error(String(d.status||code));}throw new Error("Instagram is still processing the image.");}
function localStamp(timeZone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const get=(type:string)=>parts.find(x=>x.type===type)?.value||"";return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`};}
function due(c:ContentItem,date:string,time:string){const publishTime=c.publishTime||times[(c.slot||1)-1]||"09:00";return c.status==="Approved"&&(c.date<date||(c.date===date&&publishTime<=time));}

export async function POST(request:Request){
 const secret=process.env.CRON_SECRET?.trim();if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!url||!key)return NextResponse.json({error:"Scheduler environment is incomplete."},{status:503});
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),zone=process.env.AUTO_PUBLISH_TIMEZONE||"UTC",now=localStamp(zone);
 const {data:rows,error}=await supabase.from("user_workspaces").select("user_id,campaigns,revision");if(error)return NextResponse.json({error:"Unable to read scheduled workspaces."},{status:503});
 let published=0,failed=0;
 for(const row of rows||[]){if(!validCampaigns(row.campaigns))continue;let changed=false;const campaigns=structuredClone(row.campaigns) as Campaign[];
  for(const campaign of campaigns)for(const content of campaign.contents){if(!due(content,now.date,now.time))continue;const platforms=destinations(content);if(platforms.some(p=>p!=="Facebook"&&p!=="Instagram")){failed++;continue;}let temporaryPath="";
   try{const [{data:connections,error:connectionError},{data:existing,error:publicationError}]=await Promise.all([supabase.from("social_connections").select("platform,account_id,token_ciphertext").eq("user_id",row.user_id).in("platform",platforms),supabase.from("social_publications").select("platform,account_id,external_id").eq("user_id",row.user_id).eq("content_id",content.id)]);if(connectionError||publicationError)throw new Error("Publishing tables unavailable.");
    let imageUrl="";if(content.graphicPath){if(!ownPath(content.graphicPath,row.user_id))throw new Error("Invalid graphic owner.");const {data:file,error:fileError}=await supabase.storage.from(ASSET_BUCKET).download(content.graphicPath);if(fileError||!file)throw new Error("Graphic unavailable.");const jpeg=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000}).rotate().flatten({background:"#fff"}).jpeg({quality:90,mozjpeg:true}).toBuffer();temporaryPath=`${row.user_id}/publishing/${content.id}-${crypto.randomUUID()}.jpg`;const {error:uploadError}=await supabase.storage.from(ASSET_BUCKET).upload(temporaryPath,jpeg,{contentType:"image/jpeg"});if(uploadError)throw uploadError;const {data:signed,error:signedError}=await supabase.storage.from(ASSET_BUCKET).createSignedUrl(temporaryPath,900);if(signedError||!signed)throw new Error("Cannot sign graphic.");imageUrl=signed.signedUrl;}
    for(const platform of platforms){const connection=connections?.find(x=>x.platform===platform);if(!connection)throw new Error(`${platform} is not connected.`);if(existing?.some(x=>x.platform===platform&&x.account_id===connection.account_id))continue;const token=open(connection.token_ciphertext);let externalId="";
     if(platform==="Facebook"){const form=new URLSearchParams({access_token:token});if(imageUrl){form.set("url",imageUrl);form.set("caption",caption(content,60000));}else form.set("message",caption(content,60000));const data=await graph(`https://graph.facebook.com/v23.0/${encodeURIComponent(connection.account_id)}/${imageUrl?"photos":"feed"}`,{method:"POST",body:form});externalId=String(data.post_id||data.id);}
     else {if(!imageUrl)throw new Error("Instagram requires artwork.");const form=new URLSearchParams({image_url:imageUrl,caption:caption(content,2200),access_token:token}),container=await graph(`https://graph.instagram.com/v23.0/${encodeURIComponent(connection.account_id)}/media`,{method:"POST",body:form});await ready(String(container.id),token);const data=await graph(`https://graph.instagram.com/v23.0/${encodeURIComponent(connection.account_id)}/media_publish`,{method:"POST",body:new URLSearchParams({creation_id:String(container.id),access_token:token})});externalId=String(data.id);}
     const {error:saveError}=await supabase.from("social_publications").insert({user_id:row.user_id,content_id:content.id,platform,account_id:connection.account_id,external_id:externalId});if(saveError)throw saveError;
    }
    content.status="Posted";changed=true;published++;
   }catch(error){console.warn("Scheduled publish failed",{userId:row.user_id,contentId:content.id,error:error instanceof Error?error.message:"Unknown"});failed++;}finally{if(temporaryPath)await supabase.storage.from(ASSET_BUCKET).remove([temporaryPath]);}
  }
  if(changed)await supabase.from("user_workspaces").update({campaigns,revision:row.revision+1,updated_at:new Date().toISOString()}).eq("user_id",row.user_id).eq("revision",row.revision);
 }
 return NextResponse.json({ok:true,published,failed,checkedAt:now,timeZone:zone});
}
