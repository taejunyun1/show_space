import {expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {pdfSections,fitPdfDrawing,elevationArtPlacement} from './pdfLayout';
const options={current:true,sceneIds:[],threeD:true,plan:true,elevation:true,allWallFaces:false};
it('exports current 3D, plan and installed wall faces without editing the source',()=>{
 const p=createDemoProject(),before=structuredClone(p),sections=pdfSections(p,options);
 expect(sections.map(s=>s.kind)).toEqual(['3d','plan','elevation','elevation']);expect(sections.slice(2).map(s=>[s.wall?.id,s.side])).toEqual([['wall-a','front'],['wall-b','front']]);expect(p).toEqual(before);
});
it('exports a structural Scene with its original walls, artworks and floor',()=>{
 const p=createDemoProject(),wall={...p.walls[0],id:'saved-wall',heightMm:4000};p.scenes=[{id:'scene-1',name:'원래 배치',artworks:[{...p.artworks[0],wallId:wall.id,wallSide:'back'}],wallVisibility:{},structure:{walls:[wall],openings:[],dimensions:[],unplacedArtworks:[],importedFloor:[[{x:0,z:0},{x:4000,z:0},{x:0,z:4000}]]}}];
 const sections=pdfSections(p,{...options,current:false,sceneIds:['scene-1']});expect(sections).toHaveLength(3);expect(sections[1].project.walls).toEqual([wall]);expect(sections[1].project.importedFloor).toHaveLength(1);expect(sections[2].side).toBe('back');expect(p.walls).toHaveLength(4);
});
it('excludes explicitly hidden walls/artworks but can export every visible wall face',()=>{
 const p=createDemoProject();p.walls[0].visible=false;p.artworks[4].visible=false;
 expect(pdfSections(p,{...options,allWallFaces:true}).filter(s=>s.kind==='elevation')).toHaveLength(6);
 expect(pdfSections(p,options).filter(s=>s.kind==='elevation')).toHaveLength(0);
});
it('refuses incomplete selections, missing Scenes and uncalibrated drawings',()=>{
 const p=createDemoProject();expect(()=>pdfSections(p,{...options,current:false})).toThrow(/배치/);expect(()=>pdfSections(p,{...options,threeD:false,plan:false,elevation:false})).toThrow(/보기/);expect(()=>pdfSections(p,{...options,sceneIds:['missing']})).toThrow(/Scene/);
 p.planReference={widthPx:100,heightPx:100,origin:{x:0,z:0},mmPerPixel:1,calibrated:false};expect(()=>pdfSections(p,options)).toThrow(/축척/);
});
it('fits physical millimeters to PDF points while reserving dimension space',()=>{
 const fit=fitPdfDrawing({minX:0,minY:0,maxX:8000,maxY:3200},{x:50,y:80,width:700,height:400});
 expect(fit.scale).toBeCloseTo(660/8000);expect(fit.x(0)).toBeCloseTo(70);expect(fit.x(8000)).toBeCloseTo(730);expect(fit.y(3200)).toBeLessThan(fit.y(0));expect(fit.denominator).toBeCloseTo(8000/(660*25.4/72));
});
it('mirrors back-face positions and retains the real artwork angle',()=>{
 const p=createDemoProject(),art={...p.artworks[0],wallSide:'back' as const,rotationDeg:30};
 expect(elevationArtPlacement(art,p.walls[0],'back')).toEqual({x:6600,y:1700,angle:30});
});
