import {beforeEach,expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {installationArtworks,installationDetails,installationNotes,installationProgress} from './installation';
import {parseNoteDetails,readNote,updateNote} from './notes';
import {createPublicShare} from './publicShare';
import {useEditor} from '../state/editor';
import {installationDrawing} from './readonlyDrawing';
import {addModelArtwork} from './modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
beforeEach(()=>useEditor.setState({project:createDemoProject(),past:[],future:[],previewProject:null,hydrated:true,message:null}));
it('counts current mounted, hidden, unplaced and 3D artworks without counting historical Scenes twice',()=>{
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;
 const [unplaced,...placed]=p.artworks;p.artworks=placed;p.unplacedArtworks=[unplaced];p.artworks[0].visible=false;
 p.artworks[1].noteDetails={installation:{installed:true,printed:true},checklist:[{id:'extra',text:'높이 실측',done:true}],images:[]};
 p.noteDetails={checklist:[{id:'project-task',text:'공구 준비',done:false}],images:[]};p.scenes=[{id:'historical',name:'이전 배치',artworks:structuredClone(p.artworks),wallVisibility:{}}];
 const rows=installationArtworks(p);expect(rows).toHaveLength(6);expect(rows.find(r=>r.artwork.id===unplaced.id)?.kind).toBe('unplaced');expect(rows[0].status).toBe('숨김');expect(rows.at(-1)?.kind).toBe('model');
 expect(installationProgress(p)).toEqual({artworks:6,steps:30,done:2,installed:1,checks:2,checksDone:1});expect(installationNotes(p).filter(n=>n.target.type==='artwork')).toHaveLength(5);
});
it('retains private stage statuses, notes and additional tasks across JSON, undo, redo and Scene restoration',()=>{
 const target={type:'artwork' as const,id:'artwork-1'},s=useEditor.getState();s.patchNote(target,{text:'비공개 현장 지시',details:{checklist:[{id:'extra',text:'수평 확인',done:true}],images:[]}});s.saveScene('설치 전');
 s.patchNote(target,{details:installationDetails(useEditor.getState().project,target,'installed',true)});
 expect(installationProgress(useEditor.getState().project).installed).toBe(1);s.undo();expect(installationProgress(useEditor.getState().project).installed).toBe(0);s.redo();s.restoreScene('scene-1');
 const restored=parseProject(JSON.parse(JSON.stringify(useEditor.getState().project)));expect(readNote(restored,target)).toEqual({text:'비공개 현장 지시',details:{checklist:[{id:'extra',text:'수평 확인',done:true}],images:[],installation:{installed:true}}});
 const pub=createPublicShare(restored,{includeDimensions:true,includeArtworkDetails:true});expect(JSON.stringify(pub)).not.toMatch(/비공개|수평 확인|installation|noteDetails/);
});
it('updates independent stages without erasing photos or additional checklist data',()=>{
 const p=createDemoProject(),target={type:'artwork' as const,id:'artwork-1'};p.artworks[0].noteDetails={checklist:[{id:'check',text:'고정장치 확인',done:false}],images:[],installation:{printed:true,delivered:false}};
 const next=updateNote(p,target,{details:installationDetails(p,target,'lightingChecked',true)});expect(next.artworks[0].noteDetails).toEqual({...p.artworks[0].noteDetails,installation:{printed:true,delivered:false,lightingChecked:true}});expect(p.artworks[0].noteDetails.installation?.lightingChecked).toBeUndefined();
 expect(()=>installationDetails(p,{type:'wall',id:'wall-a'},'installed',true)).toThrow(/작품/);
});
it('rejects malformed stage data before importing the project and accepts legacy notes',()=>{
 expect(parseNoteDetails({checklist:[],images:[]})).toEqual({checklist:[],images:[]});
 for(const installation of [{installed:'yes'},{unknown:true},[],null])expect(()=>parseNoteDetails({checklist:[],images:[],installation})).toThrow();
 const p=createDemoProject();p.artworks[0].noteDetails={checklist:[],images:[],installation:{installed:'yes'}} as never;expect(()=>parseProject(p)).toThrow(/설치 확인/);
});
it('builds local read-only drawings with images, visible geometry and calibrated dimensions without exposing private notes',()=>{
 const p=createDemoProject();p.artworks[0].note='PRIVATE';p.artworks[0].noteDetails={checklist:[],images:[],installation:{installed:true}};p.walls[1].visible=false;
 const d=installationDrawing(p);expect(d.walls).toHaveLength(3);expect(d.artworks.every(a=>a.wallId!=='wall-b')).toBe(true);expect(d.artworks[0].imageUrl).toBe(p.artworks[0].imageUrl);expect(d.artworks[0].spritePanel).toBe(0);expect(JSON.stringify(d)).not.toMatch(/PRIVATE|installation|noteDetails/);
 p.planDraft={kind:'partial',sourceEvidenceHash:'test',originalWalls:[]};p.planReference={widthPx:100,heightPx:100,origin:{x:0,z:0},mmPerPixel:1,calibrated:false};expect(installationDrawing(p).dimensions).toBeUndefined();
});
