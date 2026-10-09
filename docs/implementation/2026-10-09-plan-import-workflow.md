# 도면 입력·회전·축척 보정의 작업 보호 및 UI 흐름

2026-10-09. 원문 1 §3–7/40의 도면→벽 초안→직접 수정→두 점 축척 흐름을 실제 React 화면과 로컬 이미지 처리 코드로 검증했다. 인식 범위는 사용자 결정대로 가벼운 벽·숫자·문·설비 후보로 유지한다. 완전 복원 고도화나 문·설비·설치 제외 영역의 독립 직접 편집을 추가하지 않는다.

## 변경

프로젝트를 바꿔도 이전 파일의 가져오기 창이 남아 새 프로젝트에 적용될 수 있었다. `PlanImportDialog`에 기존 `useProjectDialogScope`를 연결하고 클릭·decoder·페이지 렌더·자동 PDF 선택의 결과를 원래 프로젝트/파일에 한정했다. 파일 교체 즉시 이전 미리보기와 document를 현재 파일로 표시하지 않으며, 이전 decoder의 실패 뒤에도 옛 도면을 배치할 수 없다. 파일·페이지 상태, 영역/원본, 분석 중 표시와 오류를 새 입력에서 초기화한다. 뒤늦게 도착한 문서는 destroy하고 오래된 페이지 선택 진행·결과도 폐기한다. 초안 적용 시점의 최신 프로젝트 ID·이름·단위·프로젝트 메모를 유지한다.

회전/자르기의 비동기 완료가 바뀐 페이지나 unmount 뒤 onChange·busy·오류를 전달하지 않도록 작업 ref를 추가했다. 새 페이지에서는 변환 상태를 초기화하고 새 작업을 시작할 수 있으며, 이전 완료가 새 작업의 busy를 해제하지 않는다. 이미 진행하는 이미지 decoder/Canvas 계산을 강제 중단한다는 뜻은 아니다. 자동 분석 화면은 이미지별로 구분한다.

`PlanView`는 실제 store의 모든 프로젝트 ID 전환을 감시한다. 파일/후보/표기 창, 축척 보정 점, 그리기·팬·끝점 드래그 상태를 비운다. A→B→A가 한 React batch에 있거나 도면과 축척 값이 같아도 이전 프로젝트의 보정 점을 재사용하지 않는다. 기존 같은 도면 재분석은 분석 정보만 갱신하고 직접 수정한 벽·연결 끝점·축척·초안 근거를 그대로 유지한다.

## 검증

`PlanImport.workflow.test.tsx`의 새 14개 회귀는 실제 React createRoot/StrictMode/act, Zustand, PlanImportDialog, PlanView, PlanRegionEditor, AutomaticVenuePreview, NumberField, 공개 도면 초안/보정/벽 편집·parser·Undo/Redo를 실행한다. 작업 수명 시나리오에서는 파일 decoder·PDF 페이지 선택/렌더·분석 결과·crop 완료를 제어한다. DOM 좌표/Pointer capture/dialog는 jsdom adapter다. 실제 브라우저 이벤트·PDF worker·GPU·운영 배포 근거가 아니다.

- 프로젝트 A→B→A 뒤 이전 창의 배치/초안 적용을 차단하고 PlanView에서 창을 닫는다.
- 교체 파일이 읽히는 동안과 교체 실패 뒤 이전 미리보기를 배치하지 않는다.
- unmount 뒤 문서 도착은 destroy하고 render하지 않는다.
- 이전 crop의 지연 완료가 새 crop 작업을 끝내거나 결과를 덮지 않는다. unmount 이후 완료 콜백도 없다.
- 유효한 최소 공간(벽 1개, 작품 없음)에 참고 도면을 배치하고 유한 좌표·프로젝트 ID와 parser 왕복을 확인한다. 현재 데이터 규격은 벽 1개 이상이므로 벽이 0개인 공간 지원을 검증한 것으로 확대하지 않는다.
- 두 선의 부분 초안을 적용해 100px 구간을 100cm로 보정한다. 축척은 10mm/px, 가로 벽은 8,000mm이며 적용과 보정은 각각 Undo/Redo된다.
- 보정 중 프로젝트 왕복 후 점과 패널을 폐기한다.
- 실제 SVG 끝점 드래그로 가로 벽과 연결된 인접 벽을 함께 수정한다. 같은 도면의 선 근거 2→3개를 배치해도 수정 벽·축척·초안은 불변이고, 근거 갱신도 Undo/Redo된다.
- PDF 자동 선택→수동 3페이지→고해상도 렌더→배치 옵션을 연결한다. 별도 교체 시나리오는 이전 PDF의 진행 메시지·결과를 버린다. 이 두 사례의 PDF transport는 제어된 결과다.

추가로 **실제 1,000×800 JPEG**를 native 이미지 decoder/Canvas로 입력한다. 흰 배경의 두 검은 벽 선을 로컬 `loadPlanFile`→실제 `analyzePlan`→`detectPlanWalls`/`detectPlanSymbols`→실제 `detectWallCandidates`/`pageSignSymbols`→초안 UI 적용까지 연결했다. Worker 메시지 transport만 main-thread adapter로 대체하고 생산용 픽셀 알고리즘을 그대로 실행한다. 최소 두 벽, lineState complete, 정확한 도면 크기, 축척 미정과 단일 Undo 적용을 확인한다. OCR은 이 합성 사례에서 빈 텍스트를 반환하도록 명시적으로 대체했다. 숫자 정확도·임의 복잡한 사용자 도면·실제 Web Worker 실행을 증명하지 않는다.

[검증 기록](../validation/2026-10-09-plan-import-workflow.json)에 명령·범위를 기록했다. 같은 14개와 transport를 이전 HEAD `fdfeb63`의 세 production 파일에 대조하면 **7 실패 / 7 통과**, 수정 후 **14 통과**다. 전체 **1,219 통과 / 선택 10 제외**, 222 파일 통과/10 파일 제외. TypeScript와 production build, diff 검사 통과. 기존 Vite 큰 청크 안내는 유지한다.

실제 PDF 파일의 브라우저 입력/worker·실제 포인터·GPU 3D·같은 프로젝트 전체 24단계·운영 로그인/두 기기·사용자 모델/지표·SketchUp 수신은 계속 남는다. 인식 성공률을 높였다고 주장하지 않으며 이전 자동 인식 실패 기록은 그대로 둔다. 이번 수정은 Git에 기록하며 즉시 재배포하지 않는다. 마지막 공개 배포의 기록상 소스는 `8fb69dc`이고 이번 실행에서 운영 상태를 새로 조회하지 않았다. 다음 연결 검증은 상단의 GLB/저장 프로젝트·백업 불러오기다.
