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

**층 이동 타일**

- 금색 계단 타일로 이동하면 다음 층으로 전환됩니다.
- 초록 휴식 타일은 Safe Zone 중앙에 배치됩니다.
- 붉은 적 타일은 현재 층의 적 엔티티입니다.
- 적 방향으로 이동하면 이동 대신 범프 공격을 수행합니다.
- 적이 플레이어를 시야 내에서 발견하면 추적하고, 옆 칸에 도달하면 공격 행동을 선택합니다.
- 상단 DOM HUD에서 현재 층, HP, EXP, 활성 턴, 적 수, 게임 상태를 확인할 수 있습니다.
- 하단 `Tower Feed` 메시지 로그에서 공격, 피격, 보상, 층 이동 이벤트를 확인할 수 있습니다.

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

도메인/인프라/UI 테스트를 실행합니다. 현재 턴 큐, FOV, 층 진행, 적 스폰, 적 AI, 전투, 맵 생성, HUD 렌더링까지 총 31개 테스트가 포함됩니다.

```
✓ tests/unit/domain/services/CombatService.test.ts (2)
✓ tests/unit/domain/services/FloorProgressionService.test.ts (4)
✓ tests/unit/domain/services/EnemyAiService.test.ts (4)
✓ tests/unit/domain/services/EnemySpawnerService.test.ts (4)
✓ tests/unit/domain/services/TurnQueueService.test.ts (5)
✓ tests/unit/domain/services/VisibilityService.test.ts (3)
✓ tests/unit/ui/GameHud.test.ts (3)
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
│   └── MainScene.ts               # 입력 처리 + 렌더링 담당
├── ui/
│   ├── GameHud.ts                 # DOM HUD 상태/로그 렌더링
│   └── gameHud.css                # HUD 오버레이 스타일
├── domain/
│   ├── entities/
│   │   ├── Player.ts              # 플레이어 위치 상태
│   │   └── Enemy.ts               # 적 위치 + 전투 스탯
│   └── services/
│       ├── CombatService.ts
│       ├── EnemyAiService.ts
│       ├── EnemySpawnerService.ts
│       ├── FloorProgressionService.ts
│       └── VisibilityService.ts   # FOV + 탐험 상태 관리
└── infra/
    └── rot/
        ├── MapGenerator.ts        # rot.js Digger 맵 생성
        ├── RotPathFinder.ts       # rot.js A* 경로 탐색 어댑터
        └── RotFovCalculator.ts    # rot.js FOV 어댑터

tests/
├── integration/infra/rot/
│   ├── MapGenerator.test.ts
│   ├── RotPathFinder.test.ts
│   └── RotTurnScheduler.test.ts
└── unit/
    ├── domain/services/
    │   ├── CombatService.test.ts
    │   ├── EnemyAiService.test.ts
    │   ├── EnemySpawnerService.test.ts
    │   ├── FloorProgressionService.test.ts
    │   ├── TurnQueueService.test.ts
    │   └── VisibilityService.test.ts
    └── ui/
        └── GameHud.test.ts
```
