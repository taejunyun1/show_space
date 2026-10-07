# 표면 texture/normal 캡처 준비 검사

2026-10-07 · 원문 1 §15/27, 원문 2 §48/68의 표면 이미지 누락 보호

모델과 작품 이미지가 준비돼도 벽/바닥의 별도 재질 이미지 또는 노멀 맵은 아직 로딩 중일 수 있었다. `SurfaceFinish`는 그동안 빈 map을 가진 재질을 표시하며, PNG 캡처의 대기는 이 상태를 포함하지 않았다.

`SurfaceFinish`의 실제 Material에 texture/normal의 현재 주소, 반복 실제 크기, 노멀 강도 및 pending/ready/failed 상태를 기록한다. 새 주소의 로딩 중에는 이전 source map을 ready로 인정하지 않는 기존 hook 동작과 연결한다. 캡처 검사는 이 기록이 현재 입력과 일치하는지 확인하고 실제 Material의 map/normalMap도 붙어 있어야 성공한다. texture/normal을 요청하지 않는 기본 단색 재질은 기다리지 않는다.

현재 프로젝트의 표시 벽, 실제로 존재하는 모든 바닥 surface, 표시 이미지 작품의 normal에 적용했다. 숨긴 벽/삭제 벽 작품, 존재하지 않는 바닥, 별도 BasicMaterial을 사용하는 영상 화면에는 적용하지 않는 슬롯을 요구하지 않는다. 컷어웨이의 카메라별 임시 숨김과 달리 프로젝트에서 표시한 벽/작품의 구성 자산은 준비 대상으로 유지한다. 알려진 실패는 원본 주소/파일명 없이 texture 또는 normal 오류를 전달하며, 로딩은 기존 캡처 대기에서 완료/시간 초과로 처리한다. 렌더 직전의 재검사와 기존 복원 경로를 유지한다.

바닥 surface 목록은 대기 시작 시 한 번만 계산한다. 캡처 프로젝트 변경 guard가 대기 중 수정/프로젝트 교체를 거부하므로 반복 polling마다 전체 바닥 경계를 다시 만들 필요가 없다. 이 내부 준비 정보는 live Material에만 있으며 프로젝트 저장 데이터와 detached GLB/glTF/PDF 형상은 변경하지 않는다.

검증: 새 회귀 8개로 texture/normal pending·성공·실패, 실제 Material map 누락, 변경 source/반복 크기/노멀 강도 이전 상태, 벽+바닥+이미지 normal 통합, 분리된 두 바닥 및 없는 바닥, 숨김/영상 슬롯 제외, 비동기 준비 완료/즉시 오류를 확인했다. 실제 Three TextureLoader의 브라우저 Image 이벤트 전달만 native Image adapter로 연결하고 @napi-rs/canvas로 정상/손상 PNG 본문을 디코딩했다. 정상 normal RGBA [128,128,255,255]와 NoColorSpace 유지, 손상 PNG의 오류 반환을 확인했다. 전체 1,133 통과/선택 10 제외, TypeScript/Vite 빌드와 diff 검사 통과.

한계: 실제 브라우저/R3F commit, WebGL 업로드·재질 조명 결과 및 PNG/PDF 전체 픽셀은 이 native decoder/상태 검사로 완료 판정하지 않는다. 전체 24단계 흐름, 실제 사용자 모델/SketchUp 수신, 실기기 성능/계정, 운영 인증과 배포 인수는 계속 별도다. 원문의 IES/Lux/AI 및 사진→재질 유료 기능은 후속 범위를 유지한다.
