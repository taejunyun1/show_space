import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {NumberField} from './Controls';
import {LengthUnitContext} from './LengthUnits';
import {createDemoProject} from '../domain/model';
import {createPublicShare} from '../domain/publicShare';
import {SharedPlan,SharedElevation,SharedInstallationInformation} from './SharedViewer';
import {PlanMeasurements} from './MeasurementOverlay';
import {useEditor} from '../state/editor';
it('converts number fields bounds and steps while keeping angle and provisional px fields literal',()=>{
 const html=renderToStaticMarkup(<LengthUnitContext.Provider value="m"><NumberField label="幅" value={900} min={1} max={50000} onChange={()=>{}}/><NumberField label="角" value={15} suffix="°" step={1} onChange={()=>{}}/><NumberField label="草案" value={900} suffix="px" onChange={()=>{}}/></LengthUnitContext.Provider>);
 expect(html).toContain('step="0.01" min="0.001" max="50"');expect(html).toContain('value="0.9"');expect(html).toContain('value="15"');expect(html).toContain('value="900"');expect(html).toContain('>px<');
});
it('switches units through undo/redo and scenes without touching geometry',()=>{
 const p=createDemoProject();useEditor.setState({project:p,past:[],future:[],previewProject:null,selected:[],measurementDraft:null});
 useEditor.getState().patchProject({displayUnit:'cm'});expect(useEditor.getState().project.walls).toEqual(p.walls);
 useEditor.getState().patchProject({displayUnit:'m'});useEditor.getState().undo();expect(useEditor.getState().project.displayUnit).toBe('cm');useEditor.getState().redo();expect(useEditor.getState().project.displayUnit).toBe('m');
 useEditor.getState().saveScene('A');useEditor.getState().patchProject({displayUnit:'cm'});useEditor.getState().restoreScene(useEditor.getState().project.scenes[0].id);expect(useEditor.getState().project.displayUnit).toBe('cm');expect(useEditor.getState().project.artworks).toEqual(p.artworks);
});
it('renders public plan/elevation/install sizes in project units while privacy remains enforced',()=>{
 const p={...createDemoProject(),displayUnit:'m' as const};const snapshot=createPublicShare(p,{includeDimensions:true}).snapshot;
 const plan=renderToStaticMarkup(<SharedPlan snapshot={snapshot} selectedId={null} onSelect={()=>{}}/>);expect(plan).toContain('8 m');expect(plan).not.toContain(' mm');
 const elevation=renderToStaticMarkup(<SharedElevation snapshot={snapshot} wallId="wall-a" side="front" selectedId="artwork-1" onSelect={()=>{}}/>);expect(elevation).toContain('3.2 m');expect(elevation).not.toContain(' mm');
 const installation=renderToStaticMarkup(<SharedInstallationInformation snapshot={snapshot} artworkId="artwork-1"/>);expect(installation).toContain(' m');
 const bare=createPublicShare(p,{includeDimensions:false}).snapshot;expect(renderToStaticMarkup(<SharedPlan snapshot={bare} selectedId={null} onSelect={()=>{}}/>)).not.toContain(' m<');
});
it('keeps uncalibrated plan distances in pixels even with a metre preference',()=>{
 const p={...createDemoProject(),displayUnit:'m' as const,planDraft:{}} as ReturnType<typeof createDemoProject>;const draft={view:'plan' as const,start:{kind:'fixed' as const,fallback:{x:0,y:0,z:0}},end:{kind:'fixed' as const,fallback:{x:900,y:0,z:0}}};
 const html=renderToStaticMarkup(<PlanMeasurements project={p} draft={draft} showDimensions scale={8000}/>);expect(html).toContain('900 px');expect(html).not.toContain('0.9 m');
});
