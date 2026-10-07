import {expect,it} from 'vitest';
import {createDraftRecovery,isModuleLoadError,registerRecoveryActions,recoveryActions} from './screenRecovery';
it('recognizes stale-module failures without treating every render error as a deployment change',()=>{
 for(const message of ['Failed to fetch dynamically imported module: /assets/old.js','Importing a module script failed.','Loading chunk 21 failed.','Failed to load module script'])expect(isModuleLoadError(new TypeError(message))).toBe(true);
 expect(isModuleLoadError(new Error('undefined object'))).toBe(false);expect(isModuleLoadError(null)).toBe(false);
});
it('waits for a durable save before allowing reload and preserves the complete current draft backup',async()=>{
 const draft={id:'p',name:'working',image:'data:image/png;base64,AA==',note:'private',width:1200};let durable:typeof draft|undefined,writes=0;
 const actions=createDraftRecovery({snapshot:()=>structuredClone(draft),flush:async()=>{},read:async()=>durable,write:async p=>{writes++;durable=p;}});
 await actions.save();expect(durable).toEqual(draft);expect(writes).toBe(1);await actions.save();expect(writes).toBe(1);expect(JSON.parse(actions.backup().json)).toEqual(draft);
});
it('does not permit reload on a storage error or a revision conflict',async()=>{
 for(const message of ['quota','other tab revision']){const actions=createDraftRecovery({snapshot:()=>({id:'p',name:'preserved'}),flush:async()=>{},read:async()=>undefined,write:async()=>{throw new Error(message);}});await expect(actions.save()).rejects.toThrow(message);expect(JSON.parse(actions.backup().json).name).toBe('preserved');}
});
it('retries a settled failed queue using the guarded writer when storage recovers',async()=>{
 const draft={id:'p',name:'last edit'};let stored:typeof draft|undefined,available=false,writes=0;
 const actions=createDraftRecovery({snapshot:()=>({...draft}),flush:async()=>{throw new Error('old queued quota failure');},read:async()=>stored,write:async p=>{writes++;if(!available)throw new Error('quota');stored=p;}});
 await expect(actions.save()).rejects.toThrow('quota');expect(stored).toBeUndefined();available=true;await actions.save();expect(stored).toEqual(draft);expect(writes).toBe(2);
});
it('does not bypass revision checks after a failed queue even if stored content happens to match',async()=>{
 const draft={id:'p',name:'same content'};let writes=0;
 const actions=createDraftRecovery({snapshot:()=>({...draft}),flush:async()=>{throw new Error('stale revision');},read:async()=>({...draft}),write:async()=>{writes++;throw new Error('revision conflict');}});
 await expect(actions.save()).rejects.toThrow('revision conflict');expect(writes).toBe(1);
});
it('does not save or reload a mixture when the project changes during flush or persistence',async()=>{
 let draft={id:'a',name:'A'},writes=0;const actions=createDraftRecovery({snapshot:()=>({...draft}),flush:async()=>{draft={id:'b',name:'B'};},read:async()=>undefined,write:async()=>{writes++;}});await expect(actions.save()).rejects.toThrow('변경');expect(writes).toBe(0);
 draft={id:'a',name:'A'};const race=createDraftRecovery({snapshot:()=>({...draft}),flush:async()=>{},read:async()=>undefined,write:async()=>{draft={id:'a',name:'새 수정'};}});await expect(race.save()).rejects.toThrow('변경');expect(JSON.parse(race.backup().json).name).toBe('새 수정');
});
it('keeps recovery callbacks available after an editor subtree has failed',()=>{
 const action={save:async()=>{},backup:()=>({name:'test',json:'{}'})};registerRecoveryActions(action);expect(recoveryActions()).toBe(action);registerRecoveryActions(undefined);expect(recoveryActions()).toBeUndefined();
});
