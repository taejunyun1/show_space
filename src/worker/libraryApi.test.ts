import {expect,it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {libraryApiFixture,ownerA} from './libraryApi.fixture';
import {createCloudLibraryClient} from '../lib/cloudLibraryClient';
import {createCloudLibrarySync,LibraryConflictError} from '../lib/cloudLibrarySync';
import {createArtworkLibrary} from '../lib/artworkLibrary';
import {createMaterialLibrary} from '../lib/materialLibrary';
import {createLibraryLinks} from '../lib/cloudLibraryLinks';
import {artworkTemplate} from '../domain/artworkLibrary';
import {createDemoProject} from '../domain/model';
import {builtinMaterials} from '../domain/materialLibrary';
import {libraryMetadata,type CloudLibraryDocument} from '../domain/cloudLibrary';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const artwork=()=>({template:artworkTemplate('image',{...createDemoProject().artworks[0],imageUrl:png,material:{...builtinMaterials[0].material,normal:{imageUrl:png,widthMm:400,heightMm:200,strength:2}},note:'private'}),thumbnail:png});
const material=()=>({...structuredClone(builtinMaterials[0]),name:'결 · 노멀',material:{...builtinMaterials[0].material,texture:{imageUrl:png,widthMm:800,heightMm:400},normal:{imageUrl:png,widthMm:200,heightMm:100,strength:1.5}}});
const document=():CloudLibraryDocument=>({format:'gonggan-library-item',version:1,kind:'material',template:material(),thumbnail:png});
function device(client:ReturnType<typeof createCloudLibraryClient>,f=new IDBFactory(),links=createLibraryLinks(f)){
 const repositories={artwork:createArtworkLibrary(f),material:createMaterialLibrary(f)};
 // Node verifies schema and payload hashes; actual image/GLB decoding is tested in the browser.
 return {repositories,links,sync:createCloudLibrarySync(ownerA,client,{repositories,links,validate:async()=>{}})};
}
async function seed(){const s=libraryApiFixture(),client=createCloudLibraryClient('test-a',s.bridge),d=device(client),a=await d.repositories.artwork.add(artwork()),m=await d.repositories.material.add(material(),png);return {...s,client,d,a,m};}
it('round-trips individual artwork and textured/normal materials to a second device, without private placement or duplicate imports',async()=>{
 const s=await seed(),a=await s.d.sync.push('artwork',s.a.id),m=await s.d.sync.push('material',s.m.id),second=device(s.client);
 const aa=await second.sync.pull('artwork',a.id),mm=await second.sync.pull('material',m.id);expect((await second.repositories.artwork.read(aa.localId))!.template).toEqual(artwork().template);expect((await second.repositories.material.read(mm.localId))!.template).toEqual(material());expect(artwork().template.artwork).not.toHaveProperty('note');
 expect((await second.sync.pull('artwork',a.id)).unchanged).toBe(true);expect(await second.repositories.artwork.list()).toHaveLength(1);expect(await second.repositories.material.list()).toHaveLength(1);expect(await s.client.list('material')).toHaveLength(1);
 const connection=device(s.client,new IDBFactory());expect(connection.repositories).not.toBe(second.repositories);
});
it('updates the same linked local ID with a new remote revision, preserving local-only sibling items',async()=>{
 const s=await seed(),a=await s.d.sync.push('artwork',s.a.id),second=device(s.client),imported=await second.sync.pull('artwork',a.id);const sibling=await second.repositories.artwork.add(artwork());
 await s.d.repositories.artwork.replace(s.a.id,{...artwork(),template:{...artwork().template,artwork:{...artwork().template.artwork,name:'새 이름'}},archived:false},1);
 const saved=await s.d.sync.push('artwork',s.a.id);expect(saved.revision).toBe(2);expect((await second.sync.pull('artwork',a.id)).localId).toBe(imported.localId);expect((await second.repositories.artwork.read(imported.localId))!.summary.name).toBe('새 이름');expect((await second.repositories.artwork.read(sibling.id))!.summary.revision).toBe(1);expect(await second.repositories.artwork.list()).toHaveLength(2);
});
it('refuses local/remote edit conflicts and allows an explicit fresh local copy with a new durable mapping',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),second=device(s.client),local=await second.sync.pull('material',m.id);
 await second.repositories.material.archive(local.localId,true,1);await s.d.repositories.material.replace(s.m.id,{template:{...material(),name:'다른 기기'},thumbnail:png,archived:false},1);await s.d.sync.push('material',s.m.id);
 await expect(second.sync.pull('material',m.id)).rejects.toBeInstanceOf(LibraryConflictError);expect((await second.repositories.material.read(local.localId))!.summary.archived).toBe(true);
 const copied=await second.sync.pull('material',m.id,true);expect(copied.localId).not.toBe(local.localId);expect(await second.repositories.material.list()).toHaveLength(2);expect(await second.links.local(ownerA,'material',local.localId)).toBeUndefined();expect((await second.links.remote(ownerA,'material',m.id))!.localId).toBe(copied.localId);await second.sync.pull('material',m.id);expect(await second.repositories.material.list()).toHaveLength(2);
});
it('preserves local changes when unchanged remote bytes are pulled, and rejects stale device pushes',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),second=device(s.client),local=await second.sync.pull('material',m.id);await second.repositories.material.archive(local.localId,true,1);
 await expect(second.sync.pull('material',m.id)).rejects.toThrow('로컬');await s.d.repositories.material.archive(s.m.id,true,1);await s.d.sync.push('material',s.m.id);
 await expect(second.sync.push('material',local.localId)).rejects.toMatchObject({status:409});expect((await second.repositories.material.read(local.localId))!.summary.archived).toBe(true);
});
it('reconciles lost network/D1 responses without creating another cloud record or acknowledging a different payload',async()=>{
 const s=await seed();s.db.throwAfterLibrary=true;const m=await s.d.sync.push('material',s.m.id);expect(m.revision).toBe(1);expect(await s.client.list('material')).toHaveLength(1);
 let lose=true;const client=createCloudLibraryClient('test-a',async(path,init)=>{const r=await s.bridge(path,init);if(init?.method==='PUT'&&lose){lose=false;throw new Error('network lost');}return r;});const d=device(client),a=await d.repositories.artwork.add(artwork());await d.sync.push('artwork',a.id);expect(await client.list('artwork')).toHaveLength(1);
});
it('recovers the first push/import and a local replace whose link acknowledgement was lost',async()=>{
 const s=await seed(),f=new IDBFactory(),base=createLibraryLinks(f);let fail=true;const links={...base,save:async(...args:Parameters<typeof base.save>)=>{if(fail){fail=false;throw new Error('link failed');}return base.save(...args);}};
 const d=device(s.client,f,links),m=await d.repositories.material.add(material(),png);await expect(d.sync.push('material',m.id)).rejects.toThrow('link failed');expect((await d.sync.push('material',m.id)).revision).toBe(1);expect(await s.client.list('material')).toHaveLength(1);
 const secondFactory=new IDBFactory(),secondBase=createLibraryLinks(secondFactory);let failPull=true;const second=device(s.client,secondFactory,{...secondBase,save:async(...args:Parameters<typeof secondBase.save>)=>{if(failPull){failPull=false;throw new Error('ack failed');}return secondBase.save(...args);}}),remote=(await s.client.list('material'))[0];await expect(second.sync.pull('material',remote.id)).rejects.toThrow('ack failed');expect((await second.sync.pull('material',remote.id)).unchanged).toBe(true);expect(await second.repositories.material.list()).toHaveLength(1);
 await d.repositories.material.replace(m.id,{template:{...material(),name:'updated'},thumbnail:png,archived:false},1);await d.sync.push('material',m.id);failPull=true;await expect(second.sync.pull('material',remote.id)).rejects.toThrow('ack failed');await second.sync.pull('material',remote.id);expect(await second.repositories.material.list()).toHaveLength(1);
});
it('isolates list, file, metadata, saves and archive by authenticated account and kind',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),b=createCloudLibraryClient('test-b',s.bridge);expect(await b.list('material')).toEqual([]);
 for(const action of [()=>b.metadata('material',m.id),()=>b.read('material',m.id),()=>b.archive('material',m.id,1,true),()=>s.client.read('artwork',m.id)])await expect(action()).rejects.toMatchObject({status:404});
 const doc=document();await expect(b.save('material',m.id,0,new Blob([JSON.stringify(doc)]),libraryMetadata(doc,s.m.id,false))).rejects.toMatchObject({status:409});expect((await s.client.metadata('material',m.id)).revision).toBe(1);
 expect((await s.bridge('/api/libraries/material')).status).toBe(401);expect((await s.bridge('/api/libraries/material',{headers:{authorization:'Bearer test-a',origin:'https://evil.example'}})).status).toBe(403);
});
it('keeps private R2 assets and ignores metadata archive snapshots when reading current archive state',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),saved=await s.client.archive('material',m.id,1,true);expect(saved.archived).toBe(true);await expect(s.client.archive('material',m.id,1,false)).rejects.toMatchObject({status:409});const second=device(s.client),pulled=await second.sync.pull('material',m.id);expect((await second.repositories.material.read(pulled.localId))!.summary.archived).toBe(true);expect(s.bucket.files.size).toBe(1);
 await s.client.archive('material',m.id,2,false);await second.sync.pull('material',m.id);expect((await second.repositories.material.read(pulled.localId))!.summary.archived).toBe(false);
});
it('rejects corrupted assets, mismatched summaries and failed image verification before local writes',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),second=device(s.client),key=String(s.db.sql.prepare('SELECT snapshot_key FROM cloud_library WHERE id = ?').get(m.id)!.snapshot_key),bytes=s.bucket.files.get(key)!;bytes[30]^=1;await expect(second.sync.pull('material',m.id)).rejects.toThrow('해시');bytes[30]^=1;
 s.db.sql.prepare('UPDATE cloud_library SET metadata = ? WHERE id = ?').run(JSON.stringify({...libraryMetadata(document(),s.m.id,false),name:'wrong'}),m.id);await expect(second.sync.pull('material',m.id)).rejects.toThrow('정보');expect(await second.repositories.material.list()).toEqual([]);
 s.db.sql.prepare('UPDATE cloud_library SET metadata = ? WHERE id = ?').run(JSON.stringify(libraryMetadata(document(),s.m.id,false)),m.id);const guarded=createCloudLibrarySync(ownerA,s.client,{repositories:second.repositories,links:second.links,validate:async()=>{throw new Error('decode failed');}});await expect(guarded.pull('material',m.id)).rejects.toThrow('decode');expect(await second.repositories.material.list()).toEqual([]);
});
it('prevents account switches and changed local revisions while assets are being prepared',async()=>{
 const s=await seed();let changed=false;const guarded=createCloudLibrarySync(ownerA,s.client,{repositories:s.d.repositories,links:s.d.links,validate:async()=>{changed=true;},guard:()=>{if(changed)throw new Error('account changed');}});await expect(guarded.push('material',s.m.id)).rejects.toThrow('account changed');expect(await s.client.list('material')).toEqual([]);
 const race=createCloudLibrarySync(ownerA,s.client,{repositories:s.d.repositories,links:s.d.links,validate:async()=>{await s.d.repositories.material.archive(s.m.id,true,1);}});await expect(race.push('material',s.m.id)).rejects.toThrow('로컬');expect(await s.client.list('material')).toEqual([]);
});
it('enforces count at concurrent publication and total account bytes across both libraries',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id);for(let i=1;i<199;i++)s.db.sql.prepare('INSERT INTO cloud_library SELECT ?,owner_id,kind,metadata,archived,revision,?,snapshot_sha256,snapshot_bytes,created_at,updated_at FROM cloud_library LIMIT 1').run(crypto.randomUUID(),'unused/'+i);
 let n=0,release!:()=>void;const barrier=new Promise<void>(r=>{release=r;});s.bucket.beforePut=async()=>{if(++n===2)release();await barrier;};const doc=document(),blob=new Blob([JSON.stringify(doc)]),meta=libraryMetadata(doc,s.m.id,false);
 const results=await Promise.allSettled([0,1].map(()=>s.client.save('material',crypto.randomUUID(),0,blob,meta)));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await s.client.list('material')).toHaveLength(200);expect(s.bucket.files.size).toBe(2);s.bucket.beforePut=undefined;
 s.db.sql.prepare('UPDATE cloud_library SET snapshot_bytes = 16777216').run();await expect(s.d.sync.push('artwork',s.a.id)).rejects.toMatchObject({status:409});expect(await s.client.list('artwork')).toEqual([]);expect((await s.client.metadata('material',m.id)).revision).toBe(1);
});
it('rejects stale link remapping and local repository replacements without altering old assets',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),link=(await s.d.links.local(ownerA,'material',s.m.id))!;const newId=crypto.randomUUID();await expect(s.d.links.save({...link,localId:newId},0,null)).rejects.toThrow('다른 탭');expect((await s.d.links.remote(ownerA,'material',m.id))!.localId).toBe(s.m.id);
 await s.d.repositories.material.archive(s.m.id,true,1);await expect(s.d.repositories.material.replace(s.m.id,{template:{...material(),name:'lost'},archived:false},1)).rejects.toThrow('다른 탭');expect((await s.d.repositories.material.read(s.m.id))!.summary.name).toBe('결 · 노멀');
});

it('makes an explicit copy of an unchanged remote item after a local edit',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),second=device(s.client),local=await second.sync.pull('material',m.id);await second.repositories.material.archive(local.localId,true,1);const copy=await second.sync.pull('material',m.id,true);expect(copy.localId).not.toBe(local.localId);expect((await second.repositories.material.read(local.localId))!.summary.archived).toBe(true);expect((await second.repositories.material.read(copy.localId))!.summary.archived).toBe(false);expect(await second.repositories.material.list()).toHaveLength(2);
});
it('preserves the complete original GLB of a physical 3D artwork across account transfer',async()=>{
 const {testArtworkModel}=await import('../lib/modelArtworkTestFixture'),{addModelArtwork}=await import('../domain/modelArtworks');const s=libraryApiFixture(),client=createCloudLibraryClient('test-a',s.bridge),a=device(client),b=device(client),model=addModelArtwork(createDemoProject(),testArtworkModel()).artwork;
 const local=await a.repositories.artwork.add({template:artworkTemplate('model',model),thumbnail:png});const saved=await a.sync.push('artwork',local.id),imported=await b.sync.pull('artwork',saved.id),received=(await b.repositories.artwork.read(imported.localId))!.template;expect(received.kind).toBe('model');expect(received.artwork).toHaveProperty('model',model.model);expect(received.artwork).not.toHaveProperty('position');
});

it('does not publish competing stale updates and keeps the winning immutable payload intact',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id);let n=0,release!:()=>void;const barrier=new Promise<void>(r=>{release=r;});s.bucket.beforePut=async()=>{if(++n===2)release();await barrier;};
 const results=await Promise.allSettled(['A','B'].map(name=>{const d={...document(),template:{...material(),name}} as CloudLibraryDocument;return s.client.save('material',m.id,1,new Blob([JSON.stringify(d)]),libraryMetadata(d,s.m.id,false));}));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);const saved=await s.client.read('material',m.id);expect(saved.summary.revision).toBe(2);expect(JSON.parse(new TextDecoder().decode(saved.bytes)).template.name).toBe(saved.summary.name);expect(s.bucket.files.size).toBe(1);
});
it('rejects a hash-valid but semantically invalid package before any local item or link is created',async()=>{
 const s=await seed(),d=document(),raw={...d,template:{...d.template,material:{...material().material,normal:{...material().material.normal,strength:999}}}},id=crypto.randomUUID();await s.client.save('material',id,0,new Blob([JSON.stringify(raw)]),libraryMetadata(d,s.m.id,false));const second=device(s.client);await expect(second.sync.pull('material',id)).rejects.toThrow();expect(await second.repositories.material.list()).toEqual([]);expect(await second.links.remote(ownerA,'material',id)).toBeUndefined();
});
it('rejects wrong file headers, hash and size before a library record can be published',async()=>{
 const s=libraryApiFixture(),id=crypto.randomUUID(),path='/api/libraries/material/'+id;const send=(headers:Record<string,string>,body='{}')=>s.bridge(path,{method:'PUT',headers:{authorization:'Bearer test-a',...headers},body});
 expect((await send({'x-expected-revision':'0','content-type':'application/json','x-library-sha256':'0'.repeat(64)})).status).toBe(400);expect((await send({'x-expected-revision':'-1'})).status).toBe(400);const d=document(),meta=libraryMetadata(d,crypto.randomUUID(),false),client=createCloudLibraryClient('test-a',s.bridge);await expect(client.save('material',id,0,new Blob([new Uint8Array(16*1024*1024+1)]),meta)).rejects.toThrow('용량');expect(await client.list('material')).toEqual([]);expect(s.bucket.files.size).toBe(0);
});

it('saves a conflict as a new cloud item without replacing the other device version',async()=>{
 const s=await seed(),m=await s.d.sync.push('material',s.m.id),b=device(s.client),local=await b.sync.pull('material',m.id);await s.d.repositories.material.archive(s.m.id,true,1);await s.d.sync.push('material',s.m.id);await b.repositories.material.replace(local.localId,{template:{...material(),name:'로컬 별도 수정'},archived:false},1);await expect(b.sync.push('material',local.localId)).rejects.toMatchObject({status:409});const copy=await b.sync.push('material',local.localId,true);expect(copy.id).not.toBe(m.id);expect((await s.client.metadata('material',m.id)).archived).toBe(true);expect(copy.name).toBe('로컬 별도 수정');expect(await s.client.list('material')).toHaveLength(2);expect((await b.links.local(ownerA,'material',local.localId))!.remoteId).toBe(copy.id);
});
