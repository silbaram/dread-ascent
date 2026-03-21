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

### `CardBattleService`
카드 배틀의 시작, 핸드 드로우 및 적의 카드 풀을 관리합니다.
- **`drawHand(deck: readonly Card[], handSize: number = HAND_SIZE): DrawResult`**
  - 주어진 덱에서 지정된 손패 개수만큼 무작위 카드를 중복 없이 뽑아 손패를 구성합니다. 덱이 소진되지 않으며, 매 라운드 전체 덱에서 다시 뽑습니다.
- **`generateEnemyCardPool(kind: EnemyKind, isElite: boolean): readonly Card[]`**
  - 적의 종류(normal, elite, boss)에 따라 공격/수비 카드 템플릿과 파워가 설정된 고유 카드 풀을 생성합니다.
- **`selectEnemyCard(enemyCardPool: readonly Card[]): Card`**
  - 생성된 적의 카드 풀에서 무작위 1장의 카드를 선택해 반환합니다.

### `CardBattleLoopService`
멀티 라운드로 진행되는 카드 배틀의 상태와 흐름을 관리합니다.
- **`runFullBattle(params: BattleLoopParams): BattleLoopResult`**
  - 전체 배틀을 자동으로 실행하고 최종 결과(승패, 라운드 기록)를 반환합니다.
- **`drawPhase(state: BattleLoopState, deck: readonly Card[]): BattleLoopState`**
  - 드로우 페이즈를 수행하여 플레이어의 손패를 3장 구성합니다.
- **`resolveRound(state: BattleLoopState, playerCard: Card): BattleLoopState`**
  - 플레이어가 선택한 카드와 적의 카드를 비교하여 데미지를 계산하고 체력을 갱신합니다.
- **`isBattleOver(state: BattleLoopState): boolean`**
  - 어느 한 쪽의 체력이 0 이하가 되어 배틀이 종료되었는지 확인합니다.

### `CardBattleResolver`
양측이 낸 카드의 상성 판정 및 데미지 계산을 담당하는 순수 함수입니다.
- **`resolveCardClash(playerCard: Card, enemyCard: Card): CardClashResult`**
  - 두 카드의 상성을 비교합니다:
    - **공격 vs 수비**: (공격 파워 - 수비 파워) 만큼 방어 측이 데미지를 받습니다 (최소 0). 공격 측은 피해를 받지 않습니다.
    - **공격 vs 공격**: 양측 모두 상대방의 공격 파워만큼 피해를 받습니다.
    - **수비 vs 수비**: 양쪽 모두 피해 없이 라운드가 종료됩니다.

### `EquipmentCardBonusService`
장비 아이템의 스탯을 카드 파워 보너스로 변환합니다.
- **`getEquipmentCardBonus(inventory: readonly InventoryItem[]): EquipmentCardBonus`**
  - 현재 장착 중인 무기(공격 보너스)와 방어구(수비 보너스)로부터 카드 파워 가산치를 추출합니다.
- **`applyEquipmentBonusToHand(hand: readonly Card[], bonus: EquipmentCardBonus): readonly Card[]`**
  - 드로우된 손패의 각 카드에 장비 보너스를 적용하여 최종 파워를 계산합니다.

### `CardDropService`
적 처치 시 카드 드롭 확률 판정 및 덱 추가, 교체 로직을 담당합니다.
- **`rollCardDrop(enemyKind: EnemyKind, isElite: boolean, floorNumber: number, deckService: DeckService): CardDropResult`**
  - 적의 종류와 엘리트 여부에 따라 카드 드롭 확률(30% ~ 100%)을 판정합니다.
  - 드롭 성공 시 현재 층 번호에 비례하여 파워가 스케일링된 무작위 카드를 생성합니다.
- **`swapCard(removeCardId: string, newCard: Card, deckService: DeckService): CardSwapResult`**
  - 덱이 가득 찼을 때 기존 카드 한 장을 제거하고 드롭된 새 카드로 교체합니다.

### `DeckService`
플레이어의 카드 덱의 초기화, 추가/제거 및 상태 관리를 담당합니다.
- **`initializeStarterDeck(): DeckSnapshot`**
  - 런 시작 시 플레이어에게 `ATTACK` 카드 3장과 `GUARD` 카드 2장이 포함된 기본 덱(Starter Deck)을 초기화하여 제공합니다.
- **`addCard(card: Card): boolean`** / **`removeCard(cardId: string): boolean`**
  - 덱 상한(최대 20장) 범위 내에서 카드를 덱에 추가하거나 제거합니다.
- **`getSnapshot(): DeckSnapshot`**
  - 현재 덱에 포함된 카드들, 크기 및 가득 찼는지에 대한 상태를 제공합니다.
- **`restoreDeck(cards: readonly Card[]): void`**
  - 저장된 데이터로부터 플레이어의 덱 상태를 복구합니다.

---

## 6. UI & Scene Management

### `BattleScene` (Phaser Scene)
카드 배틀의 시각적 구현과 사용자 입력을 담당합니다.
- **`init(data: BattleSceneData)`**: 플레이어, 적 정보 및 서비스를 전달받아 배틀을 초기화합니다.
- **`setOnBattleEnd(callback: (result: BattleSceneResult) => void)`**: 배틀 종료 시 메인 화면으로 돌아가기 위한 콜백을 등록합니다.
- **기능**:
  - 무작위 3장 드로우 및 카드 애니메이션.
  - 카드 선택 인터랙션 (Hover/Click).
  - 적의 선택 카드 공개 및 상성 판정 시각화.
  - 체력 바 실시간 업데이트 및 승리/패배 연출.
