# 같은 전시의 텍스처·Note·야외 시간·GLB 수신

2026-10-11. [도면부터 출력까지의 연속 흐름](2026-10-11-exhibition-workflow.md)에 같은 프로젝트의 직접 텍스처·내부 메모·야외 시간·GLB 교환을 추가했다. 기존 제품 기능을 연결한 검증이며 이번 변경의 제품 코드 추가는 없다. 앞선 캡처 오류 수정 및 개별 UI 구현은 그대로 사용한다.

## 연결한 동작

실제 App/Header/PlanView/Outliner/Inspector/Workspace/각 dialog와 기본 로컬 Auto Save·수동 Save를 계속 사용한다. 도면 입력과 축척 보정, 작품 PNG 10점·치수·그룹 배열, Scene A/B·벽면 캡처·PDF 12페이지·ZIP 완전 복원도 같은 사례 안에 유지한다.

- 벽의 wood 프리셋에 실제 64×32px PNG를 올리고 Inspector에서 반복 크기를 200×100cm로 설정한다. Scene A/B와 Scene A 복원, 독립 저장소·ZIP 재읽기에 2000×1000mm 설정을 보존한다. 사진에서 재질을 생성하지 않는다.
- 상단 프로젝트 메모에서 비공개 텍스트·체크 항목/완료 상태와 별도 48×24px 참고 PNG를 추가한다. 참고 사진은 벽 텍스처와 다른 픽셀이다. 로컬 저장/ZIP에는 포함하고 PDF 텍스트·공개 payload·GLB에는 비공개 텍스트/필드를 제외한다. 공개 업로드 목록의 11개 소스에 참고 사진 URL이 없음을 확인한다.
- 실제 야외 dialog에서 2026-10-11·09:00으로 설정하고 Scene A를 저장한다. 3D 시간 슬라이더를 17:00으로 바꿔 Scene B를 저장한 뒤 Scene A를 열면 09:00과 텍스처를 복원한다. 카메라/GPU transport는 adapter이며 실제 WebGL 태양·그림자 픽셀 인수는 아니다.
- 상단 3D 모델 내보내기의 생산용 `prepareExportScene`·GLTFExporter로 GLB를 만든다. 벽 텍스처 1장과 작품 이미지 10장의 내장 PNG를 실제로 decode하고 모든 샘플 alpha를 확인한다. GLTFLoader로 다시 읽어 벽 높이 3.5m, 텍스처 반복 `[0.5, 1]`과 64×32px, 각 작품의 64×48px 및 원본 대비 샘플 RGBA 일치를 확인한다. 출력의 Spot/Sun 정의와 비공개 메모 필드 제외도 확인한다.

## 어댑터와 실제 수신 근거

처음 CPU 렌더에서 작품 색이 빠졌다. 제품의 브라우저 캔버스에는 없는 native Canvas `data()` 메서드 때문에 GLTFExporter가 테스트 캔버스를 DataTexture로 오인해 투명 PNG를 만들었다. DOM 어댑터에서 이 필드를 숨기고 결과 픽셀 검사를 추가했다. 이전의 이미지 개수/크기 검사만으로 픽셀 인수를 주장하지 않는다. FileReader/Blob의 jsdom·Node ArrayBuffer realm도 브라우저 동작에 맞게 연결했고 Native Canvas의 ImageBitmap 역할은 no-op close로 처리한다. 이 변경은 테스트 transport에만 적용한다.

최종 GLB를 Blender 4.4.1의 독립 glTF importer로 다시 읽었다. 실제 파일/프로젝트 ID·SHA-256이 같은 수신 기록에서 벽 4개, 설치 이미지 작품 10점, 내장 이미지 11장 모두 packed, 벽 텍스처 반복/미터 단위 UV를 확인했다. 벽 world bounds 오차와 작품 local image size 오차는 기록 파일에서 확인할 수 있다. Spot/Sun도 불러왔다. 실제 CPU Cycles 1200×900px 렌더 두 장을 저장하고 색/체크 텍스처를 직접 열어 확인했다.

Blender의 샌드박스 실행은 Metal 장치 초기화 중 종료돼 허용된 로컬 실행으로 같은 명령을 완료했다. 출력은 작업 폴더에 저장했다. CPU 렌더는 파일 수신·텍스처 외관 근거이며 앱의 GPU/조명 물리 정확도 또는 SketchUp 호환 검증이 아니다. 수신 검증 script는 바닥/개구부·참고 모델·독립 3D 작품·설치 위치 전체·조명 외관을 인수하지 않는다.

## 결과

확장한 연속 테스트 1개 통과. 전체 1,314 통과/선택 10 제외, 229 파일 통과/10 파일 제외, TypeScript·production build·diff 검사 통과. 새 제품 오류를 재현한 수정 전/후 대조로 집계하지 않는다. 앞선 캡처 대조는 이전 커밋과 그 기록에 보존했다. 기존 큰 청크 안내는 유지한다.

- [확장 단계·해시·검증 기록](../validation/2026-10-11-exhibition-extended-workflow.json)
- [전시안 PDF](../validation/2026-10-11-exhibition-extended-output.pdf), [전체 프로젝트 ZIP](../validation/2026-10-11-exhibition-extended.gonggan.zip), [GLB](../validation/2026-10-11-exhibition-extended.glb)
- [Blender 수신 결과](../validation/2026-10-11-exhibition-extended-receiver/receiver.json), [전체 수신 렌더](../validation/2026-10-11-exhibition-extended-receiver/overview.png), [텍스처 벽 수신 렌더](../validation/2026-10-11-exhibition-extended-receiver/texture-wall.png)

실제 로그인·계정/기기, 브라우저/GPU·최종 PNG/PDF 3D 픽셀, 마우스 드래그/스냅/Hand의 같은 전시 흐름과 읽기 전용 URL 발행/회수, 바닥 폐합·실제 SketchUp 수신·실사용 지표·원문 24단계 전체 인수는 남는다. Native SVG rasterizer의 내장 이미지 href 픽셀 생략 한계도 앞선 기록대로 유지한다. 이번에 재배포하지 않는다.

다음은 같은 프로젝트의 마우스 편집·스냅/Hand와 벽 연결/바닥, 읽기 전용 공개 URL 발행/회수 흐름이다. 실제 인증과 브라우저 대기를 개별 합성 근거로 대체해 완료 선언하지 않는다. 도면 완전 복원/문·설비 독립 직접 편집/후속 유료 사진→재질 생성 범위는 확장하지 않는다.
