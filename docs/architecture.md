# Architecture

## 한눈에 보기

`Dread Ascent`는 "도메인 규칙"과 "런타임 표현"을 분리하는 구조입니다.

```text
main.ts
  ├─ MainScene      탐험, 층 진행, 필드 입력, 저장/오버레이 연결
  ├─ BattleScene    카드 전투 전용 씬
  └─ GameHud        DOM HUD와 오버레이

domain/
  ├─ entities/      카드, 플레이어, 적, 아이템, 스탯
  └─ services/      전투, 드로우, 상태이상, 저장, 메타 진행

infra/rot/
  └─ ROT.js 어댑터  맵, FOV, 경로 탐색, 턴 스케줄

scenes/
  ├─ controllers/   입력과 오버레이 제어
  ├─ directors/     씬이 조립하는 고수준 진행 로직
  ├─ effects/       데미지 팝업 등 표현 요소
  └─ synchronizers/ 엔티티 상태를 렌더와 동기화
```

## 런타임 구성

진입점은 [main.ts](/Users/qoo10/projects/dread-ascent/src/main.ts)입니다.

- `GameLocalization` 생성
- `GameHud` 생성
- Phaser 게임 초기화
- 씬 배열에 `MainScene`, `BattleScene` 등록

실행 중 역할 분리:

- `MainScene`
  필드 탐험, 층 생성, 적 조우, 아이템, 런 상태, 타이틀/성소/인벤토리/결과 화면 연결
- `BattleScene`
  카드 전투 턴 루프, 에너지/드로우/상태이상/적 intent/UI 패널 처리
- `GameHud`
  DOM 기반 상단 HUD, 타이틀 오버레이, 성소, 카드 모음집, 인벤토리, 보상, 결과 화면

## 디렉터리 역할

### `src/domain`

- `entities/`
  카드, 적, 플레이어, 아이템, 전투 스탯 같은 데이터 모델
- `services/`
  카드 효과, 상태이상, 덱 관리, 아이템, 층 진행, 영혼 파편, 메타 업그레이드 같은 규칙 로직

이 레이어는 Phaser에 기대지 않는 순수 TypeScript 로직이 중심입니다.

### `src/scenes`

- `MainScene.ts`
  탐험 루프의 중심
- `BattleScene.ts`
  카드 전투 전용 씬
- `controllers/`
  `InputController`, `OverlayController`
- `directors/`
  `FloorDirector`, `BattleDirector`
- `synchronizers/`
  `RenderSynchronizer`, `MovementAnimator`, 이동 duration 정책

### `src/infra/rot`

ROT.js에 의존하는 구현을 모읍니다.

- `MapGenerator`
- `RotFovCalculator`
- `RotPathFinder`
- `RotTurnScheduler`

### `src/ui`

- `GameHud.ts`
  DOM HUD와 오버레이 렌더러
- `GameLocalization.ts`
  한/영 로케일 텍스트와 저장
- `gameHud.css`
  HUD 스타일

### `src/shared`

- `types/`
  공용 타입
- `utils/`
  셔플, 위치 키, 서명 숫자 등 범용 유틸

### `src/app`

현재 저장소에는 디렉터리만 있고 활성 파일은 없습니다.
향후 앱 레벨 bootstrap/config 확장 슬롯으로 보는 편이 맞습니다.

## 주요 데이터 흐름

### 탐험

1. `InputController`가 이동 입력을 받음
2. `MainScene`가 이동/충돌/적 조우 판정
3. `FloorDirector`, `RenderSynchronizer`, `BattleDirector`가 후속 처리
4. `GameHud`와 오버레이 상태를 갱신
5. 필요하면 `RunPersistenceService`로 현재 런 저장

### 전투

1. 적과 조우하면 `BattleScene` 실행
2. `DrawCycleService`, `EnergyService`, `CardEffectService`, `StatusEffectService`로 턴 처리
3. 결과를 `BattleSceneResult`로 `MainScene`에 반환
4. `MainScene`가 적 제거, 보상, 경험치, 종료 상태를 정리

### 메타 진행

1. `OverlayController`가 타이틀/성소/결과 UI 상태 관리
2. `SoulShardService`, `MetaProgressionService`, `CardCollectionService`가 메타 데이터 제공
3. `GameHud`가 타이틀 오버레이와 성소 목록을 렌더

## 현재 구조에서 알아둘 점

- `BattleDirector`는 아직 남아 있는 보조 전투 경로입니다.
  덱이 비어 있을 때 `MainScene`에서 이 경로로 폴백할 수 있습니다.
- 세부 밸런스와 상태 전이는 `ai-dev-team/artifacts/contracts/`의 계약 파일과 함께 관리됩니다.
- `docs/`는 입문용 요약이고, 세부 계약/시스템 의도는 내부 아티팩트 문서를 참조합니다.
