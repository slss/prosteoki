import example from '../../web/example-response.json' with {type:'json'};
import {fields,VERSION,MAX_STEPS} from './model.ts';
const number={type:'number'};
const object=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const pct=object(Object.fromEntries(['p5','p25','p50','p75','p95'].map(k=>[k,{type:'number',minimum:0}])));
export const paramsSchema=object(Object.fromEntries(Object.entries(fields).map(([k,{label,unit,...f}])=>[k,{...f,description:label+' ('+unit+')'}])));
export const resultSchema=object({version:{type:'string'},calculationId:{type:'string',format:'uuid'},timestamp:{type:'string',format:'date-time'},computationMs:{type:'number',minimum:0},simulationsExecuted:{type:'integer',minimum:100},parameters:paramsSchema,results:object({totalContributions:number,nominal:pct,real:pct,probabilityBelowContributions:{type:'number',minimum:0,maximum:1},probabilityGoal:{type:'number',minimum:0,maximum:1},annual:{type:'array',items:object({year:{type:'integer'},nominal:pct,real:pct})},histogram:{type:'array',items:object({lower:number,upper:number,count:{type:'integer',minimum:0}})}}),resultSignature:{type:'string'},resultToken:{type:'string'}});
export const exampleQuery='initial=100000&monthly=2000&years=5&return=0.07&volatility=0.18&inflation=0.03&simulations=1000&goal=1000000';
export function manifest(base:string){return {name:'Monte Carlo — prosteOKI',description:'Edukacyjna symulacja GBM, bez podatków, kosztów i reguł OKI. To nie prognoza.',version:VERSION,fields,limits:{maxMonthlySteps:MAX_STEPS,note:'simulations × years × 12 ≤ limit; dla 40 lat najwyżej 125 scenariuszy.'},calculationEndpoint:base+'/api/calculate',responseSchema:resultSchema,verification:{endpoint:base+'/api/verify',parameter:'token',algorithm:'HMAC-SHA256',format:'base64url(gzip(JSON payload)).base64url(HMAC of encoded payload)',coverage:'Wszystkie pola odpowiedzi poza resultSignature i resultToken. Token nie jest szyfrowany i nie wygasa; rotacja sekretu unieważnia stare podpisy.'},exampleUrl:base+'/api/calculate?'+exampleQuery,model:'return = oczekiwany efektywny zwrot roczny. Miesięczny log-zwrot: (ln(1+return)−volatility²/2)/12 + volatility/√12 × Z; Z~N(0,1). Wpłaty na koniec miesiąca. Cel nominalny na końcu okresu. Realne wartości dzielone przez (1+inflation)^years. Percentyle: interpolacja liniowa po (n−1)p.'};}
export function openapi(base:string){
 const response=(schema:unknown)=>({description:'Odpowiedź JSON',content:{'application/json':{schema}}});
 const error=object({error:{type:'string'}});
 const responses=(schema:unknown)=>({'200':response(schema),'400':response(error),'405':response(error),'429':response(error),'500':response(error),'503':response(error),'404':response(error)});
 return {openapi:'3.1.0',info:{title:'prosteOKI Monte Carlo API',version:VERSION,description:manifest(base).model},servers:[{url:base}],paths:{
 '/api/calculate':{get:{operationId:'calculate',summary:'Nowe losowe obliczenie w Workerze; limit 60000 kroków',parameters:Object.entries(fields).map(([name,{label,unit,...schema}])=>({name,in:'query',description:label+'; '+unit,required:false,schema,example:schema.default})),responses:{...responses(resultSchema),200:{description:'Przykład lokalny, podpis testowy — nie produkcyjny',content:{'application/json':{schema:resultSchema,example}}}}}},
 '/api/verify':{get:{operationId:'verify',summary:'Sprawdź pochodzenie tokenu; nie potwierdza prawdziwości założeń',parameters:[{name:'token',in:'query',required:true,schema:{type:'string',maxLength:12000}}],responses:responses(object({authentic:{const:true},calculationId:{type:'string'},parameters:paramsSchema,payload:{type:'object'}}))}},
 '/api/manifest':{get:{operationId:'manifest',responses:responses({type:'object'})}},
 '/health':{get:{operationId:'health',responses:responses(object({status:{const:'ok'},version:{type:'string'},timestamp:{type:'string'}}))}},
 '/openapi.json':{get:{operationId:'openapi',responses:responses({type:'object'})}}
 },'x-example-query':base+'/api/calculate?'+exampleQuery};
}
