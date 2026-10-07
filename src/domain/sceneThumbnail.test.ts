import {expect,it} from 'vitest';
import {parseSceneThumbnail,SCENE_THUMBNAIL_MAX_BYTES} from './sceneThumbnail';
import {createDemoProject,parseProject} from './model';
import {appendSceneSnapshot} from './sceneSnapshot';
import {createPublicShare} from './publicShare';
export const preview={imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthPx:1,heightPx:1,view:'3d' as const};
it('supports old scenes and preserves bounded previews through JSON without publishing them',()=>{
 const p=createDemoProject(),old=appendSceneSnapshot(p,p,'旧 Scene'),next=appendSceneSnapshot(old,p,'Preview',undefined,preview);
 expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);expect(next.scenes[0].thumbnail).toBeUndefined();
 const shared=createPublicShare(next,{sceneIds:[next.scenes[1].id],includeDimensions:false});
 expect(JSON.stringify(shared)).not.toContain(preview.imageUrl);expect(JSON.stringify(shared)).not.toContain('thumbnail');
});
it('rejects remote, invalid MIME, malformed, oversized and mismatched image dimensions before load',()=>{
 for(const patch of [{imageUrl:'https://example.com/image.png'},{imageUrl:'data:image/svg+xml;base64,PHN2Zy8+'},{imageUrl:'data:image/png;base64,AQIDBA=='},{widthPx:2},{view:'unknown'},{imageUrl:'data:image/png;base64,'+'A'.repeat(SCENE_THUMBNAIL_MAX_BYTES*2)}])expect(()=>parseSceneThumbnail({...preview,...patch})).toThrow();
 const bytes=Uint8Array.from(atob(preview.imageUrl.split(',')[1]),c=>c.charCodeAt(0));new DataView(bytes.buffer).setUint32(16,20000);
 expect(()=>parseSceneThumbnail({...preview,widthPx:20000,imageUrl:'data:image/png;base64,'+btoa(String.fromCharCode(...bytes))})).toThrow(/320px/);
 const p=createDemoProject(),invalid=appendSceneSnapshot(p,p,'Scene',undefined,preview);invalid.scenes[0].thumbnail!.heightPx=320;
 expect(()=>parseProject(invalid)).toThrow(/크기/);
});
