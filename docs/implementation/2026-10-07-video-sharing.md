# 영상 스크린 공유·발표 — 2026-10-07

원문 2 §60의 영상 재생을 로컬 발표와 공개 읽기 전용 3D까지 연결했다. [편집기·저장 검증](2026-10-07-media-artwork.md)을 잇는 기록이다. 제품 전체 완료 및 실제 인증·대표 기기 전체 인수 판정은 아니다. §61의 프로젝터 투사 geometry는 별도 미구현이다.

## 동작

- 공유 snapshot은 원본 영상 dataURL 대신 SHA256 영상 ID·해상도·길이·반복·화면 채우기만 허용한다. 비공개 메모와 파일 데이터는 snapshot에 넣지 않는다. 원본 파일 자체는 변환/메타데이터 삭제 없이 공개 자산으로 올리며, 공유 창에 원본 영상 공개 안내를 표시한다.
- 현재 배치와 선택한 Scene만 발행하며 같은 원본은 한 번만 업로드한다. 숨긴 작품·숨긴 벽의 영상과 선택하지 않은 Scene은 제외한다. 원본 하나 16MiB, 전체 발행 합계 80MiB·20개 제한을 발행 전과 서버 업로드에서 검사한다.
- 작성자 인증 후 draft에만 업로드한다. MIME·컨테이너 헤더·SHA256·스트림 실제 크기를 검사한다. 선택 Scene의 영상 원본이 없으면 발행하지 않는다. 서버 검사는 브라우저 실제 코덱 디코딩을 대신하지 않는다.
- 활성 공유에 명시된 영상만 GET할 수 있다. R2 구간 읽기를 이용해 Range 요청에 206/Content-Range/Accept-Ranges를 반환하며 잘못된 범위는 416이다. 스냅샷과 자산은 no-store이다. 발행된 배치는 수정할 수 없다. 공유 회수는 상태를 먼저 중단하고 영상·이미지·모델을 함께 삭제한다.
- 열람자는 선택한 스크린의 재생·일시정지·처음으로·seek·기본 음소거/네이티브 소리만 조절한다. 크기·배치·비율·반복은 읽기 전용이다. 3D에서는 실제 VideoTexture 프레임을 표시하고 시작 전에는 비율/중앙 크롭을 적용한 포스터를 보여준다. 동시 재생 제한과 해제 처리는 편집기와 같은 runtime이다.
- 공개 재생 주소는 같은 origin의 검증된 share/hash 경로만 만든다. 실제 해상도·길이를 검증한 뒤 재생 준비로 표시한다. 코덱/메타데이터 오류는 중단하고, 일시적인 브라우저 재생 정책 거절은 재시도할 수 있다.
- 발표는 detached snapshot + 로컬 영상 자산 map을 사용하고 공개 URL로 fallback하지 않는다. 진입 시 편집기 배경 영상은 정지한다. 현재/각 Scene/편집기의 세션 키가 분리되며 Scene 이동·닫기에서 해당 decoder/VideoTexture/콜백을 해제한다. 재생 위치·소리는 프로젝트 저장에 쓰지 않는다.

## 실제 검증

전체 `npm test`: 180 파일, 983 통과, 선택 검사 3개 제외(벤치마크 2 + 실제 로컬 Worker 영상 인수 1). `npm run build` / `git diff --check` 통과. 기존 큰 chunk/Library 정적·동적 import 경고는 남는다. 실제 로컬 Worker 인수는 별도로 `GONGGAN_VIDEO_NATIVE=1 npm test -- scripts/video-sharing-native.test.ts`로 실행한다.

개인 작업 대신 직접 만든 testsrc2 합성 영상과 앱의 예제 작품만 사용했다. 기존 ANCA 프로젝트·운영 공유는 수정하지 않았다.

1. 5190 로컬 발표에서 MP4 선택→재생→정지→Home/End seek→Scene 전환 확인. 3D 스크린의 지정 17×10px 내부 범위에서 두 프레임의 170픽셀이 달라진다.
2. 8814의 실제 Wrangler Worker + 로컬 R2에 원본을 발행했다. 원본 MP4는 382,181바이트, SHA256 `e9c8d94044a6d82ad1aeee0943d11090e7843f21340899057f6c90f6d23f767e`. 공개 GET 원본이 정확히 같고 현재/Scene은 같은 자산 하나를 참조한다.
3. 전체 응답만 제공하던 첫 구현에서는 브라우저 seekable이 0이었다. Range 응답을 추가하고 다시 연 뒤 seekable 0..4초와 Home/End 실제 이동을 확인했다. 실제 `bytes=0-1` 요청은 206, `bytes 0-1/382181`, 2바이트였다. 최종 3D 시작/끝 화면의 지정 25×13px 내부 범위에서 321/325픽셀이 달라진다.
4. 공개 현재 배치의 1,600×900mm contain과 선택 Scene의 1,200×1,200mm cover를 확인했다. Scene 이동 시 선택/재생을 초기화한다. 390×844 화면에서 재생·정지 버튼 조작과 스크린/정보 배치를 확인하고 viewport를 원복했다. 이는 실제 휴대폰/Safari 코덱·성능 인수를 뜻하지 않는다.
5. 재생 중 로컬 합성 공유를 회수했다. DELETE 204, snapshot/영상 GET 410. 이미 열린 공유 화면에서도 중단 안내로 전환되고 video DOM이 0개가 됐다. 최대 30초 주기 또는 다시 활성화 시 검증한다. 이미 내려받은 원본의 복사를 소급 회수할 수 있다는 뜻은 아니다.
6. VP9 WebM 640×360/24fps/4초, 124,244바이트의 실제 파일 선택→생성→재생/정지/End 이동을 확인했다. SHA256 `4c8f19ec3b66a99ff57e75f0d0ee6d8af0b953e729e4405e343aa18f479e03be`.
7. 정상 포스터 MP4 두 설치 + WebM 한 설치/작품 총 8개를 실제 JSON 다운로드→파일 선택→새 프로젝트 복원→WebM 선택→재생했다. JSON 원본 MP4/WebM 해시가 생성 파일과 같고 이전 작업은 목록에 보존했다.

증거: `docs/validation/2026-10-07-video-{presentation-start,presentation-end,share-start,share-end,share-scene-cover,share-mobile,share-revoked,webm,json-restored}.png`, `2026-10-07-video-sharing-results.json`. 픽셀 측정은 명시한 두 테스트 스크린 범위에 한정된다.

## 남은 인수

공개 운영 사이트에서의 영상 발행/회수 왕복, 실제 Safari/모바일 코덱, 오디오 포함 다수 동시 영상의 장시간 성능은 별도 인수다. 벽면 2D 도면의 영상 포스터 비율/크롭 표시도 후속 보완이다. PDF·GLB·glTF는 정지 포스터이며 영상 애니메이션 전달을 지원한다고 주장하지 않는다. 실제 계정·두 기기 왕복과 원문 전체 인수/확장 항목은 그대로 남는다.

R2 구간 읽기는 [Cloudflare 공식 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#ranged-reads)를 확인했다.

## 공개 배포 확인

소스 커밋 `109a1d5271b0cc4e923e69411ff0f18f1b946282`를 GitHub main에 푸시하고 Cloudflare Worker `993c93e9-d7f2-49b3-83fe-c5786fee5435`로 배포했다. 기존 D1/R2 바인딩을 유지하며 마이그레이션/운영 자산 수정은 없다. 공개 앱을 실제 브라우저에서 다시 열어 `/assets/index-KpRqJVgy.js`, 영상 작품 추가, 도면·3D 불러오기 메뉴를 확인했다. `2026-10-07-video-deployed-import-menu.png`에 JPG·PNG·PDF, SketchUp export GLB, 저장 프로젝트 복원 선택이 표시된다. `.skp` 직접 입력은 지원하지 않는다고 명시한다. 이는 운영 영상 발행/회수 왕복 및 실기기 인수 증거를 대신하지 않는다.
