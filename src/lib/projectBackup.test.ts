import {afterEach,expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {exportProjectPackage} from './projectPackage';
import {readProjectBackup} from './projectBackup';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
async function backup(){const project=createDemoProject();project.artworks=project.artworks.slice(0,1).map(a=>({...a,imageUrl:png}));return {project,file:new File([await exportProjectPackage(project,async()=>png)],'test.gonggan.zip')};}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('decodes restored images and refuses images beyond the browser pixel budget',async()=>{
 const {project,file}=await backup();const sources:string[]=[];let width=1;
 vi.stubGlobal('Image',class {naturalWidth=width;naturalHeight=1;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){sources.push(value);if(value)queueMicrotask(()=>this.onload?.());}});
 expect(await readProjectBackup(file)).toEqual(project);expect(sources).toEqual([png]);
 width=60_000_001;await expect(readProjectBackup(file)).rejects.toThrow(/픽셀/);
});
it('times out a stalled image decode and allows a subsequent retry',async()=>{
 const {project,file}=await backup();let succeed=false;
 vi.stubGlobal('Image',class {naturalWidth=1;naturalHeight=1;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){if(value&&succeed)Promise.resolve().then(()=>this.onload?.());}});
 // ZIP and hashing use real asynchronous scheduling; start fake time only for the image stage.
 let ready:()=>void=()=>{};const imageStage=new Promise<void>(resolve=>{ready=resolve;});
 const result=readProjectBackup(file,message=>{if(message.startsWith('이미지 확인')){vi.useFakeTimers();ready();}});
 const rejected=expect(result).rejects.toThrow(/이미지/);
 await imageStage;await vi.advanceTimersByTimeAsync(15000);await rejected;
 vi.useRealTimers();succeed=true;expect(await readProjectBackup(file)).toEqual(project);
});
