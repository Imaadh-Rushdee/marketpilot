export type PlanId="free"|"basic"|"plus"|"premium";
export type Plan={id:PlanId;name:string;price:number;postsPerWeek:number;campaigns:number;platforms:number;graphicsPerWeek:number;features:string[];featured?:boolean};
export const PLANS:Plan[]=[
 {id:"free",name:"Free",price:0,postsPerWeek:14,campaigns:2,platforms:1,graphicsPerWeek:2,features:["14 generated posts each week","2 saved campaigns","1 social destination per campaign","2 AI graphics each week"]},
 {id:"basic",name:"Basic",price:9,postsPerWeek:50,campaigns:10,platforms:3,graphicsPerWeek:10,features:["50 generated posts each week","10 saved campaigns","Up to 3 destinations per campaign","10 AI graphics each week"]},
 {id:"plus",name:"Plus",price:19,postsPerWeek:150,campaigns:30,platforms:6,graphicsPerWeek:50,features:["150 generated posts each week","30 saved campaigns","All social destinations","50 AI graphics each week","Priority generation"],featured:true},
 {id:"premium",name:"Premium",price:39,postsPerWeek:500,campaigns:100,platforms:6,graphicsPerWeek:200,features:["500 generated posts each week","100 saved campaigns","All social destinations","200 AI graphics each week","Priority generation and support"]},
];
export const planById=(id:unknown)=>PLANS.find(p=>p.id===id)||PLANS[0];
