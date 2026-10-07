import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectArchiveContents} from './ProjectArchiveContents';
import ProjectArchiveDialog from './ProjectArchiveDialog';
import {ARCHIVE_SECTIONS,archiveLayout} from '../domain/projectArchive';
import {createDemoProject} from '../domain/model';
import {appendSceneSnapshot} from '../domain/sceneSnapshot';
import {newLight} from '../domain/lighting';
import {materialPreset} from '../domain/materials';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
it('renders all seven archived records read-only with physical units and private references',()=>{
 let p=createDemoProject();p.displayUnit='cm';p.floorMaterial=materialPreset('wood').material;p.lights=[newLight(p,'spot')];p.note='現場 私的メモ';p.noteDetails={checklist:[{id:'c',text:'輸送',done:true}],images:[{id:'i',name:'現場.png',imageUrl:png}],installation:{installed:true,lightingChecked:false}};p=appendSceneSnapshot(p,p,'初回設営');const before=structuredClone(p);
 for(const [section] of ARCHIVE_SECTIONS){const html=renderToStaticMarkup(<ProjectArchiveContents project={p} layout={p} section={section} onScene={()=>{}}/>);expect(html).not.toMatch(/<(input|textarea|select)\b/);if(section==='space')expect(html).toContain('800 cm');if(section==='materials')expect(html).toContain('목재');if(section==='lighting')expect(html).toContain('색온도');if(section==='notes'){expect(html).toContain('現場 私的メモ');expect(html).toContain('✓ 설치 완료');expect(html).toContain('○ 조명 확인');}if(section==='scenes')expect(html).toContain('初回設営');if(section==='photos')expect(html).toContain('現場.png');}
 expect(p).toEqual(before);
});
it('shows historical Scene notes and placement even when that artwork is no longer in the current layout',()=>{
 let p=createDemoProject();p.artworks[0].note='지난 설치 위치';p=appendSceneSnapshot(p,p,'지난 전시');p.artworks=p.artworks.slice(1);const layout=archiveLayout(p,p.scenes[0].id);
 const old=renderToStaticMarkup(<ProjectArchiveContents project={p} layout={layout} section="notes" onScene={()=>{}}/>),now=renderToStaticMarkup(<ProjectArchiveContents project={p} layout={p} section="notes" onScene={()=>{}}/>);expect(old).toContain('지난 설치 위치');expect(now).not.toContain('지난 설치 위치');
});
it('renders archive entry controls independently of configured authentication',()=>{
 const html=renderToStaticMarkup(<ProjectArchiveDialog onClose={()=>{}} onReused={()=>{}}/>);expect(html).toContain('전시 아카이브');for(const text of ['이 브라우저','내 계정','목록 새로고침','보관 상태','수정 연도','정렬'])expect(html).toContain(text);expect(html).toContain('기록을 열람해도 편집 중인 전시는 바뀌지 않습니다.');
});
