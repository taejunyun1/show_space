import {expect,it,beforeEach} from 'vitest';
import {createDemoProject,parseProject,duplicateSelection,deleteSelection} from './model';
import {newLight,patchLight} from './lighting';
import {testVenueModel} from '../lib/venueModelTestFixture';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {addModelArtwork} from './modelArtworks';
import {readNote,updateNote,parseNoteDetails,type NoteDetails,type NoteTarget} from './notes';
import {useEditor,hydrateEditor} from '../state/editor';
import {writeDraft} from '../lib/persistence';
import {createPublicShare,parsePublicShare} from './publicShare';
import {preparePublicModels} from '../lib/publicModelAsset';
import {exportProjectPackage,importProjectPackage,projectImageUrls} from '../lib/projectPackage';
import JSZip from 'jszip';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const details:NoteDetails={checklist:[{id:'check-1',text:'PRIVATE_CHECKLIST',done:true}],images:[{id:'image-1',name:'PRIVATE_INSTALL_PHOTO.png',imageUrl:png}]};
function fixture(){let p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.referenceModel=testVenueModel();p.lights=[newLight(p,'spot')];return p;}
const targets:NoteTarget[]=[{type:'project'},{type:'floor'},{type:'referenceModel'},{type:'wall',id:'wall-a'},{type:'artwork',id:'artwork-1'},{type:'modelArtwork',id:'model-artwork-1'},{type:'light',id:'light-1'}];
beforeEach(()=>useEditor.setState({project:fixture(),past:[],future:[],selected:[],previewProject:null,wallGesture:null,artworkGesture:null,lightGesture:null,modelArtworkGesture:null,outdoorGesture:null,message:null,hydrated:true}));
it('preserves text, checklist and pictures on every supported target through JSON and old projects',()=>{
 let p=fixture();for(const target of targets)p=updateNote(p,target,{text:'PRIVATE_NOTE',details});const restored=parseProject(JSON.parse(JSON.stringify(p)));for(const target of targets)expect(readNote(restored,target)).toEqual({text:'PRIVATE_NOTE',details});expect(readNote(parseProject(createDemoProject()),{type:'project'})).toEqual({text:'',details:{checklist:[],images:[]}});
 // Geometry updates use a field allowlist and must not erase attachment details.
 expect(patchLight(restored,'light-1',{intensity:123}).lights![0].noteDetails).toEqual(details);
});
it('clones object notes for duplicates and preserves artwork notes when deleting the supporting wall',()=>{
 let p=updateNote(fixture(),{type:'artwork',id:'artwork-1'},{details,text:'private'});const copied=duplicateSelection(p,{type:'artwork',id:'artwork-1'});expect(readNote(copied.project,copied.selection).details).toEqual(details);const changed=updateNote(copied.project,copied.selection,{details:{checklist:[],images:[]}});expect(readNote(changed,{type:'artwork',id:'artwork-1'}).details).toEqual(details);
 p=deleteSelection(p,{type:'wall',id:'wall-a'});expect(p.unplacedArtworks!.find(a=>a.id==='artwork-1')!.noteDetails).toEqual(details);expect(readNote(p,{type:'artwork',id:'artwork-1'}).text).toBe('private');
});
it('supports undo, redo, IndexedDB transport and current Scene snapshots without mutating history',async()=>{
 const state=useEditor.getState();state.patchNote({type:'artwork',id:'artwork-1'},{details,text:'note A'});state.saveScene('설치 A');state.patchNote({type:'artwork',id:'artwork-1'},{text:'note B'});state.undo();expect(readNote(useEditor.getState().project,{type:'artwork',id:'artwork-1'}).text).toBe('note A');state.redo();expect(readNote(useEditor.getState().project,{type:'artwork',id:'artwork-1'}).text).toBe('note B');state.restoreScene('scene-1');expect(readNote(useEditor.getState().project,{type:'artwork',id:'artwork-1'})).toEqual({text:'note B',details});
 let stored:unknown;await writeDraft(useEditor.getState().project,async(_,value)=>{stored=value;});useEditor.setState({hydrated:false});await hydrateEditor(async()=>stored);expect(useEditor.getState().project.artworks[0].noteDetails).toEqual(details);
});
it('packs note pictures on project, floor, all entities and historical scenes as a deduplicated verified asset',async()=>{
 let p=fixture();p.artworks=p.artworks.map(a=>({...a,imageUrl:png}));for(const target of targets)p=updateNote(p,target,{text:'PRIVATE_NOTE',details});useEditor.setState({project:p});useEditor.getState().saveScene('메모 보관');p=useEditor.getState().project;
 const packed=await exportProjectPackage(p,async()=>png),zip=await JSZip.loadAsync(await packed.arrayBuffer(),{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json')!.async('string')),stored=await zip.file('project.json')!.async('string');expect(stored).not.toContain('data:image');expect(stored).toContain('PRIVATE_NOTE');expect(manifest.assets.filter((a:{mime:string})=>a.mime==='image/png')).toHaveLength(1);expect(await importProjectPackage(await packed.arrayBuffer())).toEqual(parseProject(p));expect(projectImageUrls(p)).toEqual([png]);
});
it('excludes every private note, checklist and photo from published JSON and asset uploads',async()=>{
 let p=fixture();for(const target of targets)p=updateNote(p,target,{text:'PRIVATE_NOTE',details});const assets=await preparePublicModels(p),pub=createPublicShare(p,{includeDimensions:true,referenceAssetId:assets.referenceId,modelAssetIds:assets.ids});expect(JSON.stringify(pub.snapshot)).not.toMatch(/PRIVATE_|noteDetails|checklist|image-1/);expect(pub.uploads.map(u=>u.sourceUrl)).not.toContain(png);expect(JSON.stringify(parsePublicShare({...pub.snapshot,note:'PRIVATE_NOTE',noteDetails:details,lights:pub.snapshot.lights!.map(l=>({...l,noteDetails:details}))}))).not.toMatch(/PRIVATE_|noteDetails|checklist/);
});
it('rejects broken or oversized private note data before replacing the editor draft',()=>{
 const altered=[{...details,images:[{...details.images[0],imageUrl:'https://remote.example/private.png'}]},{...details,images:[{...details.images[0],imageUrl:'data:image/png;base64,AQIDBA=='}]},{...details,checklist:[details.checklist[0],details.checklist[0]]},{...details,checklist:[{...details.checklist[0],done:'yes'}]},{...details,images:Array.from({length:9},(_,i)=>({...details.images[0],id:'image-'+i}))}];for(const d of altered)expect(()=>parseNoteDetails(d)).toThrow();const bad=fixture();bad.noteDetails=altered[0] as NoteDetails;const previous=useEditor.getState().project;useEditor.getState().loadProject(bad);expect(useEditor.getState().project).toBe(previous);expect(useEditor.getState().message).toContain('내장');
 const large=Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0));new DataView(large.buffer).setUint32(16,100000);expect(()=>parseNoteDetails({...details,images:[{...details.images[0],imageUrl:'data:image/png;base64,'+btoa(String.fromCharCode(...large))}]})).toThrow('2,048px');
});
