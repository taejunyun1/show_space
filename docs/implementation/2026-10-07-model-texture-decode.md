# 3D 모델 텍스처 디코딩 실패 보호

2026-10-07 · 원문 2 §68의 Texture 누락 경고 보완

Three.js 0.180.0의 GLTFLoader는 `loadTextureImage`가 실패하면 null을 반환하며, `assignTexture`가 해당 슬롯을 비워 둔다. 따라서 PNG/JPG/WebP 헤더와 형상이 정상이어도 이미지 본문이 손상되면 성공한 흰색 모델처럼 보일 수 있었다.

`loadStaticModel`은 기존 정적 GLB·자산 제한 검사를 수행한 뒤 로더가 실제 요청한 재질 텍스처의 결과를 기록한다. base color, normal, metallic/roughness 및 로더가 지원하는 재질 확장에 동일하게 적용한다. null·미완료·0 크기·비정상 크기의 이미지와 기존 8192px/전체 6400만 픽셀 제한 위반은 모델 성공으로 반환하지 않는다. 동일한 decoded image를 공유하는 복제 객체와 여러 map은 한 번만 픽셀 수에 집계한다. 텍스처가 없는 모델, 사용하지 않는 이미지, unlit 재질이 의도적으로 무시하는 normal 슬롯은 계속 허용한다.

가져오기(전시장/3D 작품/벽 추출), 편집 화면 모델, 잠긴 공유/발표 모델, GLB/glTF 출력이 이 로더를 사용한다. 화면 실패 메시지는 원본 파일 이름·URL·내부 Note를 포함하지 않는다. 오류가 있는 모델의 형상만 정상처럼 표시하거나 내보내지 않는다. 신규 가져오기는 모델을 반환하기 전에 실패하고, 기존 프로젝트 데이터는 변경하지 않아 원본 모델을 다시 가져와 복구할 수 있다. 숨긴 모델은 내보내기 로딩 대상에서 제외한다.

이미지 실패 뒤 파싱된 전체 scenes의 geometry/material/texture/bitmap을 해제하고 embedded Blob URL도 해제한다. 정상 모델은 기존 캐시 소유권과 수명 주기를 유지한다. 이 검사는 GLTFLoader의 실제 assignTexture 요청을 기준으로 하며, 로더 버전을 변경할 때 회귀 검증이 필요하다.

검증: 실제 GLTFLoader와 @napi-rs/canvas PNG 디코더를 함께 사용했다. 브라우저 ImageBitmap 전달부를 native decoder로 연결했으며, 모델 로더/형상/재질은 가짜로 대체하지 않았다. 정상 2×2 PNG의 RGBA 픽셀과 KHR_texture_transform, 복제/여러 슬롯의 단일 decode, clearcoat 실패, unlit/사용하지 않는 손상 이미지, 정상 자산까지 포함한 실패 정리, 두 입력·벽 추출·두 출력·공개 metadata 정리 후 실패를 새 회귀 8개로 확인했다. 기존 GLTFLoader가 같은 손상 PNG에서 null map과 형상을 반환하는 재현도 포함한다. 전체 1,115 통과/선택 10 제외, TypeScript/Vite 빌드 및 diff 검사 통과.

범위: 이는 선언된 사용 텍스처의 디코딩 성공과 자원 제한 보호다. 실제 브라우저/Safari 디코더·WebGL 업로드·GPU 픽셀·PNG/PDF 전체 장면 인수·공유 UI 인수는 완료로 집계하지 않는다. 캡처 대기 중 모든 모델의 실패 상태 전달도 별도 점검 대상이다. 정적 공유/백업 byte 변환은 디코딩을 수행하지 않으며 원본 복구 가능성을 유지한다. 배포와 운영 인증은 별도다.
