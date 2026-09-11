# 도메인 모델 구현 보고

## 구현 범위

- `src/domain/types.ts`: 벽, 작품, 장면, 프로젝트, 선택 타입 계약
- `src/domain/model.ts`: 데모 데이터, 단위·배치 계산, 불변 편집, 추가·복제·삭제·등간격 배치, 경고, JSON 전체 검증
- `src/domain/model.test.ts`: 길이/단위, 회전 벽 배치, 연결 꼭짓점, 잠금/유한값, 가변 폭 간격, 경계 경고, 잘못된 가져오기, 데모 왕복 테스트

잠긴 객체의 제한, 연결된 잠긴 벽의 간접 이동 제한, 마지막 벽 및 작품이 걸린 벽 삭제 제한을 적용했다. 가져오기는 스키마와 전체 중첩 구조, 유한한 양수 치수, ID 중복, 벽 참조, 프레임 열거형, 객체 수, 이미지 크기·URL 형식을 검사하고 독립 복제본을 반환한다. 장면의 작품은 현재 작품 목록과 별도 스냅샷으로 검사하며 현재 존재하는 벽만 참조할 수 있다.

## 검증 결과

- `npm test -- src/domain/model.test.ts`: 성공, 1개 파일 / 9개 테스트 통과
- `npx tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ESNext,DOM --moduleResolution bundler --module ESNext src/domain/types.ts src/domain/model.ts src/domain/model.test.ts`: 성공, 도메인 파일 타입 오류 없음
- `npm run build`: TypeScript 단계 성공 후 Vite 단계 실패. 병렬 구현 중인 `/src/main.tsx`가 아직 없어 엔트리를 찾지 못한 것이 원인이며 도메인 타입 오류는 출력되지 않음.

TDD의 첫 실행은 의존성 설치 진행 중이라 `vitest: command not found`였고, 설치 후 구현 테스트에서 잘못 계산해 둔 회전 벽 기대 좌표와 한국어 정규식 2건이 실패하는 것을 확인해 테스트 기대값을 바로잡았다. 이후 위 8개 테스트가 통과했다.

후속으로 UI의 무인자 `addArtwork()` 호출이 바로 렌더되도록 기본 이미지 경로를 `/artworks/artwork-1.png`로 지정했다. 실패 테스트에서 기존 빈 문자열 반환을 확인한 뒤 구현했으며, 추가된 프로젝트가 `parseProject()` 검증을 다시 통과하는 회귀 검사까지 포함해 총 9개 테스트가 통과한다.
