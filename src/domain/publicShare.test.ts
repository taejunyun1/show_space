import {describe,expect,it} from 'vitest';
import {createDemoProject} from './model';
import {createPublicShare,parsePublicShare} from './publicShare';

describe('public share snapshot',()=>{
  it('publishes visible geometry and artwork while excluding private project data',()=>{
    const project=createDemoProject();
    project.walls[0].note='private wall note';
    project.artworks[0].note='private artwork note';
    project.planImageUrl='data:image/png;base64,cHJpdmF0ZQ==';
    project.sourcePlan={imageUrl:project.planImageUrl,widthPx:10,heightPx:10,labels:[]};
    project.scenes.push({id:'secret-scene',name:'private alternate',artworks:[],wallVisibility:{}});
    const result=createPublicShare(project,{includeDimensions:false});
    const serialized=JSON.stringify(result.snapshot);
    expect(result.snapshot.walls).toHaveLength(project.walls.length);
    expect(result.snapshot.artworks).toHaveLength(project.artworks.length);
    expect(result.uploads).toHaveLength(project.artworks.length);
    expect(result.snapshot.artworks[0].imageId).toBe('0');
    expect(result.snapshot.artworks[0].spritePanel).toBe(0);
    expect(result.snapshot.dimensions).toBeUndefined();
    for(const secret of ['private wall note','private artwork note','private alternate','cHJpdmF0ZQ==','imageUrl','sourcePlan','planAnalysis','scenes'])expect(serialized).not.toContain(secret);
  });

  it('creates a frozen public response from untrusted JSON and rejects unsafe asset references',()=>{
    const {snapshot}=createPublicShare(createDemoProject(),{includeDimensions:true});
    const input={...snapshot,internalNote:'secret',artworks:snapshot.artworks.map((artwork,i)=>({...artwork,note:'private',imageId:String(i)}))};
    const parsed=parsePublicShare(input);
    expect(JSON.stringify(parsed)).not.toContain('secret');
    expect(parsed.dimensions).toEqual([]);
    expect(()=>parsePublicShare({...input,artworks:[{...input.artworks[0],imageId:'../other-share'}]})).toThrow();
    expect(()=>parsePublicShare({...input,artworks:[{...input.artworks[0],spritePanel:5}]})).toThrow();
  });

  it('does not publish hidden walls or artwork attached to them',()=>{
    const project=createDemoProject();
    project.walls[0].visible=false;
    const snapshot=createPublicShare(project,{includeDimensions:false}).snapshot;
    expect(snapshot.walls.some(w=>w.id===project.walls[0].id)).toBe(false);
    expect(snapshot.artworks.every(a=>a.wallId!==project.walls[0].id)).toBe(true);
  });

  it('retains automatic detector IDs containing colons',()=>{
    const project=createDemoProject();
    project.walls[0].id='auto-wall:segment-1';
    project.artworks[0].wallId='auto-wall:segment-1';
    const snapshot=createPublicShare(project,{includeDimensions:false}).snapshot;
    expect(snapshot.walls[0].id).toBe('auto-wall:segment-1');
  });

  it('preserves validated artwork rotation in a public snapshot',()=>{
    const project=createDemoProject();
    project.artworks[0].rotationDeg=30;
    const snapshot=createPublicShare(project,{includeDimensions:false}).snapshot;
    expect(snapshot.artworks[0].rotationDeg).toBe(30);
    expect(parsePublicShare(snapshot).artworks[0].rotationDeg).toBe(30);
    expect(()=>parsePublicShare({...snapshot,artworks:[{...snapshot.artworks[0],rotationDeg:Infinity},...snapshot.artworks.slice(1)]})).toThrow(/치수/);
  });

  it('keeps an elevation measurement attached only to its public wall',()=>{
    const project=createDemoProject();
    const wallId=project.walls[0].id;
    project.dimensions=[{id:'dimension-1',view:'elevation',elevationWallId:wallId,start:{kind:'fixed',fallback:{x:0,y:0,z:0}},end:{kind:'fixed',fallback:{x:1000,y:0,z:0}},offsetMm:180}];
    const snapshot=createPublicShare(project,{includeDimensions:true}).snapshot;
    expect(snapshot.dimensions?.[0].elevationWallId).toBe(wallId);
    expect(()=>parsePublicShare({...snapshot,dimensions:[{...snapshot.dimensions?.[0],elevationWallId:'absent-wall'}]})).toThrow();
  });
});

it('preserves only validated perspective camera fields in public snapshots',()=>{
  const result=createPublicShare(createDemoProject(),{includeDimensions:false,camera:{projection:'perspective',fov:50,position:[0,1.6,0],target:[0,1.6,-3],zoom:1}});
  expect(parsePublicShare(result.snapshot).camera?.projection).toBe('perspective');
  expect(()=>parsePublicShare({...result.snapshot,camera:{...result.snapshot.camera,fov:180}})).toThrow();
});
