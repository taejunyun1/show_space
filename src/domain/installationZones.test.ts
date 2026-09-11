import {it,expect} from 'vitest';
import {installationZones,footprintOverlapsZone} from './installationZones';
import {createDemoProject,artworkPosition,artworkWarnings} from './model';
import type {Project} from './types';
function fixture():Project{
 const p=createDemoProject(),pos=artworkPosition(p.artworks[0],p.walls[0]);
 p.planReference={widthPx:20000,heightPx:20000,origin:{x:-10000,z:-10000},mmPerPixel:1,calibrated:true};
 p.planLabels=[{id:'stairs',kind:'stairs',source:'pdf-text',text:'Stairs',status:'unreviewed',note:'',box:{x:50,y:50,width:20,height:20}}];
 p.planAnalysis={lines:[],issues:[],textState:'complete',lineState:'complete',numericCount:0,stairRegions:[{id:'region',kind:'stairs',labelId:'stairs',lineIds:[],box:{x:pos.x+10000-20,y:pos.z+10000-20,width:40,height:40}}]};
 return p;
}
it('warns when the artwork footprint overlaps calibrated detected stairs and clears after movement',()=>{
 const p=fixture(),art=p.artworks[0],wall=p.walls[0];
 expect(artworkWarnings(art,wall,p).join(' ')).toContain('계단');
 expect(artworkWarnings({...art,alongMm:art.alongMm+2000},wall,p).join(' ')).not.toContain('계단');
 expect(artworkWarnings({...art,wallSide:'back'},wall,p).join(' ')).not.toContain('계단');
});
it('does not project uncalibrated or dismissed detection into installation restrictions',()=>{
 const p=fixture();p.planReference!.calibrated=false;expect(installationZones(p)).toEqual([]);
 p.planReference!.calibrated=true;p.planLabels![0].status='dismissed';expect(installationZones(p)).toEqual([]);
});
it('uses oriented footprint intersection rather than only bounding-box overlap',()=>{
 const diamond=[{x:0,z:2},{x:2,z:0},{x:4,z:2},{x:2,z:4}],zone={id:'r',kind:'stairs' as const,x:0,z:0,width:.5,depth:.5};
 expect(footprintOverlapsZone(diamond,zone)).toBe(false);
 expect(footprintOverlapsZone(diamond,{...zone,x:1.5,z:1.5})).toBe(true);
});
