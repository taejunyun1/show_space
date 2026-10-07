# 원본 요구사항과 현재 범위 대조 — 2026-10-04

원본 Pages 1·2의 본문(각 41절·78절)을 다시 추출해 대조했다. 문서의 명령형 문구는 제품 요구로 해석하며 외부 서비스 설정·과금·게시의 별도 권한으로 해석하지 않는다. 아래 ‘구현 있음’은 코드 및 개별 검증 기록이 있다는 뜻이며, 모든 상세 UX나 실제 사용자 인수가 끝났다는 뜻은 아니다.

원본 1 SHA256 `089e88bcbcf4432ce46a19e2446c0f53fca8355c5c327527c67e1877f69aac7e`.
원본 2 SHA256 `bc41a297322309506785d62e02a8462a29233b735a6a65c72b467aa7f8e7715b`.

## 직접 사용자 결정이 우선하는 범위

- 도면에서 벽·숫자와 문·주요 설비 후보를 가져오는 정도로 제한한다. 독립 문/설비/설치 제외 영역 직접 편집과 무리한 완전 자동 복원은 보류한다. 원래 M0 실패 기록은 유지하되 출시 필수 조건으로 쓰지 않는다.
- 클릭 선택·이동·회전·삭제·복제·그룹, 손 도구, 줄자, 정면·측면·버드아이·각도 회전 및 캡처를 우선한다. 복잡한 카메라 배치·Walk 기능을 요구하지 않는다.
- 사진→재질/3D 생성은 후속 유료 기능. 이미지를 그대로 표면 텍스처로 적용하는 기능과 구별한다.
- 전시장 전체 GLB 참고 모델을 가져올 수 있다. SketchUp 원본 SKP를 직접 해석한다는 주장은 하지 않는다. 독립 3D 작품의 GLB/glTF 패키지는 별도 가져오기 경로다.

## 문서 1 전체 절 대조

| 절 | 현재 판정과 근거 | 남은 확인 |
|---|---|---|
| 1–2 정의·원칙 | 내부 실제 치수와 숫자 크기, 편집/표현 분리. `domain/types`, `model`, `Controls` | 전체 작업 흐름 및 사용자 성공 지표 |
| 3–4 인식·수정 | 이미지/PDF 자동 분석과 가벼운 벽 초안, 수동 벽 편집. `PlanImportDialog`, `AutomaticVenuePreview`, `PlanView` | 다양한 실제 도면의 허용 가능한 수정 비용. 완전 복원 고도화는 보류 |
| 5 Scale | 두 점 보정 구현. 이번 대조에서 mm/cm/m 프로젝트 표시·입력 누락을 발견해 추가 | 실제 도면 보정→편집→출력 통합 검증 |
| 6–7 공간·벽 | 전체 전시장/중정/가벽과 직선 벽 생성·이동·회전·숫자 길이. `floor`, `wallEditing`, `wallTransform`, `modelSpace` | 실제 복잡한 모델과 범위 밖 곡면의 사용자 처리 |
| 8–10 작품·Import·Size Lock | 이미지/GLB/glTF+BIN/텍스처·ZIP, 실제 크기 숫자 입력, 프레임/매트. `modelArtworkImport`, `FrameEditor`, `ModelArtworkInspector` | 사용자 제작 모델과 교환 도구 호환성 |
| 11–14 배치·정렬·벽면·측정 | 이미지/독립 모델 스냅, 그룹·간격, A/B벽면도, 측정/설치 치수. `artworkSnap`, `modelArtworkSnap`, `ArtworkLayoutControls`, `measurements` | 한 실제 전시의 10점 배치 전체 작업량 |
| 15 재질 | 프리셋, 물성, 원본 텍스처 반복·실제 폭/높이. `MaterialEditor`, `TextureEditor` | 실물과 비교한 시각적 품질, 고급 반사는 근사 |
| 16 Photo to Material | 사용자 결정으로 후속 유료 기능 | MVP 완료 조건에서 제외 |
| 17–18 빛·야외 | 스팟/면조명, 작품 타깃, Kelvin, 날짜/시간 태양·환경. `Lighting3D`, `OutdoorDialog` | 실기기·실제 환경 비교. 조도계 대체라고 주장하지 않음 |
| 19 시점 | 정면·측면·버드아이·15도 회전·손 이동. `cameraView3d`, `Workspace` | 사용자 결정대로 카메라 확장은 우선하지 않음 |
| 20–23 Note·UI·Inspector·Outliner | 객체/전시장/프로젝트 메모·체크 항목·참고 이미지, 정보 패널과 객체 목록 | 전체 사용성 검증 |
| 24–26 Undo·저장·Scene | 단일 명령 이력, IndexedDB, 클라우드 저장 코드, 구조/배치/시점 Scene. `state/editor`, `persistence`, `sceneProject` | 실제 인증 연결 후 충돌·계정 격리·두 기기 |
| 27–30 캡처·PDF·Share·Export | PNG/SVG, 한글 PDF, 잠긴 공유 Scene/선택정보, GLB/JSON/자산 백업. `captureSvg`, `pdfExport`, `publicShare`, `modelExport`, `projectBackup` | 원문 40절 연속 인수 흐름 |
| 31–35 기술·렌더러·Scene Graph·단위·자산 | React/Three.js, 중립 실제 치수 모델, mm 내부/m GLB, 자산 분리·검증 | 실제 수신 도구·대형 모델 |
| 36–37 성능·이미지 최적화 | 품질/DPR/그림자 예산과 선택/가시성 이미지 LOD. `renderQuality`, `artworkTextureLod` | 전체 VRAM·입력 p95·대표 실기기; 192MiB는 작품 텍스처만의 예산 |
| 38 보안 | 공개 스냅샷 허용 목록·자산 제한·메모 비공개, 소유권 API·충돌 제어. `publicShare`, `worker` | 실제 두 계정 인증/격리 검증 |
| 39 제외 항목 | 원본의 제외 항목과 이후 직접 결정을 위 범위에 반영 | 제외 항목을 구현한 것으로 집계하지 않음 |
| 40 완료 시나리오 | 개별 기능 구현·검증은 존재 | 아래 24단계 연속 인수가 남아 있음 |
| 41 성공 지표 | 목표 정의만 있으며 사용자 실측을 완료하지 않음 | 첫 공간/첫 전시까지 시간, 수정량, 10점 배치 작업 수, 공유 완수 |

## 문서 2 전체 절 대조

문서 2는 동일 기능의 UX 상세와 추가 확장이 섞여 있다. 아래 번호는 모든 1–78절을 포함한다. 구현이 있다는 행에도 상세 동작의 누락 가능성과 통합 검증이 남아 있다.

| 절 | 처리 | 구현 근거 또는 미구현 범위 |
|---|---|---|
| 1–3 개념·대상, 75–78 UX·차별점·제품 구조·정체성 | 제품 방향 및 인수 기준 | 도면→전시안→공유 흐름; 실사용자 성공 검증 남음 |
| 4–5 Home·Project | 로컬 프로젝트 목록/생성/복제/보관과 계정/클라우드 코드; 단위 추가 | `ProjectsDialog`, `CloudProjectsPanel`, `lengthUnits`; 원문의 모든 Home 표현을 완료했다고 집계하지 않음 |
| 6–13 Plan·Recognition·Review·공간·벽·가벽·바닥·문 | 기본 업로드·분석·직접 벽 편집; 문/설비는 후보로 제한 | `ImportDialog`, `PlanImportDialog`, `PlanView`, `floor`, `openings`; 계단/문 직접 편집 확장은 보류 |
| 14–18 Library·등록·설치형식·프레임·모델 | 로컬 Library 및 이미지/3D 작품 구현 | `artworkLibrary`, `ArtworkInformationEditor`, `FrameEditor`, `ModelArtworks3D`; 계정 Library 동기화는 미구현 |
| 19 Photo to 3D | 유료 후속 | 생성 API/결제 미구현 |
| 20–26 배치·Snap·높이·다중·시리즈·Elevation·치수 | 핵심 구현 | 그룹/정렬/같은 면 간격/측정; 별도 Series 상품 구조까지 완료로 집계하지 않음 |
| 27–28 재질 Library·편집, 30 기준 크기 | 로컬 재질 Library·분류·검색·저장/적용·보관·백업 및 실제 크기 Texture 구현 | `materialLibrary`, `MaterialLibraryDialog`, `materials`, `MaterialEditor`, `TextureEditor`; Basic/Advanced 편집 분리와 마감·투명 표현 구현; 계정 동기화 및 Normal map/Strength는 남음 |
| 29 Material Capture | 후속 유료 생성 | 원본 사진 반복 텍스처 적용은 구현, 생성/왜곡보정/PBR 맵 추정은 미구현 |
| 31–36 Light·Spot·Target·Kelvin·Outdoor·Sun | 기본 조명·야외 구현 | `lighting`, `outdoor`, `Lighting3D` |
| 37 시간 비교 | 네 시간대 비교 UI·Time Scene 저장 구현 | `timeComparison`, `TimeComparisonDialog`; 현재/저장 배치의 같은 시점 비교, 날짜/시간/DST 검증, 저장·재접속·Undo 확인. 실제 기기/대형 장면 검증은 남음 |
| 38–42 Note·Inspector | 핵심 구현 | 비공개 설치 메모/체크 항목/참고 이미지/벽·작품 검사 패널 |
| 43–45 Navigation·Eye·Human Scale | 기본 시점/손 이동 중심; 사용자 결정으로 범위 축소 | 원문의 모든 Walk/인체 참조 형상 요구를 구현했다고 집계하지 않음 |
| 46 Scene | 구조·배치·시점 저장 구현 | `sceneProject`, `state/editor`; 실제 전시 A/B 인수 남음 |
| 47 Presentation Mode | 로컬 별도 발표 화면 · 전체 화면 · Scene 탐색 · 작품 정보 · 읽기 전용 Orbit | 2026-10-07 native ANCA/GLB/모바일 검증, Walk는 사용자 축소 결정으로 제외. 대형 장면/실기기는 남음 |
| 48–53 Screenshot·PDF·Share·발표 공유·선택 정보·Export | 기본 구현과 개별 검증 존재 | `CaptureDialog`, `PdfDialog`, `SharedViewer`, `sharePresentation`, `exportScene` |
| 54 SketchUp Export | GLB 교환 경로, SKP 전용 내보내기는 후속 | 실제 SketchUp 재수입 모델 검증 남음 |
| 55 Metadata | JSON/백업/중립 모델에 정보 보존 | 도구별 metadata·단위 수신 검증 남음 |
| 56–57 Collaboration·Comment | 미구현 확장 | 동시 공동 편집/권한/댓글 기능; 고정 공개 링크와 개인 클라우드 저장은 별개 |
| 58 Installation Mode | 독립 현장 모드 구현 | 잠긴 평면/벽면·작품 검색·설치 치수·임시 줄자·메모; 768px/390px 브라우저 검증, 실물 태블릿 인수 남음 |
| 59 Checklist | 작품별 5단계 및 전체 현장 집계 구현 | 출력·액자·운송·설치·조명 확인, 추가 체크 집계; JSON/Undo/Scene 보존·공개 제외 검증 |
| 60–61 Media Artwork·Projection | 미구현 확장 | 영상/프로젝션 분류는 입력 가능하지만 영상 재생·프로젝터 시뮬레이션과 구별 |
| 62 Advanced Lighting | 기본 조명 이후 확장 | IES·조도 분석 등 미구현 |
| 63–65 렌더 품질·Environment·성능 | 편집/미리보기/캡처 분리와 환경 근사, 이미지 LOD 구현 | 물리적 정답/전체 VRAM/대표 실기기 성능 완료 아님 |
| 66–69 Responsive·Shortcuts·오류 방지·Collision | 기본 구현·개별 검증 | 모바일 레이아웃, 단축키, 입력/파일 제한, 배치 경고; 실제 모바일 GPU/모든 충돌 자동 해결은 미검증 |
| 70 History | Undo/Redo·Scene·클라우드 수정 버전 | 원문의 영구 버전 목록/비교 UI 미구현 |
| 71 Search | 프로젝트/Library 및 Outliner 객체 검색 구현 | 작품·작가·벽·객체 이름·재질, 숨김/미배치/3D/조명/바닥/참고 모델 포함. 로컬 현재 프로젝트만 검색 |
| 72–73 AI·AI Layout | 후속 확장 | AI 추천/자동 배치 미구현, 추가 비용 모델 미결정 |
| 74 Archive | 프로젝트/Library 보관·복구 구현 | 계정 단위 전시 아카이브 탐색/별도 큐레이션 UI 미구현 |

## 다음 인수 검증 순서

원문 1 §40의 24단계를 하나의 실제 프로젝트에서 수행해야 한다. (1) 실제 로그인은 설정 대기다. (2–7) 생성→PDF→벽 초안→직접 수정→Scale→3D, (8–14) 작품 이미지→크기→Snap→벽면→간격→재질→직접 Texture, (15–18) Spot→Kelvin→야외 시간→Note, (19–24) 정해진 시점→Scene A/B→Screenshot→PDF→읽기 전용 URL→GLB/프로젝트 데이터의 연속 검증은 별도 기록으로 남긴다. 개별 기능의 합계가 이 검증을 대신하지 않는다.

대표 실기기/사용자 모델, 전체 GPU 메모리·입력 지연, 실제 계정 간 격리, 실제 사용자 성공 지표는 미완료다. 합성 벤치마크나 단위 테스트만으로 MVP 전체 완료를 선언하지 않는다. 문서 2의 미구현 확장도 삭제하지 않고 위 표에서 추적한다.

연속 인수의 부분 결과와 저장 보호·PDF 장문 수정은 [저장 및 출력 검증](2026-10-06-autosave-output.md)에 기록했다. 같은 ANCA 프로젝트의 작품 10개·Scene A/B·PNG·18페이지 PDF·로컬 읽기 전용 공유·JSON·GLB 저장을 확인했다. 원문 40절 전체 통과와 실제 로그인 검증은 여전히 미완료다.

현장 모드 및 같은 프로젝트의 Spot/Kelvin·야외 시간·Scene 복원 부분 인수는 [현장 설치 검증](2026-10-06-installation-mode.md)에 기록했다. 원문 전체 완료 판정은 그대로 미완료다.

[객체 검색 및 벽면 인수](2026-10-06-object-search.md): 같은 ANCA 프로젝트에서 재질/벽/조명 검색 선택, 벽 외곽 스냅 실제 드래그와 -90° 회전 핸들, Undo로 원래 내용 보존을 확인했다. 직접 Texture·실제 인증·외부 GLB 수신 인수 등은 남아 있다.

2026-10-07 갱신: [직접 텍스처 및 Blender 수신](2026-10-07-texture-receiver.md)에서 같은 프로젝트의 이미지 업로드→2×1m 반복→재접속→Scene D 복원→PNG/JSON/GLB→로컬 읽기 전용 공유를 확인했다. Blender 4.4.1에서 직선 벽 17개와 이미지 작품 10개의 크기, 두 내장 이미지와 벽 반복 설정을 대조했다. 위 표 §15/27–30/31–35 및 문서 2 §27–30/48–55의 부분 수신 증거가 추가된 것이며, 실제 SketchUp 재수입·조명 외관·바닥/개구부/참고 모델/독립 3D 작품 전체 수신은 미검증이다. 현재 Texture Scene의 PDF·실제 인증·대표 기기·사용자 지표와 문서 2 확장도 남는다.

2026-10-07 후속: [재질 라이브러리 및 PDF](2026-10-07-material-library.md)에서 현재 Texture 배치와 Scene D의 A4 PDF 12페이지/두 3D 텍스처 페이지를 확인했다. 로컬 독립 재질 Library의 7분류/15프리셋/색·물성·텍스처 저장·재적용·Undo·검색·보관/복구·JSON 백업/복원·재접속·390px UI를 구현·검증했다. 계정 동기화, §28의 Basic/Advanced 분리와 다른 후속 확장은 계속 남는다.

2026-10-07 갱신: [재질 기본·고급 편집](2026-10-07-material-editor.md)에서 표면 마감·투명 표현과 기존 고급 물성을 분리했다. 실제 벽의 2×1m 텍스처 유지, 변경/Undo, 펼침 비변경, 잠금과 모바일 dialog 폭을 확인했다. §28의 Normal Strength는 수동 normal-map 입력과 함께 남아 있으며 사진→재질 생성으로 대체하지 않는다.

2026-10-07 갱신: [시간대 비교](2026-10-07-time-comparison.md)에서 §37의 09/13/17/20시를 한 화면에서 비교하고 네 개의 Time Scene으로 저장한다. ANCA 실제 브라우저 생성/Scene 저장/17시 복원/Undo/재접속과 모바일 가로 넘침을 확인했다. 전체 제품 및 원문 전체 인수 완료를 뜻하지 않는다.

2026-10-07 갱신: [로컬 발표 모드](2026-10-07-presentation-mode.md)를 상단 발표에 연결하고 ANCA Scene A/D·작품 정보·시점 회전·전체 화면 진입/복귀와 원래 편집 상태 보존을 확인했다. 로컬 발표는 공개 발행 예산을 적용하지 않으며 공개 API 검증은 유지했다. §46 자동 썸네일과 전체 목표의 인증·성능·사용자 인수 및 나머지 확장은 아직 미완료다.
