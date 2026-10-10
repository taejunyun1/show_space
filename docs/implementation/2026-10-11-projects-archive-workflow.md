# 프로젝트 저장·열기·복사와 아카이브 재사용 작업 보호

2026-10-11. 원문 2의 Home/Project와 전시 Archive를 기존 프로젝트·Scene·로컬 저장 구조에서 확인했다. 도면 인식이나 카메라 기능 범위는 확장하지 않는다.

## 수정

목록에서 저장된 프로젝트 읽기를 시작한 뒤 프로젝트가 A→B→A로 바뀌거나 창이 없어져도 이전 항목을 다시 열었다. 복사본 저장이 완료될 때까지 기다리는 중 창이 없어져도 새 항목을 활성화했다. 아카이브 재사용도 프로젝트 ID만 비교해 왕복과 같은 프로젝트의 추가 편집을 놓쳤다. 실제 활성화 요약 조회 중 새 편집이 들어와도 이전 문서가 열렸다.

ProjectsDialog·ProjectArchiveDialog가 기존 `useProjectDialogScope`로 프로젝트 전환/unmount를 기록한다. 별도 `requireProjectSwitchReady`는 클릭할 때의 프로젝트 객체와 현재 객체가 같은지, 복구 완료 여부와 이동·회전 미리보기를 검사한다. 저장·읽기·복사본 쓰기 뒤와 실제 활성화 전에도 확인한다. 같은 프로젝트를 추가 편집했으면 기존 작업을 중단하고 재시도 안내를 표시한다. 원본의 마지막 저장을 먼저 확인하는 순서는 유지한다.

guard를 전달한 `saveNewLocalProject`는 비활성 항목으로 저장한 뒤 보호된 `openLocalProject`를 호출한다. `activate`는 DB 열기와 요약 조회가 끝난 뒤 guard를 검사하고 실패하면 transaction을 abort한다. 현재 탭의 revision과 기억하는 활성 ID는 성공한 열기 이후에만 갱신한다. guard를 전달하지 않은 기존 호출의 저장/열기 동작은 유지한다.

목록 초기 준비 중과 작업 중 중복 실행을 차단하고, 이전 목록 응답이 최신 결과를 덮지 않게 한다. 보관 버튼의 표시 revision과 새로 읽은 revision이 다르면 다른 탭의 변경으로 안내하고 목록을 갱신한다. 저장 공간 DOMException의 메시지도 표시한다. 저장 실패 후 현재 작업을 복사본으로 보존하면 새 항목을 열고 목록을 닫는다. 아카이브를 목록 안에서 재사용할 때 부모를 중복으로 닫지 않는다.

## 검증

새 `Projects.workflow.test.tsx` 19개는 실제 React StrictMode/ProjectsDialog/ProjectArchiveDialog/ProjectArchiveContents/NumberField, Zustand 편집·Auto Save 대기열·생산용 persistence/repository, 독립 fake-indexeddb factory를 사용한다.

- m 입력의 12×8m/벽 높이 4m 야외 프로젝트 생성, 치수 환산·빈 작품 목록·원본의 최신 초안 저장·새 항목 저장 완료/활성화·다른 repository 재읽기·readDraft 및 탭 revision을 확인한다.
- 현재 초안을 먼저 저장한 뒤 다른 프로젝트를 열며 전환 후 Undo 기록은 비운다.
- 새로운 ID의 전시 복사본에 현재 배치와 모든 Scene, 합성 실제 GLB bytes, native로 인코딩한 PNG data URL, 재질·조명·비공개 메모·체크리스트/참고 사진을 보존한다. 원본 레코드를 유지하고 새 항목에 원본 클라우드 연결을 복사하지 않는다. 이 PNG/GLB 사례는 저장 데이터 보존 검사이며 새 loader/decoder 실행 검사가 아니다.
- 보관·복구에도 내용과 현재 활성 프로젝트는 유지한다. 현재 프로젝트의 보관 버튼을 비활성화한다.
- 읽기 중 unmount/프로젝트 왕복이면 편집기·DB 활성 ID를 바꾸지 않는다. 복사본 쓰기도 새로 시작하지 않는다.
- 같은 프로젝트의 추가 편집과 미리보기 중에는 전환을 거절한다. 새 편집을 저장한 뒤 다시 시도하면 정상으로 열린다.
- 저장 공간 오류에서 부분 복사본·활성 ID 변경이 없고 오류 메시지를 표시한다.
- 실제 저장을 수락한 뒤 응답이 늦는 상태에서 창이 없어지면 새 항목은 비활성 목록에 남고 편집기는 전환하지 않는다.
- 보관된 전시의 Scene 기록을 실제로 선택하고 작품/비공개 메모를 열람해도 편집기를 바꾸지 않는다. 재사용은 선택 Scene만 복사하는 것이 아니라 현재 배치와 모든 Scene을 새 이름/ID로 저장한다. 보관 원본·revision은 유지한다.
- 현재 초안 저장 중 프로젝트 왕복, 복사본 저장 응답 대기 중 추가 편집, 복사본 읽기 중 unmount에서 아카이브 재사용을 중단한다.
- 부모 프로젝트 창→아카이브→재사용을 실제 lazy 화면으로 연결하고 부모 close가 한 번만 호출되는지 확인한다.
- 원본 Auto Save 실패 시 미저장 최신 내용은 별도 저장 복사본으로 보존한다. 원본 DB 내용은 유지하며 새 복사본을 활성화하고 목록을 닫는다.
- 별도 repository에서 새 revision을 저장한 후 오래된 보관 버튼을 실행하면 충돌을 표시하며 원본을 보관하지 않는다.
- 실제 IDB readwrite transaction의 summary query success 이벤트에서 새 편집을 넣으면 활성화 transaction을 abort한다. 편집 내용/활성 ID와 원본 탭 revision을 덮지 않는다.

기존 projectLibrary 6개/projectArchive 5개와 함께 대상 30개 통과다. 지연 응답 시점·스토리지 실패는 제어한다. dialog/input은 jsdom, 저장 엔진은 fake-indexeddb다. CloudProjectsPanel·AccountDialog·3D PresentationMode는 제외하며 계정 연결/운영 서버/GPU를 검증하지 않는다. 실제 저장 요청·원자적 transaction·별도 repository/초안 재읽기는 확인하지만 실제 브라우저 종료 후 디스크 내구성이나 기기 간 저장은 증명하지 않는다.

## 결과와 남은 범위

[검증 기록](../validation/2026-10-11-projects-archive-workflow.json). 같은 새 19개를 이전 HEAD `e2fa89d`의 두 dialog·persistence·repository와 비교하면 **13 실패 / 6 통과**, 수정 후 **19 통과**다. 실패에는 저장 실패 복구 복사본 생성 후 목록이 닫히지 않는 UX 사례도 포함한다. 전체 **1,294 통과 / 선택 10 제외**, 227 파일 통과/10 파일 제외. TypeScript·production build·diff 검사 통과. 기존 큰 청크 안내는 유지한다.

이미 수락한 transaction 전체를 강제로 취소하지 않는다. 비활성 복사본 저장 후 중단하면 목록에 항목이 남을 수 있다. 활성 ID 쓰기가 이미 제출된 뒤의 변경까지 원자적으로 되돌리는 구현도 아니다. guard 검사는 다음 쓰기/활성화 시작과 편집기 반영을 막는 경계다.

실제 브라우저/GPU·운영 인증/두 계정·기기·원문 40절 24단계 연속 인수·41절 사용자 지표·SketchUp 수신은 미완료다. 이번 변경은 Git에 기록하고 재배포하지 않는다. 마지막 배포 기록 소스 `8fb69dc`는 이번에 운영 조회로 갱신하지 않았다. 다음은 버전 기록 화면의 저장·비교·전체 프로젝트 복원과 지연 작업 보호를 확인한다.
