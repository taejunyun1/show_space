import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReviewThreadCard} from './ReviewCommentsPanel';
import type {ReviewThread} from '../domain/reviewComments';
import {SharedPlan} from './SharedViewer';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
const thread:ReviewThread={id:'a',revision:1,anchor:{kind:'wall',id:'wall-a',label:'벽 A',sceneId:null,sceneName:'현재 배치'},resolved:false,createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',canManage:false,posts:[{id:'b',name:'참여자',text:'<script>외부 의견</script>',createdAt:'2026-10-07T00:00:00Z',mine:false}]};
it('renders safe opinion text and gives anonymous readers no write actions',()=>{
 const html=renderToStaticMarkup(<ReviewThreadCard thread={thread} owner={false} canComment={false} busy={false} onChange={async()=>true} onAnchor={()=>{}}/>);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('대상 보기');for(const text of ['댓글 삭제','의견 전체 삭제','답글 등록','수정 저장'])expect(html).not.toContain(text);
});
it('lets the owner moderate but only the post author edit, and closes replies when resolved',()=>{
 const owner=renderToStaticMarkup(<ReviewThreadCard thread={{...thread,canManage:true}} owner canComment busy={false} onChange={async()=>true}/>);expect(owner).toContain('처리 완료');expect(owner).toContain('댓글 삭제');expect(owner).toContain('의견 전체 삭제');expect(owner).toContain('답글 등록');expect(owner).not.toMatch(/>수정<\/button>/);
 const author=renderToStaticMarkup(<ReviewThreadCard thread={{...thread,canManage:true,resolved:true,posts:thread.posts.map(p=>({...p,mine:true}))}} owner={false} canComment busy={false} onChange={async()=>true}/>);expect(author).toContain('다시 열기');expect(author).toMatch(/>수정<\/button>/);expect(author).not.toContain('답글 등록');
});
it('shows a comment location marker without enabling measurement or exposing saved dimensions',()=>{
 const snapshot=createPublicShare(createDemoProject(),{includeDimensions:false}).snapshot,html=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={null} onSelect={()=>{}} reviewPoint={{x:1200,y:1500,z:300}}/>);expect(html).toContain('aria-label="의견 공간 위치"');expect(html).toContain('cx="1200"');expect(html).not.toContain('aria-label="임시 측정"');expect(html).not.toContain('aria-label="치수선"');
});
