# Architecture

Dread Ascent는 **도메인 로직과 렌더링을 엄격히 분리**하는 계층형 아키텍처를 사용합니다.

---

## 계층 구조

```
┌────────────────────────────────────┐
│           scenes/                  │  ← 입력 수신, 렌더링 반영
│         (Phaser Scene)             │     외부 라이브러리 사용 허용
└──────────────┬─────────────────────┘
               │ snapshot, commands
┌──────────────▼─────────────────────┐
│           domain/                  │  ← 순수 게임 규칙
│    (entities, services, systems)   │     Phaser / rot-js 의존 금지
└──────────────┬─────────────────────┘
               │ interface 구현
┌──────────────▼─────────────────────┐
│            infra/                  │  ← 외부 라이브러리 어댑터
│         (rot/, firebase/)          │     도메인 인터페이스를 구현
└────────────────────────────────────┘
```

### 핵심 원칙

- **`domain/`** 계층은 Phaser, rot-js, Firebase 등 외부 의존성을 가지지 않는다.
- **`scenes/`** 계층은 도메인의 스냅샷을 받아 화면에 반영하는 역할만 한다.
- **`infra/`** 계층은 도메인이 정의한 인터페이스를 외부 라이브러리로 구현한다.

---

## 구현된 컴포넌트 (Sprint 001-011)

### `domain/entities/CombatStats`

전투와 이동에 공통으로 쓰이는 기본 스탯 정의.

- `health`, `maxHealth`, `attack`, `defense`와 함께 `movementSpeed`를 실제 필드로 유지한다
- `CombatStatModifier`도 `movementSpeed`를 지원해 장비/업그레이드/보정값을 같은 구조로 적용할 수 있다
- 기준값은 `movementSpeed=100`이며, 이동 애니메이션 duration 정책의 기준점으로 사용한다

```typescript
import { BASE_PLAYER_STATS, DEFAULT_MOVEMENT_SPEED } from './domain/entities/CombatStats';

console.log(BASE_PLAYER_STATS.movementSpeed); // 100
console.log(DEFAULT_MOVEMENT_SPEED); // 100
```

---

### `domain/entities/Player`

플레이어의 그리드 위치를 관리하는 순수 도메인 엔티티.

- 위치와 함께 전투 스탯(`health`, `maxHealth`, `attack`, `defense`, `movementSpeed`) 및 누적 경험치(`experience`)를 유지한다
- `reset()`, `restore()`, `applyStatModifier()`가 `movementSpeed`를 함께 반영해 런 진행 중 이동 체감이 보존된다
- `applyDamage()`, `gainExperience()`, `isDead()`로 전투/진행 상태를 직접 갱신한다

```typescript
import { Player, Position } from './domain/entities/Player';

const player = new Player({ x: 5, y: 3 });
player.moveTo(6, 3);
console.log(player.position); // { x: 6, y: 3 }
```

---

### `domain/entities/Enemy`

적의 위치와 전투 스탯을 보관하는 도메인 엔티티.

- `id`, `label`, `position`, `stats`를 유지한다
- `experienceReward`와 `lastKnownPlayerPosition`을 포함해 보상과 추적 상태를 표현한다
- `applyDamage()`와 `isDead()`로 전투 결과를 반영한다

```typescript
import { Enemy } from './domain/entities/Enemy';

const enemy = new Enemy(
    'enemy-1',
    'Enemy 1',
    { x: 12, y: 8 },
    { health: 100, maxHealth: 100, attack: 10, defense: 5, movementSpeed: 100 },
);
```

---

### `domain/services/VisibilityService`

FOV 계산 결과와 탐험 이력을 관리하는 도메인 서비스.

- 생성 시 맵 크기와 `FieldOfViewCalculator` 구현체를 주입받는다.
- `recalculate(origin, radius)` 호출 시 `VisibilitySnapshot`을 반환한다.
- 탐험한 타일은 시야에서 벗어나도 `explored` 상태로 유지된다.

```typescript
import { VisibilityService } from './domain/services/VisibilityService';
import { RotFovCalculator } from './infra/rot/RotFovCalculator';

const calculator = new RotFovCalculator((x, y) => tiles[y][x] === 0);
const service = new VisibilityService(40, 30, calculator);

// 플레이어 이동 후 호출
const snapshot = service.recalculate({ x: 10, y: 8 }, 8);

// snapshot.tiles[y][x] === 'visible' | 'explored' | 'hidden'
```

**`FieldOfViewCalculator` 인터페이스** (테스트 시 교체 가능):

```typescript
export interface FieldOfViewCalculator {
    computeVisibleTiles(origin: GridPosition, radius: number): GridPosition[];
}
```

---

### `domain/services/FloorProgressionService`

현재 층 번호와 다음 층의 유형(`normal` / `safe`)을 결정하는 순수 도메인 서비스.

- 시작 상태는 항상 `1층 / normal`
- `advance()` 호출 시 층수를 1 증가시키고, 일정 확률(`25%`)로 휴식 층을 선택한다
- 난수 의존성을 `RandomSource` 인터페이스로 분리해 단위 테스트에서 제어할 수 있다

```typescript
import { FloorProgressionService } from './domain/services/FloorProgressionService';

const floors = new FloorProgressionService();

floors.getSnapshot(); // { number: 1, type: 'normal' }
floors.advance(); // { number: 2, type: 'normal' | 'safe' }
```

---

### `domain/services/EnemySpawnerService`

현재 층 정보와 방 목록을 바탕으로 적을 배치하고 층수 기반 스탯을 계산하는 도메인 서비스.

- 시작 방을 제외한 방들에서만 적을 고른다
- `safe` 층에서는 적을 생성하지 않는다
- 적 스탯은 층수에 따라 선형 증가하며, `movementSpeed`는 기준값을 유지한다
- 난수 의존성을 분리해 테스트에서 스폰 위치를 고정할 수 있다

```typescript
import { EnemySpawnerService } from './domain/services/EnemySpawnerService';

const spawner = new EnemySpawnerService();
const enemies = spawner.spawn({
    floorNumber: 3,
    floorType: 'normal',
    tiles,
    rooms,
    blockedPositions: [playerSpawn, stairsPosition],
});
```

---

### `domain/services/RunPersistenceService`

런 상태를 로컬 저장소에 저장하고 복원하는 도메인 서비스.

- 플레이어 스냅샷의 `CombatStats`를 그대로 저장/복원하며, `movementSpeed`가 없던 과거 데이터도 기본값으로 보정한다
- 저장 포맷은 `status`, `floor`, `player`, `inventory`, `deck`, `defeatedEnemyCount`를 유지한다
- 유효하지 않은 스냅샷은 복원하지 않고 `undefined`를 반환한다

```typescript
import { RunPersistenceService } from './domain/services/RunPersistenceService';

const persistence = new RunPersistenceService();
const snapshot = persistence.load();
```

---

### `domain/services/CardCollectionService`

이전 하강에서 확보한 카드 카탈로그를 로컬 저장소에 누적 기록하고 타이틀 카드 모음집에 공급하는 도메인 서비스.

- `CardCatalog` 템플릿을 기준으로 전체 카드 목록과 해금 상태를 스냅샷으로 만든다
- 덱 카드 인스턴스를 `catalogId`로 역추적해 중복 없이 누적 저장한다
- 컬렉션 저장은 활성 런 저장과 분리된 메타 진행 데이터로 취급한다

```typescript
import { CardCollectionService } from './domain/services/CardCollectionService';

const collection = new CardCollectionService();
const snapshot = collection.getSnapshot();
```

---

### `domain/services/EnemyAiService`

적 개체의 시야 판정, 추적, 마지막 목격 위치 기억, 공격 선택을 담당하는 도메인 서비스.

- `FieldOfViewCalculator`와 `PathFinder` 인터페이스를 주입받아 외부 라이브러리 의존을 격리한다
- 플레이어가 보이면 추적하고, 보이지 않으면 마지막 위치까지 수색한다
- 인접 시 이동 대신 `attack` 행동을 반환하고 실제 데미지 처리는 다음 Task로 넘긴다

```typescript
import { EnemyAiService } from './domain/services/EnemyAiService';

const ai = new EnemyAiService(pathFinder, fovCalculator, 8);
const action = ai.decide(enemy, player.position);
```

---

### `domain/services/CombatService`

전투 공식, 크리티컬 판정, 남은 체력 계산을 담당하는 도메인 서비스.

- 시스템 문서의 `damage = max(1, attack - defense)` 공식을 적용한다
- `critRate`, `critMultiplier`를 주입 가능한 난수 소스로 평가한다
- 실제 체력 감소 반영은 엔티티(`Player`, `Enemy`)가 담당하고, 서비스는 계산 결과를 반환한다

```typescript
import { CombatService } from './domain/services/CombatService';

const combat = new CombatService();
const result = combat.resolveAttack(player.stats, enemy.stats);
```

---

### `ui/GameHud`

Phaser 캔버스와 분리된 HTML/CSS HUD 오버레이 컴포넌트.

- 상단 카드에 `Floor`, `Health`, `Experience`, `Turn`, `Enemies`, `State`를 표시한다
- 하단 `Tower Feed` 로그에 최근 6개의 메시지를 유지한다
- 메시지 톤(`combat`, `danger`, `item`, `travel`, `system`)에 따라 시각적 강조를 다르게 적용한다
- `MainScene`이 전달하는 상태 스냅샷과 로그 이벤트만 렌더링하고 게임 규칙은 포함하지 않는다

```typescript
import { GameHud } from './ui/GameHud';

const hud = new GameHud(document.getElementById('hud-root')!);
hud.updateStatus({
    floorNumber: 2,
    floorType: 'Normal',
    health: 34,
    maxHealth: 40,
    experience: 25,
    activeTurn: 'Round 2 · Player',
    enemyCount: 3,
    isGameOver: false,
});
hud.pushLog('Player hits Enemy 1 for 4 damage.', 'combat');
```

---

### `infra/rot/MapGenerator`

rot-js 기반으로 현재 층 유형에 맞는 맵 데이터를 생성하는 인프라 클래스.

```typescript
import { MapGenerator } from './infra/rot/MapGenerator';

const mapData = MapGenerator.generate(40, 30, { floorType: 'normal' });
// mapData.tiles[y][x] === 0 (floor) | 1 (wall) | 2 (stairs) | 3 (rest)
// mapData.playerSpawn / mapData.stairsPosition / mapData.restPoints 제공
```

**생성 규칙**

- `normal` 층: rot-js `Digger`로 일반 던전을 만들고, 시작 방과 가장 먼 방 쪽에 계단을 배치한다
- `safe` 층: 적이 없는 단일 성소 레이아웃을 만들고, 중앙에 휴식 지점(`REST`)과 출구 계단을 둔다

---

### `infra/rot/RotFovCalculator`

`FieldOfViewCalculator` 인터페이스를 rot-js `ROT.FOV.PreciseShadowcasting`으로 구현하는 어댑터.

```typescript
import { RotFovCalculator } from './infra/rot/RotFovCalculator';

const calculator = new RotFovCalculator((x, y) => tiles[y][x] === 0);
const visibleTiles = calculator.computeVisibleTiles({ x: 10, y: 8 }, 8);
// [{ x: 10, y: 8 }, { x: 11, y: 8 }, ...]
```

---

### `infra/rot/RotPathFinder`

`PathFinder` 인터페이스를 rot.js `ROT.Path.AStar`로 구현하는 어댑터.

```typescript
import { RotPathFinder } from './infra/rot/RotPathFinder';

const pathFinder = new RotPathFinder((x, y) => tiles[y][x] === 0);
const path = pathFinder.findPath({ x: 1, y: 1 }, { x: 8, y: 4 });
```

---

### `scenes/synchronizers/MovementDurationPolicy`

스프라이트 이동 애니메이션의 duration을 `movementSpeed`에 맞춰 계산하는 브리지.

- `movementSpeed=100`을 기준으로 `150ms`를 반환한다
- `75ms ~ 300ms` 범위로 clamp하여 극단적인 값이 화면을 깨지 않도록 한다
- visible enemy가 5명 이상일 때는 `100ms` 상한을 추가로 적용해 다수 적 이동 최적화와 합성한다
- `SpriteMovementDurationPolicy`는 sprite-instance와 stat 값을 연결해 `MovementAnimator`가 도메인 스탯을 직접 알 필요가 없도록 한다

```typescript
import {
    getComposedEnemyMovementDurationMs,
    getMovementDurationMs,
} from './scenes/synchronizers/MovementDurationPolicy';

console.log(getMovementDurationMs(100)); // 150
console.log(getComposedEnemyMovementDurationMs(150, 5)); // 100
```

---

### `scenes/MainScene`

게임의 메인 씬. 입력 처리와 렌더링만 담당한다.

**책임**:
1. `FloorProgressionService` 스냅샷에 따라 현재 층 맵을 생성하고 렌더링
2. 키보드 입력 → `Player.moveTo()` 호출
3. `EnemySpawnerService` 결과를 적 스프라이트와 턴 큐 actor로 반영하고, `movementSpeed`를 렌더링 브리지에 바인딩
4. 플레이어가 적 방향으로 이동하면 `CombatService`를 통해 범프 공격을 수행
5. 플레이어 턴 종료 후 각 적에 대해 `EnemyAiService`를 실행해 이동/공격을 처리하고, `movementSpeed` 기반 duration 정책을 적용한다
6. 이동 후 `VisibilityService.recalculate()` 호출
7. 계단 타일 진입 시 다음 층으로 전환하고 턴 큐를 재초기화
8. 스냅샷 기반으로 타일과 적 스프라이트의 표시 상태를 업데이트
9. `GameHud`에 DOM HUD 상태와 메시지 로그를 전달

**책임 아님**: FOV 계산, 탐험 상태 저장, 충돌 규칙 정의, movementSpeed 수치 산정 자체

---

## 렌더링 설정

| 항목 | 값 |
|------|-----|
| 캔버스 크기 | 800 × 600 |
| 타일 크기 | 32 × 32 px |
| 맵 크기 | 40 × 30 타일 (1280 × 960 px) |
| 카메라 줌 | 1.5× |
| FOV 반경 | 8 타일 |

---

## 테스트 전략

| 계층 | 테스트 유형 | 도구 |
|------|------------|------|
| `domain/` | 단위 테스트 | Vitest |
| `infra/` | 통합 테스트 | Vitest (예정) |
| `ui/` | 단위 테스트 | Vitest |
| `scenes/` | E2E 스모크 | Playwright (예정) |

도메인 계층은 외부 의존성 없이 테스트 가능하므로, `FieldOfViewCalculator` 같은 인터페이스를 테스트용 구현체로 교체하여 단위 테스트를 작성한다. HUD처럼 브라우저 DOM이 필요한 UI 계층은 가벼운 가짜 `HTMLElement`로 상태 반영과 로그 누적만 검증한다.
