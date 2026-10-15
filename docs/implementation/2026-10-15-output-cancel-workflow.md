# 출력 취소와 Scene 복원 중 전달 보호

2026-10-15. 하나의 전시로 편집·저장·내보내기·잠긴 공유를 잇는 기존 연속 검증은 유지하면서, 출력 중 취소와 같은 전시 복원에서 끊기는 동작을 보완했다. 운영 인증/브라우저 연결 대기와 즉시 배포 보류는 유지한다.

## 바뀐 동작

- PDF·자산 백업·GLB·glTF 창에서 ‘생성 취소’, 닫기·Escape·창 바깥 클릭을 허용한다. 취소는 즉시 재시도를 허용하고 옵션은 보존한다. 이전 결과·진행·오류·finally가 새 요청의 다운로드·알림·창 닫기·busy를 바꾸지 않는다.
- 두 창은 같은 ID의 문서/Scene/Undo·Redo 복원 context에도 묶는다. 복원이 발생하면 이전 출력 요청과 창을 폐기한다. 일반 숫자/이름 편집 중 이미 시작한 백업은 시작 시점 snapshot을 전달하고 새 편집은 보존하는 기존 정책을 유지한다.
- PDF에 선택적 AbortSignal을 추가했다. 글꼴 fetch에 취소를 전달하고 원래 30초 제한/정리 정책은 유지한다. 사용자 취소는 글꼴 오류로 바꾸지 않는다. 이미지 준비 후·PDF 조립 전후·3D 렌더 대기/준비/PNG encode 이후에 취소를 확인한다. 취소 뒤 도착한 텍스처는 encode하지 않고 dispose한다.
- detached PDF/Scene 미리보기 렌더는 동일한 실제 queue를 사용한다. 대기 중 취소한 GPU 작업은 실행하지 않는다. 이미 실행 중인 작업은 기존 자원 정리가 끝나야 다음 렌더를 시작한다. 렌더가 취소를 확인하면 projector maps·scene texture/material/geometry와 renderer/context를 기존 finally에서 정리한다. Scene 미리보기에도 같은 signal을 전달한다.
- Workspace는 같은 ID의 문서/Scene/history 복원도 감지해 이전 Scene 미리보기와 캡처를 폐기하고 캡처 창을 닫는다. 늦은 thumbnail이 복원된 전시에 새 Scene을 붙이지 않는다. Scene 저장의 snapshot/시점 읽기도 try/finally에 포함해 getter 오류가 busy를 영구 유지하지 않으며 재시도가 가능하다.

취소는 협력적이다. 이미 실행된 이미지/모델 decode·toBlob·PDF/ZIP/GLTF 동기 encode를 강제로 끝낸다는 뜻은 아니다. 백업/모델 준비는 이후 progress 지점에서 중단하며, 결과 전달은 즉시 폐기한다. 동기 CPU 작업은 이벤트 루프에 제어를 돌려주기 전까지 취소 클릭 자체를 처리할 수 없다.

## 검증과 산출물

새 회귀는 25개다. 출력 UI 10개, PDF 단계 취소 7개, detached 렌더 정리 3개, Workspace 복원/시점 오류 5개를 추가했다. 실제 React StrictMode와 실제 store 명령을 사용하며 지연된 encoder/renderer는 제어 가능한 adapter다. GPU 렌더 테스트는 실제 WebGL 프레임 검증이 아니다.

- 기존 main `3bbce851896f49b6d0e086af324a7ca98c1dd040`의 UI를 임시 소스 복사본에서 같은 선택 10개로 실행하면 모두 실패한다. 수정 후 통과한다. 작업 체크아웃을 되돌리지 않았다.
- Workspace 같은 ID/Scene 복원 4개는 수정 전 모두 실패, 수정 후 통과한다. 이 14개 선택 대조를 새 25개 전체의 수정 전/후 대조로 확대하지 않는다.
- 최종 관련 4파일 **55개 통과**, 전체 **1,657개 통과/선택 10 제외**(261파일 통과/10 제외), TypeScript·production build 통과다. 기존 큰 청크 안내는 남는다.

정상 전달 사례는 실제 `PdfDialog`/페이지 구성 UI에서 현재/Scene·표지·목록·작품 상세를 구성한다. 첫 글꼴 응답 adapter를 대기시키고 ‘생성 취소’를 눌러 fetch에 전달된 signal의 abort와 다운로드 0회를 확인한다. 같은 옵션으로 다시 생성해 실제 글꼴/native 이미지·PDF encoding과 독립 PDF.js 읽기/래스터를 실행한다.

결과는 **8페이지 PDF**, 현재 400×600mm와 저장 Scene 777×600mm의 작품 상세, 작품 10점과 Scene 1개의 정확한 자산 ZIP 복원이다. PDF 텍스트에는 내부 메모가 없고 ZIP에는 원래 편집 메타데이터가 남는다. 두 상세 페이지 PNG를 직접 열어 한글·치수·서로 다른 빨간 패널 폭을 확인했으며 독립 ZIP CRC/자산 SHA도 기록했다. 실제 이메일/네트워크·브라우저를 사용했다고 주장하지 않는다.

- [8페이지 PDF](../validation/output-cancel-2026-10-15/exhibition.pdf)
- [현재 작품 상세](../validation/output-cancel-2026-10-15/current-artwork.png), [저장 Scene 상세](../validation/output-cancel-2026-10-15/scene-artwork.png)
- [전시 자산 ZIP](../validation/output-cancel-2026-10-15/project.gonggan.zip)
- [명령·범위·해시 기록](../validation/2026-10-15-output-cancel-workflow.json)

기존 하나의 전시 App 흐름(도면 PDF/10점/포인터 편집/Scene/저장/캡처/PDF/ZIP/GLB/로컬 Worker 잠긴 공유·회수)과 영상·두 도면·프로젝터 전달 테스트도 최종 전체 실행에서 통과했다. 개별/합성 검증을 실제 운영 로그인·기기/브라우저/GPU·성능·실사용자·SketchUp 또는 원문 24단계 전체 인수 완료로 집계하지 않는다. 도면 완전 복원·설비 독립 편집·유료 생성 범위는 확장하지 않는다.

다음은 현장 모드·발표 화면에서 저장 배치와 임시 치수를 오갈 때 편집 원본이 보존되는 경로를 점검한다. 운영 인증/브라우저 대기는 재개하지 않고 이번 결과를 즉시 배포하지 않는다.
