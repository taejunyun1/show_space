import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDemoProject} from '../domain/model';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {ArtworkInformationEditor} from './ArtworkInformationEditor';
import {SharedArtworkInformation} from './SharedViewer';
import {createPublicShare} from '../domain/publicShare';
it('offers bounded metadata for legacy images without guessing their artwork category',()=>{
 const a=createDemoProject().artworks[0],html=renderToStaticMarkup(<ArtworkInformationEditor artwork={a} onChange={()=>{}}/>);
 for(const label of ['작품 작가','작품 연도','작품 종류','작품 설치 형식','작품 재료','작품 설명'])expect(html).toContain(`aria-label="${label}"`);
 expect(html).toContain('maxLength="2000"');expect(html).toContain('value="" selected=""');expect(html).toContain('설치 메모는 별도로 비공개');
});
it('disables every metadata control on locked 3D artworks',()=>{
 const a=addModelArtwork(createDemoProject(),testArtworkModel()).artwork;a.locked=true;
 const html=renderToStaticMarkup(<ArtworkInformationEditor artwork={a} onChange={()=>{}}/>);expect(html.match(/disabled=""/g)).toHaveLength(6);expect(html).not.toContain('미지정');expect(html).toContain('원본 3D 형상은 그대로');
});
it('escapes public descriptions, preserves line breaks, and respects dimensions privacy',()=>{
 const p=createDemoProject();Object.assign(p.artworks[0],{year:'2026',medium:'피그먼트 프린트',description:'첫 줄\n<script>alert(1)</script>',artworkType:'photo',presentationType:'framed-print'});
 const a=createPublicShare(p,{includeDimensions:false,includeArtworkDetails:true}).snapshot.artworks[0];
 const html=renderToStaticMarkup(<SharedArtworkInformation artwork={a} dimensions={false}/>);expect(html).toContain('2026');expect(html).toContain('피그먼트 프린트');expect(html).toContain('액자 프린트');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain(' mm');
 expect(renderToStaticMarkup(<SharedArtworkInformation artwork={a} dimensions/>)).toContain('30 mm');
});
