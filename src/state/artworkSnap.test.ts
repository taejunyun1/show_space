import {beforeEach,expect,it} from 'vitest';
import {createDemoProject,parseProject} from '../domain/model';
import {useEditor} from './editor';
const options={toleranceMm:{alongMm:12,centerHeightMm:12}};
beforeEach(()=>{const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,frame:'none',widthMm:i?400:200,heightMm:i?400:200,alongMm:i?2000:1000,centerHeightMm:i?1500:1000}));useEditor.getState().loadProject(p);useEditor.setState({artworkSnapping:true});});
it('previews exact edge/center snapping, commits once and clears draft guides on undo and redo',()=>{
 const before=useEditor.getState().project;useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1015,centerHeightMm:1010});useEditor.getState().updateArtworkDrag({alongMm:1709,centerHeightMm:1506},options);
 expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().previewProject?.artworks[0].alongMm).toBe(1700);expect(useEditor.getState().artworkGesture?.guides).toHaveLength(2);expect(useEditor.getState().past).toHaveLength(0);
 useEditor.getState().finishArtworkDrag();expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().artworkGesture).toBeNull();expect(parseProject(useEditor.getState().project).artworks[0].centerHeightMm).toBe(1500);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(before);useEditor.getState().redo();expect(useEditor.getState().project.artworks[0].alongMm).toBe(1700);
});
it('keeps free placement and cancellation separate from the persistent project',()=>{
 const before=useEditor.getState().project;useEditor.getState().toggleArtworkSnapping();expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
 useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1000,centerHeightMm:1000});useEditor.getState().updateArtworkDrag({alongMm:1694.25,centerHeightMm:1496.5},options);expect(useEditor.getState().previewProject?.artworks[0].alongMm).toBe(1694.25);expect(useEditor.getState().artworkGesture?.guides).toEqual([]);
 useEditor.getState().finishArtworkDrag(true);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
 useEditor.getState().toggleArtworkSnapping();useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1000,centerHeightMm:1000});useEditor.getState().updateArtworkDrag({alongMm:1694.25,centerHeightMm:1496.5},{...options,bypass:true});expect(useEditor.getState().previewProject?.artworks[0].alongMm).toBe(1694.25);useEditor.getState().setView('plan');expect(useEditor.getState().previewProject).toBeNull();expect(useEditor.getState().artworkGesture).toBeNull();
});
it('preserves the rigid group and checks all member bounds on wall transfer',()=>{
 const p=useEditor.getState().project;p.artworks[0].groupId='g';p.artworks.push({...p.artworks[0],id:'group-other',alongMm:1300});useEditor.getState().loadProject(p);
 useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1000,centerHeightMm:1000});useEditor.getState().updateArtworkDrag({alongMm:1394,centerHeightMm:1000},options);const a=useEditor.getState().previewProject!.artworks;expect([a[0].alongMm,a[2].alongMm]).toEqual([1400,1700]);
 useEditor.getState().updateArtworkDrag({wallId:'wall-b',wallSide:'back',alongMm:99999,centerHeightMm:-50},options);const b=useEditor.getState().previewProject!.artworks;expect([b[0].alongMm,b[2].alongMm]).toEqual([5600,5900]);expect(b[0].centerHeightMm).toBe(100);expect(b[0].wallId).toBe('wall-b');expect(b[2].wallSide).toBe('back');
 useEditor.getState().finishArtworkDrag();expect(useEditor.getState().past).toHaveLength(1);
});
it('does not create history for a click or stationary preview with an implicit front face',()=>{const before=useEditor.getState().project;useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1000,centerHeightMm:1000});useEditor.getState().finishArtworkDrag();expect(useEditor.getState().project).toBe(before);useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1000,centerHeightMm:1000});useEditor.getState().updateArtworkDrag({alongMm:1000,centerHeightMm:1000},options);useEditor.getState().finishArtworkDrag();expect(useEditor.getState().past).toHaveLength(0);});
