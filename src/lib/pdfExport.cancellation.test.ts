import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Texture} from 'three';
import {createDemoProject} from '../domain/model';
import {exportProjectPdf} from './pdfExport';
import {artworkTexture} from './modelExport';
import {renderPdf3d} from './pdfRender3d';
import {buildExhibitionPdf} from './pdfDocument';
import {queueTemporaryRender} from './temporaryRenderQueue';
vi.mock('./modelExport',()=>({artworkTexture:vi.fn()}));
vi.mock('./pdfRender3d',()=>({renderPdf3d:vi.fn()}));
vi.mock('./pdfDocument',()=>({buildExhibitionPdf:vi.fn()}));
const options={current:true,sceneIds:[],threeD:false,plan:true,elevation:false,allWallFaces:false,includeSchedule:false};
let releases:Array<()=>void>=[];
function gate<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
beforeEach(()=>{vi.resetAllMocks();releases=[];vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array([1,2,3]))));vi.mocked(buildExhibitionPdf).mockResolvedValue(new Uint8Array([37,80,68,70]));vi.mocked(renderPdf3d).mockResolvedValue(new Uint8Array([1]));});
afterEach(()=>{for(const release of releases)release();vi.unstubAllGlobals();vi.restoreAllMocks();});
function project(){return {...createDemoProject(),artworks:[],scenes:[]};}
it('does no work for a signal canceled before PDF creation',async()=>{const c=new AbortController();c.abort();await expect(exportProjectPdf(project(),options,undefined,()=>{},c.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetch).not.toHaveBeenCalled();expect(buildExhibitionPdf).not.toHaveBeenCalled();});
it('aborts the actual font request rather than replacing cancellation with a font error',async()=>{
 const c=new AbortController();let fontSignal:AbortSignal|undefined;vi.mocked(fetch).mockImplementationOnce(async(_input,init)=>new Promise((_resolve,reject)=>{fontSignal=init?.signal as AbortSignal;fontSignal.addEventListener('abort',()=>reject(fontSignal!.reason),{once:true});}));const result=exportProjectPdf(project(),options,undefined,()=>{},c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(fontSignal).toBeDefined());c.abort();await check;expect(fontSignal!.aborted).toBe(true);expect(buildExhibitionPdf).not.toHaveBeenCalled();
});
it('disposes an image decoded after cancellation and does not encode it or load the next image',async()=>{
 const c=new AbortController(),p=createDemoProject(),g=gate<Texture>(),texture=new Texture(),encode=vi.fn(),dispose=vi.spyOn(texture,'dispose');texture.image={toDataURL:encode};releases.push(()=>g.resolve(texture));vi.mocked(artworkTexture).mockImplementationOnce(()=>g.promise);const result=exportProjectPdf(p,{...options,elevation:true},undefined,()=>{},c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(artworkTexture).toHaveBeenCalledTimes(1));c.abort();g.resolve(texture);await check;expect(dispose).toHaveBeenCalledTimes(1);expect(encode).not.toHaveBeenCalled();expect(artworkTexture).toHaveBeenCalledTimes(1);expect(buildExhibitionPdf).not.toHaveBeenCalled();
});
it('does not build the document when canceled at the last progress checkpoint',async()=>{const c=new AbortController();await expect(exportProjectPdf(project(),options,undefined,message=>{if(message.startsWith('평면·벽면도'))c.abort();},c.signal)).rejects.toMatchObject({name:'AbortError'});expect(buildExhibitionPdf).not.toHaveBeenCalled();});
it('skips a canceled GPU job waiting behind an existing renderer',async()=>{
 const c=new AbortController(),g=gate<void>(),entered=gate<void>();releases.push(()=>g.resolve());const previous=queueTemporaryRender(new AbortController().signal,()=>g.promise);const result=exportProjectPdf(project(),{...options,threeD:true},undefined,message=>{if(message.includes('3D 이미지'))entered.resolve();},c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await entered.promise;c.abort();g.resolve();await previous;await check;expect(renderPdf3d).not.toHaveBeenCalled();expect(buildExhibitionPdf).not.toHaveBeenCalled();
});
it('waits for a canceled in-flight renderer to settle before a replacement can render',async()=>{
 const c=new AbortController(),g=gate<Uint8Array>();releases.push(()=>g.resolve(new Uint8Array([1])));vi.mocked(renderPdf3d).mockImplementationOnce(()=>g.promise);const first=exportProjectPdf(project(),{...options,threeD:true},undefined,()=>{},c.signal),check=expect(first).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(renderPdf3d).toHaveBeenCalledTimes(1));expect(vi.mocked(renderPdf3d).mock.calls[0][3]).toBe(c.signal);c.abort();const second=exportProjectPdf(project(),{...options,threeD:true},undefined);await new Promise(r=>setTimeout(r,0));expect(renderPdf3d).toHaveBeenCalledTimes(1);g.resolve(new Uint8Array([1]));await check;expect(await second).toBeInstanceOf(Blob);expect(renderPdf3d).toHaveBeenCalledTimes(2);expect(buildExhibitionPdf).toHaveBeenCalledTimes(1);
});
it('does not deliver a document completed after cancellation',async()=>{
 const c=new AbortController(),g=gate<Uint8Array>();releases.push(()=>g.resolve(new Uint8Array([1])));vi.mocked(buildExhibitionPdf).mockImplementationOnce(()=>g.promise);const result=exportProjectPdf(project(),options,undefined,()=>{},c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(buildExhibitionPdf).toHaveBeenCalledTimes(1));c.abort();g.resolve(new Uint8Array([1]));await check;
});
