import { create } from 'zustand'
import {
  addArtwork as addArtworkToProject,
  addWall as addWallToProject,
  createDemoProject,
  deleteSelection,
  distributeArtworks,
  duplicateSelection,
  parseProject,
  updateArtwork,
  updateWall,
} from '../domain/model'
import type { Artwork, EntitySelection, Project, Wall } from '../domain/types'
import { readDraft, writeDraft } from '../lib/persistence'

type View = '3d' | 'plan' | 'elevation'
type SaveStatus = 'loading' | 'saved' | 'saving' | 'error'

interface EditorState {
  project: Project
  selected: EntitySelection[]
  view: View
  activeWallId: string
  showDimensions: boolean
  saveStatus: SaveStatus
  message: string | null
  past: Project[]
  future: Project[]
  hydrated: boolean
  select(selection: EntitySelection, additive?: boolean): void
  setView(view: View): void
  setActiveWall(id: string): void
  toggleDimensions(): void
  notify(message: string | null): void
  commit(next: Project): void
  patchArtwork(id: string, patch: Partial<Artwork>): void
  patchWall(id: string, patch: Partial<Wall>): void
  renameProject(name: string): void
  patchProject(patch: Pick<Partial<Project>, 'floorColor' | 'venue' | 'planImageUrl' | 'planOpacity' | 'planReference' | 'planLabels' | 'planAnalysis' | 'sourcePlan'>): void
  addArtwork(imageUrl?: string, name?: string): void
  addWall(): void
  duplicateSelected(): void
  deleteSelected(): void
  spaceSelected(gap: number): void
  undo(): void
  redo(): void
  loadProject(project: Project): void
  saveScene(name: string): void
  restoreScene(id: string): void
  deleteScene(id: string): void
}

const clone = <T,>(value: T): T => structuredClone(value)

function firstSelection(project: Project): EntitySelection[] {
  if (project.artworks[0]) return [{ type: 'artwork', id: project.artworks[0].id }]
  if (project.walls[0]) return [{ type: 'wall', id: project.walls[0].id }]
  return []
}

function validSelection(project: Project, selected: EntitySelection[]) {
  return selected.filter((selection) => selection.type === 'artwork'
    ? project.artworks.some((artwork) => artwork.id === selection.id)
    : project.walls.some((wall) => wall.id === selection.id))
}

function validWall(project: Project, preferred: string) {
  return project.walls.some((wall) => wall.id === preferred) ? preferred : (project.walls[0]?.id ?? '')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '작업을 완료할 수 없습니다.'
}

const initialProject = createDemoProject()

export const useEditor = create<EditorState>((set, get) => {
  const attempt = (operation: () => void) => {
    try { operation() } catch (error) { set({ message: errorMessage(error) }) }
  }
  return {
    project: initialProject,
    selected: firstSelection(initialProject),
    view: '3d',
    activeWallId: 'wall-a',
    showDimensions: true,
    saveStatus: 'loading',
    message: null,
    past: [],
    future: [],
    hydrated: false,
    select: (selection, additive = false) => set((state) => {
      const selected = additive
        ? state.selected.some((item) => item.type === selection.type && item.id === selection.id)
          ? state.selected.filter((item) => item.type !== selection.type || item.id !== selection.id)
          : [...state.selected, selection]
        : [selection]
      const artwork = selection.type === 'artwork' ? state.project.artworks.find((item) => item.id === selection.id) : undefined
      return { selected, activeWallId: selection.type === 'wall' ? selection.id : (artwork?.wallId ?? state.activeWallId) }
    }),
    setView: (view) => set({ view }),
    setActiveWall: (activeWallId) => set({ activeWallId }),
    toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
    notify: (message) => set({ message }),
    commit: (next) => set((state) => ({
      project: clone(next),
      past: [...state.past, clone(state.project)].slice(-50),
      future: [],
      message: null,
      selected: validSelection(next, state.selected),
      activeWallId: validWall(next, state.activeWallId),
    })),
    patchArtwork: (id, patch) => attempt(() => get().commit(updateArtwork(get().project, id, patch))),
    patchWall: (id, patch) => attempt(() => get().commit(updateWall(get().project, id, patch))),
    renameProject: (name) => get().commit({ ...get().project, name }),
    patchProject: (patch) => get().commit({ ...get().project, ...patch }),
    addArtwork: (imageUrl, name) => attempt(() => {
      const next = addArtworkToProject(get().project, imageUrl, name)
      const created = next.artworks[next.artworks.length - 1]
      get().commit(next)
      set({ selected: [{ type: 'artwork', id: created.id }], activeWallId: created.wallId })
    }),
    addWall: () => attempt(() => {
      const next = addWallToProject(get().project)
      const created = next.walls[next.walls.length - 1]
      get().commit(next)
      set({ selected: [{ type: 'wall', id: created.id }], activeWallId: created.id })
    }),
    duplicateSelected: () => attempt(() => {
      const selection = get().selected[0]
      if (!selection) throw new Error('복제할 항목을 선택해 주세요.')
      const result = duplicateSelection(get().project, selection)
      get().commit(result.project)
      set({ selected: [result.selection], activeWallId: result.selection.type === 'wall'
        ? result.selection.id
        : result.project.artworks.find((item) => item.id === result.selection.id)?.wallId ?? get().activeWallId })
    }),
    deleteSelected: () => attempt(() => {
      const selections = get().selected
      if (!selections.length) throw new Error('삭제할 항목을 선택해 주세요.')
      const next = selections.reduce((project, selection) => deleteSelection(project, selection), get().project)
      get().commit(next)
      set({ selected: [] })
    }),
    spaceSelected: (gap) => attempt(() => {
      const ids = get().selected.filter((item) => item.type === 'artwork').map((item) => item.id)
      get().commit(distributeArtworks(get().project, ids, gap))
    }),
    undo: () => set((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      const project = clone(previous)
      return { project, past: state.past.slice(0, -1), future: [clone(state.project), ...state.future].slice(0, 50), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    redo: () => set((state) => {
      const next = state.future[0]
      if (!next) return state
      const project = clone(next)
      return { project, past: [...state.past, clone(state.project)].slice(-50), future: state.future.slice(1), selected: validSelection(project, state.selected), activeWallId: validWall(project, state.activeWallId), message: null }
    }),
    loadProject: (project) => attempt(() => {
      const parsed = parseProject(project)
      set({ project: parsed, selected: firstSelection(parsed), activeWallId: validWall(parsed, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
    }),
    saveScene: (name) => attempt(() => {
      const project = get().project
      const used = new Set(project.scenes.map((scene) => scene.id))
      let index = 1
      while (used.has(`scene-${index}`)) index += 1
      get().commit({ ...project, scenes: [...project.scenes, { id: `scene-${index}`, name, artworks: clone(project.artworks), wallVisibility: Object.fromEntries(project.walls.map((wall) => [wall.id, wall.visible])) }] })
    }),
    restoreScene: (id) => attempt(() => {
      const project = get().project
      const scene = project.scenes.find((item) => item.id === id)
      if (!scene) throw new Error('장면을 찾을 수 없습니다.')
      const wallIds = new Set(project.walls.map((wall) => wall.id))
      const artworks = clone(scene.artworks.filter((artwork) => wallIds.has(artwork.wallId)))
      const walls = project.walls.map((wall) => ({ ...wall, visible: scene.wallVisibility[wall.id] ?? wall.visible }))
      get().commit({ ...project, artworks, walls })
    }),
    deleteScene: (id) => get().commit({ ...get().project, scenes: get().project.scenes.filter((scene) => scene.id !== id) }),
  }
})

export async function hydrateEditor(reader: () => Promise<unknown> = readDraft): Promise<void> {
  const projectAtStart = useEditor.getState().project
  try {
    const raw = await reader()
    if (useEditor.getState().project !== projectAtStart) {
      useEditor.setState({ hydrated: true, saveStatus: 'saved' })
      return
    }
    if (raw === undefined) {
      useEditor.setState({ hydrated: true, saveStatus: 'saved' })
      return
    }
    const project = parseProject(raw)
    useEditor.setState({ project, selected: firstSelection(project), activeWallId: validWall(project, ''), past: [], future: [], hydrated: true, saveStatus: 'saved', message: null })
  } catch (error) {
    useEditor.setState({ hydrated: true, saveStatus: 'error', message: `저장된 프로젝트를 불러오지 못했습니다. ${errorMessage(error)}` })
  }
}

export function startAutosave(
  writer: (project: Project) => Promise<void> = writeDraft,
  debounceMs = 250,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastProject = useEditor.getState().project
  let queued = Promise.resolve()
  let revision = 0
  const unsubscribe = useEditor.subscribe((state) => {
    if (!state.hydrated || state.project === lastProject) return
    lastProject = state.project
    if (timer) clearTimeout(timer)
    useEditor.setState({ saveStatus: 'saving' })
    const scheduledRevision = ++revision
    timer = setTimeout(() => {
      const snapshot = state.project
      queued = queued.then(() => writer(snapshot)).then(
        () => {
          if (scheduledRevision === revision) useEditor.setState({ saveStatus: 'saved' })
        },
        (error: unknown) => useEditor.setState({ saveStatus: 'error', message: `프로젝트를 저장하지 못했습니다. ${errorMessage(error)}` }),
      )
    }, debounceMs)
  })
  return () => { if (timer) clearTimeout(timer); unsubscribe() }
}
