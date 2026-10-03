import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {addModelArtwork} from './modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {artworkTemplate,parseArtworkTemplate,installArtworkTemplate} from './artworkLibrary';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
it('keeps artwork design but excludes project-specific anchors, identity and notes',()=>{
 const a={...createDemoProject().artworks[0],imageUrl:png,year:'2026',medium:'사진',description:'작품 설명',artworkType:'photo' as const,presentationType:'framed-print' as const,frameSettings:{widthMm:30,depthMm:70,material:'metal' as const,matWidthMm:60,matColor:'#f5f4ef',cover:'glass' as const},locked:true,visible:false,groupId:'group-1',note:'PRIVATE_INSTALL',rotationDeg:35};
 const t=artworkTemplate('image',a);expect(t.artwork).toMatchObject({name:a.name,year:'2026',widthMm:900,frameSettings:a.frameSettings});expect(JSON.stringify(t)).not.toMatch(/PRIVATE_INSTALL|wallId|alongMm|centerHeightMm|rotationDeg|groupId|locked|visible|note/);
 const p=createDemoProject(),result=installArtworkTemplate(p,t,'wall-b');expect(result.selection.type).toBe('artwork');const placed=result.project.artworks.at(-1)!;
 expect(placed).toMatchObject({wallId:'wall-b',widthMm:900,centerHeightMm:1500,frameSettings:a.frameSettings,note:'',locked:false,visible:true});expect(placed.id).not.toBe(a.id);expect(placed.alongMm).toBe(540);expect(p.artworks).toHaveLength(5);
 placed.frameSettings!.matWidthMm=12;expect(t.artwork.frameSettings?.matWidthMm).toBe(60);
});
it('reuses 3D geometry and physical dimensions, resetting the instance pose',()=>{
 const a=addModelArtwork(createDemoProject(),testArtworkModel()).artwork;a.position={x:500,y:700,z:900};a.rotation={x:10,y:20,z:30};a.widthMm=450;a.note='PRIVATE';a.locked=true;a.groupId='g';
 const t=artworkTemplate('model',a),result=installArtworkTemplate(createDemoProject(),t);const copy=result.project.modelArtworks![0];expect(copy.model).toEqual(a.model);expect(copy.widthMm).toBe(450);expect(copy.position).toEqual({x:0,y:0,z:0});expect(copy.rotation).toEqual({x:0,y:0,z:0});expect(copy.note).toBe('');expect(JSON.stringify(t)).not.toMatch(/PRIVATE|groupId|position|rotation|locked/);
});
it('rejects malformed media, dimensions, enums and uncalibrated placements',()=>{
 const a={...createDemoProject().artworks[0],imageUrl:png},t=artworkTemplate('image',a);
 for(const patch of [{widthMm:0},{frame:'bad'},{imageUrl:'https://example.org/x.png'},{imageUrl:'data:image/png;base64,YmFk'},{artworkType:'bad'}])expect(()=>parseArtworkTemplate({kind:'image',artwork:{...t.artwork,...patch}})).toThrow();
 const p=createDemoProject();p.planDraft={kind:'partial',sourceEvidenceHash:'x',originalWalls:p.walls};expect(()=>installArtworkTemplate(p,t)).toThrow('축척');expect(()=>installArtworkTemplate(createDemoProject(),t,'missing')).toThrow('벽');
});
