import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {appendSceneSnapshot} from './sceneSnapshot';
import {archiveLayout,archiveMaterials,archiveNotes,archivePhotos,archiveYear,filterArchiveProjects,type ArchiveSummary} from './projectArchive';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
it('keeps current and historical Scene records detached, including Scene-only private reference photos',()=>{
 let p=createDemoProject();p.note='프로젝트 비공개 메모';p.artworks[0].note='과거 설치';p.artworks[0].noteDetails={checklist:[{id:'check',text:'설치',done:true}],images:[{id:'photo',name:'과거 사진.png',imageUrl:png}]};p=appendSceneSnapshot(p,p,'과거 설치안');p.artworks=p.artworks.slice(1);const before=structuredClone(p),scene=archiveLayout(p,p.scenes[0].id);
 expect(archiveNotes(p).map(n=>n.text)).not.toContain('과거 설치');expect(archiveNotes(scene).map(n=>n.text)).toContain('과거 설치');expect(archivePhotos(p)).toHaveLength(1);expect(archivePhotos(p)[0].sources).toContain('과거 설치안 · 작품 · 고요한 면');expect(archivePhotos(p)[0].imageUrl).toBe(png);
 scene.artworks[0].alongMm+=500;expect(p).toEqual(before);expect(()=>archiveLayout(p,'missing')).toThrow();
});
it('deduplicates photo bytes while retaining each source and reads all material and note targets',()=>{
 const p=createDemoProject(),details={checklist:[],images:[{id:'p',name:'사진.png',imageUrl:png}]};p.noteDetails=details;p.floorNote='바닥 기록';p.floorNoteDetails=details;p.walls[0].note='벽 기록';p.artworks[0].noteDetails=details;const before=structuredClone(p);
 const gallery=archivePhotos(p);expect(gallery).toHaveLength(1);expect(gallery[0].sources).toHaveLength(3);expect(archiveNotes(p).map(n=>n.key)).toEqual(expect.arrayContaining(['project','floor','wall:wall-a','artwork:artwork-1']));expect(archiveMaterials(p)).toHaveLength(1+p.walls.length+p.artworks.length);expect(p).toEqual(before);
});
it('filters archive state, Korean normalized terms and Korea-time modification years without mutating the list',()=>{
 const base={venue:'서울 갤러리',revision:1,createdAt:'2024-01-01T00:00:00Z'},items:ArchiveSummary[]=[{...base,id:'a',name:'가 전시',updatedAt:'2025-12-31T16:00:00Z',archived:true},{...base,id:'b',name:'나 전시',updatedAt:'2025-12-31T14:00:00Z',archived:false}];const before=structuredClone(items);
 expect(archiveYear(items[0])).toBe('2026');expect(archiveYear(items[1])).toBe('2025');expect(filterArchiveProjects(items,'가 서울'.normalize('NFD'),'archived','2026','updated').map(p=>p.id)).toEqual(['a']);expect(filterArchiveProjects(items,'','active','','name').map(p=>p.id)).toEqual(['b']);expect(items).toEqual(before);
});
