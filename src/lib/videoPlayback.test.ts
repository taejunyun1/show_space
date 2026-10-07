import {expect,it,vi} from 'vitest';
import {createVideoPlaybackRuntime} from './videoPlayback';
const media={dataUrl:'data:video/mp4;base64,'+btoa(String.fromCharCode(0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0)),widthPx:640,heightPx:360,durationSeconds:3,loop:true,fit:'contain' as const};
class FakeVideo extends EventTarget{
 paused=true;readyState=2;currentTime=0;duration=3;videoWidth=640;videoHeight=360;muted=false;loop=false;src='';preload='';playsInline=false;controls=false;
 async play(){this.paused=false;this.dispatchEvent(new Event('play'));}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){}removeAttribute(){this.src='';}setAttribute(){}
}
function fixture(maxSessions=8,maxPlaying=4){const made:FakeVideo[]=[],revoke=vi.fn();const runtime=createVideoPlaybackRuntime({createVideo:()=>{const v=new FakeVideo();made.push(v);return v as unknown as HTMLVideoElement;},createUrl:()=>`blob:test-${made.length}`,revokeUrl:revoke,maxSessions,maxPlaying});return {runtime,made,revoke};}
it('shares one decoder between inspector and 3D leases and releases its URL after the final surface disappears',()=>{
 const {runtime,made,revoke}=fixture(),a=runtime.open('scene:art',media),b=runtime.open('scene:art',media),surface=runtime.retain(a.session,'surface');expect(made).toHaveLength(1);expect(a.session.video.muted).toBe(true);expect(a.session.video.loop).toBe(true);
 a.release();b.release();expect(runtime.get('scene:art')).toBe(a.session);surface();expect(runtime.get('scene:art')).toBeUndefined();expect(revoke).toHaveBeenCalledTimes(1);surface();expect(revoke).toHaveBeenCalledTimes(1);
});
it('bounds simultaneous playback even when native controls start the new clip',async()=>{
 const {runtime}=fixture(8,2),a=runtime.open('a',media),b=runtime.open('b',media),c=runtime.open('c',media);await a.session.play();await b.session.play();await c.session.video.play();expect(a.session.video.paused).toBe(true);expect(b.session.video.paused).toBe(false);expect(c.session.video.paused).toBe(false);a.release();b.release();c.release();
});
it('evicts a paused background surface under decoder pressure and preserves the active inspector',()=>{
 const {runtime,revoke}=fixture(2),a=runtime.open('a',media),surface=runtime.retain(a.session,'surface');a.release();const b=runtime.open('b',media),c=runtime.open('c',media);expect(a.session.closed).toBe(true);expect(runtime.get('a')).toBeUndefined();expect(revoke).toHaveBeenCalledTimes(1);expect(()=>runtime.open('d',media)).toThrow();surface();b.release();c.release();
});
it('replaces a changed source without letting an old lease destroy its replacement',()=>{
 const next='data:video/mp4;base64,'+btoa(String.fromCharCode(0,0,0,16,102,116,121,112,109,112,52,50,0,0,0,0));
 const {runtime,revoke}=fixture(),a=runtime.open('a',media),b=runtime.open('a',{...media,dataUrl:next});expect(a.session.closed).toBe(true);a.release();expect(runtime.get('a')).toBe(b.session);expect(revoke).toHaveBeenCalledTimes(1);b.release();expect(revoke).toHaveBeenCalledTimes(2);
});
it('reports playback rejection and real metadata mismatches, and clamps seeking without mutating project data',async()=>{
 const {runtime,made}=fixture(),a=runtime.open('a',media);made[0].play=async()=>{throw new Error('browser policy');};await expect(a.session.play()).rejects.toThrow();expect(a.session.snapshot.error).toContain('재생');a.session.seek(999);expect(a.session.video.currentTime).toBe(3);expect(media).not.toHaveProperty('currentTime');made[0].videoWidth=1280;made[0].dispatchEvent(new Event('loadedmetadata'));expect(a.session.snapshot.ready).toBe(false);expect(a.session.snapshot.error).toContain('원본');a.release();
});
