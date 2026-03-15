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
- **전투**: 적 방향으로 이동하면 범프 공격을 수행합니다. 적의 등급(일반/엘리트/보스)에 따라 난이도가 다릅니다.
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
│   └── MainScene.ts               # 입력 처리 + 렌더링 담당
├── ui/
│   ├── GameHud.ts                 # DOM HUD 상태/로그/오버레이 렌더링
│   └── gameHud.css                # HUD 스타일
├── domain/
│   ├── entities/                  # 도메인 모델 (Player, Enemy, Item, Stats)
│   └── services/                  # 순수 게임 로직
│       ├── CombatService.ts       # 전투 수식
│       ├── EnemySpawnerService.ts # 적 및 보스 스폰
│       ├── ItemService.ts         # 아이템 습득/장착/사용
│       ├── RunPersistenceService.ts # LocalStorage 저장 관리
│       ├── FloorProgressionService.ts
│       ├── MetaProgressionService.ts
│       └── VisibilityService.ts   # FOV + 탐험 상태
└── infra/                         # 외부 라이브러리 어댑터
    └── rot/
        ├── MapGenerator.ts        # rot.js 맵 생성
        ├── RotPathFinder.ts       # rot.js 경로 탐색
        └── RotFovCalculator.ts    # rot.js FOV
```
