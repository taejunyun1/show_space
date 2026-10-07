import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArtworkSeriesDialog} from './ArtworkSeriesDialog';
import {createDemoProject} from '../domain/model';
import {LengthUnitContext} from './LengthUnits';
it('renders ordered count/spacing controls, both wall faces and a physical preview in the project unit',()=>{
 const p=createDemoProject(),ids=p.artworks.slice(0,3).map(a=>a.id),html=renderToStaticMarkup(<LengthUnitContext.Provider value="cm"><ArtworkSeriesDialog project={p} initialIds={ids} initialWallId={p.walls[0].id} onApply={()=>null} onClose={()=>{}}/></LengthUnitContext.Provider>);
 for(const label of ['시리즈 자동 배열','배열할 작품 수','시리즈 설치 벽','시리즈 설치 면','시리즈 배열 방향','시리즈 작품 간격','배열 중심 높이','시리즈 외곽 배치 미리보기','배열 뒤 작품 그룹 만들기'])expect(html).toContain(`aria-label="${label}"`);
 expect(html).toContain('3점 배열 적용');expect(html).toContain('A면');expect(html).toContain('B면');expect(html).toContain(' cm');expect(html).toContain('value="25"');expect(html).toContain('value="3"');expect(html).toContain('한 번의 실행 취소');
});
it('disables apply for a partial existing group and explains the reason before any edit',()=>{
 const p=createDemoProject();p.artworks=p.artworks.map(a=>({...a,groupId:'series'}));const html=renderToStaticMarkup(<ArtworkSeriesDialog project={p} initialIds={p.artworks.slice(0,2).map(a=>a.id)} initialWallId={p.walls[0].id} onApply={()=>null} onClose={()=>{}}/>);
 expect(html).toContain('기존 그룹의 작품을 모두');expect(html).toContain('role="alert"');expect(html).toMatch(/disabled=""[^>]*>2점 배열 적용/);expect(html).not.toContain('시리즈 외곽 배치 미리보기');
});
