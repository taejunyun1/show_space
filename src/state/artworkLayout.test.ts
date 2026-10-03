import {beforeEach,expect,it} from 'vitest';
import {useEditor} from './editor';
import {createDemoProject,parseProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {rotatedArtworkOuterSize} from '../domain/artworkPresentation';
const load=()=>{const p=createDemoProject();p.artworks=p.artworks.slice(0,3);useEditor.getState().loadProject(p);p.artworks.forEach((a,i)=>useEditor.getState().select({type:'artwork',id:a.id},i!==0));return p;};
beforeEach(load);
it('applies a multi-artwork layout as one undoable edit, retains selection and avoids empty history',()=>{
 const before=useEditor.getState().project,selection=useEditor.getState().selected;
 useEditor.getState().spaceSelected(250);const after=useEditor.getState().project;
 expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().selected).toEqual(selection);
 expect(after.artworks.map(a=>a.alongMm)).toEqual([1400,2595,3790]);
 useEditor.getState().spaceSelected(250);expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().project).toBe(after);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(before);
 useEditor.getState().redo();expect(useEditor.getState().project).toEqual(after);
 useEditor.getState().layoutSelectedArtworks({kind:'center-height',heightMm:1450});expect(useEditor.getState().project.artworks.every(a=>a.centerHeightMm===1450)).toBe(true);expect(useEditor.getState().past).toHaveLength(2);
});
it('rejects mixed or locked selections and wall overflow without losing redo or changing any artwork',()=>{
 const p=useEditor.getState().project;
 useEditor.getState().layoutSelectedArtworks({kind:'center-wall'});useEditor.getState().undo();
 const before=useEditor.getState().project,redo=useEditor.getState().future;
 useEditor.getState().spaceSelected(100000);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);expect(useEditor.getState().future).toBe(redo);expect(useEditor.getState().message).toMatch(/벽/);
 useEditor.getState().select({type:'wall',id:p.walls[0].id},true);useEditor.getState().spaceSelected(250);expect(useEditor.getState().message).toMatch(/이미지 작품/);expect(useEditor.getState().project).toBe(before);
 const locked={...p,artworks:p.artworks.map((a,i)=>i?a:{...a,locked:true})};useEditor.getState().loadProject(locked);locked.artworks.forEach((a,i)=>useEditor.getState().select({type:'artwork',id:a.id},i!==0));useEditor.getState().layoutSelectedArtworks({kind:'align',edge:'top'});expect(useEditor.getState().message).toMatch(/잠긴/);expect(useEditor.getState().past).toHaveLength(0);expect(useEditor.getState().project).toEqual(locked);
});
it('preserves full groups, frame assets and physical sizes through Scene, JSON and read-only share output',()=>{
 useEditor.getState().groupSelectedArtworks();const before=useEditor.getState().project;
 useEditor.getState().spaceSelected(250);useEditor.getState().layoutSelectedArtworks({kind:'center-height',heightMm:1450});const arranged=useEditor.getState().project;
 expect(arranged.artworks.map(a=>a.groupId)).toEqual(before.artworks.map(a=>a.groupId));
 arranged.artworks.forEach((a,i)=>expect({...a,alongMm:before.artworks[i].alongMm,centerHeightMm:before.artworks[i].centerHeightMm}).toEqual(before.artworks[i]));
 useEditor.getState().saveScene('정렬 검증');const scene=useEditor.getState().project.scenes.at(-1)!;
 useEditor.getState().layoutSelectedArtworks({kind:'align',edge:'left'});useEditor.getState().restoreScene(scene.id);
 const restored=parseProject(JSON.parse(JSON.stringify(useEditor.getState().project)));expect(restored.artworks).toEqual(arranged.artworks);
 const {snapshot}=createPublicShare(restored,{includeDimensions:true});
 expect(snapshot.artworks.map(a=>[a.alongMm,a.centerHeightMm,a.widthMm,a.heightMm,a.frame])).toEqual(arranged.artworks.map(a=>[a.alongMm,a.centerHeightMm,a.widthMm,a.heightMm,a.frame]));
 const gap=restored.artworks[1].alongMm-restored.artworks[0].alongMm-(rotatedArtworkOuterSize(restored.artworks[0]).widthMm+rotatedArtworkOuterSize(restored.artworks[1]).widthMm)/2;expect(gap).toBe(250);
});
