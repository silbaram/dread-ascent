import type { EnemyArchetypeId } from '../domain/entities/Enemy';
import type {
    EquipmentSlot,
    ItemDefinition,
    ItemRarity,
    ItemType,
} from '../domain/entities/Item';
import type { FloorType } from '../domain/services/FloorProgressionService';
import type { PermanentUpgradeKey } from '../domain/services/MetaProgressionService';

export type SupportedLocale = 'en' | 'ko';
export type MovementDirection = 'west' | 'east' | 'north' | 'south';
type LocaleListener = (locale: SupportedLocale) => void;
type UpgradeStatLabel = 'HP' | 'ATK' | 'DEF';

interface LocaleBundle {
    ui: {
        languageLabel: string;
        brand: string;
        hudTitle: string;
        floorLabel: string;
        healthLabel: string;
        experienceLabel: string;
        turnLabel: string;
        enemiesLabel: string;
        stateLabel: string;
        bossEyebrow: string;
        logEyebrow: string;
        logTitle: string;
        titleEyebrow: string;
        titleHero: string;
        titleCopy: string;
        soulShardsLabel: string;
        continueLabel: string;
        newRunLabel: string;
        sanctuaryLabel: string;
        sanctuaryEyebrow: string;
        sanctuaryBackLabel: string;
        levelLabel: string;
        currentLabel: string;
        nextLabel: string;
        costLabel: string;
        purchaseLabel: (bonus: number) => string;
        runEndedEyebrow: string;
        gameOverTitle: string;
        floorReachedLabel: string;
        enemiesDefeatedLabel: string;
        earnedShardsLabel: string;
        totalShardsLabel: string;
        returnToTitleLabel: string;
        endingEyebrow: string;
        victoryTitle: string;
        victoryCopy: string;
        floorClearedLabel: string;
        bossDefeatedLabel: string;
        inventoryCloseLabel: string;
        inventoryEyebrow: string;
        inventoryTitle: string;
        inventoryEmptyTitle: string;
        inventoryEmptyCopy: string;
        selectedItemEyebrow: string;
        selectedItemEmptyTitle: string;
        selectedItemEmptyCopy: string;
        typeLabel: string;
        quantityLabel: string;
        stackLabel: string;
        statusDetailLabel: string;
        rarityLabel: string;
        actionLabel: string;
        singleSlotLabel: string;
        equippedLabel: string;
        inPackLabel: string;
        noDirectUseLabel: string;
        closeLabel: string;
        useLabel: string;
        equipLabel: string;
        unequipLabel: string;
        dropLabel: string;
        floorSuffix: string;
        slotCapacity: (usedSlots: number, slotCapacity: number) => string;
    };
    floorTypes: Record<FloorType, string>;
    runStates: Record<'playing' | 'game-over' | 'victory', string>;
    directions: Record<MovementDirection, string>;
    enemies: Record<EnemyArchetypeId, string>;
    rarities: Record<ItemRarity, string>;
    itemTypes: Record<ItemType, string>;
    equipmentSlots: Record<EquipmentSlot, string>;
    upgrades: Record<PermanentUpgradeKey, { label: string; statLabel: UpgradeStatLabel; description: string }>;
    items: Record<ItemDefinition['id'], { name: string; description: string }>;
    common: {
        player: string;
        titleScreenTurn: string;
        sanctuaryTurn: string;
        endingTurn: string;
        gameOverTurn: string;
    };
}

export interface LocaleStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const DEFAULT_LOCALE: SupportedLocale = 'en';
const STORAGE_KEY = 'dread-ascent.locale';

const LOCALES: Record<SupportedLocale, LocaleBundle> = {
    en: {
        ui: {
            languageLabel: 'Language',
            brand: 'Dread Ascent',
            hudTitle: 'Field HUD',
            floorLabel: 'Floor',
            healthLabel: 'Health',
            experienceLabel: 'Experience',
            turnLabel: 'Turn',
            enemiesLabel: 'Enemies',
            stateLabel: 'State',
            bossEyebrow: 'Boss Presence',
            logEyebrow: 'Message Log',
            logTitle: 'Tower Feed',
            titleEyebrow: 'Dread Ascent',
            titleHero: 'Title Return',
            titleCopy: 'Gather yourself and descend again when ready.',
            soulShardsLabel: 'Soul Shards',
            continueLabel: 'Continue',
            newRunLabel: 'New Descent',
            sanctuaryLabel: 'Sanctuary',
            sanctuaryEyebrow: 'Meta Shop',
            sanctuaryBackLabel: 'Back',
            levelLabel: 'Level',
            currentLabel: 'Current',
            nextLabel: 'Next',
            costLabel: 'Cost',
            purchaseLabel: (bonus) => `Purchase +${bonus}`,
            runEndedEyebrow: 'Run Ended',
            gameOverTitle: 'Game Over',
            floorReachedLabel: 'Floor Reached',
            enemiesDefeatedLabel: 'Enemies Defeated',
            earnedShardsLabel: 'Earned Shards',
            totalShardsLabel: 'Total Shards',
            returnToTitleLabel: 'Return to Title',
            endingEyebrow: 'Ending',
            victoryTitle: 'The Ascent Breaks',
            victoryCopy: 'The summit falls silent. The final guardian is gone.',
            floorClearedLabel: 'Floor Cleared',
            bossDefeatedLabel: 'Boss Defeated',
            inventoryCloseLabel: 'Close',
            inventoryEyebrow: 'Inventory',
            inventoryTitle: 'Pack Ledger',
            inventoryEmptyTitle: 'Inventory is empty',
            inventoryEmptyCopy: 'Collect treasure on the field to fill your pack.',
            selectedItemEyebrow: 'Selected Item',
            selectedItemEmptyTitle: 'Nothing selected',
            selectedItemEmptyCopy: 'Pick an item slot to inspect it and drop it back onto the floor.',
            typeLabel: 'Type',
            quantityLabel: 'Quantity',
            stackLabel: 'Stack',
            statusDetailLabel: 'Status',
            rarityLabel: 'Rarity',
            actionLabel: 'Action',
            singleSlotLabel: 'Single slot',
            equippedLabel: 'Equipped',
            inPackLabel: 'In Pack',
            noDirectUseLabel: 'No direct use',
            closeLabel: 'Close',
            useLabel: 'Use',
            equipLabel: 'Equip',
            unequipLabel: 'Unequip',
            dropLabel: 'Drop',
            floorSuffix: 'F',
            slotCapacity: (usedSlots, slotCapacity) => `${usedSlots} / ${slotCapacity} slots`,
        },
        floorTypes: {
            normal: 'Normal',
            safe: 'Safe Zone',
            boss: 'Boss Lair',
        },
        runStates: {
            playing: 'PLAYING',
            'game-over': 'GAME OVER',
            victory: 'VICTORY',
        },
        directions: {
            west: 'west',
            east: 'east',
            north: 'north',
            south: 'south',
        },
        enemies: {
            'ash-crawler': 'Ash Crawler',
            'blade-raider': 'Blade Raider',
            'dread-sentinel': 'Dread Sentinel',
            'final-boss': 'Final Boss',
        },
        rarities: {
            COMMON: 'Common',
            RARE: 'Rare',
            LEGENDARY: 'Legendary',
        },
        itemTypes: {
            CONSUMABLE: 'Consumable',
            EQUIPMENT: 'Equipment',
            MATERIAL: 'Material',
            KEY: 'Key Item',
        },
        equipmentSlots: {
            WEAPON: 'Weapon',
            ARMOR: 'Armor',
            TRINKET: 'Trinket',
        },
        upgrades: {
            maxHealth: {
                label: 'Vitality',
                statLabel: 'HP',
                description: 'Raise starting HP by 10.',
            },
            attack: {
                label: 'Ferocity',
                statLabel: 'ATK',
                description: 'Raise starting attack by 2.',
            },
            defense: {
                label: 'Bulwark',
                statLabel: 'DEF',
                description: 'Raise starting defense by 1.',
            },
        },
        items: {
            'small-potion': {
                name: 'Small Potion',
                description: 'A compact tonic that restores a small amount of health.',
            },
            'iron-dagger': {
                name: 'Iron Dagger',
                description: 'A light blade suited for quick strikes.',
            },
            'leather-vest': {
                name: 'Leather Vest',
                description: 'Hardened hide plating that softens incoming blows.',
            },
            'scrap-bundle': {
                name: 'Scrap Bundle',
                description: 'Loose salvaged parts that may support later upgrades.',
            },
            'bronze-sigil': {
                name: 'Bronze Sigil',
                description: 'An engraved seal marked for future locked paths.',
            },
            'moonsteel-saber': {
                name: 'Moonsteel Saber',
                description: 'A rare saber that bites deeper than common iron.',
            },
            'warden-plate': {
                name: 'Warden Plate',
                description: 'Heavy armor recovered from tower wardens.',
            },
            'sunfire-idol': {
                name: 'Sunfire Idol',
                description: 'A legendary idol that fortifies body and spirit.',
            },
        },
        common: {
            player: 'Player',
            titleScreenTurn: 'Title Screen',
            sanctuaryTurn: 'Sanctuary',
            endingTurn: 'Ending',
            gameOverTurn: 'Game Over',
        },
    },
    ko: {
        ui: {
            languageLabel: '언어',
            brand: '드레드 어센트',
            hudTitle: '전장 HUD',
            floorLabel: '층',
            healthLabel: '체력',
            experienceLabel: '경험치',
            turnLabel: '턴',
            enemiesLabel: '적',
            stateLabel: '상태',
            bossEyebrow: '보스 기척',
            logEyebrow: '메시지 로그',
            logTitle: '현장 기록',
            titleEyebrow: '드레드 어센트',
            titleHero: '타이틀 복귀',
            titleCopy: '준비가 되면 다시 몸을 추스르고 하강하세요.',
            soulShardsLabel: '영혼 파편',
            continueLabel: '이어하기',
            newRunLabel: '새 탐험',
            sanctuaryLabel: '성소',
            sanctuaryEyebrow: '메타 상점',
            sanctuaryBackLabel: '뒤로',
            levelLabel: '레벨',
            currentLabel: '현재',
            nextLabel: '다음',
            costLabel: '비용',
            purchaseLabel: (bonus) => `구매 +${bonus}`,
            runEndedEyebrow: '탐험 종료',
            gameOverTitle: '게임 오버',
            floorReachedLabel: '도달 층수',
            enemiesDefeatedLabel: '처치한 적',
            earnedShardsLabel: '획득 파편',
            totalShardsLabel: '누적 파편',
            returnToTitleLabel: '타이틀로',
            endingEyebrow: '엔딩',
            victoryTitle: '정상이 무너진다',
            victoryCopy: '정상은 침묵에 잠겼고 마지막 수호자는 사라졌습니다.',
            floorClearedLabel: '정복 층수',
            bossDefeatedLabel: '처치한 보스',
            inventoryCloseLabel: '닫기',
            inventoryEyebrow: '인벤토리',
            inventoryTitle: '소지 현황',
            inventoryEmptyTitle: '인벤토리가 비어 있습니다',
            inventoryEmptyCopy: '필드에서 보물을 모아 가방을 채우세요.',
            selectedItemEyebrow: '선택한 아이템',
            selectedItemEmptyTitle: '선택된 아이템 없음',
            selectedItemEmptyCopy: '슬롯을 선택하면 정보와 버리기 가능 여부를 확인할 수 있습니다.',
            typeLabel: '종류',
            quantityLabel: '수량',
            stackLabel: '스택',
            statusDetailLabel: '상태',
            rarityLabel: '희귀도',
            actionLabel: '행동',
            singleSlotLabel: '단일 슬롯',
            equippedLabel: '장착 중',
            inPackLabel: '소지 중',
            noDirectUseLabel: '직접 사용 불가',
            closeLabel: '닫기',
            useLabel: '사용',
            equipLabel: '장착',
            unequipLabel: '해제',
            dropLabel: '버리기',
            floorSuffix: '층',
            slotCapacity: (usedSlots, slotCapacity) => `${usedSlots} / ${slotCapacity}칸`,
        },
        floorTypes: {
            normal: '일반',
            safe: '안전 지대',
            boss: '보스 둥지',
        },
        runStates: {
            playing: '진행 중',
            'game-over': '게임 오버',
            victory: '승리',
        },
        directions: {
            west: '서쪽',
            east: '동쪽',
            north: '북쪽',
            south: '남쪽',
        },
        enemies: {
            'ash-crawler': '잿더미 크롤러',
            'blade-raider': '블레이드 레이더',
            'dread-sentinel': '드레드 센티널',
            'final-boss': '최종 보스',
        },
        rarities: {
            COMMON: '일반',
            RARE: '희귀',
            LEGENDARY: '전설',
        },
        itemTypes: {
            CONSUMABLE: '소모품',
            EQUIPMENT: '장비',
            MATERIAL: '재료',
            KEY: '열쇠 아이템',
        },
        equipmentSlots: {
            WEAPON: '무기',
            ARMOR: '방어구',
            TRINKET: '장신구',
        },
        upgrades: {
            maxHealth: {
                label: '생명력',
                statLabel: 'HP',
                description: '시작 HP를 10 올립니다.',
            },
            attack: {
                label: '맹공',
                statLabel: 'ATK',
                description: '시작 공격력을 2 올립니다.',
            },
            defense: {
                label: '철벽',
                statLabel: 'DEF',
                description: '시작 방어력을 1 올립니다.',
            },
        },
        items: {
            'small-potion': {
                name: '작은 포션',
                description: '적은 양의 체력을 회복하는 소형 비약입니다.',
            },
            'iron-dagger': {
                name: '철 단검',
                description: '빠른 찌르기에 적합한 가벼운 칼날입니다.',
            },
            'leather-vest': {
                name: '가죽 조끼',
                description: '받는 충격을 덜어 주는 단단한 가죽 장비입니다.',
            },
            'scrap-bundle': {
                name: '고철 묶음',
                description: '훗날 강화에 쓰일 수도 있는 수집 부품입니다.',
            },
            'bronze-sigil': {
                name: '청동 인장',
                description: '앞으로 열릴 잠긴 길을 암시하는 각인된 봉인입니다.',
            },
            'moonsteel-saber': {
                name: '문스틸 세이버',
                description: '평범한 철보다 더 깊게 베어내는 희귀 세이버입니다.',
            },
            'warden-plate': {
                name: '감시자의 중갑',
                description: '탑의 감시자에게서 회수한 무거운 갑옷입니다.',
            },
            'sunfire-idol': {
                name: '선파이어 우상',
                description: '몸과 정신을 함께 강화하는 전설의 우상입니다.',
            },
        },
        common: {
            player: '플레이어',
            titleScreenTurn: '타이틀 화면',
            sanctuaryTurn: '성소',
            endingTurn: '엔딩',
            gameOverTurn: '게임 오버',
        },
    },
};

export class GameLocalization {
    private readonly listeners = new Set<LocaleListener>();
    private locale: SupportedLocale;

    constructor(
        private readonly storage: LocaleStorage | undefined = globalThis.localStorage,
        private readonly storageKey = STORAGE_KEY,
    ) {
        this.locale = this.readLocale();
        this.applyDocumentLanguage();
    }

    getLocale() {
        return this.locale;
    }

    getBundle() {
        return LOCALES[this.locale];
    }

    getSupportedLocales(): SupportedLocale[] {
        return ['en', 'ko'];
    }

    setLocale(locale: SupportedLocale) {
        if (locale === this.locale) {
            return;
        }

        this.locale = locale;
        this.storage?.setItem(this.storageKey, locale);
        this.applyDocumentLanguage();
        for (const listener of this.listeners) {
            listener(locale);
        }
    }

    subscribe(listener: LocaleListener) {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    formatFloorValue(floorNumber: number, floorTypeLabel: string) {
        const suffix = this.getBundle().ui.floorSuffix;
        return `${floorNumber}${suffix} · ${floorTypeLabel}`;
    }

    formatFloorNumber(floorNumber: number) {
        return `${floorNumber}${this.getBundle().ui.floorSuffix}`;
    }

    formatExperience(experience: number) {
        return this.locale === 'ko' ? `${experience} EXP` : `${experience} EXP`;
    }

    formatRunState(runState: 'playing' | 'game-over' | 'victory') {
        return this.getBundle().runStates[runState];
    }

    getFloorTypeLabel(type: FloorType) {
        return this.getBundle().floorTypes[type];
    }

    getMovementDirection(direction: MovementDirection) {
        return this.getBundle().directions[direction];
    }

    getPlayerLabel() {
        return this.getBundle().common.player;
    }

    getInventoryTurnLabel(actorLabel: string) {
        return this.locale === 'ko'
            ? `인벤토리 · ${actorLabel}`
            : `Inventory · ${actorLabel}`;
    }

    getRoundTurnLabel(round: number, actorLabel: string) {
        return this.locale === 'ko'
            ? `라운드 ${round} · ${actorLabel}`
            : `Round ${round} · ${actorLabel}`;
    }

    getTitleScreenTurnLabel() {
        return this.getBundle().common.titleScreenTurn;
    }

    getSanctuaryTurnLabel() {
        return this.getBundle().common.sanctuaryTurn;
    }

    getEndingTurnLabel() {
        return this.getBundle().common.endingTurn;
    }

    getGameOverTurnLabel() {
        return this.getBundle().common.gameOverTurn;
    }

    getEnemyName(archetypeId: EnemyArchetypeId, elite = false) {
        const name = this.getBundle().enemies[archetypeId];
        if (!elite) {
            return name;
        }

        return this.locale === 'ko'
            ? `정예 ${name}`
            : `Elite ${name}`;
    }

    getItemName(itemId: ItemDefinition['id'], fallback: string) {
        return this.getBundle().items[itemId]?.name ?? fallback;
    }

    getItemDescription(itemId: ItemDefinition['id'], fallback: string) {
        return this.getBundle().items[itemId]?.description ?? fallback;
    }

    getRarityLabel(rarity: ItemRarity) {
        return this.getBundle().rarities[rarity];
    }

    getItemTypeLabel(type: ItemType) {
        return this.getBundle().itemTypes[type];
    }

    getEquipmentSlotLabel(slot: EquipmentSlot) {
        return this.getBundle().equipmentSlots[slot];
    }

    getUpgradeText(key: PermanentUpgradeKey) {
        return this.getBundle().upgrades[key];
    }

    formatPlayerClimbsStairs() {
        return this.locale === 'ko'
            ? '플레이어가 계단을 올라갑니다.'
            : 'Player climbs the stairs.';
    }

    formatPlayerStepsIntoSanctuary() {
        return this.locale === 'ko'
            ? '플레이어가 성소에 들어섭니다.'
            : 'Player steps into the sanctuary.';
    }

    formatPlayerMoved(direction: MovementDirection) {
        return this.locale === 'ko'
            ? `플레이어가 ${this.getMovementDirection(direction)}으로 이동했습니다.`
            : `Player moved ${this.getMovementDirection(direction)}.`;
    }

    formatEnteredFloor(floorNumber: number, type: FloorType) {
        return this.locale === 'ko'
            ? `${this.formatFloorNumber(floorNumber)}(${this.getFloorTypeLabel(type)})에 진입했습니다.`
            : `Entered floor ${floorNumber} (${this.getFloorTypeLabel(type)}).`;
    }

    formatResumedFloor(floorNumber: number, type: FloorType) {
        return this.locale === 'ko'
            ? `${this.formatFloorNumber(floorNumber)}(${this.getFloorTypeLabel(type)})에서 이어합니다.`
            : `Resumed on floor ${floorNumber} (${this.getFloorTypeLabel(type)}).`;
    }

    formatSanctuaryAwaits() {
        return this.locale === 'ko'
            ? '이 층에는 고요한 성소가 기다리고 있습니다.'
            : 'A quiet sanctuary awaits on this floor.';
    }

    formatBossFloorWarning(bossName: string) {
        return this.locale === 'ko'
            ? `정상이 봉인되었습니다. ${bossName}만 남았습니다.`
            : 'The summit seals itself. Only the Final Boss remains.';
    }

    formatRoundActorTurn(round: number, actorLabel: string) {
        return this.locale === 'ko'
            ? `라운드 ${round}: ${actorLabel} 턴.`
            : `Round ${round}: ${actorLabel} turn.`;
    }

    formatInventoryFull(itemName: string, usedSlots: number, slotCapacity: number) {
        return this.locale === 'ko'
            ? `${itemName}을 더 들 수 없습니다. (${usedSlots}/${slotCapacity}칸 가득 참)`
            : `Cannot carry ${itemName} (${usedSlots}/${slotCapacity} slots full).`;
    }

    formatFloorBanner(floorNumber: number, type: FloorType) {
        return this.formatFloorValue(floorNumber, this.getFloorTypeLabel(type));
    }

    formatBossApproaches(bossName: string) {
        return this.locale === 'ko'
            ? `${bossName} 접근`
            : `${bossName} Approaches`;
    }

    formatActorMissing(actorLabel: string) {
        return this.locale === 'ko'
            ? `${actorLabel}이 더 이상 존재하지 않습니다.`
            : `${actorLabel} is no longer present.`;
    }

    formatEnemyAdvances(enemyName: string) {
        return this.locale === 'ko'
            ? `${enemyName}이 플레이어를 향해 전진합니다.`
            : `${enemyName} advances toward the player.`;
    }

    formatEnemySearches(enemyName: string) {
        return this.locale === 'ko'
            ? `${enemyName}이 마지막 위치를 수색합니다.`
            : `${enemyName} searches the last known position.`;
    }

    formatEnemyWait(enemyName: string, reason: 'idle' | 'searching' | 'blocked') {
        if (this.locale === 'ko') {
            switch (reason) {
                case 'searching':
                    return `${enemyName}이 마지막으로 본 위치에서 대기합니다.`;
                case 'blocked':
                    return `${enemyName}이 길을 찾지 못하고 대기합니다.`;
                case 'idle':
                default:
                    return `${enemyName}이 대기합니다.`;
            }
        }

        switch (reason) {
            case 'searching':
                return `${enemyName} waits at the last known position.`;
            case 'blocked':
                return `${enemyName} cannot find a path and waits.`;
            case 'idle':
            default:
                return `${enemyName} waits.`;
        }
    }

    formatAttack(attacker: string, target: string, damage: number, isCritical: boolean) {
        if (this.locale === 'ko') {
            return `${attacker} -> ${target}, ${isCritical ? '치명타 ' : ''}${damage} 피해.`;
        }

        const criticalLabel = isCritical ? ' critical' : '';
        return `${attacker} hits ${target} for ${damage}${criticalLabel} damage.`;
    }

    formatEnemyDeath(enemyName: string) {
        return this.locale === 'ko'
            ? `${enemyName} 처치.`
            : `${enemyName} dies.`;
    }

    formatExperienceGain(experienceReward: number, totalExperience: number) {
        return this.locale === 'ko'
            ? `플레이어가 EXP ${experienceReward} 획득 (${totalExperience} 누적).`
            : `Player gains ${experienceReward} EXP (${totalExperience} total).`;
    }

    formatPlayerDeath() {
        return this.locale === 'ko'
            ? '플레이어가 쓰러졌습니다. 전투 종료.'
            : 'Player dies. Combat ends.';
    }

    formatSoulShardReward(earnedSoulShards: number, totalSoulShards: number) {
        return this.locale === 'ko'
            ? `영혼 파편 +${earnedSoulShards} (${totalSoulShards} 누적).`
            : `Soul Shards +${earnedSoulShards} (${totalSoulShards} total).`;
    }

    formatVictory(bossName: string) {
        return this.locale === 'ko'
            ? `${bossName}이 쓰러졌습니다. 정상은 당신의 것입니다.`
            : `${bossName} falls. The summit is yours.`;
    }

    formatEliteRewardLost(enemyName: string) {
        return this.locale === 'ko'
            ? `${enemyName}이 지닌 유물이 충돌 속에 사라졌습니다.`
            : `${enemyName} carried a relic, but it is lost in the clash.`;
    }

    formatEnemyDrops(enemyName: string, itemName: string, rarity: ItemRarity) {
        const rarityLabel = this.getRarityLabel(rarity);
        return this.locale === 'ko'
            ? `${enemyName}이 ${itemName} [${rarityLabel}]을 떨어뜨렸습니다.`
            : `${enemyName} drops ${itemName} [${rarityLabel}].`;
    }

    formatPickup(icon: string, itemName: string, quantity: number) {
        const quantityLabel = quantity > 1 ? ` x${quantity}` : '';
        return this.locale === 'ko'
            ? `${icon} ${itemName}${quantityLabel} 획득.`
            : `Get ${icon} ${itemName}${quantityLabel}.`;
    }

    formatDrop(icon: string, itemName: string) {
        return this.locale === 'ko'
            ? `${icon} ${itemName} 버리기.`
            : `Drop ${icon} ${itemName}.`;
    }

    formatUse(icon: string, itemName: string, healedAmount: number) {
        if (this.locale === 'ko') {
            return healedAmount > 0
                ? `플레이어가 ${icon} ${itemName}을 사용해 HP ${healedAmount} 회복.`
                : `플레이어가 ${icon} ${itemName}을 사용했지만 HP는 회복되지 않았습니다.`;
        }

        return healedAmount > 0
            ? `Player uses ${icon} ${itemName} and recovers ${healedAmount} HP.`
            : `Player uses ${icon} ${itemName}, but no HP is restored.`;
    }

    formatEquip(icon: string, itemName: string, state: 'equip' | 'unequip', summary: string) {
        if (this.locale === 'ko') {
            const action = state === 'equip' ? '장착' : '해제';
            return summary
                ? `플레이어가 ${icon} ${itemName} ${action} (${summary}).`
                : `플레이어가 ${icon} ${itemName} ${action}.`;
        }

        const prefix = state === 'equip' ? 'Player equips' : 'Player unequips';
        return summary
            ? `${prefix} ${icon} ${itemName} (${summary}).`
            : `${prefix} ${icon} ${itemName}.`;
    }

    formatItemNotUsable(itemName: string) {
        return this.locale === 'ko'
            ? `${itemName}은 지금 사용할 수 없습니다.`
            : `${itemName} cannot be used right now.`;
    }

    formatUnequipBeforeDrop() {
        return this.locale === 'ko'
            ? '장착한 아이템은 먼저 해제해야 버릴 수 있습니다.'
            : 'Unequip an item before dropping it.';
    }

    formatOccupiedDrop() {
        return this.locale === 'ko'
            ? '다른 개체가 있는 칸에는 아이템을 버릴 수 없습니다.'
            : 'Cannot drop an item onto an occupied tile.';
    }

    formatSanctuaryHelp() {
        return this.locale === 'ko'
            ? '영혼 파편으로 다음 하강을 강화하세요.'
            : 'Spend Soul Shards to strengthen your next descent.';
    }

    formatUpgradeAdvanced(upgradeKey: PermanentUpgradeKey, level: number) {
        const label = this.getUpgradeText(upgradeKey).label;
        return this.locale === 'ko'
            ? `${label}이 Lv.${level}이 되었습니다.`
            : `${label} advanced to Lv.${level}.`;
    }

    formatUpgradeNeedMore(upgradeKey: PermanentUpgradeKey, missingSoulShards: number) {
        const label = this.getUpgradeText(upgradeKey).label;
        return this.locale === 'ko'
            ? `${label} 업그레이드에 영혼 파편 ${missingSoulShards}개가 더 필요합니다.`
            : `Need ${missingSoulShards} more Soul Shards for ${label}.`;
    }

    private readLocale(): SupportedLocale {
        const storedValue = this.storage?.getItem(this.storageKey);
        return storedValue === 'ko' || storedValue === 'en'
            ? storedValue
            : DEFAULT_LOCALE;
    }

    private applyDocumentLanguage() {
        globalThis.document?.documentElement?.setAttribute('lang', this.locale);
    }
}
