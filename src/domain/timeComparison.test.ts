import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {DEFAULT_OUTDOOR,outdoorAppearance,outdoorInstant} from './outdoor';
import {materialPreset} from './materials';
import {DEFAULT_COMPARISON_TIMES,timeComparisonFrames,appendTimeComparisonScenes} from './timeComparison';
import {sceneProject} from './sceneProject';
const options={sceneId:'',date:'2026-07-21',times:DEFAULT_COMPARISON_TIMES,occurrence:'earlier' as const};
it('compares four real solar times without changing current geometry, materials, notes or saved scenes',()=>{
 const p=createDemoProject();p.outdoor={...DEFAULT_OUTDOOR,mode:'indoor',time:'16:30'};
 p.walls[0].material=materialPreset('glossy-photo-paper').material;p.artworks[0].note='PRIVATE';
 const original=structuredClone(p),frames=timeComparisonFrames(p,options);
 expect(frames.map(f=>f.project.outdoor?.time)).toEqual(['09:00','13:00','17:00','20:00']);
 for(const f of frames){expect({...f.project,outdoor:p.outdoor}).toEqual(p);expect(f.project.outdoor?.mode).toBe('outdoor');expect(parseProject(f.project)).toEqual(f.project);}
 expect(outdoorAppearance(frames[1].project.outdoor)!.sunIntensity).toBeGreaterThan(0);
 expect(outdoorAppearance(frames[3].project.outdoor)!.sunIntensity).toBe(0);
 expect(frames[0].sun.azimuth).not.toBe(frames[2].sun.azimuth);expect(p).toEqual(original);
});
it('validates the entire batch, including DST gaps and the selected occurrence of repeated local times',()=>{
 const p=createDemoProject();p.outdoor={...DEFAULT_OUTDOOR,timeZone:'America/New_York'};
 expect(()=>timeComparisonFrames(p,{...options,date:'2026-03-08',times:['01:00','02:30','09:00','13:00']})).toThrow(/존재하지/);
 const repeated={...options,date:'2026-11-01',times:['01:30','01:30','09:00','13:00']};
 const first=timeComparisonFrames(p,repeated),last=timeComparisonFrames(p,{...repeated,occurrence:'later'});
 expect(outdoorInstant(last[0].project.outdoor!)-outdoorInstant(first[0].project.outdoor!)).toBe(3600000);
 for(const patch of [{times:[]},{times:['09:00','13:00','17:00','24:00']},{date:'2026-02-29'},{sceneId:'missing'}])expect(()=>timeComparisonFrames(p,{...options,...patch})).toThrow();
});
it('appends four complete saved time scenes atomically while preserving newer current edits and existing ids',()=>{
 const source=createDemoProject();source.floorMaterial=materialPreset('epoxy-floor').material;
 const saved=appendTimeComparisonScenes(source,source,options,{position:[-9,10,13],target:[0,1,0],zoom:65,projection:'orthographic'});
 expect(saved.scenes).toHaveLength(4);expect(source.scenes).toHaveLength(0);
 expect({...saved,scenes:source.scenes}).toEqual(source);
 const current={...saved,name:'New current name',walls:saved.walls.map(w=>({...w,color:'#123456'}))};
 const more=appendTimeComparisonScenes(current,saved,{...options,sceneId:'scene-1'});
 expect(more.scenes).toHaveLength(8);expect(new Set(more.scenes.map(s=>s.id)).size).toBe(8);
 expect(more.walls).toEqual(current.walls);expect(more.name).toBe('New current name');
 const restored=sceneProject(more,more.scenes[7]);expect(restored.walls).toEqual(source.walls);expect(restored.floorMaterial).toEqual(source.floorMaterial);expect(restored.outdoor?.time).toBe('20:00');
 expect(parseProject(JSON.parse(JSON.stringify(more)))).toEqual(more);
 expect(()=>appendTimeComparisonScenes({...current,id:'other'},source,options)).toThrow(/프로젝트/);
});
it('keeps each rendered preview aligned with its saved time and rejects a partial or invalid batch',()=>{
 const p=createDemoProject(),url='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',thumbnails=DEFAULT_COMPARISON_TIMES.map(()=>({imageUrl:url,widthPx:1,heightPx:1,view:'3d' as const}));
 const saved=appendTimeComparisonScenes(p,p,options,undefined,thumbnails);expect(saved.scenes.map(s=>s.thumbnail)).toEqual(thumbnails);expect(saved.scenes.map(s=>s.structure!.outdoor!.time)).toEqual(DEFAULT_COMPARISON_TIMES);
 expect(()=>appendTimeComparisonScenes(p,p,options,undefined,thumbnails.slice(0,3))).toThrow(/네 시간대/);
 const invalid=structuredClone(thumbnails);invalid[3].heightPx=200;expect(()=>appendTimeComparisonScenes(p,p,options,undefined,invalid)).toThrow(/크기/);expect(p.scenes).toHaveLength(0);
});
