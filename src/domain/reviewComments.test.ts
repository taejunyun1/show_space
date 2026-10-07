import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {createPublicShare} from './publicShare';
import {resolveReviewAnchor,parseReviewPage,mutateReviewThread,ReviewError,type StoredReviewThread} from './reviewComments';
import {authReturnPath} from './authConfig';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',postId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',date='2026-10-07T00:00:00Z';
function fixture():StoredReviewThread{return {anchor:{kind:'project',sceneId:null,sceneName:'현재 배치',label:'전시 전체'},resolved:false,posts:[{id:postId,name:'협업자',text:'의견',authorId:'user-b',createdAt:date}]};}
it('uses only published targets and venue bounds, deriving labels and ignoring private input',()=>{
 const p=createDemoProject();p.artworks=[];p.walls[0].name='';const snapshot=createPublicShare(p,{includeDimensions:false}).snapshot;
 expect(resolveReviewAnchor(snapshot,{kind:'wall',id:'wall-a',sceneId:null,label:'forged',note:'SECRET'})).toEqual({kind:'wall',id:'wall-a',sceneId:null,sceneName:'현재 배치',label:'이름 없는 벽'});
 expect(()=>resolveReviewAnchor(snapshot,{kind:'point',sceneId:null,point:{x:9999999,y:0,z:0}})).toThrow('공유 공간 범위');expect(()=>resolveReviewAnchor(snapshot,{kind:'project',sceneId:'private-scene'})).toThrow('공유하지 않은');
});
it('preserves the stored opinion while enforcing author editing and owner moderation',()=>{
 const source=fixture(),before=structuredClone(source);expect(()=>mutateReviewThread(source,'user-b','user-c',false,{action:'deleteThread'},date)).toThrow(ReviewError);expect(()=>mutateReviewThread(source,'user-b','user-a',true,{action:'edit',id:postId,text:'rewrite'},date)).toThrow('자신이 쓴');
 const deleted=mutateReviewThread(source,'user-b','user-a',true,{action:'deletePost',id:postId},date);expect(deleted.record.posts[0]).toMatchObject({text:'',name:'',deleted:true});expect(source).toEqual(before);
});
it('bounds and rebuilds untrusted page records, stripping account identity and unknown fields',()=>{
 const r=fixture(),input={enabled:true,items:[{id,revision:1,anchor:r.anchor,resolved:false,createdAt:date,updatedAt:date,canManage:false,posts:r.posts.map(p=>({...p,mine:false,email:'PRIVATE'})),ownerId:'PRIVATE'}],nextCursor:null,canComment:false,owner:false};const page=parseReviewPage(input);
 expect(JSON.stringify(page)).not.toMatch(/authorId|email|ownerId|PRIVATE/);expect(()=>parseReviewPage({...input,items:Array(11).fill(input.items[0])})).toThrow();expect(()=>parseReviewPage({...input,items:[{...input.items[0],posts:[{...input.items[0].posts[0],text:'a'.repeat(2001)}]}]})).toThrow();expect(parseReviewPage({enabled:false,private:'PRIVATE'}).items).toEqual([]);
});
it('returns only same-site review paths for login callback, retaining the ordinary default',()=>{
 expect(authReturnPath('/s/'+'a'.repeat(48))).toBe('/s/'+'a'.repeat(48));for(const value of [undefined,'https://evil.test','//evil.test','/s/invalid','/auth/callback?next=https://evil.test'])expect(authReturnPath(value)).toBe('/auth/callback');
});
