import {expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';

it('acknowledges a restored project revision so the next autosave succeeds without overwriting a stale tab',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());try{
  const {readDraft,writeDraft,replaceLocalProject,localProjectRevision}=await import('./persistence'),original=await readDraft() as import('../domain/types').Project;
  await writeDraft({...original,note:'복원 전'});expect(localProjectRevision(original.id)).toBe(2);
  await replaceLocalProject(original,2);expect(localProjectRevision(original.id)).toBe(3);
  await writeDraft({...original,note:'복원 후 새 편집'});expect(localProjectRevision(original.id)).toBe(4);expect(await readDraft()).toMatchObject({note:'복원 후 새 편집'});
  await expect(replaceLocalProject(original,2)).rejects.toThrow('다른 탭');expect(await readDraft()).toMatchObject({note:'복원 후 새 편집'});
 }finally{vi.unstubAllGlobals();}
});
