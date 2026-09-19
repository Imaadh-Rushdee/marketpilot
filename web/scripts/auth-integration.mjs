import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

// Tests the real Next.js routes/SSR cookie handling against an isolated fake
// Supabase HTTP service. It never reads or writes a real Supabase project.
const accounts = [
  { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" },
  { id: "22222222-2222-4222-8222-222222222222", email: "b@example.test" },
];
accounts[0].user_metadata={business_profile:{name:"Bright Academy",description:"A school teaching science and technology",services:"Education",audience:"Parents and students",market:"Sri Lanka",tone:"Friendly",contact:"",businessType:"School",expectedOutcome:"Increase admissions",keywords:"science, learning, admissions"}};
const workspaces = new Map();
const assets = new Map();
const graphics = new Map();
let missingTable = false;
let revoked = false;
let subscriptionPlan = "premium";
let supabaseUrl;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,role:"authenticated",aud:"authenticated",exp,iat:exp-3600,iss:`${supabaseUrl}/auth/v1`})}.test-signature`;
  return { access_token, refresh_token: `refresh-${user.id}`, token_type: "bearer", expires_in: 3600, expires_at: exp, user: {...user,aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:user.user_metadata || {}} };
}
function tokenUser(request) {
  try { return accounts.find(u => u.id === JSON.parse(Buffer.from(request.headers.authorization.split(".")[1], "base64url").toString()).sub); }
  catch { return null; }
}
const service = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,x-supabase-api-version","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"};
  if(request.method==="OPTIONS"){response.writeHead(204,cors);response.end();return;}
  const send = (status, data) => { response.writeHead(status, {"Content-Type":"application/json",...cors}); response.end(JSON.stringify(data)); };
  const chunks=[]; for await (const chunk of request) chunks.push(chunk);
  const bytes=Buffer.concat(chunks);
  const body = request.headers["content-type"]?.includes("application/json") && bytes.length ? JSON.parse(bytes.toString()) : {};
  if (url.pathname === "/auth/v1/recover") return send(200,{});
  if (url.pathname === "/auth/v1/signup") return send(200,{...session(accounts[0]).user,email:body.email});
  if (url.pathname === "/auth/v1/logout") {response.writeHead(204,cors);response.end();return;}
  if (url.pathname === "/auth/v1/token") {
    const user = accounts.find(u => u.email === body.email);
    return user && body.password === "test-password" ? send(200, session(user)) : send(400, {error:"invalid_grant",error_description:"Invalid credentials"});
  }
  if (url.pathname === "/auth/v1/verify") {
    return body.token_hash === "valid-recovery" ? send(200, session(accounts[0])) : send(400,{msg:"Expired token"});
  }
  if (url.pathname.startsWith("/client/v4/accounts/test-account/ai/run/") && request.headers.authorization === "Bearer test-ai-token") {
    const image=await sharp({create:{width:32,height:32,channels:4,background:"#2255cc"}}).png().toBuffer();
    return send(200,{success:true,result:{image:image.toString("base64")}});
  }
  if(url.pathname.startsWith("/storage/v1/object/sign/")){
    const user=tokenUser(request),path=decodeURIComponent(url.pathname.replace("/storage/v1/object/sign/marketpilot-assets/",""));
    if(request.method==="GET"&&url.searchParams.get("token")==="test"){const file=assets.get(path);if(!file)return send(404,{message:"Not found"});response.writeHead(200,{"Content-Type":path.endsWith(".jpg")?"image/jpeg":"image/png",...cors});response.end(file);return;}
    if(!user||!path.startsWith(user.id+"/")||!assets.has(path))return send(404,{message:"Not found"});
    return send(200,{signedURL:`/object/public-signed/marketpilot-assets/${encodeURIComponent(path)}?token=test`});
  }
  if(url.pathname.startsWith("/storage/v1/object/public-signed/")){
    const path=decodeURIComponent(decodeURIComponent(url.pathname.replace("/storage/v1/object/public-signed/marketpilot-assets/",""))),file=assets.get(path);
    if(!file||url.searchParams.get("token")!=="test")return send(404,{message:"Not found"});
    response.writeHead(200,{"Content-Type":path.endsWith(".jpg")?"image/jpeg":"image/png",...cors});response.end(file);return;
  }
  const user = tokenUser(request);
  if (url.pathname === "/auth/v1/user") return user && !revoked ? send(200,session(user).user) : send(401,{msg:"Invalid JWT",code:"bad_jwt"});
  if (!user) return send(401,{message:"Authentication required"});
  if (url.pathname.startsWith("/storage/v1/object/")) {
    const path=decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?marketpilot-assets\//,""));
    if(request.method==="DELETE") {for(const key of body.prefixes || []) if(key.startsWith(user.id+"/"))assets.delete(key);return send(200,[]);}
    if(!path.startsWith(user.id+"/"))return send(403,{message:"Forbidden"});
    if(request.method==="POST") {assets.set(path,bytes);return send(200,{Key:`marketpilot-assets/${path}`});}
    const file=assets.get(path);if(!file)return send(404,{message:"Not found"});response.writeHead(200,{"Content-Type":"image/png",...cors});response.end(file);return;
  }
  if(url.pathname==="/rest/v1/marketpilot_graphics") {
    if(request.method==="POST"){const row={...body,created_at:new Date().toISOString()};graphics.set(row.id,row);return send(201,row);}
    const rows=[...graphics.values()].filter(g=>g.user_id===user.id && (!url.searchParams.get("id") || g.id===url.searchParams.get("id").slice(3)));
    if(request.method==="DELETE"){rows.forEach(g=>graphics.delete(g.id));return send(200,[]);}return send(200,rows);
  }
  if(url.pathname==="/rest/v1/social_connections") {
    if(request.method==="DELETE") return send(200,[]);
    return send(200,[]);
  }
  if(url.pathname==="/rest/v1/marketpilot_subscriptions") return send(200,[{plan:subscriptionPlan,status:"active",current_period_end:null}]);
  if(url.pathname==="/rest/v1/marketpilot_usage") return send(200,[]);
  if(url.pathname==="/rest/v1/rpc/consume_marketpilot_usage") return send(200,true);
  if (url.pathname === "/rest/v1/user_workspaces") {
    if (missingTable) return send(404,{code:"42P01",message:"Table not found"});
    const owner = url.searchParams.get("user_id")?.slice(3);
    const data = owner === user.id ? workspaces.get(user.id) : null;
    return send(200, data ? [data] : []);
  }
  if (url.pathname === "/rest/v1/rpc/save_marketpilot_workspace") {
    const prior = workspaces.get(user.id);
    if (body.p_expected_revision !== (prior?.revision || 0)) return send(200,[]);
    const revision = (prior?.revision || 0) + 1;
    workspaces.set(user.id,{profile:body.p_profile,campaigns:body.p_campaigns,revision});
    return send(200,[{new_revision:revision}]);
  }
  send(404,{message:"Unknown mock endpoint"});
});
await new Promise(resolve => service.listen(0, "127.0.0.1", resolve));
supabaseUrl = `http://127.0.0.1:${service.address().port}`;
const port = Number(process.env.AUTH_TEST_PORT || 3012);
const base = `http://localhost:${port}`;
let logs = "";
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", String(port)], {
  env: {...process.env, NEXT_PUBLIC_SUPABASE_URL:supabaseUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",NEXT_PUBLIC_SUPABASE_ANON_KEY:"",GEMINI_API_KEY:"",MARKETPILOT_DEMO_MODE:"false",CLOUDFLARE_ACCOUNT_ID:"test-account",CLOUDFLARE_AI_API_TOKEN:"test-ai-token",CLOUDFLARE_AI_BASE_URL:supabaseUrl,META_APP_ID:"",META_APP_SECRET:"",INSTAGRAM_APP_ID:"",INSTAGRAM_APP_SECRET:"",TIKTOK_CLIENT_KEY:"",TIKTOK_CLIENT_SECRET:"",MARKETPILOT_TEST_DIST_DIR:".next-test"},
  stdio: ["ignore","pipe","pipe"],
});
app.stdout.on("data", chunk => {logs += chunk;}); app.stderr.on("data",chunk => {logs += chunk;});
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
async function cookieFor(user) {
  const cookies = new Map();
  const client = createServerClient(supabaseUrl,"sb_publishable_test",{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>cookies.set(name,value))}});
  const {error} = await client.auth.signInWithPassword({email:user.email,password:"test-password"});
  assert.equal(error,null);
  return [...cookies].map(([name,value])=>`${name}=${value}`).join("; ");
}
async function api(path, cookie, method="GET", body, origin) {
  return fetch(`${base}${path}`,{method,redirect:"manual",headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{"Content-Type":"application/json"}:{}),...(origin?{Origin:origin}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
try {
  for (let i=0;i<120;i++) {
    try { await fetch(`${base}/login`); break; } catch { if (app.exitCode!==null || i===119) throw new Error("Test app did not start"); await pause(500); }
  }
  const root = await api("/"); assert.equal(root.status,200);
  assert.equal((await api("/login")).status,200);
  assert.equal((await api("/api/workspace")).status,401);
  assert.equal((await api("/api/workspace",null,"PUT",{})).status,401);
  assert.equal((await api("/api/generate",null,"POST",{})).status,401);
  const a = await cookieFor(accounts[0]); const b = await cookieFor(accounts[1]);
  assert.equal((await api("/app",a)).status,200);
  assert.equal((await fetch(`${base}/api/workspace`,{headers:{Cookie:b,"x-marketpilot-user":accounts[0].id}})).status,401);
  assert.equal((await api("/api/workspace",a,"PUT",{},"https://malicious.example")).status,403);
  const initial = await (await api("/api/workspace",a)).json(); assert.equal(initial.revision,0);assert.deepEqual(initial.campaigns,[]);assert.equal(initial.profile.name,"Bright Academy");assert.equal(initial.profile.businessType,"School");assert.equal(initial.profile.expectedOutcome,"Increase admissions");
  const input={product:"Fresh bread",goal:"Drive sales",audience:"Families",offer:"Visit the bakery",platforms:["Instagram"],duration:3,tone:"Friendly",instructions:""};
  const generation = await api("/api/generate",a,"POST",{profile:initial.profile,campaign:input,startDate:"2026-12-30"});
  assert.equal(generation.status,200);const generated=await generation.json();assert.equal(generated.contents.length,3);assert.equal(generated.contents[2].date,"2027-01-01");
  const campaign={id:"campaign-a",createdAt:new Date().toISOString(),input,strategy:generated.strategy,contents:generated.contents.map((c,i)=>({...c,id:`content-${i}`,campaignId:"campaign-a",status:"Draft"}))};
  const saved = await api("/api/workspace",a,"PUT",{...initial,campaigns:[campaign]});assert.equal(saved.status,200);assert.equal((await saved.json()).revision,1);
  const restored=await(await api("/api/workspace",a)).json();assert.equal(restored.campaigns[0].id,"campaign-a");
  const other=await(await api("/api/workspace",b)).json();assert.equal(other.revision,0);assert.deepEqual(other.campaigns,[]);
  assert.equal((await api("/api/workspace",b,"PUT",{...other,profile:{...other.profile,name:"Account B"}})).status,200);
  assert.equal((await(await api("/api/workspace",a)).json()).profile.name,initial.profile.name);
  assert.equal((await api("/api/workspace",a,"PUT",{...initial,profile:{...initial.profile,name:"Stale"}})).status,409);
  assert.equal((await(await api("/api/workspace",a)).json()).profile.name,initial.profile.name);
  assert.equal((await api("/api/workspace",a,"PUT",{profile:null,campaigns:[],revision:1})).status,400);
  assert.equal((await api("/api/generate",a,"POST",{profile:initial.profile,campaign:{...input,platforms:[]}})).status,400);
  const multiInput={...input,platforms:["Facebook","Instagram","TikTok","LinkedIn"]};
  const multi=await(await api("/api/generate",a,"POST",{profile:initial.profile,campaign:multiInput})).json();
  assert.equal(multi.contents.length,3);multi.contents.forEach(c=>assert.deepEqual(c.platforms,multiInput.platforms));
  subscriptionPlan="free";assert.equal((await api("/api/generate",a,"POST",{profile:initial.profile,campaign:{...input,platforms:["Facebook","Instagram"]}})).status,403);subscriptionPlan="premium";
  assert.equal((await api("/api/graphics",null,"POST",{})).status,401);
  assert.equal((await api("/api/media",null)).status,401);
  assert.equal((await api("/api/social/connections")).status,401);
  assert.equal((await api("/api/social/publish",null,"POST",{})).status,401);
  const social=await api("/api/social/connections",a);assert.equal(social.status,200);assert.deepEqual((await social.json()).connections,[]);
  const unconfigured=await api("/api/social/connect/meta",a);assert.equal(unconfigured.status,307);assert.equal(new URL(unconfigured.headers.get("location")).pathname,"/app");
  const logo=await sharp({create:{width:120,height:60,channels:4,background:"#ee1122"}}).png().toBuffer();
  const form=new FormData();form.set("file",new Blob([logo],{type:"image/png"}),"logo.png");
  const uploaded=await fetch(`${base}/api/media`,{method:"POST",headers:{Cookie:a},body:form});assert.equal(uploaded.status,200);const logoPath=(await uploaded.json()).path;
  const preview=await api(`/api/media?path=${encodeURIComponent(logoPath)}`,a);assert.equal(preview.status,307);assert.equal((await fetch(preview.headers.get("location"))).status,200);
  assert.equal((await api(`/api/media?path=${encodeURIComponent(logoPath)}`,b)).status,404);
  const brief={profile:{...initial.profile,logoPath,brandColor:"#11aa99",businessType:"Bakery",keywords:"fresh bread"},kind:"ad",format:"landscape",headline:"Fresh bread every morning",cta:"Visit us today",prompt:"A warm bakery with fresh bread"};
  const rendered=await api("/api/graphics",a,"POST",brief);assert.equal(rendered.status,200);const graphic=(await rendered.json()).graphic;assert.equal(graphic.demo,false);
  const png=await api(`/api/media?path=${encodeURIComponent(graphic.path)}`,a);assert.equal(png.status,307);const image=Buffer.from(await (await fetch(png.headers.get("location"))).arrayBuffer());const metadata=await sharp(image).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,900);
  // The original opaque red logo is composited, not recreated by AI.
  const pixel=await sharp(image).extract({left:110,top:110,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...pixel],[238,17,34]);
  assert.equal((await(await api("/api/graphics",a)).json()).graphics.length,1);
  assert.equal((await(await api("/api/graphics",b)).json()).graphics.length,0);
  assert.equal((await api("/api/graphics",b,"POST",brief)).status,400);
  assert.equal((await api(`/api/graphics?id=${graphic.id}`,b,"DELETE")).status,404);
  assert.equal((await api(`/api/graphics?id=${graphic.id}`,a,"DELETE")).status,200);
  assert.equal((await(await api("/api/graphics",a)).json()).graphics.length,0);
  missingTable=true;assert.equal((await api("/api/workspace",a)).status,503);missingTable=false;
  const recovery=await api("/auth/callback?token_hash=valid-recovery&type=recovery&next=https://evil.example",a);assert.equal(recovery.status,307);assert.equal(new URL(recovery.headers.get("location")).pathname,"/auth/update-password");
  const expired=await api("/auth/callback?token_hash=expired&type=email",a);assert.equal(new URL(expired.headers.get("location")).pathname,"/login");
  await new Promise((resolve,reject)=>{
    const smoke=spawn(process.execPath,["scripts/smoke.mjs"],{env:{...process.env,TEST_BASE_URL:base,TEST_COOKIE:a},stdio:["ignore","pipe","pipe"]});
    smoke.stdout.on("data",chunk=>process.stdout.write(chunk));smoke.stderr.on("data",chunk=>process.stderr.write(chunk));
    smoke.on("exit",code=>code===0?resolve():reject(new Error("Campaign smoke checks failed")));
  });
  revoked=true;assert.equal((await api("/api/workspace",a)).status,401);
  console.log("Auth integration passed: SSR cookies, protected routes, private workspace reads/writes, conflict rejection, invalid input, outage handling, recovery redirects, multi-platform posts, private uploads, exact logo compositing and graphics library isolation.");
  console.log("Supabase was mocked; live database RLS and email delivery still require verification in your project.");
  if(process.env.AUTH_TEST_HOLD === "true") {
    revoked=false;
    console.log(`Local browser test app ready at ${base}/login`);
    await new Promise(resolve=>process.once("SIGINT",resolve));
  }
} catch (error) {
  console.error(logs.slice(-6000)); throw error;
} finally {
  app.kill(); service.closeAllConnections(); await new Promise(resolve=>service.close(resolve));
}
