import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDemoProject} from '../domain/model';
import {useEditor} from '../state/editor';
import InstallationMode from './InstallationMode';
import {SharedPlan,SharedElevation} from './SharedViewer';
import {installationDrawing} from '../domain/readonlyDrawing';
it('offers field drawings, measurements, notes and stages without geometry-edit controls',()=>{
 const p=createDemoProject();useEditor.setState({project:p,selected:[{type:'artwork',id:'artwork-1'}]});const before=JSON.stringify(p),html=renderToStaticMarkup(<InstallationMode onClose={()=>{}}/>);
 expect(html).toContain('현장 설치');expect(html).toContain('임시 줄자');expect(html).toContain('벽면도');expect(html).toContain('현장 NOTE');expect(html).toContain('조명 확인');expect(html).toContain('준비 단계');expect(html).not.toMatch(/벽 추가|선택 삭제|선택 복제|스팟 추가|3D 작품 회전/);expect(JSON.stringify(p)).toBe(before);
});
it('renders empty venue plans without invalid bounds',()=>{
 const p=createDemoProject();p.unplacedArtworks=[p.artworks[0]];p.artworks=[];p.walls=[];const html=renderToStaticMarkup(<SharedPlan snapshot={installationDrawing(p)} selectedId={null} onSelect={()=>{}}/>);expect(html).not.toMatch(/Infinity|NaN/);expect(html).toContain('viewBox="-120 -120 1240 1240"');
});
it('renders local artwork images and rotated back-face installation distances in field elevations',()=>{
 const p=createDemoProject();p.artworks=[{...p.artworks[0],wallSide:'back',rotationDeg:90}];const snapshot=installationDrawing(p),html=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId='wall-a' side='back' selectedId={p.artworks[0].id} onSelect={()=>{}}/>);
 expect(html).toContain('background-size:500% 100%');expect(html).toContain('rotate(-90');expect(html).toContain('벽 왼쪽');expect(html).toContain('벽 오른쪽');expect(html).not.toContain('<input');
 const plan=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={null} onSelect={()=>{}}/>);expect(plan).not.toMatch(/이동|회전|삭제|input/);
});

it('shows the whole uploaded image at its chosen physical dimensions instead of cropping its centre',()=>{
 const p=createDemoProject();p.artworks=[{...p.artworks[0],imageUrl:'data:image/png;base64,example',widthMm:400,heightMm:1200}];
 const html=renderToStaticMarkup(<SharedElevation snapshot={installationDrawing(p)} wallId='wall-a' side='front' selectedId={null} onSelect={()=>{}}/>);
 expect(html).toContain('href="data:image/png;base64,example"');expect(html).toContain('preserveAspectRatio="none"');expect(html).not.toContain('slice');expect(html).not.toContain('background-size:500%');
});

it('keeps white walls readable in technical plans while preserving material colours in public plans',()=>{
 const p=createDemoProject();p.walls.forEach(w=>w.color='#ffffff');const snapshot=installationDrawing(p),before=JSON.stringify(p);
 const field=renderToStaticMarkup(<SharedPlan technical snapshot={snapshot} selectedId='wall-a' onSelect={()=>{}}/>);
 const publicPlan=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={null} onSelect={()=>{}}/>);
 expect(field).toContain('stroke="#536176"');expect(field).toContain('stroke="#365cf5"');expect(publicPlan).toContain('stroke="#ffffff"');expect(JSON.stringify(p)).toBe(before);
});
