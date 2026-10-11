# 공동 열람·의견·Scene 기록의 전환 보호

2026-10-12. 기존 공동 전시 열람과 비공개 의견을 실제 UI 동작에 연결해 보완했다. 도면 인식·직접 설비 편집·유료 생성 및 실시간 동시 편집 범위는 확장하지 않는다.

## 수정한 동작

- 공동 열람은 열린 계정·로컬 전시/복원 context·대상 ID에 묶는다. 계정/전시 A→B→A, 같은 ID의 복원·Scene 전환에서도 동기적 구독으로 이전 요청·기록·3D 미리보기를 폐기하고 창을 닫는다. 대상 클라우드 ID는 새 내부 창을 만든다.
- 파일 준비와 접근 확인은 자기 controller만 적용한다. ‘열람 불러오기 취소’는 즉시 새로고침을 다시 허용하며 옛 응답이 새 요청의 busy를 해제하지 않는다. 실패한 30초 접근 확인은 비공개 기록·의견·미리보기를 숨긴다. 합법적으로 내려받은 로컬 파일 삭제나 실시간 권한 회수를 주장하지 않는다.
- 서버 metadata에서 확인한 열람자/보관 상태를 댓글 UI에 전달한다. 이전 댓글 조회가 지연돼도 작성·답글·수정·관리 컨트롤을 남기지 않는다. private 댓글 쓰기 403도 이미 열려 있던 수정창을 포함해 추가 쓰기를 차단하되 읽을 수 있는 의견과 같은 계정의 입력을 유지한다. 서버 권한/CAS 검사는 그대로 최종 조건이다.
- 댓글 계정 epoch는 React가 한 번에 처리한 A→B→A도 폐기한다. 계정·private 역할 범위가 바뀌면 입력/답글/수정 상태가 다음 범위에 남지 않는다. ‘댓글 작업 취소’는 같은 입력·요청 ID로 즉시 재시도한다. 이미 수락한 서버 의견은 유지하며 늦은 성공/오류가 새 입력·상태를 바꾸지 않는다. 공개 의견의 기존 읽기/권한/충돌 입력 유지 동작도 검증했다.
- 아카이브의 ‘도면 축척’은 현재 전시가 아닌 선택한 Scene의 `planReference`를 사용한다. Scene B의 미보정 상태에서 Scene A를 선택하면 A의 10mm/px를 전시 표시 단위인 **1cm/px**로 표시한다. 원본 Scene과 배치 데이터는 수정하지 않는다.

## 실제 UI와 native 전달 검증

React/jsdom StrictMode에서 지연된 session/read/comment 응답, 계정/전시 왕복·같은 ID/Scene 복원, 대상 변경, 취소 후 새 요청, 권한 확인 실패, viewer/archived 전환·403과 댓글 취소/동일 입력 재시도를 확인했다. 단위 사례의 client/댓글 응답은 adapter다. 읽기 전용 Scene/발표 탐색은 editor/store·IndexedDB 시작 프로젝트와 문서를 바꾸지 않는다.

별도 native 흐름은 앞선 두 JPEG/Scene ZIP을 실제 package/image decoder로 읽고 production client/Worker handler를 사용한다. 로컬 SQLite·메모리 R2·합성 확인 이메일 계정 A/B와 초대 수락, fake-indexeddb를 사용한다. 실제 `TeamProjectDialog`, `ReviewCommentsPanel`, `PresentationMode`를 실행하며 GPU transport만 stand-in이다.

1. A가 revision 1의 전시를 저장하고 B의 viewer 초대를 생성/수락한다. B의 실제 공동 열람 UI에는 편집·댓글 작성 컨트롤이 없다.
2. Scene A의 기록을 선택해 1cm/px 표시와 실제 벽 치수를 확인한다. 실제 발표 모드에 전달한 읽기 전용 snapshot의 벽 ID/좌표/높이/두께는 A와 같다. 설치 Note는 발표에 표시하지 않는다. GPU 렌더/실제 포인터를 검증했다고 주장하지 않는다.
3. B를 commenter로 변경하고 새로고침한다. 실제 의견 등록→Worker 201 확정/응답 지연→취소→동일 thread ID/본문 재시도 200을 실행해 의견은 1개임을 확인한다. 옛 응답이 새 busy나 입력을 바꾸지 않는다. 원격 ZIP/revision은 1로 그대로다.
4. editor로 바꾼 UI에는 별도 ‘편집기로 열기’만 나타난다. 이 버튼의 handoff는 callback으로 확인하고 로컬 편집기 상태는 바꾸지 않는다. 댓글 참여 때 입력한 답글 초안은 새 역할에 남지 않는다. 실제 편집기로 파일 열기/저장은 앞선 cloud workflow 근거이며 이번 사례가 그 작업을 대신했다고 주장하지 않는다.
5. viewer로 강등한 뒤 댓글 GET을 지연시키고 30초 poll을 실행한다. metadata가 확인된 즉시 편집/댓글 컨트롤은 숨겨진다. 서버도 의견 쓰기를 403으로 거절한다.
6. 참여를 제외하고 다음 poll에서 기록/댓글/미리보기를 숨긴다. B의 private 파일 조회는 404, membership은 viewer·revoked·revision 5다. A가 다시 읽은 ZIP은 최초 바이트 및 전체 전시와 같고 로컬 editor 전체 state/시작 프로젝트/문서도 같다. 두 PNG 자산 SHA는 입력 백업과 같고 별도 ZIP CRC 검사도 통과했다.

[수신 전시 ZIP](../validation/team-view-2026-10-12/project.gonggan.zip), [버튼·API 기록](../validation/team-view-2026-10-12/workflow.json), [검증 기록](../validation/2026-10-12-team-view-workflow.json).

임시 최종 소스 복사본에서 제품 3파일만 이전 main `ebbb9e78980e1aac3f5209f3806f90023a1c2ca2`로 바꾸면 같은 최종 24개는 **13 실패/11 통과**, 수정 후 전부 통과다. 작업 체크아웃을 되돌리지 않았다. 새 회귀 16개, 대상 11파일/71개 및 전체 **1,617개 통과·선택 10 제외**, TypeScript·production build 통과다. 기존 큰 청크 안내는 남는다.

운영 로그인/리디렉션·실제 계정/기기/공유 URL·브라우저/GPU·3D 캡처·성능/성공 지표·실제 사용자 도면/SketchUp 및 원문 24단계 전체 인수는 미완료다. 즉시 재배포하지 않는다. 다음은 초대 생성·수락·참여자 관리 화면의 실제 조작과 범위 전환 보호를 점검한다. 운영 인증 연결 대기와 독립 설비/유료 생성 유보는 유지한다.
