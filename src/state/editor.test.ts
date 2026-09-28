import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProject, updateArtwork } from '../domain/model'
import {deriveFloor} from '../domain/floor'
import { hydrateEditor, startAutosave, useEditor } from './editor'

const reset = () => {
  const project = createDemoProject()
  useEditor.setState({
    project,
    previewProject: null,
    wallGesture: null,
    artworkGesture:null,
    rotatingArtworkId:null,
    activeTool: 'select',
    linkedCorners: true,
    selected: [{ type: 'artwork', id: project.artworks[0].id }],
    activeWallId: project.walls[0].id,
    past: [],
    future: [],
    message: null,
    hydrated: false,
    saveStatus: 'loading',
  })
}

describe('editor history and commands', () => {
  beforeEach(reset)

  it('keeps immutable snapshots and clears the redo branch after a new edit', () => {
    const original = useEditor.getState().project
    useEditor.getState().renameProject('첫 수정')
    useEditor.getState().undo()
    useEditor.getState().patchArtwork('artwork-1', { name: '새 작품' })

    const state = useEditor.getState()
    expect(original.name).toBe('여백의 기록')
    expect(state.past).toHaveLength(1)
    expect(state.future).toEqual([])
    expect(state.project.artworks[0].name).toBe('새 작품')
  })

  it('previews a wall drag without saving until one final undoable commit', () => {
    const state=useEditor.getState();
    state.beginWallTransform('wall-a','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:600,z:0});
    expect(useEditor.getState().project.walls[0].start.x).toBe(-4000);
    expect(useEditor.getState().previewProject?.walls[0].start.x).toBe(-3400);
    expect(useEditor.getState().past).toHaveLength(0);
    useEditor.getState().finishWallTransform();
    expect(useEditor.getState().project.walls[0].start.x).toBe(-3400);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.walls[0].start.x).toBe(-4000);
  });

  it('keeps the floor closed when dragging a boundary wall with connected corners enabled',()=>{
    useEditor.getState().beginWallTransform('wall-c','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:580,z:2060});
    const preview=useEditor.getState().previewProject;
    expect(preview).not.toBeNull();
    expect(deriveFloor(preview!.walls).surfaces).toHaveLength(1);
    useEditor.getState().finishWallTransform();
    expect(deriveFloor(useEditor.getState().project.walls).surfaces).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.walls).toEqual(createDemoProject().walls);
  });

  it('uses precision snapping for a 3D wall drag',()=>{
    useEditor.getState().beginWallTransform('wall-c','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:80,z:70},true);
    expect(useEditor.getState().previewProject?.walls[2].start).toEqual({x:4100,z:3100});
  });

  it('restores a damaged sample boundary as one undoable edit',()=>{
    const demo=createDemoProject();
    const damaged={...demo,walls:demo.walls.map(wall=>wall.id==='wall-c'?{...wall,start:{x:4580,z:5060},end:{x:-3420,z:5060}}:wall)};
    useEditor.setState({project:damaged});
    useEditor.getState().restoreDemoSpace();
    expect(deriveFloor(useEditor.getState().project.walls).surfaces).toHaveLength(1);
    expect(useEditor.getState().project.artworks).toEqual(damaged.artworks);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.walls).toEqual(damaged.walls);
  });

  it('stores a 3D camera view with a Scene and restores its project snapshot',()=>{
    const cameraView={position:[-9,7,11] as [number,number,number],target:[1,1,2] as [number,number,number],zoom:75};
    useEditor.getState().saveScene('시점 A',cameraView);
    expect(useEditor.getState().project.scenes[0].cameraView).toEqual(cameraView);
    useEditor.getState().patchArtwork('artwork-1',{alongMm:2000});
    useEditor.getState().restoreScene('scene-1');
    expect(useEditor.getState().project.artworks[0].alongMm).toBe(createDemoProject().artworks[0].alongMm);
    expect(useEditor.getState().project.scenes[0].cameraView).toEqual(cameraView);
  });

  it('cancels a wall drag without changing the project or history',()=>{
    useEditor.getState().beginWallTransform('wall-a','rotate',{x:4000,z:-3000});
    useEditor.getState().updateWallTransform({x:0,z:1000});
    useEditor.getState().finishWallTransform(true);
    expect(useEditor.getState().project.walls[0].start).toEqual({x:-4000,z:-3000});
    expect(useEditor.getState().previewProject).toBeNull();
    expect(useEditor.getState().past).toHaveLength(0);
  });

  it('previews a 3D artwork drag and commits it in one undo step',()=>{
    const original=useEditor.getState().project.artworks[0];
    useEditor.getState().beginArtworkDrag(original.id,{alongMm:1500,centerHeightMm:1520});
    useEditor.getState().updateArtworkDrag({alongMm:2600,centerHeightMm:1900});
    expect(useEditor.getState().project.artworks[0].alongMm).toBe(1400);
    expect(useEditor.getState().previewProject?.artworks[0]).toMatchObject({alongMm:2500,centerHeightMm:1880});
    expect(useEditor.getState().past).toHaveLength(0);
    useEditor.getState().finishArtworkDrag();
    expect(useEditor.getState().project.artworks[0]).toMatchObject({alongMm:2500,centerHeightMm:1880});
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.artworks[0].alongMm).toBe(1400);
  });

  it('moves a 3D artwork onto another wall face in one undoable drop',()=>{
    const original=useEditor.getState().project.artworks[0];
    useEditor.getState().beginArtworkDrag(original.id,{alongMm:1400,centerHeightMm:1500});
    useEditor.getState().updateArtworkDrag({wallId:'wall-b',wallSide:'back',alongMm:2800,centerHeightMm:1600});
    expect(useEditor.getState().project.artworks[0].wallId).toBe('wall-a');
    expect(useEditor.getState().previewProject?.artworks[0]).toMatchObject({wallId:'wall-b',wallSide:'back',alongMm:2800,centerHeightMm:1600});
    useEditor.getState().finishArtworkDrag();
    expect(useEditor.getState().project.artworks[0]).toMatchObject({wallId:'wall-b',wallSide:'back'});
    expect(useEditor.getState().activeWallId).toBe('wall-b');
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.artworks[0]).toMatchObject({wallId:'wall-a',alongMm:1400});
  });

  it('cancels an artwork drag and rejects a locked artwork',()=>{
    const original=useEditor.getState().project;
    useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1400,centerHeightMm:1500});
    useEditor.getState().updateArtworkDrag({alongMm:2800,centerHeightMm:2000});
    useEditor.getState().finishArtworkDrag(true);
    expect(useEditor.getState().project).toBe(original);
    expect(useEditor.getState().past).toHaveLength(0);
    useEditor.getState().patchArtwork('artwork-1',{locked:true});
    useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1400,centerHeightMm:1500});
    expect(useEditor.getState().artworkGesture).toBeNull();
    expect(useEditor.getState().message).toMatch(/잠긴 작품/);
  });

  it('drops a transform preview when changing views',()=>{
    useEditor.getState().beginWallTransform('wall-a','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:500,z:0});
    useEditor.getState().setView('plan');
    expect(useEditor.getState().wallGesture).toBeNull();
    expect(useEditor.getState().previewProject).toBeNull();
    expect(useEditor.getState().project.walls[0].start.x).toBe(-4000);
    useEditor.getState().beginArtworkDrag('artwork-1',{alongMm:1400,centerHeightMm:1500});
    useEditor.getState().updateArtworkDrag({alongMm:2400,centerHeightMm:1800});
    useEditor.getState().setView('3d');
    expect(useEditor.getState().artworkGesture).toBeNull();
    expect(useEditor.getState().previewProject).toBeNull();
    expect(useEditor.getState().project.artworks[0].alongMm).toBe(1400);
  });

  it('preserves a selected wall group during a drag and commits once',()=>{
    useEditor.getState().select({type:'wall',id:'wall-a'});
    useEditor.getState().select({type:'wall',id:'wall-b'},true);
    useEditor.getState().beginWallTransform('wall-a','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:500,z:200});
    const state=useEditor.getState();
    expect(state.selected.map(item=>item.id)).toEqual(['wall-a','wall-b']);
    expect(state.previewProject?.walls[0].start).toEqual({x:-3500,z:-2800});
    expect(state.previewProject?.walls[1].start).toEqual({x:4500,z:-2800});
    expect(state.project.walls[0].start.x).toBe(-4000);
    state.finishWallTransform();
    expect(useEditor.getState().past).toHaveLength(1);
  });

  it('adds a drawn wall as one undoable action',()=>{
    useEditor.getState().drawWall({x:100,z:100},{x:1500,z:1100});
    expect(useEditor.getState().project.walls).toHaveLength(5);
    expect(useEditor.getState().selected[0]).toMatchObject({type:'wall'});
    useEditor.getState().undo();
    expect(useEditor.getState().project.walls).toHaveLength(4);
  });

  it('duplicates and locks a multi-wall selection in single undo steps',()=>{
    useEditor.getState().select({type:'wall',id:'wall-c'});
    useEditor.getState().select({type:'wall',id:'wall-d'},true);
    useEditor.getState().duplicateSelected();
    expect(useEditor.getState().project.walls).toHaveLength(6);
    expect(useEditor.getState().selected).toHaveLength(2);
    useEditor.getState().lockSelected(true);
    expect(useEditor.getState().selected.every(item=>useEditor.getState().project.walls.find(w=>w.id===item.id)?.locked)).toBe(true);
    expect(useEditor.getState().past).toHaveLength(2);
    useEditor.getState().undo();
    expect(useEditor.getState().selected.every(item=>!useEditor.getState().project.walls.find(w=>w.id===item.id)?.locked)).toBe(true);
    useEditor.getState().undo();
    expect(useEditor.getState().project.walls).toHaveLength(4);
  });

  it('detaches a corner when connection editing is off',()=>{
    useEditor.getState().setLinkedCorners(false);
    useEditor.getState().moveWallEndpoint('wall-c','start',{x:4200,z:3100});
    expect(useEditor.getState().project.walls[2].start).toEqual({x:4200,z:3100});
    expect(useEditor.getState().project.walls[1].end).toEqual({x:4000,z:3000});
  });

  it('leaves drawing mode when opening a non-plan view',()=>{
    useEditor.getState().setView('plan');
    useEditor.getState().setTool('draw');
    useEditor.getState().setView('3d');
    expect(useEditor.getState().activeTool).toBe('select');
  });

  it('saves a two-point measurement once and restores it with undo',()=>{
    useEditor.getState().setView('plan');
    useEditor.getState().setTool('measure');
    useEditor.getState().pickMeasurement({kind:'fixed',fallback:{x:0,y:0,z:0}},'plan');
    useEditor.getState().pickMeasurement({kind:'fixed',fallback:{x:3000,y:0,z:4000}},'plan');
    expect(useEditor.getState().measurementDraft?.end).toBeDefined();
    expect(useEditor.getState().project.dimensions).toBeUndefined();
    useEditor.getState().saveMeasurement();
    expect(useEditor.getState().project.dimensions).toHaveLength(1);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().project.dimensions).toBeUndefined();
  });

  it('keeps a geometric preview but rejects an opening collapsed at commit',()=>{
    const project=createDemoProject();
    project.openings=[{id:'door-1',kind:'door',role:'boundary',start:{wallId:'wall-a',endpoint:'start'},end:{wallId:'wall-b',endpoint:'start'},note:''}];
    useEditor.setState({project});
    useEditor.getState().setLinkedCorners(false);
    useEditor.getState().beginWallTransform('wall-a','move',{x:0,z:0});
    useEditor.getState().updateWallTransform({x:8000,z:0});
    expect(useEditor.getState().previewProject).not.toBeNull();
    useEditor.getState().finishWallTransform();
    expect(useEditor.getState().project).toBe(project);
    expect(useEditor.getState().past).toHaveLength(0);
    expect(useEditor.getState().message).toMatch(/개구부 길이/);
  });

  it('keeps only the latest fifty undo snapshots', () => {
    for (let index = 0; index < 55; index += 1) useEditor.getState().renameProject(`수정 ${index}`)
    expect(useEditor.getState().past).toHaveLength(50)
  })

  it('surfaces invalid model operations without changing the project', () => {
    const original = useEditor.getState().project
    useEditor.getState().patchArtwork('artwork-1', { widthMm: -1 })
    expect(useEditor.getState().project).toBe(original)
    expect(useEditor.getState().message).toMatch(/0보다/)
  })

  it('removes deleted entities from selection and keeps an existing active wall', () => {
    useEditor.getState().select({ type: 'artwork', id: 'artwork-1' })
    useEditor.getState().deleteSelected()
    expect(useEditor.getState().selected).toEqual([])

    useEditor.getState().setActiveWall('wall-b')
    useEditor.getState().select({ type: 'wall', id: 'wall-b' })
    useEditor.getState().deleteSelected()
    expect(useEditor.getState().project.walls.some((wall) => wall.id === useEditor.getState().activeWallId)).toBe(true)
  })

  it('stores artworks when deleting their wall and restores one onto the active wall with undo', () => {
    useEditor.getState().select({ type: 'wall', id: 'wall-a' })
    useEditor.getState().deleteSelected()
    expect(useEditor.getState().project.unplacedArtworks?.map(art => art.id)).toEqual(['artwork-1', 'artwork-2', 'artwork-3', 'artwork-4'])
    useEditor.getState().setActiveWall('wall-b')
    useEditor.getState().placeUnplaced('artwork-1')
    expect(useEditor.getState().project.artworks.find(art => art.id === 'artwork-1')?.wallId).toBe('wall-b')
    expect(useEditor.getState().selected).toEqual([{ type: 'artwork', id: 'artwork-1' }])
    useEditor.getState().undo()
    expect(useEditor.getState().project.unplacedArtworks).toHaveLength(4)
    useEditor.getState().undo()
    expect(useEditor.getState().project.walls.some(wall => wall.id === 'wall-a')).toBe(true)
    expect(useEditor.getState().project.artworks.find(art => art.id === 'artwork-1')?.wallId).toBe('wall-a')
  })

  it('sanitizes selection through undo and redo', () => {
    useEditor.getState().select({ type: 'artwork', id: 'artwork-1' })
    useEditor.getState().deleteSelected()
    useEditor.getState().undo()
    expect(useEditor.getState().selected).toEqual([])
    useEditor.getState().redo()
    expect(useEditor.getState().selected).toEqual([])
  })

  it('round-trips artwork positions and wall visibility through a scene', () => {
    useEditor.getState().saveScene('처음')
    const sceneId = useEditor.getState().project.scenes[0].id
    useEditor.getState().patchArtwork('artwork-1', { alongMm: 7777 })
    useEditor.getState().patchWall('wall-a', { visible: false })
    useEditor.getState().restoreScene(sceneId)
    expect(useEditor.getState().project.artworks[0].alongMm).toBe(1400)
    expect(useEditor.getState().project.walls[0].visible).toBe(true)
  })

  it('selects newly added and duplicated entities', () => {
    useEditor.getState().addArtwork(undefined, '추가 작품')
    const added = useEditor.getState().selected[0]
    expect(added.type).toBe('artwork')
    expect(useEditor.getState().project.artworks.some((artwork) => artwork.id === added.id)).toBe(true)
    useEditor.getState().duplicateSelected()
    expect(useEditor.getState().selected[0].id).not.toBe(added.id)
  })

  it('toggles additive selections by type and id', () => {
    useEditor.getState().select({ type: 'artwork', id: 'artwork-2' }, true)
    expect(useEditor.getState().selected).toHaveLength(2)
    useEditor.getState().select({ type: 'artwork', id: 'artwork-1' }, true)
    expect(useEditor.getState().selected).toEqual([{ type: 'artwork', id: 'artwork-2' }])
  })

  it('loads parsed projects and repairs initial selection and active wall', () => {
    const project = updateArtwork(createDemoProject(), 'artwork-1', { name: '불러온 작품' })
    useEditor.getState().loadProject(project)
    expect(useEditor.getState().project.artworks[0].name).toBe('불러온 작품')
    expect(useEditor.getState().selected).toEqual([{ type: 'artwork', id: 'artwork-1' }])
    expect(useEditor.getState().hydrated).toBe(true)
  })

  it('restores an uncalibrated wall draft in plan view instead of a misleading 3D view',async()=>{
    const base=createDemoProject();
    const project={...base,planImageUrl:'data:image/png;base64,AA==',planReference:{widthPx:1000,heightPx:800,origin:{x:0,z:0},mmPerPixel:1,calibrated:false},planDraft:{kind:'partial' as const,sourceEvidenceHash:'00000000',originalWalls:structuredClone(base.walls)}};
    useEditor.setState({view:'3d'});
    await hydrateEditor(async()=>project);
    expect(useEditor.getState().view).toBe('plan');
    expect(useEditor.getState().project.planDraft).toEqual(project.planDraft);
    useEditor.getState().setView('3d');
    expect(useEditor.getState().view).toBe('plan');
  });

  it('adds and duplicates walls at drawing-pixel scale before calibration',()=>{
    const base=createDemoProject();
    const walls=[{...base.walls[0],start:{x:100,z:100},end:{x:900,z:100},role:'partition' as const}];
    const project={...base,walls,artworks:[],scenes:[],planImageUrl:'data:image/png;base64,AA==',planReference:{widthPx:1000,heightPx:800,origin:{x:0,z:0},mmPerPixel:1,calibrated:false},planDraft:{kind:'partial' as const,sourceEvidenceHash:'00000000',originalWalls:structuredClone(walls)}};
    useEditor.getState().loadProject(project);
    useEditor.getState().addWall();
    const added=useEditor.getState().project.walls.at(-1)!;
    expect(Math.hypot(added.end.x-added.start.x,added.end.z-added.start.z)).toBeLessThan(500);
    expect(added.start.x).toBeGreaterThanOrEqual(0);
    useEditor.getState().select({type:'wall',id:walls[0].id});
    useEditor.getState().duplicateSelected();
    const copy=useEditor.getState().project.walls.at(-1)!;
    expect(copy.start.z-walls[0].start.z).toBeLessThan(100);
  });

  it('does not overwrite an edit made while hydration is pending', async () => {
    let resolveRead!: (value: unknown) => void
    const hydration = hydrateEditor(() => new Promise((resolve) => { resolveRead = resolve }))
    useEditor.getState().renameProject('읽는 동안 수정')
    resolveRead({ ...createDemoProject(), name: '저장된 이름' })
    await hydration
    expect(useEditor.getState().project.name).toBe('읽는 동안 수정')
    expect(useEditor.getState().hydrated).toBe(true)
  })

  it('serializes autosaves and reports saved only after the latest write', async () => {
    vi.useFakeTimers()
    useEditor.setState({ hydrated: true, saveStatus: 'saved' })
    const releases: Array<() => void> = []
    const names: string[] = []
    const stop = startAutosave((project) => new Promise<void>((resolve) => {
      names.push(project.name)
      releases.push(resolve)
    }), 10)

    useEditor.getState().renameProject('첫 저장')
    await vi.advanceTimersByTimeAsync(10)
    useEditor.getState().renameProject('둘째 저장')
    await vi.advanceTimersByTimeAsync(10)
    expect(names).toEqual(['첫 저장'])
    releases.shift()?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(names).toEqual(['첫 저장', '둘째 저장'])
    expect(useEditor.getState().saveStatus).toBe('saving')
    releases.shift()?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(useEditor.getState().saveStatus).toBe('saved')
    stop()
    vi.useRealTimers()
  })
})

it('preserves calibrated plan through undo and redo without scaling artwork', () => {
 const state=useEditor.getState(); state.loadProject(createDemoProject());
 const reference={widthPx:1000,heightPx:500,origin:{x:0,z:0},mmPerPixel:5,calibrated:true};
 useEditor.getState().patchProject({planImageUrl:'data:image/png;base64,AAAA',planReference:reference});
 expect(useEditor.getState().project.planReference).toEqual(reference);
 expect(useEditor.getState().project.artworks[0].widthMm).toBe(900);
 useEditor.getState().undo(); expect(useEditor.getState().project.planReference).toBeUndefined();
 useEditor.getState().redo(); expect(useEditor.getState().project.planReference).toEqual(reference);
});

it('adds reviewed walls as one undoable action and restores them with redo', async()=>{
 const {addReviewedWalls}=await import('../domain/reviewedWalls');
 const p={...createDemoProject(),planImageUrl:'data:image/png;base64,AAAA',planReference:{widthPx:800,heightPx:500,origin:{x:0,z:0},mmPerPixel:10,calibrated:true}};
 useEditor.getState().loadProject(p);
 useEditor.getState().commit(addReviewedWalls(p,[{start:{x:10,y:10},end:{x:100,y:10}},{start:{x:10,y:50},end:{x:200,y:50}}],3000,150));
 expect(useEditor.getState().project.walls).toHaveLength(6);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(p);
 useEditor.getState().redo();expect(useEditor.getState().project.walls).toHaveLength(6);
});
it('restores opening attachments with undo and redo after a wall deletion',()=>{
 reset();const p=createDemoProject();p.artworks=[];p.openings=[{id:'opening-test',kind:'door',role:'partition',start:{wallId:p.walls[0].id,endpoint:'start'},end:{wallId:p.walls[1].id,endpoint:'end'},note:'history test'}];useEditor.getState().commit(p);useEditor.getState().select({type:'wall',id:p.walls[0].id});useEditor.getState().deleteSelected();expect(useEditor.getState().project.openings).toHaveLength(0);useEditor.getState().undo();expect(useEditor.getState().project.openings).toEqual(p.openings);useEditor.getState().redo();expect(useEditor.getState().project.openings).toHaveLength(0);
});
