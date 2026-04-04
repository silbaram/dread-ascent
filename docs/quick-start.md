# Quick Start

## 요구 사항

- Node.js 18+
- npm 9+

## 설치

```bash
npm install
```

## 개발 서버

```bash
npm run dev
```

- 기본 Vite 개발 서버를 띄웁니다.
- Phaser 게임은 `#game-container`에 붙고, DOM HUD는 `#hud-root`에 렌더됩니다.

## 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm test
```

자주 쓰는 슬라이스:

```bash
npm test -- tests/integration/scenes/BattleScene.test.ts
npm test -- tests/unit/scenes/MainScene.test.ts
npm test -- tests/unit/domain/services/CardEffectService.test.ts
```

## 기본 조작

탐험 중:

- `WASD` 또는 방향키: 한 칸 이동
- `Tab` 또는 `I`: 인벤토리 열기/닫기
- `Esc`: 인벤토리 닫기

타이틀 화면:

- `Sanctuary` 버튼: 성소 열기
- `Card Archive` 버튼: 카드 모음집 열기
- 성소가 열려 있을 때 `Esc`: 성소 닫기

전투 중:

- 손패 카드를 마우스로 클릭: 카드 사용
- `End Turn` 버튼: 턴 종료
- 에너지가 0이 되면 자동으로 턴이 종료될 수 있음

## 첫 실행에서 보면 좋은 흐름

1. `New Descent`로 새 런을 시작합니다.
2. 필드에서 적과 접촉하면 `BattleScene`으로 들어갑니다.
3. 적 처치 후 카드 보상이 뜰 수 있습니다.
4. 사망 후 타이틀로 돌아가면 영혼 파편으로 성소 업그레이드를 살 수 있습니다.
5. 이전 하강에서 확보한 카드는 카드 모음집에서 누적 확인할 수 있습니다.

## 로컬 데이터

이 프로젝트는 브라우저 `localStorage`를 사용합니다.
초기화가 필요하면 브라우저 저장소에서 아래 키를 지우면 됩니다.

- `dread-ascent.run-state`
- `dread-ascent.soul-shards`
- `dread-ascent.meta-progression`
- `dread-ascent.card-collection`
- `dread-ascent.locale`
