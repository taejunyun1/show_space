import {expect,it,vi} from 'vitest';
import {createDemoProject} from '../domain/model';
import {exportProjectPackage} from './projectPackage';
import {readCloudHistoryProject} from './cloudHistoryActions';
import type {createCloudHistoryClient} from './cloudHistoryClient';

it('checks the scope before requesting a version file',async()=>{
 const read=vi.fn(),history={read} as unknown as ReturnType<typeof createCloudHistoryClient>;
 await expect(readCloudHistoryProject(history,crypto.randomUUID(),crypto.randomUUID(),vi.fn(),()=>{throw new Error('retired scope');})).rejects.toThrow('retired scope');expect(read).not.toHaveBeenCalled();
});
it('does not decode or verify a late version after scope retirement',async()=>{
 let live=true;const verify=vi.fn(),history={read:async()=>{live=false;return {bytes:new ArrayBuffer(1),summary:{}};}} as unknown as ReturnType<typeof createCloudHistoryClient>;
 await expect(readCloudHistoryProject(history,crypto.randomUUID(),crypto.randomUUID(),verify,()=>{if(!live)throw new Error('retired scope');})).rejects.toThrow('retired scope');expect(verify).not.toHaveBeenCalled();
});
it('rechecks scope after image verification instead of returning a retired project',async()=>{
 const project={...createDemoProject(),artworks:[]},bytes=await (await exportProjectPackage(project,async()=>{throw new Error('Unexpected asset');})).arrayBuffer();let live=true;
 const history={read:async()=>({bytes,summary:{sourceProjectId:project.id,name:project.name,venue:project.venue}})} as unknown as ReturnType<typeof createCloudHistoryClient>;
 await expect(readCloudHistoryProject(history,crypto.randomUUID(),crypto.randomUUID(),async()=>{live=false;},()=>{if(!live)throw new Error('retired scope');})).rejects.toThrow('retired scope');
});
