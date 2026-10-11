# 영상 작품의 Scene·2D·출력 연결 검증

2026-10-11. 문서 2 §60의 남은 2D 포스터 비율 인수를 점검했다. 비율 처리는 이미 [2026-10-07](2026-10-07-projection.md)에 구현돼 있었다. 이번에는 제품 오류를 새로 재현하지 않았으며, 제품 런타임 변경 없이 **같은 프로젝트의 입력→편집→Scene→출력→원본 복원** 회귀와 보존 가능한 검증 자료를 추가했다. 과거 [영상 공유 기록](2026-10-07-video-sharing.md)의 2D 후속 문구는 아래 근거로 갱신한다.

## 연결한 흐름

- 직접 생성한 6색 패널 영상: H.264 MP4 640×360 / VP9 WebM 360×640, 각각 1초. `ffprobe`의 코덱·크기·길이와 실제 `ffmpeg -ss 0.05` 디코딩을 확인했다. 다시 디코딩한 PNG 해시가 보존된 프레임과 동일하다.
- 실제 `readVideoArtworkFile`의 원본 바이트 검사·포스터 JPEG 생성과 `installLibraryArtwork`를 실행한다. HTML 영상 decoder/metadata만 위 실제 디코딩 프레임으로 대체한다. 임의 컨테이너 헤더를 재생 가능한 영상으로 집계하지 않는다. 포스터의 크기와 12개 색상 표본을 원래 디코딩 프레임과 비교했다.
- 실제 React/jsdom의 영상 Inspector·Workspace에서 contain/cover, 원본 비율 복구, Undo/Redo와 잠금 입력을 확인한다. 같은 두 정사각 스크린을 A면 contain/+30°·−15°, B면 cover/−30°·+15°로 저장하고 Scene 복원, 320×200 썸네일, 캡처 창의 PNG 다운로드를 연결했다.
- 실제 `captureSvg` 및 현장 읽기 전용 `SharedElevation`을 native SVG/Canvas로 출력한다. PNG 세 장의 72개 RGB 표본 오차는 0이다. 가로 영상의 상하 여백, 세로 영상의 좌우 여백, 중앙 잘림과 회전을 별도 계산한 좌표로 검사한다.
- 실제 `exportProjectPdf`로 벽면 2페이지·작품 상세 4페이지를 생성한다. PDF.js/native Canvas로 **6페이지 전부** 렌더하고 96개 RGB 표본 오차 0, 한글 페이지명·비공개 메모 제외를 확인한다. 같은 포스터라도 Scene별 fit이 다르면 다른 이미지를 준비한다.
- 실제 GLB 두 개를 내보내 실제 GLTFLoader로 다시 읽는다. contain의 내부 평면 크기와 cover의 스크린 크기, 다시 읽은 map의 UV 변환·포스터 픽셀을 확인했다. 표본 34개 RGB 오차는 0이다. Three 수신 근거이며 이번에 Blender/SketchUp 수신을 수행한 것으로 확대하지 않는다.
- 공유 준비의 영상 원본 2개와 포스터 2개 중복 제거·두 Scene fit, 원본 영상 해시와 바이트 동일성을 확인한다. ZIP import/export는 전체 프로젝트 JSON의 정확한 복원과 MP4/WebM 원본 바이트 복원을 확인한다. 운영 URL 발행/회수 검증은 이번 범위가 아니다.

픽셀 기준은 `videoScreenLayout`, `videoPosterRect`, PDF fit helper를 호출하지 않고 원본 크기에 대한 min/max 배율과 저장 회전·벽면을 계산한다. A면 캡처의 기대 fit을 cover로 바꾸거나 회전을 45° 바꾸면 같은 검증이 실패한다. 제품 코드는 이번에 바뀌지 않았으므로 이전 제품 코드의 실패→수정 후 통과라는 주장은 하지 않는다.

## 보존 자료와 재실행

[workflow.json](../validation/video-delivery-2026-10-11/workflow.json), [codec 기록](../validation/video-delivery-2026-10-11/fixtures.json), [6페이지 PDF](../validation/video-delivery-2026-10-11/project.pdf), [정확 복원 백업](../validation/video-delivery-2026-10-11/project.gonggan.zip), [A면 PNG](../validation/video-delivery-2026-10-11/Scene-A.png), [B면 PNG](../validation/video-delivery-2026-10-11/Scene-B.png), 두 GLB·public JSON과 원본 영상/프레임을 같은 폴더에 저장했다. A/B PNG와 PDF A페이지를 실제로 열어 검은 여백·중앙 잘림·회전·한글 PDF 배치를 확인했다.

```sh
python3 scripts/verify-video-delivery-fixtures.py
npm test -- src/components/VideoDelivery.workflow.test.tsx src/lib/videoArtworkImport.test.ts src/lib/videoPoster.test.tsx src/lib/mediaPdfFraming.test.ts src/lib/mediaFramingPixels.test.ts
GONGGAN_VIDEO_DELIVERY_PROOF=1 npm test -- src/components/VideoDelivery.workflow.test.tsx
```

`--generate`는 소유한 합성 영상·프레임만 다시 만든다. FFmpeg 버전·WebM 컨테이너 ID에 따라 원본 해시가 달라질 수 있으므로 그 경우 proof도 다시 생성한다. 보통 테스트는 커밋된 입력을 읽으며 문서 자료를 다시 쓰지 않는다. `ffmpeg`는 fixture 검증 스크립트에만 필요하며 제품 브라우저 의존성에 추가하지 않았다.

최종 대상 5파일 11개 통과. 전체 246파일/1,495개 통과, 선택 실행 10개 제외, TypeScript·빌드 통과(5.25초), diff 검사 통과. 새 연결 회귀는 1개다. 초기 검증 adapter의 createImageBitmap 누락, font 전용 fetch가 GLB blob 요청에도 적용된 문제, native Canvas의 `.data`를 DataTexture로 취급한 문제를 수정했다. 이들은 제품 오류로 집계하지 않는다.

## 남은 범위

실제 브라우저/Safari·모바일의 코덱 재생, 오디오·다수 영상 장시간 성능, GPU 3D 캡처, 운영 인증/공유 URL과 두 기기 인수는 남는다. native SVG decoder는 글자 픽셀을 렌더하지 않으므로 PNG 치수 글자의 표시 완료로 집계하지 않는다. PDF 한글은 실제 PDF.js 픽셀·텍스트 근거다. PDF/PNG/GLB는 정지 포스터이며 영상 애니메이션을 전달하지 않는다.

다음 단계는 문서 2 §61 프로젝터 이미지·설정의 Scene/공유 준비·캡처 경로 연결을 확인하는 것이다. 투사/차폐의 실제 GPU 픽셀과 24단계 전체 전시 흐름 인수는 별도로 유지한다. 사진→재질 생성은 유료 후속, 인증·브라우저 대기 유보는 유지하며 이번 변경은 재배포하지 않는다.
