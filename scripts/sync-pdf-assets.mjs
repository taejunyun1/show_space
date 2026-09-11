import { cp, mkdir } from 'node:fs/promises';
for (const directory of ['wasm','cmaps','standard_fonts']) {
 await mkdir(`public/pdfjs/${directory}`,{recursive:true});
 await cp(`node_modules/pdfjs-dist/${directory}`,`public/pdfjs/${directory}`,{recursive:true});
}
