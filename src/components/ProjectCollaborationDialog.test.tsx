import {afterEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ProjectCollaborationDialog from './ProjectCollaborationDialog';
import ProjectInvitationPage from './ProjectInvitationPage';
import {ReviewCommentsPanel} from './ReviewCommentsPanel';
import {useAuth} from '../state/auth';
vi.mock('../state/auth',async load=>{const m=await load<typeof import('../state/auth')>();return {...m,useAuth:Object.assign(()=>m.useAuth.getState(),m.useAuth)};});
const original=useAuth.getState();afterEach(()=>useAuth.setState(original,true));
it('discloses private Notes/assets access and the role boundaries before creating an invitation',()=>{
 const html=renderToStaticMarkup(<ProjectCollaborationDialog projectId={crypto.randomUUID()} name={'<script>전시</script>'} onClose={()=>{}}/>);expect(html).toContain('내부 설치 메모');expect(html).toContain('7일 유효');expect(html).toContain('소유자만');expect(html).toContain('실시간 동시 편집은 지원하지');expect(html).not.toContain('<script>전시</script>');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('새 초대 링크');
});
it('shows unavailable authentication honestly without asking for credentials or creating editable project state',()=>{
 useAuth.setState({status:'disabled',config:null,user:null,error:''});const html=renderToStaticMarkup(<ProjectInvitationPage invitationId={crypto.randomUUID()}/>);expect(html).toContain('계정 초대 연결을 준비 중');expect(html).not.toContain('초대 수락');expect(html).not.toContain('계정 로그인');
});
it('renders private project opinions separately without public link login or point editing options',()=>{
 useAuth.setState({status:'signedIn',user:{id:crypto.randomUUID(),email:'account@example.test'}});const id=crypto.randomUUID(),html=renderToStaticMarkup(<ReviewCommentsPanel shareId={id} privateProject={{id,name:'비공개 전시'}}/>);expect(html).toContain('참여자만 읽는');expect(html).toContain('내부 설치 메모와 별도');expect(html).not.toContain('링크를 가진 사람이');expect(html).not.toContain('공간 위치');expect(html).not.toContain('계정 이메일');
});
