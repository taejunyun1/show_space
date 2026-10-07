import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {projectionReceiverFixture} from '../lib/projectionReceiverFixture';
import {ExportDialog} from './ExportDialog';
const state=vi.hoisted(()=>({project:undefined as ReturnType<typeof projectionReceiverFixture>|undefined}));
vi.mock('../state/editor',()=>({useEditor:(select:(value:{project:ReturnType<typeof projectionReceiverFixture>})=>unknown)=>select({project:state.project!})}));
it('shows actual omitted-light counts beside 3D export with the correct image/backup alternatives',()=>{
 state.project=projectionReceiverFixture();const html=renderToStaticMarkup(<ExportDialog onClose={()=>{}} onPng={()=>{}} onPdf={()=>{}}/>);expect(html).toContain('프로젝터 2대·면 조명 1개는 GLB·glTF에 포함되지');expect(html).toContain('PNG·PDF 3D');expect(html).toContain('프로젝트 자산 백업');expect(html).not.toContain('PRIVATE');state.project.lights=state.project.lights!.filter(l=>!l.projection&&l.kind!=='area');const ordinary=renderToStaticMarkup(<ExportDialog onClose={()=>{}} onPng={()=>{}} onPdf={()=>{}}/>);expect(ordinary).not.toContain('role="note"');
});
