import {beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShareDialog} from './ShareDialog';
import {createDemoProject} from '../domain/model';
import {testVenueModel} from '../lib/venueModelTestFixture';
const auth=vi.hoisted(()=>({status:'signedIn',user:{id:'11111111-1111-4111-8111-111111111111',email:'account@example.test'} as {id:string;email:string}|null}));
vi.mock('../state/auth',async importOriginal=>({...await importOriginal<object>(),useAuth:()=>auth}));
beforeEach(()=>{auth.status='signedIn';auth.user={id:'11111111-1111-4111-8111-111111111111',email:'account@example.test'};});
it('offers publication for a visible venue model and explains its locked shape',()=>{
 const p=createDemoProject();p.referenceModel=testVenueModel();const html=renderToStaticMarkup(<ShareDialog project={p} onClose={()=>{}}/>);expect(html).toContain('전시장 3D 모델의 전체 형상');expect(html).toContain('원본 파일명은 전달하지 않습니다');expect(html).not.toContain('아직 지원하지');expect(html).not.toContain('disabled');
});
it('keeps the calibration gate when a plan has no physical scale',()=>{
 const p=createDemoProject();p.referenceModel=testVenueModel();p.planDraft={kind:'partial',sourceEvidenceHash:'0'.repeat(64),originalWalls:structuredClone(p.walls)};const html=renderToStaticMarkup(<ShareDialog project={p} onClose={()=>{}}/>);expect(html).toContain('disabled');expect(html).toContain('축척');
});
it('offers explicitly unchecked Scene selection and explains that other Scenes and notes remain private',()=>{
 const p=createDemoProject();p.scenes=[{id:'installation-a',name:'설치안 A',artworks:[],wallVisibility:{}}];const html=renderToStaticMarkup(<ShareDialog project={p} onClose={()=>{}}/>);
 expect(html).toContain('함께 공유할 Scene');expect(html).toContain('설치안 A');expect(html).toContain('선택하지 않은 Scene');expect(html).toContain('최대 20개');expect(html).not.toContain('checked=""');
});
it('defaults additional artwork information to private and explains the basic public fields',()=>{
 const html=renderToStaticMarkup(<ShareDialog project={createDemoProject()} onClose={()=>{}}/>);expect(html).toContain('작품 상세 정보 공개');expect(html).toContain('이름·작가·연도는 기본 공개');expect(html).toContain('내부 설치 메모는 포함하지 않습니다');expect(html).not.toContain('checked=""');
});
it('uses the signed-in account by default and asks signed-out users to log in before publication',()=>{
 const render=()=>renderToStaticMarkup(<ShareDialog project={createDemoProject()} onClose={()=>{}}/>);
 let html=render();expect(html).toContain('account@example.test');expect(html).toContain('이 계정에서 만든 링크만 관리');expect(html).not.toContain('type="password"');expect(html).not.toContain('disabled');
 auth.status='signedOut';auth.user=null;html=render();expect(html).toContain('계정 로그인');expect(html).toContain('작성자 키 없이');expect(html).toContain('disabled');expect(html).not.toContain('account@example.test');
});
it('retains the legacy author-key route when account authentication is unconfigured',()=>{
 auth.status='disabled';auth.user=null;const html=renderToStaticMarkup(<ShareDialog project={createDemoProject()} onClose={()=>{}}/>);expect(html).toContain('type="password"');expect(html).toContain('작성자 키');expect(html).toContain('disabled');expect(html).not.toContain('계정 로그인');
});
