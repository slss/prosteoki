import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import worker from '../worker/src/index.ts';
const env={HMAC_SECRET:'benchmark-local-test-key-123456789012345',ALLOWED_ORIGINS:'',RATE_LIMITER:{limit:async()=>({success:true})}};
const results=[];
for(const query of ['', 'years=20&simulations=250', 'years=40&simulations=125']){
 const times=[],cpu=[];for(let i=0;i<25;i++){const before=process.cpuUsage(),start=performance.now();const r=await worker.fetch(new Request('https://api.example/api/calculate?'+query),env);if(r.status!==200)throw Error(await r.text());await r.json();const c=process.cpuUsage(before);if(i>=5){times.push(performance.now()-start);cpu.push((c.user+c.system)/1000);}}
 times.sort((a,b)=>a-b);cpu.sort((a,b)=>a-b);results.push({query:query||'defaults',samples:20,wallP50:times[10],wallP95:times[19],processCpuP50:cpu[10],processCpuP95:cpu[19]});
}
const report={timestamp:new Date().toISOString(),runtime:process.version,platform:process.platform,arch:process.arch,note:'Lokalny Node; CPU procesu, nie pomiar limitu Cloudflare. W Workers computationMs może wynosić 0. Wymagany benchmark zdalny przed produkcją.',results};
await writeFile('monte-carlo/benchmark-local.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
