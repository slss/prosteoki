import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
const meta=JSON.parse(await readFile('dist/build.json','utf8'));
const api=process.env.MONTE_CARLO_API_URL??'';
if(api){const u=new URL(api);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||!(u.protocol==='https:'||meta.mode==='local'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('API musi być origin HTTPS (lokalnie dopuszczony localhost HTTP)');}
await mkdir('dist/monte-carlo',{recursive:true});
await cp('monte-carlo/web','dist/monte-carlo',{recursive:true});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const file of ['index.html','ai-integration.html']){
 let html=await readFile('monte-carlo/web/'+file,'utf8');
 html=html.replace(/<a data-api-path="([^"]+)"/g,(_,path)=>`<a href="${api?escape(api.replace(/\/$/,''))+path:'ai-integration.html'}" data-api-path="${path}"`);
 html=html.replaceAll('__API__',escape(api.replace(/\/$/,''))).replaceAll('__CANONICAL__',escape(new URL('monte-carlo/'+(file==='index.html'?'':file),meta.baseUrl).href)).replaceAll('__ROBOTS__',meta.indexable?'index,follow':'noindex,follow');
 if(!api)html=html.replace(/href="\/(api\/[^"]*|openapi.json|health)"/g,'href="ai-integration.html"');
 await writeFile('dist/monte-carlo/'+file,html);
}
let sitemap=await readFile('dist/sitemap.xml','utf8');
sitemap=sitemap.replace('</urlset>',['','ai-integration.html'].map(p=>`<url><loc>${escape(new URL('monte-carlo/'+p,meta.baseUrl).href)}</loc></url>`).join('')+'</urlset>');await writeFile('dist/sitemap.xml',sitemap);
// Add discovery links without changing shared vendor sources.
for(const file of ['dist/index.html','dist/kalkulatory/index.html']){let html=await readFile(file,'utf8');html=html.replace('</main>',`<section class="section"><h2>Losowe scenariusze inwestycji</h2><p><a href="${file==='dist/index.html'?'':'../'}monte-carlo/">Kalkulator Monte Carlo</a> — obliczenia i podpis wyniku w Cloudflare Worker.</p></section></main>`);await writeFile(file,html);}
// Existing privacy statement describes browser-only calculators; clarify the new exception.
const privacy='dist/prywatnosc/index.html';let text=await readFile(privacy,'utf8');text=text.replace('Obliczenia wykonuje przeglądarka.','Dotychczasowe kalkulatory OKI wykonuje przeglądarka. Kalkulator Monte Carlo przesyła parametry w publicznym adresie GET do Cloudflare Worker, który wykonuje obliczenia. URL i token (nieszyfrowany) mogą trafić do historii, logów dostawców i asystenta. Nie podawaj danych osobowych ani prywatnych kwot. Nie zapisujemy wyników w bazie.');text=text.replace('Nie umieszczamy danych scenariusza w adresie','W dotychczasowych kalkulatorach OKI nie umieszczamy danych scenariusza w adresie');await writeFile(privacy,text);
console.log('Dodano Monte Carlo; API: '+(api||'nieskonfigurowane — formularz zablokowany'));
