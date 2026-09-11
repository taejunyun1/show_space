import {expect,it} from 'vitest';
import {createDemoProject,artworkPosition,updateArtwork,parseProject,distributeArtworks,updateWall} from './model';
it('places back-face artwork on the opposite side with opposite normal',()=>{const p=createDemoProject(),w=p.walls[0],a=p.artworks[0];const front=artworkPosition(a,w),back=artworkPosition({...a,wallSide:'back'},w);expect(back.z-w.start.z).toBe(-(front.z-w.start.z));expect(Math.cos(back.rotationY)).toBeCloseTo(-Math.cos(front.rotationY));expect(back.x).toBe(front.x);});
it('validates wall roles and faces and preserves legacy projects',()=>{const p=createDemoProject();expect(parseProject(p)).toEqual(p);expect(()=>updateArtwork(p,p.artworks[0].id,{wallSide:'other' as never})).toThrow();expect(()=>updateWall(p,p.walls[0].id,{role:'other' as never})).toThrow();const n=updateArtwork(updateWall(p,p.walls[0].id,{role:'partition'}),p.artworks[0].id,{wallSide:'back'});expect(parseProject(JSON.parse(JSON.stringify(n)))).toEqual(n);});
it('does not distribute paintings across opposite wall faces',()=>{const p=createDemoProject();p.artworks[1].wallSide='back';expect(()=>distributeArtworks(p,[p.artworks[0].id,p.artworks[1].id],250)).toThrow();});

it('loads the complete venue fixture with a courtyard and shared partitions', async()=>{
 const {default:fixture}=await import('../../public/examples/whole-venue.json');const {deriveFloor}=await import('./floor');
 const p=parseProject(fixture);
 const floor=deriveFloor(p.walls);expect(floor.areaMm2).toBe(180_000_000);expect(floor.surfaces).toHaveLength(1);expect(floor.surfaces[0].holes).toHaveLength(1);expect(floor.invalidComponents).toBe(0);
 expect(p.artworks.map(a=>a.wallSide)).toEqual(['front','back']);
});
