import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProject, updateArtwork } from '../domain/model'
import { hydrateEditor, startAutosave, useEditor } from './editor'

const reset = () => {
  const project = createDemoProject()
  useEditor.setState({
    project,
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
