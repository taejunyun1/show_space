import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createDemoProject} from '../domain/model';
import type {ModelArtwork} from '../domain/types';
import {pdfDefaultPages,pdfNeeds3d,pdfPreviewSection,pdfSections,type PdfOptions} from './pdfLayout';
import {buildExhibitionPdf} from './pdfDocument';
const base:PdfOptions={current:true,sceneIds:[],threeD:true,plan:true,elevation:true,allWallFaces:false,includeSchedule:true};
const model:ModelArtwork={id:'model',name:'오브젝트',artist:'작가',year:'2026',kind:'object',model:{name:'object.glb',dataUrl:'not-loaded-in-layout-test',sizeMm:[1000,2000,500],sourceOffsetM:[0,0,0]},widthMm:1000,heightMm:2000,depthMm:500,position:{x:9000,y:300,z:3000},rotation:{x:0,y:30,z:0},visible:true,locked:false,note:'PRIVATE_MODEL'};
it('follows explicit interleaved page order and the saved structural batch without editing the project',()=>{
 const p=createDemoProject();p.scenes=[{id:'saved',name:'저장 배치',artworks:[{...p.artworks[0],widthMm:777}],wallVisibility:{},cameraView:{position:[1,2,3],target:[0,0,0],zoom:8}}];const before=structuredClone(p);
 const sections=pdfSections(p,{...base,current:false,pages:[{id:'a',kind:'cover',sceneId:'saved',title:'  첫 표지  '},{id:'b',kind:'detail',artworkId:p.artworks[0].id},{id:'c',kind:'plan',sceneId:'saved'},{id:'d',kind:'3d',sceneId:'saved'},{id:'e',kind:'plan'},{id:'f',kind:'schedule',sceneId:'saved'}]});
 expect(sections.map(s=>[s.kind,s.name])).toEqual([['cover','저장 배치'],['detail','현재 배치'],['plan','저장 배치'],['3d','저장 배치'],['plan','현재 배치'],['schedule','저장 배치']]);expect(sections[0].title).toBe('첫 표지');expect(sections[2].project.artworks[0].widthMm).toBe(777);expect(sections[3].camera).toEqual(p.scenes[0].cameraView);expect(sections[0].project).toBe(sections[2].project);expect(p).toEqual(before);
});
it('seeds the legacy order and maps a Scene correctly when an earlier batch has no installed wall faces',()=>{
 const p=createDemoProject();p.scenes=[{id:'empty',name:'비어 있는 배치',artworks:[],wallVisibility:{}},{id:'full',name:'설치 배치',artworks:p.artworks,wallVisibility:{}}];
 const pages=pdfDefaultPages(p,{...base,current:false,sceneIds:['empty','full'],threeD:false,plan:false});expect(pages.filter(p=>p.kind==='elevation').every(p=>p.sceneId==='full')).toBe(true);expect(pages.filter(p=>p.kind==='schedule').map(p=>p.sceneId)).toEqual(['empty','full']);
 const current=pdfDefaultPages(p,{...base,sceneIds:[]});expect(current.map(p=>p.kind)).toEqual(['3d','plan','elevation','elevation','schedule']);
});
it('refuses empty/missing/hidden targets instead of producing incomplete detail or elevation pages',()=>{
 const p=createDemoProject();expect(()=>pdfSections(p,{...base,pages:[]})).toThrow(/페이지/);expect(()=>pdfSections(p,{...base,pages:[{id:'a',kind:'cover',sceneId:'missing'}]})).toThrow(/Scene/);
 p.walls[0].visible=false;expect(()=>pdfSections(p,{...base,pages:[{id:'a',kind:'detail',artworkId:p.artworks[0].id}]})).toThrow(/표시 작품/);expect(()=>pdfSections(p,{...base,pages:[{id:'a',kind:'elevation',wallId:'wall-a',side:'front'}]})).toThrow(/표시 벽/);
 expect(()=>pdfSections(p,{...base,pages:[{id:'a',kind:'detail',artworkId:'missing'}]})).toThrow(/표시 작품/);
});
it('overrides PDF-only 3D presets while retaining saved lighting and a valid perspective zoom',()=>{
 const p=createDemoProject(),before=structuredClone(p);
 const sections=pdfSections(p,{...base,pages:[{id:'a',kind:'3d',cameraMode:'front'},{id:'b',kind:'3d',cameraMode:'perspective'},{id:'c',kind:'3d',cameraMode:'saved'}]});
 expect(sections[0].current).toBe(false);expect(sections[0].camera?.projection).toBe('orthographic');expect(sections[1].camera).toMatchObject({projection:'perspective',zoom:1,fov:50});expect(sections[2].current).toBe(true);expect(p).toEqual(before);
});
it('isolates a model detail preview without changing physical size, pose or original venue geometry',()=>{
 const p=createDemoProject();p.modelArtworks=[model,{...model,id:'other'}];const before=structuredClone(p),section=pdfSections(p,{...base,pages:[{id:'a',kind:'detail',artworkId:'model'}]})[0],preview=pdfPreviewSection(section);
 expect(pdfNeeds3d(section)).toBe(true);expect(preview.project.modelArtworks).toEqual([model]);expect(preview.project.walls).toEqual([]);expect(preview.project.artworks).toEqual([]);expect(preview.project.importedFloor).toEqual([]);expect(preview.current).toBe(false);expect(preview.camera?.projection).toBe('orthographic');expect(preview.camera?.target[0]).toBeCloseTo(model.position.x/1000);expect(section.project.walls).toHaveLength(4);expect(p).toEqual(before);
});
it('builds ordered cover/detail/plan/3D/schedule pages with searchable full long descriptions and no private notes',async()=>{
 const p=createDemoProject();p.note='PRIVATE_PROJECT';p.walls[0].note='PRIVATE_WALL';p.artworks[0].note='PRIVATE_ART';p.artworks[0].artist='상세 작가';p.artworks[0].medium='아카이벌 프린트';p.artworks[0].description='작품 설명 '.repeat(280)+'설명 마지막 문장';
 const options:PdfOptions={...base,pages:[{id:'a',kind:'cover',title:'검증 표지'},{id:'b',kind:'detail',artworkId:p.artworks[0].id,title:'상세 첫 작품'},{id:'c',kind:'plan',title:'순서 세 번째 평면'},{id:'d',kind:'3d',title:'순서 네 번째 3D'},{id:'e',kind:'schedule',title:'마지막 치수 목록'}]},sections=pdfSections(p,options);
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 const bytes=await buildExhibitionPdf(sections,options,{fontBytes:new Uint8Array(await readFile('public/fonts/NotoSansKR-Regular.ttf')),images:new Map([[p.artworks[0].imageUrl,png]]),previews:new Map([[3,png]])});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),useSystemFonts:false}),pdf=await task.promise,texts:string[]=[];
 try{for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),items=(await page.getTextContent()).items.filter(item=>'str' in item);texts.push(items.map(i=>i.str).join(' '));for(const item of items.filter(i=>i.str.trim())){expect(item.transform[4]).toBeGreaterThanOrEqual(35);expect(item.transform[4]+item.width).toBeLessThanOrEqual(841.89-34);expect(item.transform[5]).toBeGreaterThanOrEqual(21);}}
 expect(texts[0]).toContain('검증 표지');expect(texts[1]).toContain('상세 첫 작품');expect(texts.join(' ')).toContain('설명 마지막 문장');expect(texts.join(' ')).toContain('상세 작가');expect(texts.join(' ')).toContain('아카이벌 프린트');expect(texts.findIndex(t=>t.includes('순서 세 번째 평면'))).toBeGreaterThan(1);expect(texts.findIndex(t=>t.includes('순서 네 번째 3D'))).toBeGreaterThan(texts.findIndex(t=>t.includes('순서 세 번째 평면')));expect(texts.at(-1)).toContain('마지막 치수 목록');expect(texts.join(' ')).not.toContain('PRIVATE');expect(texts.filter(t=>t.includes('치수 목록 · 표시 중인'))).toHaveLength(0);
 }finally{await task.destroy();}
},20000);
