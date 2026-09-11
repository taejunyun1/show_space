import {cp,mkdir,readdir} from 'node:fs/promises';
await mkdir('public/ocr/core',{recursive:true});
for(const name of await readdir('node_modules/tesseract.js-core'))if(name.endsWith('.wasm')||name.endsWith('.wasm.js')||name==='LICENSE')await cp(`node_modules/tesseract.js-core/${name}`,`public/ocr/core/${name}`);
await cp('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
await cp('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt','public/ocr/worker.min.js.LICENSE.txt');
