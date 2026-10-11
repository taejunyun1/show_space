# 계정 복원 지점의 취소·비교·복원 보호

검증일 2026-10-11 · 정리일 2026-10-12. 계정 복원 지점의 기존 저장·비교·새 로컬 복사본 열기를 보완했다. 도면 인식과 유료 생성 기능의 범위는 늘리지 않는다.

## 수정한 동작

취소된 요청의 catch/finally가 다음 요청의 오류·진행 상태를 바꿀 수 있었다. 계정 왕복, 같은 ID의 문서/Scene 복원, 대상 클라우드 ID 변경과 StrictMode 재시작도 이전 요청을 완전히 폐기하지 않았다. 취소 버튼은 응답이 끝날 때까지 컨트롤을 잠갔다. 복원 중 추가 편집을 검사하지 않았으며, 로컬 복사본을 cloud link 저장 전에 활성화했다.

- 복원 창은 열린 계정·로컬 전시·복원 context에 묶이며 동기적 구독으로 범위 변경을 폐기한다. 대상 클라우드 ID가 바뀌면 창 내부를 새로 만든다. 계정이 바뀌면 목록·비교·미리보기·입력/재시도 정보를 지우고 닫을 수 있다. 전시/Scene 전환 때는 창을 닫는다.
- 요청은 자신의 controller가 유효할 때만 결과·오류·busy를 변경한다. 취소/unmount는 즉시 부모 컨트롤도 해제한다. StrictMode의 이전 요청과 React 렌더 전 연속 클릭도 보호한다.
- 불확실한 복원 지점 저장은 같은 ID·이름·기준 버전으로 재시도한다. 취소된 요청의 늦은 충돌 오류는 새 요청의 재시도 ID를 지우지 않는다. 서버가 이미 받아 둔 버전은 취소로 되돌리지 않으며, 안내 후 목록에서 확인할 수 있다.
- 복원은 시작 문서의 identity와 이동·회전을 로컬 flush, 파일 검증, 원격 안전 기록·저장, 로컬 복사/연결 및 활성화에서 재검사한다. 추가 편집을 덮어쓰지 않는다. 새 복원본은 비활성으로 저장하고 cloud link를 준비한 뒤 guarded IndexedDB 활성화를 거친다. 중단된 복사본과 기존 전시는 보존한다.
- 파일 읽기 전후·ZIP import 후·이미지 검증 후 guard를 실행해 폐기된 요청의 파일을 해석하거나 반환하지 않는다. 현재 클라우드 비교 파일도 읽기/동적 import 후 검사한다.

## 검증한 저장 흐름

React/jsdom StrictMode의 실제 버튼·입력과 기본 로컬 저장을 실행했다. 범위/지연 사례는 session/client/action adapter이며, 마지막 활성화 보호는 fake-indexeddb의 실제 transaction 조회 성공 이벤트에서 편집을 넣어 확인했다. 정상 복원은 새 ID·cloud link·시작 프로젝트가 일치하고 이전 로컬 문서를 유지한다.

두 native 흐름은 앞선 두 JPEG/Scene 백업을 입력으로 실제 이미지 decoder, ZIP, history actions/client 및 production Worker handler를 실행한다. 서버는 로컬 SQLite·메모리 R2·합성 인증 fixture다.

1. private 프로젝트 revision 1의 전체 ZIP을 ‘설치 전’ 지점으로 기록한다. 서버의 201 확정 응답을 지연시키고 실제 취소→즉시 재시도 버튼을 누른다. 동일 지점 ID는 200을 반환하며 기록은 1개다. 옛 응답이 새 busy를 해제하지 않는다.
2. 원격 메모를 변경해 revision 2로 저장하고 목록 새로고침→비교를 실행한다. 현재/복원 지점의 차이를 표시한다.
3. 복원 버튼은 revision 2를 안전 지점으로 남긴 뒤 revision 1의 정확한 ZIP을 최신 revision 3으로 저장한다. 정상 사례는 새 로컬 ID로 열며 두 Scene의 이미지·축척·벽·메모와 cloud link revision 3을 유지한다. 이전 로컬 전시도 남는다.
4. 별도 사례는 서버가 revision 3을 받아 둔 뒤 응답을 지연시키고 복원을 취소한다. 로컬 전시와 시작 프로젝트는 그대로이며 원격 revision 3과 안전 지점은 보존된다. 취소의 원격 rollback을 주장하지 않는다.
5. private API로 읽은 ZIP은 최초 revision 1의 바이트 및 전체 프로젝트와 일치한다. 안전 지점은 revision 2 바이트와 일치한다. 기록 2개/서버 파일 3개이며 다른 합성 계정의 이력 조회는 404다. 두 PNG 자산 SHA는 입력 백업과 같고 별도 Python CRC 검사도 통과했다.

[정상 복원 ZIP](../validation/cloud-history-2026-10-11/open-copy.gonggan.zip), [정상 버튼/API 기록](../validation/cloud-history-2026-10-11/open-copy.json), [취소 수신 ZIP](../validation/cloud-history-2026-10-11/cancel-after-cloud-commit.gonggan.zip), [취소 버튼/API 기록](../validation/cloud-history-2026-10-11/cancel-after-cloud-commit.json), [검증 기록](../validation/2026-10-11-cloud-history-workflow.json).

최종 소스의 임시 복사본에서 제품 2파일만 이전 main `a92a14cdeda8aa7a0db7669f13fec01f5ea280f4`로 교체했다. 늦은 요청이 후속 사례에 영향을 주지 않도록 별도 Vitest 프로세스에서 동일한 선택 회귀 8개를 비교하면 **7 실패/1 통과**, 수정 후 전부 통과다. 작업 체크아웃은 되돌리지 않았다. 새 회귀 21개, 대상 6파일/63개 및 전체 **1,601개 통과·선택 10 제외**, TypeScript·production build 통과다. 기존 큰 청크 안내는 남는다.

실제 브라우저 저장/Abort·GPU/3D 캡처, 운영 인증·두 계정/기기·공유 URL, 실제 사용자 도면/모델·SketchUp 수신·성능/성공 지표 및 원문 24단계 전체 인수는 미완료다. 즉시 재배포하지 않는다. 다음은 공동 전시의 열람·의견에서 파일 준비/전시 전환과 잠긴 화면 상태를 점검한다. 기존 가벼운 도면·문/설비 후보 및 독립 설비 편집·유료 생성 유보는 유지한다.
