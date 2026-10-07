import {afterEach,expect,it,vi} from 'vitest';
import {readVideoArtworkFile,verifyVideoArtwork} from './videoArtworkImport';
const bytes=new Uint8Array([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
const source=`data:video/mp4;base64,${btoa(String.fromCharCode(...bytes))}`;
const media={dataUrl:source,widthPx:640,heightPx:360,durationSeconds:4,loop:true,fit:'contain' as const};
class Video {
 preload='';muted=false;playsInline=false;src='';videoWidth=640;videoHeight=360;duration=4;
 onloadedmetadata:null|(()=>void)=null;onloadeddata:null|(()=>void)=null;onseeked:null|(()=>void)=null;onerror:null|(()=>void)=null;
 set currentTime(_seconds:number){queueMicrotask(()=>this.onseeked?.());}
 pause=vi.fn();removeAttribute=vi.fn(()=>this.src='');load=vi.fn(()=>{if(!this.src)return;queueMicrotask(()=>{this.onloadedmetadata?.();if(this.src)this.onloadeddata?.();});});
}
function browser(video=new Video()){
 const revoke=vi.fn(),canvas={width:0,height:0,getContext:()=>({drawImage:vi.fn()}),toDataURL:()=> 'data:image/jpeg;base64,/9j/'};
 vi.stubGlobal('document',{createElement:(kind:string)=>kind==='video'?video:canvas});vi.stubGlobal('URL',{createObjectURL:()=> 'blob:owned-video',revokeObjectURL:revoke});return {video,revoke};
}
afterEach(()=>vi.unstubAllGlobals());
it('keeps exact video bytes and aspect ratio and releases decoder and URL after poster generation',async()=>{
 const {video,revoke}=browser(),result=await readVideoArtworkFile(new File([bytes],'moving.mp4'));
 expect(result.artwork.video).toEqual(media);expect(result.artwork.heightMm).toBe(675);expect(result.artwork.artworkType).toBe('video');expect(result.artwork.presentationType).toBe('screen');expect(video.pause).toHaveBeenCalled();expect(video.src).toBe('');expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned-video');
});
it('rejects actual oversized metadata before permitting a decoded frame and cleans resources',async()=>{
 const v=new Video();v.videoWidth=4096;v.videoHeight=2160;const {revoke}=browser(v);
 await expect(readVideoArtworkFile(new File([bytes],'huge.mp4'))).rejects.toThrow(/1,920/);expect(v.preload).toBe('metadata');expect(v.src).toBe('');expect(revoke).toHaveBeenCalledTimes(1);
});
it('rejects forged stored dimensions and duration using the actual decoder metadata',async()=>{
 const {revoke}=browser();await expect(verifyVideoArtwork({...media,widthPx:1280})).rejects.toThrow(/원본/);expect(revoke).toHaveBeenCalledTimes(1);
 browser();await expect(verifyVideoArtwork({...media,durationSeconds:5})).rejects.toThrow(/원본/);
});
it('does not allocate a decoder for non-video files or mismatched container bytes',async()=>{
 const create=vi.fn();vi.stubGlobal('document',{createElement:create});await expect(readVideoArtworkFile(new File([bytes],'renamed.jpg'))).rejects.toThrow(/MP4/);await expect(readVideoArtworkFile(new File(['invalid'],'renamed.mp4'))).rejects.toThrow(/형식/);expect(create).not.toHaveBeenCalled();
});
