import {expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createArtworkLibrary} from './artworkLibrary';
import {artworkTemplate} from '../domain/artworkLibrary';
import {createDemoProject} from '../domain/model';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const input=()=>({template:artworkTemplate('image',{...createDemoProject().artworks[0],imageUrl:png}),thumbnail:png});
it('stores independent designs, thin summaries, reload persistence and reversible archives',async()=>{
 const factory=new IDBFactory(),a=createArtworkLibrary(factory),b=createArtworkLibrary(factory),item=await a.add(input());expect((await b.list())[0]).not.toHaveProperty('template');expect((await b.read(item.id))!.template).toEqual(input().template);
 await b.archive(item.id,true,item.revision);expect((await a.list())[0].archived).toBe(true);await expect(a.archive(item.id,false,item.revision)).rejects.toThrow('다른 탭');await a.archive(item.id,false,2);expect((await b.read(item.id))!.summary.revision).toBe(3);
});
it('rolls back assets and summaries if storage fails and permits retry',async()=>{
 const repo=createArtworkLibrary(new IDBFactory()),original=IDBObjectStore.prototype.put,spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(this.name==='summaries')throw new DOMException('공간 부족','QuotaExceededError');return original.call(this,value,key);});
 try{await expect(repo.add(input())).rejects.toThrow('공간 부족');}finally{spy.mockRestore();}expect(await repo.list()).toEqual([]);await repo.add(input());expect(await repo.list()).toHaveLength(1);
});
it('validates a whole restore before mutation and assigns fresh independent identities',async()=>{
 const repo=createArtworkLibrary(new IDBFactory());await repo.add(input());const backup=await repo.backup();const restored=createArtworkLibrary(new IDBFactory());await restored.restore(backup);expect((await restored.list())[0].id).not.toBe((await repo.list())[0].id);expect((await restored.read((await restored.list())[0].id))!.template).toEqual(input().template);
 const bad=structuredClone(backup);bad.items.push({...bad.items[0],template:{kind:'image',artwork:{...bad.items[0].template.artwork,widthMm:0}}} as typeof bad.items[number]);await expect(restored.restore(bad)).rejects.toThrow();expect(await restored.list()).toHaveLength(1);
});
it('enforces count and UTF-8 budget atomically, including archived designs',async()=>{
 const repo=createArtworkLibrary(new IDBFactory(),'bounded',{maxItems:2,maxBytes:10000});const a=await repo.add(input());await repo.archive(a.id,true,1);await repo.add(input());await expect(repo.add(input())).rejects.toThrow('최대');expect(await repo.list()).toHaveLength(2);
 const small=createArtworkLibrary(new IDBFactory(),'small',{maxItems:5,maxBytes:10});await expect(small.add(input())).rejects.toThrow('용량');expect(await small.list()).toEqual([]);
});
it('serializes simultaneous tabs against the count limit without losing either store',async()=>{
 const factory=new IDBFactory(),limits={maxItems:1,maxBytes:10000},a=createArtworkLibrary(factory,'concurrent',limits),b=createArtworkLibrary(factory,'concurrent',limits);
 const results=await Promise.allSettled([a.add(input()),b.add(input())]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 const list=await a.list();expect(list).toHaveLength(1);expect((await b.read(list[0].id))!.template).toEqual(input().template);expect((await a.backup()).items).toHaveLength(1);
});
it('preserves video originals in independent library storage and backup restoration, without placement or private notes',async()=>{
 const bytes=Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);const video={dataUrl:'data:video/mp4;base64,'+btoa(String.fromCharCode(...bytes)),widthPx:640,heightPx:360,durationSeconds:4,loop:false,fit:'cover' as const};
 const a={...createDemoProject().artworks[0],imageUrl:png,artworkType:'video' as const,presentationType:'screen' as const,video,note:'private note'};
 const repo=createArtworkLibrary(new IDBFactory(),'video'),summary=await repo.add({template:artworkTemplate('image',a),thumbnail:png});const stored=(await repo.read(summary.id))!.template;
 expect(stored.kind).toBe('image');if(stored.kind!=='image')throw new Error('wrong kind');expect(stored.artwork.video).toEqual(video);expect(stored.artwork).not.toHaveProperty('note');expect(stored.artwork).not.toHaveProperty('wallId');
 const restored=createArtworkLibrary(new IDBFactory(),'video-restored');await restored.restore(await repo.backup());const item=(await restored.read((await restored.list())[0].id))!.template;expect(item).toEqual(stored);
});
