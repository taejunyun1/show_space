import {expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createMaterialLibrary} from './materialLibrary';
import {builtinMaterials} from '../domain/materialLibrary';
const input=()=>structuredClone(builtinMaterials[0]);
it('persists separate material documents and thin searchable summaries across connections',async()=>{
 const f=new IDBFactory(),a=createMaterialLibrary(f),b=createMaterialLibrary(f),item=await a.add(input());
 expect((await b.list())[0]).not.toHaveProperty('template');expect((await b.read(item.id))!.template).toEqual(input());
 await b.archive(item.id,true,1);expect((await a.list())[0].archived).toBe(true);await expect(a.archive(item.id,false,1)).rejects.toThrow('다른 탭');await a.archive(item.id,false,2);expect((await b.read(item.id))!.summary.revision).toBe(3);
});
it('backs up texture repeat and preserves archive state with independent restore identities',async()=>{
 const a=createMaterialLibrary(new IDBFactory()),b=createMaterialLibrary(new IDBFactory());
 const template={...input(),material:{...input().material,texture:{imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthMm:2000,heightMm:1000}}};
 const item=await a.add(template,template.material.texture.imageUrl);await a.archive(item.id,true,1);const [restored]=await b.restore(await a.backup());expect(restored.id).not.toBe(item.id);expect(restored.archived).toBe(true);expect(restored.thumbnail).toBe(template.material.texture.imageUrl);expect((await b.read(restored.id))!.template).toEqual(template);
});
it('validates the whole backup before any write and enforces count and UTF-8 size budgets atomically',async()=>{
 const r=createMaterialLibrary(new IDBFactory(),'bounded',{maxItems:2,maxBytes:10000});await r.add(input());const backup=await r.backup();backup.items.push({template:{...input(),color:'bad'},archived:false});await expect(r.restore(backup)).rejects.toThrow();expect(await r.list()).toHaveLength(1);
 await r.add(input());await expect(r.add(input())).rejects.toThrow('최대');expect(await r.list()).toHaveLength(2);
 const small=createMaterialLibrary(new IDBFactory(),'small',{maxItems:5,maxBytes:100});await expect(small.add(input())).rejects.toThrow('용량');expect(await small.list()).toEqual([]);
 const empty=createMaterialLibrary(new IDBFactory());await expect(empty.add(input(),'data:image/png;base64,YWJj')).rejects.toThrow();expect(await empty.list()).toEqual([]);
});
it('rolls back both stores on storage failure and allows retry',async()=>{
 const repo=createMaterialLibrary(new IDBFactory()),original=IDBObjectStore.prototype.put,spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(this.name==='summaries')throw new DOMException('공간 부족','QuotaExceededError');return original.call(this,value,key);});
 try{await expect(repo.add(input())).rejects.toThrow('공간 부족');}finally{spy.mockRestore();}expect(await repo.list()).toEqual([]);await repo.add(input());expect(await repo.list()).toHaveLength(1);
});
it('serializes concurrent tabs against the total count without orphaned material assets',async()=>{
 const f=new IDBFactory(),limits={maxItems:1,maxBytes:10000},a=createMaterialLibrary(f,'concurrent',limits),b=createMaterialLibrary(f,'concurrent',limits);
 const results=await Promise.allSettled([a.add(input()),b.add(input())]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);const list=await a.list();expect(list).toHaveLength(1);expect((await b.read(list[0].id))!.template).toEqual(input());expect((await a.backup()).items).toHaveLength(1);
});
