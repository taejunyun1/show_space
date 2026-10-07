# Scene 저장·복원과 캡처 작업 수명

2026-10-08. 원문 1 §26–27/40 및 문서 2 §46/48의 Scene→Screenshot 흐름을 실제 React 화면 제어와 편집 상태로 연결했다. 운영 인증 설정과 브라우저 연결 대기는 사용자 결정대로 보류한다.

## 발견 및 변경

Scene 저장 작업의 취소는 React의 project.id effect에만 의존했다. 프로젝트 A→B→A 전환이 하나의 React batch에 있으면 effect가 전환을 보지 못했고, 이전 미리보기 결과가 다시 연 A에 저장될 수 있었다. 실제 editor store의 모든 프로젝트 ID 전환을 구독해 작업을 즉시 중단한다. 새 프로젝트의 저장 버튼과 이름 입력을 초기화하고, 이전 작업의 완료·실패·finally가 새 저장을 건드리지 못하게 한다. unmount도 작업을 중단한다.

캡처는 인코딩 뒤에 프로젝트/보기의 유효성을 검사하지 않아, 전시나 화면을 바꾼 뒤 늦은 PNG가 내려받아졌다. Workspace가 시작한 캡처 작업은 전시 데이터·분리 미리보기·보기 변경과 unmount를 기록하고, 결과가 도착했을 때 폐기한다. A→B→A나 3D→벽면도→3D가 한 batch 안에 있어도 폐기한다. 실행 중인 이전 캡처가 정리되기 전에는 추가 캡처를 거절하며, 현재 캡처의 실패는 창에 표시하고 다시 시도할 수 있다.

2D 캡처의 SVG 검색을 해당 Workspace 내부로 한정했다. 문서의 다른 viewport가 먼저 있어도 현재 벽면도의 SVG를 사용한다. 3D 캡처 callback 등록은 effect cleanup을 반환해 이전 Canvas가 해제될 때 참조도 제거한다. 아직 새 3D 화면을 불러오는 중이면 해제된 renderer를 호출하지 않는다. CaptureDialog는 unmount 뒤 늦은 성공/오류가 새 창을 닫거나 입력 상태를 바꾸지 않도록 완료 처리 전에 수명을 확인한다.

이미 시작한 SVG/PNG 인코딩이나 GPU 작업 자체를 강제로 종료하는 것은 아니다. 기존 renderer의 finally와 자원 정리는 계속 실행되고, 폐기된 결과의 다운로드와 새 화면 변경만 막는다. Scene 미리보기 취소는 기존 AbortSignal과 임시 렌더 대기열을 사용한다. 미리보기 이미지 생성에 실패해도 현재 Scene 배치안 저장은 유지한다.

## 검증

`Workspace.sceneWorkflow.test.tsx`의 새 회귀 14개는 jsdom의 실제 React createRoot/StrictMode/act, Zustand, Workspace, CaptureDialog, ElevationView와 Scene 편집 명령을 실행한다. 3D transport·미리보기 encoder·PNG 다운로드는 제어 가능한 adapter다. 네이티브 dialog/ResizeObserver/화면 크기는 test adapter이며 실제 브라우저 모달, WebGL 투영 픽셀 또는 PNG 출력 파일의 검증 근거로 집계하지 않는다.

- Scene 시작 시 배치를 저장하고 생성 중 추가 편집을 유지한다. 이름을 바꿔 입력한 다음 Scene 제목도 지우지 않는다.
- 저장된 Scene 선택→실제 배치 복원→저장 카메라 요청→캡처 창→1920px 옵션 전달→파일명→Undo/Redo를 연결한다.
- 취소된 Scene의 늦은 결과가 새 작업의 busy/목록/이력을 바꾸지 않는다.
- A→B→A batch, 새 프로젝트 저장 중 이전 renderer 오류, unmount의 지연 오류를 폐기한다.
- 현재 renderer 실패는 썸네일 없이 배치안을 저장하고 안내한다.
- 실제 벽면도 SVG를 320px 미리보기 입력으로 전달하고, 3D 카메라 없이 Scene을 저장한다. 중복 저장을 막고 hydration/분리 미리보기 중에는 저장을 비활성화한다.
- 프로젝트/보기/작품 편집 이후 인코딩 결과를 폐기하고 새 캡처 창을 유지한다. 정상 재시도는 다운로드한다 (전환별 3개).
- unmount된 Workspace의 캡처를 폐기한다.
- 다른 viewport가 있어도 해당 벽면도 SVG를 사용한다.
- 해제된 3D adapter를 새 화면이 준비되기 전에 재사용하지 않는다.

수정 전 HEAD에 이 테스트를 적용하면 7개 실패/7개 통과였다. 수정 후 14개 모두 통과한다. 전체 **1,175 통과 / 선택 10 제외**, 219 파일 통과/10 파일 제외. TypeScript 및 production build, diff 검사 통과. Vite의 기존 큰 청크 안내는 남는다.

원문 1 §40의 하나의 실제 전시 24단계 전체 인수, 실제 브라우저/PNG·PDF 픽셀·GPU·두 기기·로그인/협업·사용자 지표는 별도로 남는다. 이번 변경은 Git에 기록하며 즉시 재배포하지 않는다. 공개 웹의 직전 배포 소스는 `8fb69dc`다.
