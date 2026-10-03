import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShareDialog} from './ShareDialog';
import {createDemoProject} from '../domain/model';
import {testVenueModel} from '../lib/venueModelTestFixture';
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
