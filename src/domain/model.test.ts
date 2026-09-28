import { describe, expect, it } from 'vitest'
import {
  addArtwork, addWall, artworkPosition, artworkWarnings, canRestoreDemoBoundary, createDemoProject, deleteSelection,
  distributeArtworks, duplicateSelection, mmToMeters, normalizeArtworkAngle, parseProject, placeUnplacedArtwork, restoreDemoBoundary, rotatedArtworkSize, updateArtwork, updateWall, wallLength,
} from './model'
import {deriveFloor} from './floor'

describe('exhibition domain model', () => {
  it('calculates wall lengths and converts millimetres', () => {
    expect(wallLength({ ...createDemoProject().walls[0], end: { x: 1200, z: 1000 }, start: { x: -4000, z: 1000 } })).toBe(5200)
    expect(mmToMeters(1250)).toBe(1.25)
  })

  it('places artwork against a rotated wall using its inward normal', () => {
    const wall = { ...createDemoProject().walls[0], start: { x: 0, z: 0 }, end: { x: 3000, z: 4000 } }
    const artwork = { ...createDemoProject().artworks[0], alongMm: 2500 }
    expect(artworkPosition(artwork, wall)).toEqual({ x: 1420, y: 1500, z: 2060, rotationY: -0.9272952180016123 })
  })

  it('updates a shared corner without mutating the project', () => {
    const project = createDemoProject()
    const updated = updateWall(project, 'wall-a', { end: { x: 4200, z: -2800 } })
    expect(updated.walls[1].start).toEqual({ x: 4200, z: -2800 })
    expect(project.walls[1].start).toEqual({ x: 4000, z: -3000 })
  })

  it('enforces locked and finite-value rules', () => {
    const project = updateArtwork(createDemoProject(), 'artwork-1', { locked: true })
    expect(() => updateArtwork(project, 'artwork-1', { alongMm: 2 })).toThrow(/잠/)
    expect(updateArtwork(project, 'artwork-1', { name: '새 이름' }).artworks[0].name).toBe('새 이름')
    expect(() => updateWall(createDemoProject(), 'wall-a', { heightMm: Number.NaN })).toThrow(/유한/)
  })

  it('distributes varying widths with exact edge gaps', () => {
    let project = createDemoProject()
    project = updateArtwork(project, 'artwork-1', { widthMm: 800 })
    project = updateArtwork(project, 'artwork-2', { widthMm: 1200 })
    project = distributeArtworks(project, ['artwork-2', 'artwork-1'], 100)
    const [a, b] = project.artworks
    expect((b.alongMm - b.widthMm / 2) - (a.alongMm + a.widthMm / 2)).toBe(100)
  })

  it('spaces rotated artworks using their visible widths', () => {
    const project = updateArtwork(createDemoProject(), 'artwork-1', { rotationDeg: 90 })
    const distributed = distributeArtworks(project, ['artwork-1', 'artwork-2'], 100)
    const [first, second] = distributed.artworks
    const gap = second.alongMm - rotatedArtworkSize(second).widthMm / 2 - first.alongMm - rotatedArtworkSize(first).widthMm / 2
    expect(gap).toBe(100)
  })

  it('reports all physical-boundary warnings', () => {
    const wall = createDemoProject().walls[0]
    const artwork = { ...createDemoProject().artworks[0], alongMm: 50, centerHeightMm: 200, heightMm: 1000 }
    expect(artworkWarnings(artwork, wall)).toHaveLength(2)
  })

  it('rotates artwork around its center and checks the visible wall footprint', () => {
    const project = createDemoProject()
    const original = project.artworks[0]
    const rotated = updateArtwork(project, original.id, { alongMm: 500, rotationDeg: 90 }).artworks[0]
    expect(rotatedArtworkSize(rotated)).toEqual({ widthMm: 1200, heightMm: 900 })
    expect(artworkWarnings({ ...rotated, rotationDeg: 0 }, project.walls[0])).not.toContain('작품이 벽의 좌우 경계를 벗어납니다.')
    expect(artworkWarnings(rotated, project.walls[0])).toContain('작품이 벽의 좌우 경계를 벗어납니다.')
    expect(parseProject({ ...project, artworks: [{ ...original, rotationDeg: 90 }] }).artworks[0].rotationDeg).toBe(90)
    expect(() => updateArtwork(project, original.id, { rotationDeg: Number.NaN })).toThrow(/회전/)
    expect(() => updateArtwork(project, original.id, { rotationDeg: 181 })).toThrow(/회전/)
  })

  it('wraps repeated quarter turns to a stable signed angle', () => {
    expect(normalizeArtworkAngle(180 + 90)).toBe(-90)
    expect(normalizeArtworkAngle(-90 - 90)).toBe(180)
    expect(normalizeArtworkAngle(45)).toBe(45)
  })

  it('rejects malformed projects and unsafe URLs', () => {
    const project = createDemoProject()
    expect(() => parseProject({ ...project, schemaVersion: 2 })).toThrow(/스키마/)
    expect(() => parseProject({ ...project, artworks: [{ ...project.artworks[0], imageUrl: 'javascript:alert(1)' }] })).toThrow(/이미지/)
    expect(() => parseProject({ ...project, walls: [{ ...project.walls[0], heightMm: Infinity }] })).toThrow(/유한/)
  })

  it('round-trips a demo project into an independent clone', () => {
    const demo = createDemoProject()
    const parsed = parseProject(JSON.parse(JSON.stringify(demo)))
    expect(parsed).toEqual(demo)
    expect(parsed).not.toBe(demo)
  })

  it('restores a damaged demo boundary without discarding artwork edits',()=>{
    const demo=createDemoProject();
    const edited=updateArtwork({...demo,walls:demo.walls.map(wall=>wall.id==='wall-c'?{...wall,start:{x:4580,z:5060},end:{x:-3420,z:5060}}:wall)},'artwork-1',{name:'수정한 작품'});
    expect(deriveFloor(edited.walls).surfaces).toHaveLength(0);
    expect(canRestoreDemoBoundary(edited)).toBe(true);
    expect(canRestoreDemoBoundary({...edited,planImageUrl:'data:image/png;base64,AA=='})).toBe(false);
    const restored=restoreDemoBoundary(edited);
    expect(deriveFloor(restored.walls).surfaces).toHaveLength(1);
    expect(restored.artworks).toEqual(edited.artworks);
    expect(restored.walls.find(wall=>wall.id==='wall-c')?.start).toEqual(demo.walls[2].start);
    expect(edited.walls[2].start).toEqual({x:4580,z:5060});
  });

  it('rejects an invalid saved Scene camera view',()=>{
    const project=createDemoProject();
    project.scenes=[{id:'scene-1',name:'시점',artworks:[],wallVisibility:{},cameraView:{position:[1,2,3],target:[0,0,0],zoom:0}}];
    expect(()=>parseProject(project)).toThrow(/시점/);
  });

  it('adds a renderable default artwork that remains importable', () => {
    const project = addArtwork(createDemoProject())
    expect(project.artworks.at(-1)?.imageUrl).toBe('/artworks/artwork-1.png')
    expect(parseProject(project)).toEqual(project)
  })

  it('removes deleted-wall references from saved scenes', () => {
    const demo = createDemoProject()
    const snapshot = { ...demo.artworks[0], id: 'snapshot-on-c', wallId: 'wall-c' }
    const project = { ...demo, scenes: [{ id: 'scene-1', name: '장면', artworks: [snapshot, demo.artworks[1]], wallVisibility: { 'wall-a': true, 'wall-c': false } }] }
    const deleted = deleteSelection(project, { type: 'wall', id: 'wall-c' })
    expect(deleted.scenes[0].wallVisibility).toEqual({ 'wall-a': true })
    expect(deleted.scenes[0].artworks.map(item => item.id)).toEqual(['artwork-2'])
    expect(parseProject(deleted)).toEqual(deleted)
  })

  it('keeps artworks from a deleted wall in an importable unplaced list and reattaches them',()=>{
    const demo=createDemoProject();
    const deleted=deleteSelection(demo,{type:'wall',id:'wall-a'});
    expect(deleted.artworks.map(art=>art.id)).toEqual(['artwork-5']);
    expect(deleted.unplacedArtworks?.map(art=>art.id)).toEqual(['artwork-1','artwork-2','artwork-3','artwork-4']);
    expect(deleted.unplacedArtworks?.[0].imageUrl).toBe(demo.artworks[0].imageUrl);
    expect(parseProject(deleted)).toEqual(deleted);
    const placed=placeUnplacedArtwork(deleted,'artwork-1','wall-b');
    expect(placed.artworks.find(art=>art.id==='artwork-1')).toMatchObject({wallId:'wall-b',name:demo.artworks[0].name});
    expect(placed.unplacedArtworks?.map(art=>art.id)).toEqual(['artwork-2','artwork-3','artwork-4']);
    expect(parseProject(placed)).toEqual(placed);
  });

  it('prevents deletion of a wall with locked artwork and rejects malformed unplaced entries',()=>{
    const demo=updateArtwork(createDemoProject(),'artwork-1',{locked:true});
    expect(()=>deleteSelection(demo,{type:'wall',id:'wall-a'})).toThrow(/잠긴 작품/);
    const unplaced={...demo.artworks[0],id:'unplaced-1'};
    expect(()=>parseProject({...demo,unplacedArtworks:[unplaced]})).toThrow(/설치 벽/);
    const {wallId:_,...withoutWall}=unplaced;
    expect(()=>parseProject({...demo,unplacedArtworks:[{...withoutWall,id:'artwork-1'}]})).toThrow(/중복/);
  });

  it('rejects empty rooms and IDs shared across entity kinds', () => {
    const demo = createDemoProject()
    expect(() => parseProject({ ...demo, walls: [] })).toThrow(/벽/)
    expect(() => parseProject({ ...demo, artworks: [{ ...demo.artworks[0], id: 'wall-a' }] })).toThrow(/중복/)
  })

  it('enforces creation caps without changing the source project', () => {
    const demo = createDemoProject()
    const walls = Array.from({ length: 200 }, (_, index) => ({ ...demo.walls[0], id: `w-${index}` }))
    const artworks = Array.from({ length: 500 }, (_, index) => ({ ...demo.artworks[0], id: `a-${index}` }))
    const wallLimit = { ...demo, walls, artworks: [] }
    const artworkLimit = { ...demo, artworks }
    expect(() => addWall(wallLimit)).toThrow(/200/)
    expect(() => duplicateSelection(wallLimit, { type: 'wall', id: 'w-0' })).toThrow(/200/)
    expect(() => addArtwork(artworkLimit)).toThrow(/500/)
    expect(() => duplicateSelection(artworkLimit, { type: 'artwork', id: 'a-0' })).toThrow(/500/)
    expect(wallLimit.walls).toHaveLength(200)
    expect(artworkLimit.artworks).toHaveLength(500)
  })

  it('accepts only renderable local sample paths or raster data images', () => {
    const demo = createDemoProject()
    for (const imageUrl of ['', '/artworks/missing.png', '/artworks/artwork-6.png', 'data:image/svg+xml;base64,PHN2Zz4=']) {
      expect(() => parseProject({ ...demo, artworks: [{ ...demo.artworks[0], imageUrl }] })).toThrow(/이미지/)
    }
    expect(() => addArtwork(demo, '/artworks/missing.png')).toThrow(/이미지/)
    expect(() => updateArtwork(demo, 'artwork-1', { imageUrl: '' })).toThrow(/이미지/)
  })
})
