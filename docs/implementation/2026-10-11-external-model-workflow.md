# 외부 PBR 모델 입력·출력 보존과 Base64 변환 비용

2026-10-11. [모델 객체 구조 재사용](2026-10-11-model-instances.md)에 이어 외부 정적 GLB 한 개를 실제 가져오기·저장·공유 자산·출력 경로에 연결했다. 원문 1의 3D 작품/GLB 전달 및 원문 2의 형상 보존·경량화 검증에 해당한다. 도면 자동 인식 범위는 확대하지 않았다.

## 입력과 제품 변경

입력은 Microsoft의 CC0 BoomBox다. [공식 원본·라이선스](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/0b4f3a5862f3037c7092206e75c6f2a31a504ca5/Models/BoomBox/README.md)를 특정 commit에 고정하고 원본 GLB와 README를 보관했다. 10,614,184바이트, 정점 3,575개·삼각형 6,036개, 2048×2048 PNG 네 장과 색/금속·거칠기/AO/노멀/발광의 여섯 재질 슬롯을 가진다. 사용자 전시장 전체를 대표하는 모델로 집계하지 않는다.

기존 `Uint8Array.from(atob(...), mapper)`는 바이트마다 iterator/mapper를 실행했다. 소유한 ArrayBuffer에 직접 바이트를 채우는 `base64Bytes`로 교체했다. 편집기 작품/참고 전시장, 도메인 검증, 모델 입력/출력, 공개 자산, 로컬 발표, glTF/프로젝트 ZIP의 11개 파일에 적용한다. 기존 형식·용량·GLB/정적 모델 검사와 오류 처리는 그대로 실행하며 검사를 우회하거나 원본을 압축하지 않는다.

같은 Node 24.14.0에서 원본 10.6MB를 사용해 warmup 뒤 순서를 교차한 세 번의 중앙값은 기존 412.26ms, 변경 12.75ms다. 매번 모든 바이트가 원본과 일치했다. 이는 Base64 변환만의 CPU 측정이며 브라우저 로딩/FPS/VRAM·입력 지연 개선 수치로 사용하지 않는다. [재현 스크립트](../../scripts/benchmark-model-base64.mjs), [측정 기록](../validation/external-models-2026-10-11/base64-benchmark.json).

## 연결 검증

새 통합 검사 하나가 생산용 File 입력 파서·GLTFLoader·Scene snapshot·프로젝트 ZIP·공개 자산·GLTFExporter를 실제로 실행한다. Native PNG와 FileReader/DOM transport만 어댑터이며 GPU renderer나 입력 알고리즘을 대체하지 않는다.

- 같은 파일을 작품 및 참고 전시장 입력으로 읽고 실제 형상 크기·기준점·원본 바이트를 확인했다.
- Scene A는 500×400×250mm/회전 0°, Scene B는 700×500×350mm/X25·Y37·Z-13°로 저장했다. ZIP에 모델 한 개만 저장하며 원본 해시와 JSON 의미상 프로젝트 복원을 확인했다. JSON의 `-0`은 `0`으로 정규화되므로 IEEE 비트 동일성을 주장하지 않는다.
- 공개 모델 하나에 원본 PNG 네 장의 바이트가 유지되고 생성기 metadata·내부 Note가 제외됐다. 실제 공유 발행 UI/운영 URL 검증은 이번 검사에 포함하지 않는다.
- 각 Scene의 실제 GLB를 다시 읽어 독립 XYZ 수식으로 계산한 world bounds, position/normal/UV/index 배열과 노멀·발광·색 공간을 확인했다. 기존 출력 정책대로 텍스처는 1024px이며 각 Scene의 여섯 슬롯에서 RGBA 24개 샘플을 비교했다. 원본 2048px는 백업·공개 모델에 남는다.
- 실제 glTF ZIP의 상대 자산을 다시 묶고 읽어 Scene B 배치·노멀 맵을 확인했다. 입력 파일과 편집 프로젝트는 변경되지 않았다.

동일 최종 외부 검사 하나는 이전 제품 코드에서도 통과했다. 이번 변경은 기능 실패 수정이 아닌 변환 비용 개선이다. 초기 테스트 작성 중 native Canvas 타입·기본 바닥을 포함한 bbox·JSON `-0`의 어댑터/기대값을 바로잡은 실패는 제품 오류 전후 대조로 집계하지 않는다. 외부 검사 1개와 기존 대상 46개 통과, 전체 1,355 통과/선택 10 제외·234 파일 통과/10 제외, TypeScript 및 production build 통과다. 큰 청크 안내는 유지한다.

## 독립 수신과 시각 확인

실제 두 GLB를 Blender 4.4.1에 전달했다. 각 파일의 hash, Mesh 한 개/정점 3,575개·삼각형 6,036개, UV, world bounds(최대 오차 약 0.00012mm), packed 1024px 이미지 네 장, Principled의 색·금속·거칠기·노멀·발광 연결과 AO 연결을 확인했다. 치수 기대값을 100mm 틀리게 만든 대조 입력은 실제 import 뒤 실패한다.

두 Scene을 Cycles CPU/16 samples/768×512로 렌더해 직접 확인했다. 이는 독립 수신 재질/배치 확인이며 서비스 화면 캡처나 원본과의 렌더 픽셀 일치·광학 동등성 검증은 아니다.

- [명령·검증·원본/결과 해시](../validation/2026-10-11-external-model-workflow.json)
- [연속 입력/복원 기록](../validation/external-models-2026-10-11/workflow.json)
- [Blender 수신 기록](../validation/external-models-2026-10-11/blender/receiver.json)
- [Scene A 렌더](../validation/external-models-2026-10-11/blender/Scene-A.png), [Scene B 렌더](../validation/external-models-2026-10-11/blender/Scene-B.png)

## 남은 범위

이번 수정은 배포하지 않는다. 실제 사용자 전시장/대형 모델, 실제 브라우저/GPU·두 기기·전체 VRAM/FPS/입력 p95, 운영 인증/외부 공유 URL, 원문 24단계/성공 지표와 SketchUp 수신은 아직 남아 있다. `.skp` 직접 지원으로 표시하지 않는다. 기존 인증/브라우저 유보와 사진→재질 유료 생성·IES/조도 분석·AI 배치 등 후속 요구를 유지한다. 다음은 대표 전시장/대형 모델의 입력 제한·오류 안내와 편집/출력의 연결 검증이다.
