# 동기화 대기·계정 전환과 도면 Scene 복원

2026-10-11. 앞선 로컬 저장·재열기의 두 도면 전시를 클라우드 저장 큐와 연결했다. 원문 1 §24–26/40의 저장·Scene·전달 및 2의 계정 저장 범위에 대한 부분 검증이다.

## 발견한 문제와 수정

앞선 클라우드 작업을 기다리는 요청은 대기 후 `syncCloudProject`를 재귀 호출하면서 현재 계정을 다시 선택했다. A계정에서 요청한 저장이 B로 이어질 수 있었고, 취소한 실행 작업을 기다리던 요청이 새 controller로 다시 업로드할 수도 있었다. A→B→A 사이 같은 ID로 돌아온 경우에도 옛 요청이 살아났다.

각 요청은 시작한 계정과 취소 controller를 대기 중부터 보유한다. 같은 계정/프로젝트의 promise chain을 유지하고 계정 ID 변경을 요청별로 구독해 옛 세션의 작업을 폐기한다. 명시적 취소는 실행 중 요청과 같은 키의 대기 요청 모두를 취소한다. 앞선 작업의 종료가 뒤 작업의 queue tail 등록을 지우지 않도록 조건부로 정리하며, controller·계정 구독도 각 요청 종료 때 해제한다. 대기 ZIP은 계정별 키에 원본 그대로 남고 새 계정의 대기/연결로 옮기지 않는다.

옛 파일의 응답이 도착하면 복원 후 최신 배치까지 ‘클라우드 저장됨’으로 표시하는 문제도 수정했다. 응답 파일의 local revision이 이 탭이 인정한 revision과 같고 현재 로컬 저장도 완료됐을 때만 완료 상태를 표시한다. 더 새 수정이 있으면 다음 클라우드 저장 대기로 남긴다. 서버의 CAS·동일 파일 재시도 로직과 프로젝트 schema는 바꾸지 않았다.

## 실제 저장 경로에서 검증한 결과

단위 회귀는 계정 변경·로그아웃·A→B→A, 취소한 대기 요청, Scene 복원 중 옛 revision 응답 및 세 요청 직렬화를 확인한다. 별도 연속 작업은 직전 두 JPEG/Scene 백업을 입력으로 실제 Zustand·기본 로컬 자동 저장·native 이미지 decoder를 사용하는 `exportProjectBackup`·cloud client·production Worker handler를 실행했다. 저장소는 fake-indexeddb, Worker는 SQLite·메모리 R2·합성 인증 fixture이며 네트워크 지연만 adapter로 제어했다.

1. A계정의 실제 ZIP을 durable pending으로 저장했다. Worker가 **revision 1/201**을 확정한 뒤 응답을 지연시켰다. 이 adapter는 abort 뒤에도 응답을 돌려주어 응답 이후의 소유권 검사까지 실행한다.
2. 같은 계정으로 요청한 두 번째 저장을 대기시키고 Scene A를 복원·로컬 revision 2로 저장한 뒤 B계정으로 바꿨다. 대기 요청은 계정/취소 오류로 끝났고 **PUT은 A의 첫 요청 1회만** 있었다. A의 request ID와 ZIP 바이트는 정확히 남았으며 A 연결은 아직 인정되지 않았다. B 대기/연결은 없다.
3. A로 돌아와 명시적으로 재시도했다. 기존 Worker의 동일 파일 확인이 예상 revision 0 요청에 **200/revision 1**을 반환했다. 원본 해시/바이트로 재시도하며 새 버전을 중복 생성하지 않았다. 이어 현재 복원한 A 배치를 보내 **remote/local revision 2**를 저장했다.
4. Scene B를 복원·저장한 뒤 **remote/local revision 3**을 저장했다. 실제 private API의 metadata/file을 읽고 ZIP을 import해 A/B 각각의 전체 프로젝트와 일치하는지 검사했다. Scene B의 최종 파일은 처음 B 배치와 바이트/해시가 같다. Scene 전체 이미지·축척·벽 및 최신 비공개 메모를 보존했다.
5. B계정 목록은 빈 배열이고 A 파일의 metadata 조회는 **404**다. B의 로컬 대기/연결도 없다. 서버에는 최신 ZIP 1개만 남았다. 최종 PNG 자산 2개는 원본 Scene 이미지 SHA와 일치하고 별도 Python ZIP CRC 검사도 통과했다.

자료: [수신 ZIP](../validation/cloud-plan-restore-2026-10-11/project.gonggan.zip), [API 순서·해시 기록](../validation/cloud-plan-restore-2026-10-11/workflow.json), [검증 기록](../validation/2026-10-11-cloud-plan-restore.json).

## 대조와 남은 인수

임시 최종 소스 복사본에서 제품 `cloudSync.ts`만 이전 main `827adf6b9bab40e09734eb0f033628e81217e7c0`로 교체했다. 같은 최종 14개는 **5 실패/9 통과**, 수정 후 모두 통과다. 실제 체크아웃을 되돌리지 않았다. 새 회귀 7개, 대상 8파일/62개 및 전체 **1,565개 통과·선택 10 제외**, TypeScript·production build 통과다. 기존 큰 청크 안내는 남는다.

실제 운영 계정 인증·브라우저 fetch/Abort·클라우드 UI 조작·두 기기, GPU/3D 캡처·공유 URL, 실제 사용자 도면/모델과 SketchUp, 성능/성공 지표 및 원문 24단계 전체 인수는 완료로 바꾸지 않는다. 이번 변경은 즉시 재배포하지 않는다. 다음은 동기화 취소·재시도와 프로젝트 목록 상태 표시의 UI 연결을 점검한다. 도면은 기존 초안·문/설비 후보 범위, 독립 설비 편집과 유료 생성 기능은 유보 상태를 유지한다.
