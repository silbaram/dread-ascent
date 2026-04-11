# Testing Guide

## 현재 테스트 구조

현재 `tests/`에는 총 47개 테스트 파일이 있습니다.

- `tests/unit`: 42개
- `tests/integration`: 5개
- `tests/e2e`: 디렉터리만 있고 활성 파일 없음

## 디렉터리별 역할

### `tests/unit`

작고 순수한 로직을 검증합니다.

예시:

- `domain/entities`
- `domain/services`
- `scenes/controllers`
- `scenes/synchronizers`
- `ui/GameHud`

적합한 변경:

- 카드 효과 계산
- 덱/드로우/상태이상
- 저장 포맷 정규화
- HUD 렌더 문자열

### `tests/integration`

여러 구성 요소가 실제로 이어지는 흐름을 검증합니다.

예시:

- `integration/scenes/BattleScene.test.ts`
- `integration/infra/rot/*`

적합한 변경:

- 카드 전투 턴 흐름
- 실제 씬 소비 경로
- ROT.js 어댑터와 도메인 연결

## 실행 명령

전체:

```bash
npm test
```

`npm test`는 Vitest 실행 후 계약 검증을 이어서 실행합니다. Vitest만 실행해야 할 때는 `npm run test:vitest`를 사용합니다.

대표 슬라이스:

```bash
npm test -- tests/integration/scenes/BattleScene.test.ts
npm test -- tests/unit/scenes/MainScene.test.ts
npm test -- tests/unit/ui/GameHud.test.ts
npm test -- tests/unit/domain/services/CardEffectService.test.ts
```

빌드 검증:

```bash
npm run build
```

## 어떤 테스트를 어디에 넣을까

- 순수 계산 규칙 변경
  `tests/unit/domain/services/*`
- 카드 카탈로그/덱/보상 생성 규칙 변경
  `tests/unit/domain/*`
- `MainScene`, `BattleScene`에서 실제 상태 전이와 소비 경로 확인 필요
  `tests/integration/scenes/*`
- DOM HUD 텍스트, 버튼, 오버레이 렌더 확인
  `tests/unit/ui/GameHud.test.ts`
- 입력/오버레이 컨트롤러 변경
  `tests/unit/scenes/controllers/*`

## 현재 프로젝트의 테스트 원칙

- 계산식 변경은 최소 1개의 회귀 테스트를 같이 추가합니다.
- Scene 변경은 이벤트 발생만 보지 말고, HUD나 상태 소비 결과까지 보는 편이 좋습니다.
- 저장 포맷 변경은 복원 테스트를 반드시 같이 수정해야 합니다.
- 계약/문서 변경이 동반되는 시스템 수정이라면 테스트 외에 계약 검증도 같이 수행합니다.

## 권장 검증 순서

1. 관련 unit test 실행
2. 관련 integration test 실행
3. `npm run build`
4. 계약 파일을 건드렸다면 `npm run validate:contracts`
