const publishPosts=async request=>{
  const secret=process.env.CRON_SECRET||"";
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return new Response("Unauthorized",{status:401});
  const base=(process.env.URL||process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
  if(!base)return new Response("Site URL is missing",{status:503});
  let total=0;
  for(let attempt=0;attempt<30;attempt++){
    const response=await fetch(`${base}/api/social/scheduled`,{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55000)});
    const result=await response.json();
    if(!response.ok){console.error("Scheduled publishing failed",{status:response.status,result});return new Response(JSON.stringify({total,error:result}),{status:response.status,headers:{"content-type":"application/json"}});}
    total+=result.published||0;
    if(!result.published)break;
  }
  console.log("Scheduled publishing completed",{total});
  return Response.json({ok:true,total});
};
export default publishPosts;
