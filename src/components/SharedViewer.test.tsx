import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {SharedPlan,SharedElevation,SharedInstallationInformation} from './SharedViewer';

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

it('draws rotated 3D artwork footprints in read-only plans without dimension or edit controls',async()=>{
 const {addModelArtwork}=await import('../domain/modelArtworks'),{testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{preparePublicModels}=await import('../lib/publicModelAsset'),p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.modelArtworks![0].position={x:20000,y:100,z:15000};p.modelArtworks![0].rotation={x:25,y:35,z:10};const models=await preparePublicModels(p),snapshot=createPublicShare(p,{includeDimensions:false,modelAssetIds:models.ids}).snapshot;
 const html=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={snapshot.modelArtworks![0].id} onSelect={()=>{}}/>);expect(html).toContain('3D 작품 translated-arch');expect(html).toContain('<polygon');expect(html).not.toContain(' mm');expect(html).not.toMatch(/input|이동|회전|삭제/);const [x,z,width,depth]=html.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);expect(x+width).toBeGreaterThan(21000);expect(z+depth).toBeGreaterThan(16000);const vertices=html.match(/<polygon[^>]*points="([^"]+)"/)![1].split(' ').map(v=>v.split(',').map(Number));expect(vertices.length).toBeGreaterThanOrEqual(4);expect(vertices.every(([vx,vz])=>vx>=x&&vx<=x+width&&vz>=z&&vz<=z+depth)).toBe(true);
});


it('shows the venue outline as an unfilled reference range and handles elevations without editable walls',async()=>{
 const {testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{preparePublicModels}=await import('../lib/publicModelAsset'),p=createDemoProject();p.walls=[];p.artworks=[];p.referenceModel={...testArtworkModel(),positionMm:[20000,300,15000],rotationDeg:30,scale:2};const models=await preparePublicModels(p),snapshot=createPublicShare(p,{includeDimensions:false,referenceAssetId:models.referenceId}).snapshot;
 const plan=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={null} referenceSelected onSelect={()=>{}}/>);expect(plan).toContain('전시장 3D 모델 범위');expect(plan).toContain('fill="none"');expect(plan).toContain('stroke-dasharray');expect(plan).not.toContain(' mm');expect(plan).not.toContain('<path');const [x,z,width,depth]=plan.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);expect(x).toBeGreaterThan(17000);expect(z).toBeGreaterThan(12000);expect(x+width).toBeGreaterThan(21000);expect(z+depth).toBeGreaterThan(16000);
 const elevation=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId={null} side="front" selectedId={null} onSelect={()=>{}}/>);expect(elevation).toContain('벽');expect(elevation).not.toContain('<svg');
});
it('shows read-only Scene navigation including current layout and the active saved name',async()=>{
 const {SharedScenes}=await import('./SharedViewer');const snapshot=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot;
 const html=renderToStaticMarkup(<SharedScenes scenes={[{id:'a',name:'설치안 A',snapshot},{id:'b',name:'설치안 B',snapshot}]} selectedId="b" onChange={()=>{}}/>);
 expect(html).toContain('aria-label="전시 Scene"');expect(html).toContain('현재 배치');expect(html).toContain('aria-pressed="true">설치안 B');expect(html).not.toMatch(/저장|삭제|input/);
});

it('shares frame-aware installation distances only on a selected artwork and dimension-enabled link',()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,wallSide:'back',rotationDeg:90,widthMm:i?700:500,heightMm:i?900:600,alongMm:i?3600:4780,centerHeightMm:1600,frame:'natural',frameSettings:{widthMm:30,depthMm:70,matWidthMm:60,matColor:'#ffffff',material:'metal',cover:'glass'}}));
 const snapshot=createPublicShare(p,{includeDimensions:true}).snapshot,before=JSON.stringify(snapshot);
 const selected=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId="wall-a" side="back" selectedId={p.artworks[0].id} onSelect={()=>{}}/>);
 for(const label of ['외곽 가로 간격 250 mm','바닥 1,260 mm','벽 왼쪽 2,830 mm','벽 오른쪽 4,390 mm'])expect(selected).toContain(label);
 expect(selected).not.toMatch(/draggable-art|스냅|<input|onpointermove|삭제/);expect(JSON.stringify(snapshot)).toBe(before);
 const unselected=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId="wall-a" side="back" selectedId={null} onSelect={()=>{}}/>);expect(unselected).not.toContain('작품 설치 치수');
 const opposite=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId="wall-a" side="front" selectedId={p.artworks[0].id} onSelect={()=>{}}/>);expect(opposite).not.toContain('data-artwork-dimension');
 const bare=createPublicShare(p,{includeDimensions:false}).snapshot,privateView=renderToStaticMarkup(<SharedElevation snapshot={bare} wallId="wall-a" side="back" selectedId={p.artworks[0].id} onSelect={()=>{}}/>);expect(privateView).not.toContain(' mm');expect(privateView).not.toContain('작품 설치 치수');
});

it('keeps the public installation list readable and absent from dimension-private links',()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,name:`작품 ${i+1}`,frame:'none',widthMm:500,heightMm:600,alongMm:1000+i*750,centerHeightMm:1500}));
 const snapshot=createPublicShare(p,{includeDimensions:true}).snapshot,html=renderToStaticMarkup(<SharedInstallationInformation snapshot={snapshot} artworkId={p.artworks[0].id}/>);
 expect(html).toContain('외곽 가로 간격 · 작품 2');expect(html).toContain('250 mm');expect(html).toContain('1,200 mm');expect(html).not.toMatch(/<input|<button|이동|삭제/);
 expect(renderToStaticMarkup(<SharedInstallationInformation snapshot={createPublicShare(p,{includeDimensions:false}).snapshot} artworkId={p.artworks[0].id}/>)).toBe('');
});
