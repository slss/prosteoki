export const VERSION = '1.0.0';
export const MAX_STEPS = 60000;
export const fields = {
 initial: {type:'number', default:100000, minimum:0, maximum:100000000, unit:'PLN', label:'Kapitał początkowy'},
 monthly: {type:'number', default:2000, minimum:0, maximum:1000000, unit:'PLN', label:'Miesięczna wpłata'},
 years: {type:'integer', default:5, minimum:5, maximum:40, unit:'lat', label:'Okres inwestycji'},
 return: {type:'number', default:0.07, minimum:-0.5, maximum:0.5, unit:'ułamek roczny', label:'Oczekiwany roczny zwrot'},
 volatility: {type:'number', default:0.18, minimum:0, maximum:1, unit:'ułamek roczny', label:'Roczna zmienność'},
 inflation: {type:'number', default:0.03, minimum:-0.1, maximum:0.3, unit:'ułamek roczny', label:'Inflacja roczna'},
 simulations: {type:'integer', default:1000, minimum:100, maximum:1000, unit:'scenariuszy', label:'Liczba symulacji'},
 goal: {type:'number', default:1000000, minimum:0, maximum:10000000000, unit:'PLN nominalnie', label:'Cel na koniec okresu'}
} as const;
export type Params = Record<keyof typeof fields, number>;
export function parseParams(query: URLSearchParams): Params {
 for (const key of query.keys()) if (!Object.hasOwn(fields,key) || query.getAll(key).length!==1) throw Error('Nieznany lub powtórzony parametr: '+key);
 const p = {} as Params;
 for (const [key,f] of Object.entries(fields)) {
  const raw=query.get(key); const v=raw===null?f.default:Number(raw);
  if(raw?.trim()==='' || !Number.isFinite(v) || v<f.minimum || v>f.maximum || (f.type==='integer'&&!Number.isInteger(v))) throw Error('Nieprawidłowe pole: '+key);
  p[key as keyof Params]=v;
 }
 if(p.simulations*p.years*12>MAX_STEPS) throw Error(`Limit ${MAX_STEPS} kroków: dla ${p.years} lat wybierz najwyżej ${Math.floor(MAX_STEPS/(12*p.years))} symulacji.`);
 return p;
}
// return is an effective expected annual simple return: E[S(1)]/S(0)-1.
export function monthlyParameters(r:number,sigma:number) {return {drift:(Math.log1p(r)-sigma*sigma/2)/12, diffusion:sigma/Math.sqrt(12)};}
export function cryptoNormal() {
 const buffer=new Uint32Array(4096); let offset=buffer.length, spare:number|undefined;
 const uniform=()=>{if(offset===buffer.length){crypto.getRandomValues(buffer);offset=0;}return (buffer[offset++]+0.5)/4294967296;};
 return ()=>{if(spare!==undefined){const z=spare;spare=undefined;return z;}const radius=Math.sqrt(-2*Math.log(uniform())),angle=2*Math.PI*uniform();spare=radius*Math.sin(angle);return radius*Math.cos(angle);};
}
export function percentiles(sorted:number[]) {
 const q=(p:number)=>{const i=(sorted.length-1)*p,a=Math.floor(i);return sorted[a]+(sorted[Math.ceil(i)]-sorted[a])*(i-a);};
 return {p5:q(.05),p25:q(.25),p50:q(.5),p75:q(.75),p95:q(.95)};
}
export function simulate(p:Params, normal:()=>number=cryptoNormal()) {
 const {drift,diffusion}=monthlyParameters(p.return,p.volatility);
 const portfolios=new Float64Array(p.simulations).fill(p.initial);
 const annual=[];
 for(let year=1;year<=p.years;year++) {
  for(let month=0;month<12;month++) for(let i=0;i<portfolios.length;i++) portfolios[i]=portfolios[i]*Math.exp(drift+diffusion*normal())+p.monthly;
  const nominal=percentiles(Array.from(portfolios).sort((a,b)=>a-b));
  const factor=(1+p.inflation)**year;
  annual.push({year,nominal,real:Object.fromEntries(Object.entries(nominal).map(([k,v])=>[k,v/factor]))});
 }
 const sorted=Array.from(portfolios).sort((a,b)=>a-b),totalContributions=p.initial+p.monthly*p.years*12;
 const min=sorted[0],max=sorted.at(-1)!,width=(max-min)/20;
 const histogram=Array.from({length:width===0?1:20},(_,i)=>({lower:min+i*width,upper:min+(i+1)*width,count:0}));
 for(const v of sorted) histogram[width===0?0:Math.min(19,Math.floor((v-min)/width))].count++;
 return {totalContributions,nominal:annual.at(-1)!.nominal,real:annual.at(-1)!.real,probabilityBelowContributions:sorted.filter(v=>v<totalContributions).length/p.simulations,probabilityGoal:sorted.filter(v=>v>=p.goal).length/p.simulations,annual,histogram};
}
