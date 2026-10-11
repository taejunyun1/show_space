// Node 24 CPU microbenchmark; actual browser latency/GPU/FPS are not measured.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {base64Bytes} from '../src/lib/base64Bytes.ts';
if(!global.gc)throw new Error('Run with node --expose-gc');
const input=readFileSync(process.argv[2]),encoded=input.toString('base64');
const methods={legacy:value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)),direct:base64Bytes};
const timings={legacy:[],direct:[]};
for(let i=0;i<4;i++)for(const name of i%2?['direct','legacy']:['legacy','direct']){
 global.gc();const start=performance.now(),decoded=methods[name](encoded),ms=performance.now()-start;
 if(!Buffer.from(decoded).equals(input))throw new Error(name+' byte mismatch');
 if(i)timings[name].push(ms);
}
const median=v=>[...v].sort((a,b)=>a-b)[1];
const result={date:'2026-10-11',node:process.version,bytes:input.length,sha256:createHash('sha256').update(input).digest('hex'),rounds:3,warmup:1,alternatingOrder:true,allBytesEqual:true,timingsMs:timings,medianMs:{legacy:median(timings.legacy),direct:median(timings.direct)},limitations:['CPU base64 decoding only; not browser load latency, GPU, FPS or p95','Same-machine microbenchmark; do not generalize to all devices']};
writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
