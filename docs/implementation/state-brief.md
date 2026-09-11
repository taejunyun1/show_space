# Local persistence and history
Own ONLY src/state/editor.ts, src/state/editor.test.ts, src/lib/persistence.ts, src/lib/persistence.test.ts. Root owns UI; domain agent owns src/domain. npm installing. Do not change package files. No git repository. Write report docs/implementation/state-report.md.
Use Zustand store; import Project,EntitySelection,Artwork,Wall from ../domain/types and domain functions from model (agent implementing). Read domain-brief for types.

Export useEditor from editor.ts with Zustand state contract:
project:Project (initial createDemoProject), selected:EntitySelection[] (initial artwork first), view:'3d'|'plan'|'elevation' initial3d, activeWallId:string initialwall-a, showDimensions:boolean true, saveStatus:'loading'|'saved'|'saving'|'error', message:string|null, past:Project[], future:Project[], hydrated:boolean false.
select(selection:EntitySelection, additive?:boolean):void; additive toggles matching selection else replaces; artwork selects its wallId as activeWallId, wall selects id.
setView(view), setActiveWall(id), toggleDimensions(), notify(message:string|null).
commit(next:Project):void pushes clone previous max50 undo, clears redo, sets project, message null. Must not mutate state; catches user operation errors in action wrapper notify.
patchArtwork(id,patch:Partial<Artwork>),patchWall(id,patch:Partial<Wall>),renameProject(name:string), addArtwork(imageUrl?:string,name?:string),addWall(),duplicateSelected(),deleteSelected(),spaceSelected(gap:number) delegates model, selects created entities; selection sanitized after delete/undo/redo.
undo(),redo(),loadProject(project:Project) validate with parseProject, resets past/future selection to first artwork orwall and activeWall toexisting. Mark hydrated true for explicit load.
saveScene(name:string): store snapshot artworks + wall visibility with unique id;restoreScene(id:string): use saved artwork snapshot filtered to validwall references and wallVisibility, perform as one commit; deleteScene(id).
patchProject(patch:Pick<Partial<Project>,'floorColor'|'venue'|'planImageUrl'|'planOpacity'>)

Export hydrateEditor():Promise<void> reads storage, parseProject, updates hydrated; on invalid stored content preserve raw storage (no automatic overwrite), show error, allow explicit edits/load to save replacement. Export startAutosave():()=>void subscribes to project changes after hydrated, debounce250ms; avoid stale asynchronous saves out of order; errors show error and message; statuses truthful. Use idb-keyval (dependency) get/set with key 'gonggan-project-v1'. Hydration must not overwrite edits done while read pending: if project changed preserve edits. Prefer separate persistence module functions readDraft/writeDraft (export) accepts Project unknown read.

Test substantive history immutability, redo branch cleared, max50history, invalid input errors surfaced, deleting removes selection, active wall valid, scene roundtrip; test persistence serialization async ordering/hydration edits if feasible with dependency injection, no fake-indexeddb currently. Pure controller helpers acceptable if editor contract maintained. Do not build UI. Tests before implementation; domain may not yet exist, coordinate via message. Keep code focused.
