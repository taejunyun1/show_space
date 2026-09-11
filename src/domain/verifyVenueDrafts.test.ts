import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {venueDraftsAgree} from './verifyVenueDrafts';
const project=()=>({...createDemoProject(),planReference:{widthPx:1000,heightPx:800,origin:{x:0,z:0},mmPerPixel:10,calibrated:true}});
it('accepts reordered reversed wall endpoints and minor raster drift',()=>{const a=project(),b=project();b.walls.reverse();b.walls=b.walls.map(w=>({...w,start:{x:w.end.x+10,z:w.end.z},end:{...w.start}}));expect(venueDraftsAgree(a,b)).toBe(true);});
it('rejects conflicting scale, missing walls, role changes and structural movement',()=>{for(const mutate of [(b:ReturnType<typeof project>)=>b.planReference.mmPerPixel=20,(b:ReturnType<typeof project>)=>b.walls.pop(),(b:ReturnType<typeof project>)=>b.walls[0].role='partition',(b:ReturnType<typeof project>)=>b.walls[0].start.x+=100]){const b=project();mutate(b);expect(venueDraftsAgree(project(),b)).toBe(false);}});
