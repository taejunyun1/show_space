import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {SharedPlan,SharedElevation} from './SharedViewer';

describe('read-only public drawings',()=>{
  const bare=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot;
  const measured=createPublicShare(createDemoProject(),{includeDimensions:true}).snapshot;

  it('does not disclose lengths or artwork sizes when dimensions were excluded',()=>{
    const plan=renderToStaticMarkup(<SharedPlan snapshot={bare} selectedId={null} onSelect={()=>{}}/>);
    const elevation=renderToStaticMarkup(<SharedElevation snapshot={bare} wallId={bare.walls[0].id} side="front" selectedId={null} onSelect={()=>{}}/>);
    expect(plan).not.toContain(' mm');
    expect(elevation).not.toContain(' mm');
    expect(plan).not.toContain('치수선');
    expect(elevation).not.toContain('치수선');
    expect(plan).toContain('평면도');
  });

  it('shows lengths and saved measurement lines only after dimension sharing is enabled',()=>{
    const plan=renderToStaticMarkup(<SharedPlan snapshot={measured} selectedId={null} onSelect={()=>{}}/>);
    const elevation=renderToStaticMarkup(<SharedElevation snapshot={measured} wallId={measured.walls[0].id} side="front" selectedId={null} onSelect={()=>{}}/>);
    expect(plan).toContain(' mm');
    expect(elevation).toContain(' mm');
  });

  it('crops legacy five-panel artwork to its selected panel in the wall view',()=>{
    const snapshot={...bare,artworks:bare.artworks.map((art,index)=>({...art,...(index===0?{spritePanel:3}:{})}))};
    const elevation=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={snapshot.artworks[0].wallId} side={snapshot.artworks[0].wallSide} selectedId={null} onSelect={()=>{}} shareId={'a'.repeat(48)}/>);
    expect(elevation).toContain('background-size:500% 100%');
    expect(elevation).toContain('background-position:75% center');
  });

  it('does not repeat a saved elevation measurement on another wall',()=>{
    const wall=measured.walls[0],dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z;
    const snapshot={...measured,dimensions:[{id:'measure0',view:'elevation' as const,elevationWallId:wall.id,start:{x:wall.start.x+dx*.25,y:1200,z:wall.start.z+dz*.25},end:{x:wall.start.x+dx*.75,y:1200,z:wall.start.z+dz*.75},distanceMm:3000}]};
    const first=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={wall.id} side="front" selectedId={null} onSelect={()=>{}}/>);
    const other=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={snapshot.walls[1].id} side="front" selectedId={null} onSelect={()=>{}}/>);
    expect(first).toContain('3,000 mm');
    expect(other).not.toContain('3,000 mm');
  });

  it('shows a temporary ruler only on links that disclose dimensions',()=>{
    const points=[{x:-3000,y:1000,z:-3000},{x:-1000,y:1000,z:-3000}];
    const plan=renderToStaticMarkup(<SharedPlan snapshot={measured} selectedId={null} onSelect={()=>{}} measuring measurePoints={points}/>);
    const elevation=renderToStaticMarkup(<SharedElevation snapshot={measured} wallId={measured.walls[0].id} side="front" selectedId={null} onSelect={()=>{}} measuring measurePoints={points}/>);
    const privatePlan=renderToStaticMarkup(<SharedPlan snapshot={bare} selectedId={null} onSelect={()=>{}} measuring measurePoints={points}/>);
    expect(plan).toContain('임시 측정');
    expect(plan).toContain('2,000 mm');
    expect(elevation).toContain('임시 측정');
    expect(elevation).toContain('2,000 mm');
    expect(privatePlan).not.toContain('임시 측정');
    expect(privatePlan).not.toContain('2,000 mm');
  });
});
