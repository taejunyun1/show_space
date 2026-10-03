import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

// Keep licenses for the ZIP runtime and its dependency tree in the web distribution.
const visited=new Set(),notices=[];
function collect(name,parentRequire){
 const path=parentRequire.resolve(`${name}/package.json`),pkg=JSON.parse(readFileSync(path,'utf8')),key=`${pkg.name}@${pkg.version}`;
 if(visited.has(key))return;visited.add(key);
 const directory=dirname(path),names=readdirSync(directory),files=names.filter(file=>/^(licen[sc]e|copying)(\.|$)/i.test(file)).sort();
 let text=files.map(file=>readFileSync(resolve(directory,file),'utf8')).join('\n');
 if(!text){
  const readme=names.find(file=>/^readme(\.|$)/i.test(file)),body=readme?readFileSync(resolve(directory,readme),'utf8'):'';
  const heading=/^#{1,4}\s+Licen[sc]e\b/im.exec(body);
  if(heading&&body.slice(heading.index).includes('Permission is hereby granted'))text=body.slice(heading.index);
 }
 if(!text)throw new Error(`Missing license text: ${key}`);
 notices.push(`${key}\n${'='.repeat(key.length)}\n${text}`);
 const require=createRequire(path);for(const dependency of Object.keys(pkg.dependencies??{}))collect(dependency,require);
}
collect('jszip',createRequire(import.meta.url));
const directory=resolve('public/licenses');mkdirSync(directory,{recursive:true});
writeFileSync(resolve(directory,'zip-third-party-notices.txt'),`ZIP runtime notices\nJSZip is used under its MIT license option. Other dependency licenses appear below.\n\n${notices.join('\n\n')}`);
console.log(`ZIP runtime licenses: ${visited.size} packages`);
