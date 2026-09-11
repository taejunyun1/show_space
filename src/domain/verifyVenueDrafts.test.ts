import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {venueDraftsAgree} from './verifyVenueDrafts';
const project=()=>({...createDemoProject(),planReference:{widthPx:1000,heightPx:800,origin:{x:0,z:0},mmPerPixel:10,calibrated:true}});
it('accepts reordered reversed wall endpoints and minor raster drift',()=>{const a=project(),b=project();b.walls.reverse();b.walls=b.walls.map(w=>({...w,start:{x:w.end.x+10,z:w.end.z},end:{...w.start}}));expect(venueDraftsAgree(a,b)).toBe(true);});
it('rejects conflicting scale, missing walls, role changes and structural movement',()=>{for(const mutate of [(b:ReturnType<typeof project>)=>b.planReference.mmPerPixel=20,(b:ReturnType<typeof project>)=>b.walls.pop(),(b:ReturnType<typeof project>)=>b.walls[0].role='partition',(b:ReturnType<typeof project>)=>b.walls[0].start.x+=100]){const b=project();mutate(b);expect(venueDraftsAgree(project(),b)).toBe(false);}});
it('rejects a missing opening or changed opening type',()=>{const a=project(),b=project();a.openings=[{id:'door',kind:'door',role:'boundary',start:{wallId:a.walls[0].id,endpoint:'start'},end:{wallId:a.walls[1].id,endpoint:'end'},note:''}];expect(venueDraftsAgree(a,b)).toBe(false);b.openings=structuredClone(a.openings);expect(venueDraftsAgree(a,b)).toBe(true);b.openings[0].kind='window';expect(venueDraftsAgree(a,b)).toBe(false);});
it('rejects different wall heights even when plan geometry matches',()=>{const a=project(),b=project();b.walls[0].heightMm+=100;expect(venueDraftsAgree(a,b)).toBe(false);});
