import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {BoxGeometry,Mesh,MeshStandardMaterial,Scene,Texture,WebGLRenderer} from 'three';
import {createDemoProject} from '../domain/model';
import {renderPdf3d} from './pdfRender3d';
import {prepareExportScene} from './modelExport';
import {prepareProjectorMaps} from './projectorLighting';
vi.mock('three',async original=>({...await original<typeof import('three')>(),WebGLRenderer:vi.fn()}));
vi.mock('./modelExport',()=>({prepareExportScene:vi.fn()}));
vi.mock('./projectorLighting',async original=>({...await original<typeof import('./projectorLighting')>(),prepareProjectorMaps:vi.fn()}));
vi.mock('./surfaceEnvironment',()=>({needsSurfaceEnvironment:()=>false}));
let releases:Array<()=>void>=[];
function gate<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
function scene(){const map=new Texture(),geometry=new BoxGeometry(1,1,1),material=new MeshStandardMaterial({map}),value=new Scene();value.add(new Mesh(geometry,material));return {value,dispose:[vi.spyOn(map,'dispose'),vi.spyOn(geometry,'dispose'),vi.spyOn(material,'dispose')]};}
function section(){return {project:{...createDemoProject(),artworks:[]},name:'취소 검증',kind:'3d' as const,current:true};}
beforeEach(()=>{vi.resetAllMocks();releases=[];vi.mocked(prepareProjectorMaps).mockResolvedValue(()=>{});});
afterEach(()=>{for(const release of releases)release();vi.restoreAllMocks();});
it('disposes a scene loaded after cancellation before creating a GPU renderer',async()=>{
 const c=new AbortController(),s=scene(),g=gate<Scene>();releases.push(()=>g.resolve(s.value));vi.mocked(prepareExportScene).mockImplementationOnce(()=>g.promise);const result=renderPdf3d(section(),undefined,1920,c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});c.abort();g.resolve(s.value);await check;for(const dispose of s.dispose)expect(dispose).toHaveBeenCalledTimes(1);expect(WebGLRenderer).not.toHaveBeenCalled();
});
it('releases projection maps loaded after cancellation and does not create a renderer',async()=>{
 const c=new AbortController(),s=scene(),g=gate<()=>void>(),disposeMaps=vi.fn();releases.push(()=>g.resolve(disposeMaps));vi.mocked(prepareExportScene).mockResolvedValue(s.value);vi.mocked(prepareProjectorMaps).mockImplementationOnce(()=>g.promise);const result=renderPdf3d(section(),undefined,1920,c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(prepareProjectorMaps).toHaveBeenCalled());c.abort();g.resolve(disposeMaps);await check;expect(disposeMaps).toHaveBeenCalledTimes(1);for(const dispose of s.dispose)expect(dispose).toHaveBeenCalledTimes(1);expect(WebGLRenderer).not.toHaveBeenCalled();
});
it('disposes renderer/context and scene after a canceled PNG encode finally settles',async()=>{
 const c=new AbortController(),s=scene(),disposeMaps=vi.fn(),dispose=vi.fn(),forceContextLoss=vi.fn();let encode:((blob:Blob|null)=>void)|undefined;vi.mocked(prepareExportScene).mockResolvedValue(s.value);vi.mocked(prepareProjectorMaps).mockResolvedValue(disposeMaps);vi.mocked(WebGLRenderer).mockImplementation(function(){return {shadowMap:{},setSize:vi.fn(),setPixelRatio:vi.fn(),render:vi.fn(),dispose,forceContextLoss,domElement:{toBlob(callback:(blob:Blob|null)=>void){encode=callback;}}} as unknown as WebGLRenderer;});
 const result=renderPdf3d(section(),undefined,1920,c.signal),check=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.waitFor(()=>expect(encode).toBeDefined());c.abort();expect(dispose).not.toHaveBeenCalled();encode!(new Blob(['encoded PNG']));await check;expect(dispose).toHaveBeenCalledTimes(1);expect(forceContextLoss).toHaveBeenCalledTimes(1);expect(disposeMaps).toHaveBeenCalledTimes(1);for(const dispose of s.dispose)expect(dispose).toHaveBeenCalledTimes(1);
});
