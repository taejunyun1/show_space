# 프로젝터 GLB·glTF 전달 범위와 빈 모델 보호

§61의 투사 미리보기와 §54–55의 3D 교환을 구분한다. GLB/glTF 경로는 프로젝터 이미지 투사를 일반 흰 Spot으로 바꾸지 않고 기존대로 제외한다. 이번 변경은 제외 사실을 실제 출력 파일에 남기고, 형상이 없는 모델 파일을 거절하는 보완이다. 이미지 투사 베이크나 앱/공유의 실제 프로젝터 픽셀 검증을 구현했다고 집계하지 않는다.

## 실제 변경

- 내보내기 창과 GLB/glTF 다운로드 알림에 **현재 표시 중인 프로젝터·면 조명 개수** 및 PNG/PDF 3D·프로젝트 자산 백업 전달 대안을 표시한다. 숨김 조명과 다른 Scene은 이 개수에 포함하지 않는다.
- GLB/glTF Scene extras의 `gongganExport`에는 버전·미터 단위·제외 개수만 넣는다. glTF ZIP의 `export-report.json`에도 같은 개수를 기록한다. 프로젝터 이미지·원본 Notes·다른 Scene·장비 렌즈 설정을 새 metadata에 넣지 않는다. 이 metadata는 제외 안내이며 조명 재생 확장이 아니다.
- 프로젝터만 있거나 태양 없는 야외 밤일 때 빈 lighting Group을 내보내지 않는다. 모델 생성 전에 실제 표시되는 Mesh 위치 데이터가 있는지 확인한다. 형상 없이 조명만 있거나 전부 숨긴 형상은 **내보낼 벽·바닥·작품 또는 3D 모델이 없습니다**로 거절한다. 빈 GLB를 성공한 모델처럼 저장하지 않는다.
- 형상과 함께 있는 일반 Spot 및 태양 전달은 유지한다. JSON/프로젝트 자산 백업의 프로젝터 설정·이미지 보존도 유지한다. 실제 투사 이미지는 앱의 PNG/PDF 3D 경로이며, 이 작업에서는 해당 브라우저 경로의 픽셀 완료를 주장하지 않는다.

## 독립 수신 증거

`scripts/projection-receiver-fixture.test.ts`가 실제 `exportProjectGlb`/`exportProjectGltf`로 자체 합성 파일을 만든다. 6×6m 바닥, 표시 벽 4개, 숨김 차폐 벽, 참고 모델 3부품, 두 프로젝터, 표시 Area 1개/숨김 Area 1개, 일반 Spot 1개를 사용한다. 앱 내부 Note도 의도적으로 넣어 출력 제외를 검사한다. 실제 사용자 파일·브라우저 저장소·운영 계정은 사용하지 않는다.

설치된 Blender 4.4.1의 독립 importer로 GLB와 압축을 푼 glTF/buffer를 각각 수신했다. Three.js 계산을 재사용하지 않는 방향 수식으로 일반 Spot의 위치·방향·조사각을 비교했다.

- 두 형식 모두 표준 조명 정의 1개와 실제 수신 Spot 1개. 프로젝터/Area를 흰 Spot으로 오인한 추가 광원 없음.
- 제외 metadata는 프로젝터 2대·Area 1개. 원본 투사 이미지와 앱 내부 Note가 3D 파일에 들어가지 않음.
- 표시 벽 4개, 바닥 36.000008㎡/160mm, 참고 모델 Mesh 3개 유지.
- Spot 위치 오차 0m, 방향 최대 성분 차이 0.0000001192, 조사각 48° 유지. 밝기/Lux·재질의 시각적 동등성은 검증하지 않았다.
- glTF buffer는 상대 파일로 존재하며 이미지 원본/외부 URL을 요구하지 않는 합성 장면임을 확인.
- 소스 프로젝트의 프로젝터 수를 틀리면 제외 보고서 불일치로 exit 1 / passed false. GLB의 일반 Spot을 Point로 고의 변경한 파일도 exit 1 / passed false. 검증기가 잘못된 입력을 통과시키지 않음을 확인했다.
- 마지막 앱 코드로 다시 만든 GLB·glTF 해시는 독립 수신 때의 파일과 일치했다.

[실제 GLB](../validation/projection-export-2026-10-07/scene.glb), [glTF](../validation/projection-export-2026-10-07/scene.gltf), [원본 합성 Project](../validation/projection-export-2026-10-07/project.json), [수신 수치](../validation/projection-export-2026-10-07/receiver.json), [성공/오류 대조 및 해시](../validation/projection-export-2026-10-07/verifier-checks.json)를 보존했다. glTF를 사용하려면 같은 디렉터리의 buffers도 함께 받아야 한다.

## 실행 및 남은 범위

새 일반 회귀 3개로 빈 형상·야외 밤·형상 없는 Spot, 실제 GLB/glTF ZIP metadata·조명 제외·숨김·원본 불변, 정적 React의 전달 안내를 검증했다. 별도 fixture 생성 1개 통과, Blender 성공 exit 0 및 두 실패 대조 exit 1. 전체 1,078 통과 / 선택 통합 10 제외, TypeScript/Vite 빌드 통과.

운영 배포, 실제 새 UI, 마지막 투사 입력 contain/cover 조작, imported GLB 표면의 앱 투사 픽셀, 공개/발표 3D 및 PNG/PDF 3D 프로젝터 출력을 완료로 바꾸지 않는다. 사용자 결정대로 인증·브라우저 대기는 보류한다. 이 증거는 Blender가 프로젝터를 재현했다는 뜻도, 실제 SketchUp 수입을 검증했다는 뜻도 아니다.

원문 대조에서 §43의 선택 객체 Frame/Focus와 §67의 Focus 단축키가 현재 기본 시점/전체 공간 맞춤에 비해 빠져 있음을 확인했다. 다음 독립 구현은 선택 항목 시점 맞춤이다. §62의 IES/Lux는 원문 자체의 MVP 이후 별도 고급 기능이며, AI/유료 생성과 함께 별도 트랙으로 계속 추적한다.
