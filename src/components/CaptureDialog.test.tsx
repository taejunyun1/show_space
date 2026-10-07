import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CaptureDialog} from './CaptureDialog';
it('offers transparent PNG in every view and environment controls only for 3D',()=>{
 for(const view of ['plan','elevation','3d'] as const){const html=renderToStaticMarkup(<CaptureDialog view={view} hasPlan={false} sourceSize={()=>({width:800,height:600})} onClose={()=>{}} onCapture={async()=>{}}/>);expect(html).toContain('투명 배경 PNG');expect(html.includes('환경 배경·반사 포함')).toBe(view==='3d');expect(html).toContain('1,920 × 1,440 px');expect(html).toContain('PNG 저장');}
});
