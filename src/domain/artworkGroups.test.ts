import {describe,it,expect} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {groupArtworks,ungroupArtworks,patchGroupedArtwork,artworkGroupMembers} from './artworkGroups';

function fixture(){const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map((a,i)=>({...a,wallId:p.walls[0].id,alongMm:1400+i*1500,centerHeightMm:1500}));return p;}
describe('artwork groups',()=>{
  it('requires two unlocked artworks on one wall face',()=>{
    const p=fixture();expect(()=>groupArtworks(p,[p.artworks[0].id])).toThrow();
    expect(()=>groupArtworks({...p,artworks:p.artworks.map((a,i)=>({...a,wallSide:i?'back':'front'}))},p.artworks.map(a=>a.id))).toThrow(/같은/);
    expect(()=>groupArtworks({...p,artworks:p.artworks.map((a,i)=>({...a,locked:!!i}))},p.artworks.map(a=>a.id))).toThrow(/잠긴/);
  });
  it('moves all members by the same delta and keeps spacing at the wall edge',()=>{
    const p=fixture(),g=groupArtworks(p,p.artworks.map(a=>a.id));
    expect(artworkGroupMembers(g,p.artworks[1].id)).toHaveLength(2);
    const moved=patchGroupedArtwork(g,p.artworks[0].id,{alongMm:100,centerHeightMm:100},true);
    expect(moved.artworks[1].alongMm-moved.artworks[0].alongMm).toBe(1500);
    expect(moved.artworks.every(a=>a.alongMm>=a.widthMm/2&&a.centerHeightMm>=a.heightMm/2)).toBe(true);
    expect(ungroupArtworks(g,[p.artworks[0].id]).artworks.every(a=>!a.groupId)).toBe(true);
  });
  it('moves the group to another face, preserves JSON, and rejects a locked member atomically',()=>{
    const p=fixture(),g=groupArtworks(p,p.artworks.map(a=>a.id));
    const moved=patchGroupedArtwork(g,p.artworks[1].id,{wallId:p.walls[1].id,wallSide:'back',alongMm:3500});
    expect(moved.artworks.every(a=>a.wallId===p.walls[1].id&&a.wallSide==='back')).toBe(true);
    expect(parseProject(JSON.parse(JSON.stringify(moved))).artworks[0].groupId).toBe(g.artworks[0].groupId);
    expect(()=>patchGroupedArtwork({...g,artworks:g.artworks.map((a,i)=>({...a,locked:!!i}))},p.artworks[0].id,{alongMm:2000})).toThrow(/잠긴/);
    expect(g.artworks[0].alongMm).toBe(1400);
    expect(()=>parseProject({...g,artworks:g.artworks.map((a,i)=>i?{...a,wallSide:'back'}:a)})).toThrow(/같은/);
    expect(()=>parseProject({...g,artworks:g.artworks.map((a,i)=>i?a:{...a,groupId:123})})).toThrow(/그룹/);
    const small={...g,walls:g.walls.map((w,i)=>i?w:{...w,end:{x:w.start.x+1000,z:w.start.z}})};
    expect(()=>patchGroupedArtwork(small,p.artworks[0].id,{alongMm:100},true)).toThrow(/큽니다/);
  });
});
