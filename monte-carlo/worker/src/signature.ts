const enc=new TextEncoder();
const encode=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=(s:string)=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Nieprawidłowy token');return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));};
async function key(secret:string){if(!secret||secret.length<32)throw Error('Brak skonfigurowanego sekretu HMAC');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(payload:unknown,secret:string){const compressed=await new Response(new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();const data=encode(new Uint8Array(compressed));const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(data))));return {resultSignature:signature,resultToken:data+'.'+signature};}
export async function verify(token:string,secret:string){
 if(token.length>12000)throw Error('Token jest za długi');
 const parts=token.split('.');if(parts.length!==2)throw Error('Nieprawidłowy token');
 const [data,sig]=parts;
 if(!await crypto.subtle.verify('HMAC',await key(secret),decode(sig),enc.encode(data)))throw Error('Nieprawidłowy podpis');
 const unpacked=await new Response(new Blob([decode(data)]).stream().pipeThrough(new DecompressionStream('gzip'))).text();return JSON.parse(unpacked);
}
