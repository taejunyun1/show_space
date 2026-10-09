# 속성 편집의 대상 보호와 치수·간격·재질·조명 UI 연결

2026-10-09. 원문 1의 치수/배치·재질·Spot/Kelvin 흐름을 실제 React 속성 화면에서 확인했다. 도면 인식이나 사진→재질 생성 범위를 확장하지 않는다.

## 재현과 수정

같은 치수의 다른 작품을 선택하면 NumberField의 아직 확정하지 않은 입력값이 남았다. 프로젝트·벽 선택이 A→B→A로 한 React batch에서 바뀌면 기존 MaterialEditor가 계속 유지돼 이전 텍스처/노멀 결과가 적용됐다. 바닥 재질도 프로젝트 왕복 뒤 늦은 이미지가 현재 항목에 적용됐다. 벽 잠금→해제를 한 batch에서 실행해도 이전 노멀 작업이 살아 있었다.

`useEditorEditScope`는 실제 store의 프로젝트 ID·첫 선택의 종류/ID·존재/잠금 전환을 동기적으로 기록한다. Inspector의 편집 하위 화면을 이 버전으로 구분해 미확정 입력과 처리 표시를 비운다. MaterialEditor 결과 callback도 버전을 확인해 React가 아직 이전 화면을 유지하는 순간의 비동기 완료를 막는다. 바닥은 선택한 객체와 독립적인 고정 대상이므로 프로젝트 전환만 감시한다. 바닥 MaterialEditor·NoteEditor도 버전으로 구분한다. 이미 시작한 이미지 decoder 계산을 강제로 중단하는 구현은 아니다.

같은 대상에서 재질 프리셋·거칠기를 바꾸는 정상 편집은 입력을 폐기하지 않는다. 완료한 이미지는 최신 재질 설정에 합쳐진다. 객체 선택/잠금 전환에서 버린 입력은 재선택해야 한다. 일반 속성 편집은 기존 command/Undo 구조를 그대로 사용한다.

## 검증

새 `Inspector.workflow.test.tsx` 13개는 실제 React createRoot/StrictMode/act, Inspector·FloorMaterialDialog·MaterialEditor·TextureEditor·NormalMapEditor·NumberField·ArtworkLayoutControls·LightInspector, Zustand/생산용 편집 command·Scene·parser를 실행한다. 객체 선택의 입력 경계는 store command이며 실제 캔버스 hit-test·마우스 선택을 증명하지 않는다.

- 같은 값의 다른 작품 선택, 선택 왕복, 프로젝트 왕복 후 미확정 W 입력이 123cm에서 현재 90cm로 초기화된다. 이후 blur로 다른 작품/히스토리를 변경하지 않는다.
- 벽 선택 왕복 뒤 이전 텍스처/노멀의 지연 결과·처리 표시를 폐기한다.
- 이전 작업이 아직 pending이어도 새 화면의 텍스처 불러오기 버튼이 열려 새 입력을 시작한다. 이전 오류/finally가 새 작업을 끝내거나 알림을 바꾸지 않는다.
- 프로젝트 왕복 후 바닥 이미지가 적용되지 않는다. 같은 React batch 안에서 decoder 완료가 도착하는 경우도 차단한다.
- 벽 잠금/해제 왕복 뒤 이전 노멀을 적용하지 않는다.
- 실제 cm W 입력 95→950mm, 작품 3점 그룹, 본체 외곽 35→350mm 간격, Undo/Redo, 같은 delta 그룹 이동, 그룹 B면 변경·공통 중심 높이 1650mm와 첫 작품의 90° 회전을 확인한다.
- 실제 Spot 5500K·120cd·35° 설정, X 30cm 이동과 같은 300mm 조준점 이동, Area 1500×750mm, 잠금·해제/Undo를 확인한다. 조명 광도·색온도·각도 값은 길이 단위로 환산하지 않는다.
- 텍스처 처리 중 목재 프리셋/37% 거칠기를 편집해도 완료 시 설정이 유지된다. 이미지 추가는 한 번의 Undo로 복원된다.
- native 32×16 PNG를 생산용 이미지/WebP 및 수동 DirectX 노멀 입력으로 읽는다. 실제 이미지 한 장의 반복 크기 2000×1000mm, 별도 노멀 반복 500×250mm/강도 150%, 녹색 반전 픽셀 `[128,200,255,255]→[128,55,255,255]`, bitmap 해제를 확인한다. Scene 저장/복원과 JSON parser 왕복에서 재질과 맵이 유지된다.

작업 지연 사례는 decoder 완료를 제어하며 정상 native 입력 사례는 실제 readSurfaceTexture/readSurfaceNormal을 사용한다. File·Image·Canvas·dialog는 Node/native/jsdom adapter다. 실제 GPU 물성·조명 외관·브라우저 숫자 입력·저장 디스크/클라우드의 근거로 확대하지 않는다. Scene/JSON 왕복은 메모리 데이터 기준이며 이 테스트가 IndexedDB 저장 완료를 검증한 것은 아니다.

## 결과

[검증 기록](../validation/2026-10-09-inspector-workflow.json). 같은 13개를 이전 HEAD `bb4686e`의 Inspector·FloorMaterialDialog에 대조하면 **9 실패 / 4 통과**, 수정 후 **13 통과**다. 전체 **1,253 통과 / 선택 10 제외**, 225 파일 통과/10 파일 제외. TypeScript·production build·diff 검사 통과. 기존 큰 청크 안내는 유지한다.

실제 브라우저/GPU·운영 계정/두 기기·전체 24단계·사용자 성능/지표·SketchUp 수신은 미완료로 유지한다. 이번 수정은 Git에 기록하고 즉시 재배포하지 않는다. 마지막 공개 배포 기록의 소스는 `8fb69dc`이며 운영 상태를 새로 조회하지 않았다. 다음은 재질·작품 라이브러리의 저장·재사용 화면 연결과 지연 작업 보호다.
