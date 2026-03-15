# API Reference

Dread Ascent의 주요 도메인 서비스와 데이터 인터페이스를 정의합니다. 모든 서비스는 순수 TypeScript로 작성되었으며 Phaser와 같은 외부 엔진에 의존하지 않습니다.

## 1. Item System

### `ItemService`
아이템의 생성, 습득, 사용 및 인벤토리 관리를 담당합니다.

- **`initializeFloor(request: ItemSpawnRequest): ItemEntity[]`**
  - 새로운 층이 생성될 때 아이템을 배치합니다. 층 번호에 따라 아이템 등급(Rarity)이 결정될 수 있습니다.
- **`pickupAt(position: Position): ItemPickupResult | undefined`**
  - 특정 좌표의 아이템을 인벤토리에 추가합니다.
- **`activateItem(instanceId: string): ItemActivationResult | undefined`**
  - 소모품 사용 또는 장비 장착/해제를 수행합니다.
- **`dropItem(instanceId: string, position: Position): ItemDropResult | undefined`**
  - 인벤토리의 아이템을 필드에 내려놓습니다.

### `ItemRarity` (Enum)
아이템의 희귀도 등급을 정의합니다.
- `COMMON`: 기본 등급 (스탯 배율 1.0x)
- `RARE`: 희귀 등급 (스탯 배율 1.25x)
- `LEGENDARY`: 전설 등급 (스탯 배율 1.6x)

---

## 2. Enemy System

### `EnemySpawnerService`
층의 난이도와 유형에 맞춰 적 유닛을 생성합니다.

- **`spawn(request: EnemySpawnRequest): Enemy[]`**
  - 층 번호, 유형(Normal/Safe/Boss), 방 정보에 따라 적들을 배치합니다.
  - 아키타입(Archetype) 시스템을 통해 층별로 다른 적이 등장합니다.
  - 일정 확률(`ELITE_CHANCE`)로 엘리트 몬스터가 생성됩니다.
- **`EnemyArchetype`**: `ash-crawler` (1-45F), `blade-raider` (20-80F), `dread-sentinel` (50-99F).
- **`Elite/Boss 스케일링`**:
    - **Elite**: 체력 1.5x, 공격/방어 보너스, 경험치 2x.
    - **Boss**: 체력 2x, 강력한 공격/방어 보너스, 경험치 4x.

---

## 3. Floor Progression

### `FloorProgressionService`
던전의 진행 상태와 난이도 스케일링을 관리합니다.

- **`advance(): FloorSnapshot`**: 다음 층으로 이동합니다. 100층 도달 시 자동으로 `boss` 유형으로 전환됩니다.
- **`restore(snapshot: FloorSnapshot)`**: 저장된 상태로부터 층 정보를 복구합니다.
- **`BOSS_FLOOR_NUMBER`: 100** (최종 보스가 등장하는 층).

---

## 4. Run Persistence

### `RunPersistenceService`
현재 게임 진행 상태(Run)를 브라우저의 `localStorage`에 영구 저장합니다.

- **`save(snapshot: RunPersistenceSnapshot)`**: 현재 층, 플레이어 스탯, 인벤토리, 처치 수 등을 저장합니다.
- **`load(): RunPersistenceSnapshot | undefined`**: 저장된 데이터를 불러옵니다.
- **`hasActiveRun(): boolean`**: 이어하기 가능한 활성화된 게임 세션이 있는지 확인합니다.

---

## 5. Combat System

### `CombatService`
전투 수식과 피해 계산을 처리합니다.

- **`resolveAttack(attacker: CombatStats, target: CombatStats): CombatResolution`**
  - 공격자와 방어자의 스탯을 비교하여 피해량을 계산합니다.
  - 공격력 - 방어력(최소 1) 공식을 기본으로 사용합니다.

---

## 6. UI & Feedback

### `GameHud`
게임의 상태 정보와 로그 피드백을 사용자에게 시각적으로 전달합니다.

- **`pushLog(message: string, tone: HudLogTone)`**: 전투, 아이템 획득, 이동 등 상황에 맞는 색상(Tone)과 함께 로그를 추가합니다.
- **`queueEventBanner(message: string, durationMs: number)`**: 화면 중앙에 일시적으로 중요한 알림 배너를 띄웁니다.
- **`updateBoss(snapshot: BossHudSnapshot)`**: 보스전 진입 시 보스의 이름과 체력 바를 활성화합니다.
- **`updateVictory(snapshot: VictoryOverlaySnapshot)`**: 100층 보스 처치 시 승리 화면을 표시합니다.
