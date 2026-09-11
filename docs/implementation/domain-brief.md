# Local editor domain milestone
Implement ONLY src/domain/types.ts, src/domain/model.ts, src/domain/model.test.ts. Root agent owns package files, UI, store. No git repository currently; do not initialize or commit. Use test-first development, npm test available after install. Write report docs/implementation/domain-report.md.

Contracts (export exactly these):
Point { x:number; z:number } mm.
Wall { id:string; name:string; start:Point; end:Point; heightMm:number; thicknessMm:number; color:string; visible:boolean; locked:boolean; note:string }
Artwork { id:string; name:string; artist:string; widthMm:number; heightMm:number; depthMm:number; wallId:string; alongMm:number; centerHeightMm:number; frame:'black'|'natural'|'white'|'none'; imageUrl:string; visible:boolean; locked:boolean; note:string }
Scene { id:string; name:string; artworks:Artwork[]; wallVisibility:Record<string,boolean> }
Project { schemaVersion:1; id:string; name:string; venue:string; walls:Wall[]; artworks:Artwork[]; scenes:Scene[]; floorColor:string; planImageUrl?:string; planOpacity?:number }
EntitySelection {type:'wall'|'artwork'; id:string}

Functions:
createDemoProject():Project: 8000mm x 6000mm rectangular room walls wall-a from {-4000,-3000} to {4000,-3000}, wall-b from {4000,-3000} to {4000,3000}, wall-c from {4000,3000} to {-4000,3000}, wall-d from {-4000,3000} to {-4000,-3000}; 3200mm high, 160 thick. All visible. Names 벽 A etc. 4 artworks back wall A positions alongMm 1400,3100,4800,6500 and 1 on B at 2800; each width900 height1200 depth30 center1500, natural frames. Names 고요한 면, 빛의 간격, 잔상, 겹쳐진 시간, 여백; imageUrl /artworks/artwork-1.png through artwork-5.png. Name 여백의 기록, venue 성수 갤러리. Empty scenes.
wallLength(wall):number;
mmToMeters(value):number;
artworkPosition(artwork,wall): {x:number;y:number;z:number;rotationY:number} all position mm. Artwork along wall measured to CENTER. Room walls oriented clockwise in X/Z; inward normal (-dz,0,dx), place artwork at wall half thickness + artwork half depth + 5mm toward inward normal. Artwork faces positive local Z, rotation atan2(normal.x,normal.z).
updateWall(project,id,patch:Partial<Wall>):Project; immutable, shared matching endpoints update connected walls when start/end changed. Reject nonfinite/zero length or nonpositive sizes via throw Error. Locked wall updates numeric position/size rejected except name/note/locked/visible allowed.
updateArtwork(project,id,patch:Partial<Artwork>):Project; immutable reject invalid nonpositive sizes, nonfinite position, invalid wallId; reject placement/dimension/frame mutation on locked artwork but permit name/note/visible/locked. Clamp? Do not clamp out-of-bounds; warning function handles.
addWall(project):Project; new standalone wall 3000 length, unique id.
addArtwork(project,imageUrl?:string,name?:string):Project; new unique artwork on first wall, width900 height1200 etc.
duplicateSelection(project,selection):{project:Project;selection:EntitySelection}; offset artwork along 200 or wall z 400, unique id, copies unlocked.
deleteSelection(project,selection):Project; disallow deleting locked selection; disallow deleting last wall; disallow wall deletion with attached artworks (clear Korean error explains to move works first), preserve other state.
distributeArtworks(project,ids:string[],spacingMm:number):Project; min 2, same wall, none locked; sort along; keep left edge of first, gap between actual edges exactly spacing; throw Korean errors for invalid selection/gap.
artworkWarnings(artwork,wall):string[]: extends beyond wall edges, below floor, above wall.
parseProject(input:unknown):Project; full validation imported JSON including enum values, duplicate ids, wall refs, safe image URL data:image/png/jpeg/webp or /artworks/... only (reject http remote/script/svg), finite dims, schema, scene artwork refs/wall visibility; limit counts 200 walls 500 artworks and image string max 12MB, no silent invalid schema. Return clone; reject clear Korean errors. Treat scene snapshots separately: objects can be missing from current scene but references to existing walls required.

Tests meaningful: 5200 wall length; mm→m; rotated wall artwork placement; spacing between varying widths; shared corner update; locked behavior; nonfinite input; malformed project; round-trip demo. Test absence/missing implementation then implement. Report actual command/results.
