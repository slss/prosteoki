import {parseParams,simulate,VERSION} from './model.ts';
import {sign,verify} from './signature.ts';
import {manifest,openapi} from './contract.ts';
export interface Env {HMAC_SECRET:string; ALLOWED_ORIGINS:string; RATE_LIMITER:{limit(options:{key:string}):Promise<{success:boolean}>};}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
 if(origin&&(env.ALLOWED_ORIGINS??'').split(',').includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, OPTIONS';}
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))return json({error:'Wymagany HTTPS'},400);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET'){headers.Allow='GET, OPTIONS';return json({error:'Dozwolony jest GET'},405);}
 if(url.href.length>16000)return json({error:'Adres jest za długi'},400);
 try {
  if(url.pathname==='/health')return json({status:'ok',version:VERSION,timestamp:new Date().toISOString()});
  if(url.pathname==='/api/manifest')return json(manifest(url.origin));
  if(url.pathname==='/openapi.json')return json(openapi(url.origin));
  if(!['/api/calculate','/api/verify'].includes(url.pathname))return json({error:'Nie znaleziono endpointu'},404);
  if(!env.HMAC_SECRET||env.HMAC_SECRET.length<32||!env.RATE_LIMITER)return json({error:'API nie jest skonfigurowane'},503);
  const allowed=await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'local'});
  if(!allowed.success){headers['Retry-After']='60';return json({error:'Limit żądań. Spróbuj za minutę.'},429);}
  if(url.pathname==='/api/verify'){
   if([...url.searchParams.keys()].some(k=>k!=='token')||url.searchParams.getAll('token').length!==1)return json({error:'Podaj jeden token'},400);
   try{const payload=await verify(url.searchParams.get('token')!,env.HMAC_SECRET);return json({authentic:true,calculationId:payload.calculationId,parameters:payload.parameters,payload});}catch{return json({error:'Nieprawidłowy token lub podpis'},400);}
  }
  let parameters;try{parameters=parseParams(url.searchParams);}catch(e){return json({error:(e as Error).message},400);}
  const start=performance.now(),results=simulate(parameters);
  const payload={version:VERSION,calculationId:crypto.randomUUID(),timestamp:new Date().toISOString(),computationMs:Math.max(0,performance.now()-start),simulationsExecuted:parameters.simulations,parameters,results};
  return json({...payload,...await sign(payload,env.HMAC_SECRET)});
 }catch{return json({error:'Nie udało się wykonać obliczenia. Spróbuj ponownie.'},500);}
}};
