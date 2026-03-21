# Quick Start

5분 안에 Dread Ascent를 로컬에서 실행합니다.

---

## Prerequisites

- **Node.js** 18 이상
- **npm** 9 이상

---

## Installation

```bash
# 저장소 클론
git clone <repo-url>
cd dread-ascent

# 의존성 설치
npm install
```

---

## 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 → 던전이 랜덤 생성되고 플레이어가 표시됩니다.

**조작 방법**

| 키 | 동작 |
|:--:|------|
| `↑` / `W` | 위로 이동 |
| `↓` / `S` | 아래로 이동 |
| `←` / `A` | 왼쪽으로 이동 |
| `→` / `D` | 오른쪽으로 이동 |
| `Tab` / `I` | 인벤토리 열기/닫기 |
| `Esc` | 메뉴 닫기 / 이전 화면 |

**게임 목표 및 진행**

- **최종 목표**: 100층에 도달하여 'Final Boss'를 물리치는 것입니다.
- **층 이동**: 금색 계단 타일로 이동하면 다음 층으로 전환됩니다. (이때 자동 저장됩니다)
- **전투**: 적과 조우 시 카드 배틀 씬으로 진입합니다. 
  - **드로우**: 매 라운드 덱에서 무작위 3장의 카드를 뽑습니다.
  - **선택**: 3장 중 1장을 선택하여 적의 카드와 맞붙습니다.
  - **상성**: 공격 vs 수비(데미지 감쇄), 공격 vs 공격(서로 피해), 수비 vs 수비(무피해) 상성이 적용됩니다.
  - **장비**: 무기와 방어구의 스탯이 각각 공격/수비 카드의 파워에 보너스로 반영됩니다.
  - **보상**: 적 처치 시 일정 확률로 새 카드를 획득하여 덱에 추가하거나 기존 카드와 교체할 수 있습니다.
  - **종료**: 한 쪽의 HP가 0이 될 때까지 라운드가 반복됩니다.
- **아이템**: 필드 위 아이템 타일로 이동하여 자동 습득하고, 인벤토리에서 장착하거나 사용할 수 있습니다.
- **성장**: 적 처치 시 경험치를 획득하며 레벨업 시 기본 능력치가 상승합니다. 영구 강화는 'Sanctuary' 메뉴를 이용하세요.

---

## 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다.

빌드 결과 미리보기:

```bash
npm run preview
```

---

## 테스트 실행

```bash
npm test
```

도메인/인프라/UI 테스트를 실행합니다. 현재 턴 큐, FOV, 층 진행, 적 스폰, 적 AI, 전투, 맵 생성, HUD 렌더링, 인벤토리, 저장 시스템까지 모든 핵심 로직을 검증합니다.

```
✓ tests/unit/domain/entities/Player.test.ts (2)
✓ tests/unit/domain/services/CombatService.test.ts (2)
✓ tests/unit/domain/services/EnemyAiService.test.ts (4)
✓ tests/unit/domain/services/EnemySpawnerService.test.ts (11)
✓ tests/unit/domain/services/FloorProgressionService.test.ts (6)
✓ tests/unit/domain/services/ItemService.test.ts (6)
✓ tests/unit/domain/services/MetaProgressionService.test.ts (6)
✓ tests/unit/domain/services/RunPersistenceService.test.ts (6)
✓ tests/unit/domain/services/SoulShardService.test.ts (4)
✓ tests/unit/domain/services/TurnQueueService.test.ts (5)
✓ tests/unit/domain/services/VisibilityService.test.ts (4)
✓ tests/unit/ui/GameHud.test.ts (10)
✓ tests/integration/infra/rot/MapGenerator.test.ts (2)
✓ tests/integration/infra/rot/RotPathFinder.test.ts (2)
✓ tests/integration/infra/rot/RotTurnScheduler.test.ts (2)
```

---

## 프로젝트 구조

```
src/
├── main.ts                        # Phaser 게임 설정 및 진입점
├── scenes/
│   ├── MainScene.ts               # 던전 탐험 및 입력 처리
│   ├── BattleScene.ts             # 카드 배틀 시각화 및 UI
│   └── directors/
│       ├── FloorDirector.ts       # 층 전환 및 이벤트 조정
│       └── BattleDirector.ts      # 배틀 진입 및 결과 처리
├── domain/
│   ├── entities/                  # 도메인 모델 (Player, Enemy, Item, Card)
│   └── services/                  # 순수 게임 로직
│       ├── CardBattleLoopService.ts  # 멀티 라운드 배틀 관리
│       ├── CardBattleResolver.ts     # 상성 판정 및 데미지 계산
│       ├── CardBattleService.ts      # 카드 드로우 및 적 풀 생성
│       ├── CardDropService.ts        # 카드 드롭 및 덱 교체
│       ├── DeckService.ts            # 플레이어 덱 관리
│       ├── EquipmentCardBonusService.ts # 장비 스탯 보너스 적용
│       ├── EnemySpawnerService.ts # 적 및 보스 스폰
│       ├── ItemService.ts         # 아이템 습득/장착/사용
│       ├── RunPersistenceService.ts # LocalStorage 저장 관리
│       └── FloorProgressionService.ts
└── infra/                         # 외부 라이브러리 어댑터
```
