import {afterEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {useEditor} from '../state/editor';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {ModelArtworkInspector} from './ModelArtworkInspector';
import {Inspector} from './Inspector';
vi.mock('../state/editor',async importOriginal=>{const actual=await importOriginal<typeof import('../state/editor')>();return {...actual,useEditor:Object.assign((selector?:((state:ReturnType<typeof actual.useEditor.getState>)=>unknown))=>selector?selector(actual.useEditor.getState()):actual.useEditor.getState(),actual.useEditor)};});
const original=useEditor.getState();afterEach(()=>useEditor.setState(original));
it('shows advisory 3D warnings from the live drag preview without changing the stored pose or disabling free numeric edits',()=>{
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project,a=p.modelArtworks![0];p.walls=[];p.artworks=[];a.position={x:0,y:0,z:0};a.rotation={x:0,y:0,z:0};a.locked=false;useEditor.setState({project:p,previewProject:null,selected:[{type:'modelArtwork',id:a.id}]});expect(renderToStaticMarkup(<ModelArtworkInspector artwork={a}/>)).not.toContain('aria-label="3D 작품 배치 경고"');
 const preview=structuredClone(p);preview.modelArtworks![0].position.y=-500;useEditor.setState({previewProject:preview});const html=renderToStaticMarkup(<ModelArtworkInspector artwork={a}/>);expect(html).toContain('aria-label="3D 작품 배치 경고"');expect(html).toContain('기준 바닥(0mm) 아래');expect(html).toContain('위치·크기를 자동으로 바꾸지');expect(html).toContain('3D 위치 Y');expect(html).toContain('-500 mm');expect(a.position.y).toBe(0);expect(useEditor.getState().project).toBe(p);
});
it('surfaces ordinary image artwork overlap in the existing inspector',()=>{
 const p=createDemoProject();p.modelArtworks=[];const wall=p.walls[0],a={...p.artworks[0],wallId:wall.id,id:'picture-a',alongMm:1500,centerHeightMm:1500,visible:true,widthMm:600,heightMm:600};p.artworks=[a,{...a,id:'picture-b',name:'겹친 사진'}];useEditor.setState({project:p,previewProject:null,selected:[{type:'artwork',id:a.id}]});const html=renderToStaticMarkup(<Inspector/>);expect(html).toContain('작품 외곽 범위가 다른 작품과 겹칩니다: 겹친 사진');expect(html).toContain('작품 크기');
});
