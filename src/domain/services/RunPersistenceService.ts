import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    type Card,
    type CardArchetype,
    type CardCondition,
    type CardType,
} from '../entities/Card';
import {
    DEFAULT_MOVEMENT_SPEED,
    cloneCombatStats,
    type CombatStatModifier,
    type CombatStats,
} from '../entities/CombatStats';
import { STATUS_EFFECT_TYPE } from './StatusEffectService';
import {
    ITEM_CATALOG,
    EQUIPMENT_SLOT,
    ITEM_RARITY,
    ITEM_SPAWN_SOURCE,
    ITEM_TYPE,
    type ItemId,
    cloneConsumableEffect,
    cloneEquipmentDefinition,
    cloneInventoryItem as cloneStoredInventoryItem,
    isPrimaryEquipmentSlot,
    type InventoryItem,
    type ItemRarity,
    type ItemType,
} from '../entities/Item';
import type { EnemyArchetypeId } from '../entities/Enemy';
import type { FloorSnapshot, FloorType } from './FloorProgressionService';
import type { StorageLike } from './SoulShardService';

export type PersistedRunStatus = 'active' | 'game-over' | 'victory';

export interface PersistedPlayerSnapshot {
    stats: CombatStats;
    experience: number;
}

export interface PersistedSpecialRewardOffer {
    sourceType: 'cache' | 'boss';
    keyItemId?: ItemId;
    bossArchetypeId?: EnemyArchetypeId;
    offeredItemIds: ItemId[];
}

export interface RunPersistenceSnapshot {
    status: PersistedRunStatus;
    floor: FloorSnapshot;
    player: PersistedPlayerSnapshot;
    inventory: InventoryItem[];
    deck: Card[];
    defeatedEnemyCount: number;
    pendingBattleStartEnergy?: number;
    pendingSpecialRewardOffer?: PersistedSpecialRewardOffer;
}

export const RUN_PERSISTENCE_STORAGE_KEY = 'dread-ascent.run-state';

interface NormalizedInventoryResult {
    items: InventoryItem[];
    removedLegacyEquippedStatModifier: CombatStatModifier;
}

interface NormalizedInventoryItemResult {
    item: InventoryItem;
    removedLegacyEquippedStatModifier?: CombatStatModifier;
}

const CARD_CONDITION_TYPES = [
    'HP_THRESHOLD',
    'HP_PERCENT_THRESHOLD',
    'MISSING_HEALTH_DAMAGE',
    'TURN_DAMAGE_TAKEN_AT_LEAST',
] as const satisfies readonly CardCondition['type'][];

const CARD_SCALING_SOURCES = [
    'MISSING_HEALTH',
    'USER_BLOCK',
    'TARGET_DEBUFF_COUNT',
    'TURN_DAMAGE_TAKEN',
] as const;

const CARD_BUFF_TYPES = [
    STATUS_EFFECT_TYPE.VULNERABLE,
    STATUS_EFFECT_TYPE.WEAK,
    STATUS_EFFECT_TYPE.POISON,
    STATUS_EFFECT_TYPE.STRENGTH,
    STATUS_EFFECT_TYPE.THORNS,
    STATUS_EFFECT_TYPE.REGENERATION,
    STATUS_EFFECT_TYPE.FRAIL,
    'BLOCK_PERSIST',
    'ENEMY_ATTACK_DOWN',
    'STRENGTH_ON_SELF_DAMAGE',
    'POISON_MULTIPLIER',
    'APPLY_POISON_PER_TURN',
] as const;

export class RunPersistenceService {
    private hasCachedLoad = false;
    private cachedRawValue?: string | null;
    private cachedSnapshot?: RunPersistenceSnapshot;

    constructor(
        private readonly storage: StorageLike | undefined = globalThis.localStorage,
        private readonly storageKey = RUN_PERSISTENCE_STORAGE_KEY,
    ) {}

    save(snapshot: RunPersistenceSnapshot) {
        const normalizedSnapshot = this.cloneSnapshot(snapshot);
        const serializedSnapshot = JSON.stringify(normalizedSnapshot);
        this.storage?.setItem(this.storageKey, serializedSnapshot);
        this.hasCachedLoad = true;
        this.cachedRawValue = serializedSnapshot;
        this.cachedSnapshot = normalizedSnapshot;
    }

    load() {
        if (!this.storage) {
            return undefined;
        }

        const rawValue = this.storage.getItem(this.storageKey);
        if (this.hasCachedLoad && rawValue === this.cachedRawValue) {
            return this.cachedSnapshot
                ? this.cloneSnapshot(this.cachedSnapshot)
                : undefined;
        }

        this.hasCachedLoad = true;
        this.cachedRawValue = rawValue;
        if (!rawValue) {
            this.cachedSnapshot = undefined;
            return undefined;
        }

        try {
            const snapshot = this.normalizeSnapshot(JSON.parse(rawValue));
            this.cachedSnapshot = snapshot ? this.cloneSnapshot(snapshot) : undefined;
            return snapshot;
        } catch {
            this.cachedSnapshot = undefined;
            return undefined;
        }
    }

    hasActiveRun() {
        return this.load()?.status === 'active';
    }

    private cloneSnapshot(snapshot: RunPersistenceSnapshot): RunPersistenceSnapshot {
        return {
            status: snapshot.status,
            floor: { ...snapshot.floor },
            player: {
                stats: cloneCombatStats(snapshot.player.stats),
                experience: snapshot.player.experience,
            },
            inventory: snapshot.inventory.map((item) => this.cloneInventoryItem(item)),
            deck: snapshot.deck.map((card) => this.cloneCard(card)),
            defeatedEnemyCount: snapshot.defeatedEnemyCount,
            pendingBattleStartEnergy: snapshot.pendingBattleStartEnergy ?? 0,
            pendingSpecialRewardOffer: snapshot.pendingSpecialRewardOffer
                ? {
                    sourceType: snapshot.pendingSpecialRewardOffer.sourceType,
                    keyItemId: snapshot.pendingSpecialRewardOffer.keyItemId,
                    bossArchetypeId: snapshot.pendingSpecialRewardOffer.bossArchetypeId,
                    offeredItemIds: [...snapshot.pendingSpecialRewardOffer.offeredItemIds],
                }
                : undefined,
        };
    }

    private normalizeSnapshot(value: unknown): RunPersistenceSnapshot | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        const snapshot = value as Partial<RunPersistenceSnapshot>;
        const floor = this.normalizeFloor(snapshot.floor);
        const player = this.normalizePlayer(snapshot.player);
        const inventory = this.normalizeInventory(snapshot.inventory);
        const deck = this.normalizeDeck((snapshot as { deck?: unknown }).deck);
        if (!floor || !player || !inventory || !deck) {
            return undefined;
        }

        const status = this.normalizeStatus(snapshot.status);
        if (!status) {
            return undefined;
        }

        return {
            status,
            floor,
            player: {
                ...player,
                stats: this.removeStatModifier(
                    player.stats,
                    inventory.removedLegacyEquippedStatModifier,
                ),
            },
            inventory: inventory.items,
            deck,
            defeatedEnemyCount: this.normalizeCount(snapshot.defeatedEnemyCount),
            pendingBattleStartEnergy: this.normalizeCount(
                (snapshot as { pendingBattleStartEnergy?: unknown }).pendingBattleStartEnergy,
            ),
            pendingSpecialRewardOffer: this.normalizePendingSpecialRewardOffer(
                (snapshot as { pendingSpecialRewardOffer?: unknown }).pendingSpecialRewardOffer,
            ),
        };
    }

    private normalizeStatus(status: unknown): PersistedRunStatus | undefined {
        return status === 'active' || status === 'game-over' || status === 'victory'
            ? status
            : undefined;
    }

    private normalizeFloor(floor: unknown): FloorSnapshot | undefined {
        if (!floor || typeof floor !== 'object') {
            return undefined;
        }

        const candidate = floor as Partial<FloorSnapshot>;
        const number = Number.isFinite(candidate.number) && (candidate.number ?? 0) >= 1
            ? Math.floor(candidate.number ?? 1)
            : undefined;
        const type = this.normalizeFloorType(candidate.type);
        if (!number || !type) {
            return undefined;
        }

        return {
            number,
            type,
        };
    }

    private normalizeFloorType(type: unknown): FloorType | undefined {
        return type === 'normal' || type === 'safe' || type === 'boss'
            ? type
            : undefined;
    }

    private normalizePendingSpecialRewardOffer(
        offer: unknown,
    ): PersistedSpecialRewardOffer | undefined {
        if (!offer || typeof offer !== 'object') {
            return undefined;
        }

        const candidate = offer as Partial<PersistedSpecialRewardOffer>;
        const sourceType = candidate.sourceType === 'cache' || candidate.sourceType === 'boss'
            ? candidate.sourceType
            : typeof candidate.keyItemId === 'string'
                ? 'cache'
                : undefined;
        const keyItemId = typeof candidate.keyItemId === 'string'
            ? candidate.keyItemId as ItemId
            : undefined;
        const bossArchetypeId = typeof candidate.bossArchetypeId === 'string'
            ? candidate.bossArchetypeId as EnemyArchetypeId
            : undefined;
        const keyItem = keyItemId
            ? ITEM_CATALOG.find((item) =>
                item.id === keyItemId
                && item.type === ITEM_TYPE.KEY,
            )
            : undefined;
        const rawOfferedItemIds = (candidate as { offeredItemIds?: unknown }).offeredItemIds;
        const offeredItemIds = Array.isArray(rawOfferedItemIds)
            ? rawOfferedItemIds.reduce<ItemId[]>((ids, itemId) => {
                if (typeof itemId !== 'string') {
                    return ids;
                }

                const definition = ITEM_CATALOG.find((item) => item.id === itemId);
                const isValidSpecialReward = definition
                    && (
                        definition.spawnSources?.includes(ITEM_SPAWN_SOURCE.SPECIAL)
                        || (
                            definition.rarity === ITEM_RARITY.EPIC
                            && definition.spawnSources?.includes(ITEM_SPAWN_SOURCE.REWARD)
                        )
                    );
                if (!isValidSpecialReward || ids.includes(itemId as ItemId)) {
                    return ids;
                }

                ids.push(itemId as ItemId);
                return ids;
            }, [])
            : [];
        if (!sourceType || offeredItemIds.length === 0) {
            return undefined;
        }

        if (sourceType === 'cache' && !keyItem) {
            return undefined;
        }

        return {
            sourceType,
            keyItemId: keyItem?.id,
            bossArchetypeId,
            offeredItemIds,
        };
    }

    private normalizePlayer(player: unknown): PersistedPlayerSnapshot | undefined {
        if (!player || typeof player !== 'object') {
            return undefined;
        }

        const candidate = player as Partial<PersistedPlayerSnapshot>;
        const stats = this.normalizeCombatStats(candidate.stats);
        if (!stats) {
            return undefined;
        }

        return {
            stats,
            experience: this.normalizeCount(candidate.experience),
        };
    }

    private normalizeCombatStats(stats: unknown): CombatStats | undefined {
        if (!stats || typeof stats !== 'object') {
            return undefined;
        }

        const candidate = stats as Partial<CombatStats>;
        const maxHealth = this.normalizePositiveStat(candidate.maxHealth);
        const health = this.normalizeStat(candidate.health);
        const attack = this.normalizeStat(candidate.attack);
        const defense = this.normalizeStat(candidate.defense);
        const movementSpeed = this.normalizePositiveStat(candidate.movementSpeed) ?? DEFAULT_MOVEMENT_SPEED;
        if (maxHealth === undefined || health === undefined || attack === undefined || defense === undefined) {
            return undefined;
        }

        return {
            health: Math.min(maxHealth, health),
            maxHealth,
            attack,
            defense,
            movementSpeed,
        };
    }

    private normalizeInventory(inventory: unknown): NormalizedInventoryResult | undefined {
        if (!Array.isArray(inventory)) {
            return undefined;
        }

        return inventory.reduce<NormalizedInventoryResult>((result, item) => {
            const normalizedItem = this.normalizeInventoryItem(item);
            if (!normalizedItem) {
                return result;
            }

            result.items.push(normalizedItem.item);
            result.removedLegacyEquippedStatModifier = this.combineStatModifiers(
                result.removedLegacyEquippedStatModifier,
                normalizedItem.removedLegacyEquippedStatModifier,
            );
            return result;
        }, {
            items: [],
            removedLegacyEquippedStatModifier: {},
        });
    }

    private normalizeInventoryItem(item: unknown): NormalizedInventoryItemResult | undefined {
        if (!item || typeof item !== 'object') {
            return undefined;
        }

        const candidate = item as Partial<InventoryItem>;
        const type = this.normalizeItemType(candidate.type);
        const rarity = this.normalizeItemRarity(candidate.rarity);
        const instanceId = typeof candidate.instanceId === 'string' ? candidate.instanceId : undefined;
        const id = typeof candidate.id === 'string' ? candidate.id : undefined;
        const name = typeof candidate.name === 'string' ? candidate.name : undefined;
        const icon = typeof candidate.icon === 'string' ? candidate.icon : undefined;
        const description = typeof candidate.description === 'string' ? candidate.description : undefined;
        const stackable = typeof candidate.stackable === 'boolean' ? candidate.stackable : undefined;
        const maxStack = this.normalizePositiveStat(candidate.maxStack);
        const quantity = this.normalizePositiveStat(candidate.quantity);
        const isEquipped = typeof candidate.isEquipped === 'boolean' ? candidate.isEquipped : undefined;
        if (
            !type
            || !rarity
            || !instanceId
            || !id
            || !name
            || !icon
            || !description
            || stackable === undefined
            || maxStack === undefined
            || quantity === undefined
            || isEquipped === undefined
        ) {
            return undefined;
        }

        const catalogDefinition = ITEM_CATALOG.find((definition) => definition.id === id);
        const consumableEffect = candidate.consumableEffect
            && typeof candidate.consumableEffect === 'object'
            && (candidate.consumableEffect as { kind?: unknown }).kind === 'heal'
            && this.normalizePositiveStat((candidate.consumableEffect as { amount?: unknown }).amount) !== undefined
            ? {
                kind: 'heal' as const,
                amount: this.normalizePositiveStat((candidate.consumableEffect as { amount?: unknown }).amount) ?? 1,
            }
            : cloneConsumableEffect(catalogDefinition?.consumableEffect);
        const equipment = this.normalizeEquipment(candidate.equipment, catalogDefinition?.equipment);
        const effectiveType = catalogDefinition?.type ?? type;
        const effectiveRarity = catalogDefinition?.rarity ?? rarity;
        const effectiveIsEquipped = effectiveType === ITEM_TYPE.EQUIPMENT
            && !!equipment
            && isPrimaryEquipmentSlot(equipment.slot)
            ? isEquipped
            : false;

        return {
            item: {
                instanceId,
                id: catalogDefinition?.id ?? id,
                name: catalogDefinition?.name ?? name,
                type: effectiveType,
                rarity: effectiveRarity,
                icon: catalogDefinition?.icon ?? icon,
                stackable: catalogDefinition?.stackable ?? stackable,
                maxStack: catalogDefinition?.maxStack ?? maxStack,
                quantity,
                description: catalogDefinition?.description ?? description,
                spawnSources: catalogDefinition?.spawnSources ? [...catalogDefinition.spawnSources] : undefined,
                isEquipped: effectiveIsEquipped,
                consumableEffect,
                equipment,
            },
            removedLegacyEquippedStatModifier:
                effectiveType === ITEM_TYPE.EQUIPMENT
                && !!equipment
                && isEquipped
                && !isPrimaryEquipmentSlot(equipment.slot)
                    ? { ...equipment.statModifier }
                    : undefined,
        };
    }

    private normalizeEquipment(
        equipment: unknown,
        catalogEquipment?: InventoryItem['equipment'],
    ) {
        if (!equipment || typeof equipment !== 'object') {
            return cloneEquipmentDefinition(catalogEquipment);
        }

        const candidate = equipment as {
            slot?: unknown;
            statModifier?: Partial<CombatStats>;
            passives?: InventoryItem['equipment'] extends infer T
                ? T extends { passives?: infer TPassives }
                    ? TPassives
                    : never
                : never;
        };
        const slot = candidate.slot === EQUIPMENT_SLOT.WEAPON
            || candidate.slot === EQUIPMENT_SLOT.HELMET
            || candidate.slot === EQUIPMENT_SLOT.BODY_ARMOR
            || candidate.slot === EQUIPMENT_SLOT.BOOTS
            || candidate.slot === EQUIPMENT_SLOT.ARMOR
            || candidate.slot === EQUIPMENT_SLOT.TRINKET
            ? candidate.slot === EQUIPMENT_SLOT.ARMOR
                ? EQUIPMENT_SLOT.BODY_ARMOR
                : candidate.slot
            : catalogEquipment?.slot;
        const modifier = candidate.statModifier && typeof candidate.statModifier === 'object'
            ? {
                maxHealth: this.normalizeOptionalStat(candidate.statModifier.maxHealth),
                attack: this.normalizeOptionalStat(candidate.statModifier.attack),
                defense: this.normalizeOptionalStat(candidate.statModifier.defense),
                movementSpeed: this.normalizeOptionalStat(candidate.statModifier.movementSpeed),
            }
            : catalogEquipment?.statModifier
                ? { ...catalogEquipment.statModifier }
                : undefined;
        const passives = Array.isArray(candidate.passives)
            ? candidate.passives
                .filter((entry): entry is { kind: string; value?: number } =>
                    !!entry
                    && typeof entry === 'object'
                    && typeof entry.kind === 'string'
                    && (
                        (entry as { value?: unknown }).value === undefined
                        || Number.isFinite((entry as { value?: unknown }).value)
                    ),
                )
                .map((entry) => ({
                    kind: entry.kind,
                    value: Number.isFinite(entry.value)
                        ? Math.floor(entry.value as number)
                        : undefined,
                }))
            : catalogEquipment?.passives?.map((entry) => ({ ...entry }));
        if (!slot || !modifier) {
            return undefined;
        }

        return {
            slot,
            statModifier: modifier,
            passives,
        };
    }

    private normalizeItemType(type: unknown): ItemType | undefined {
        return type === ITEM_TYPE.CONSUMABLE
            || type === ITEM_TYPE.EQUIPMENT
            || type === ITEM_TYPE.MATERIAL
            || type === ITEM_TYPE.KEY
            ? type
            : undefined;
    }

    private normalizeItemRarity(rarity: unknown): ItemRarity | undefined {
        return rarity === ITEM_RARITY.COMMON
            || rarity === ITEM_RARITY.UNCOMMON
            || rarity === ITEM_RARITY.RARE
            || rarity === ITEM_RARITY.EPIC
            || rarity === ITEM_RARITY.CURSED
            ? rarity
            : rarity === 'LEGENDARY'
                ? ITEM_RARITY.EPIC
                : undefined;
    }

    private normalizeDeck(deck: unknown): Card[] | undefined {
        if (!Array.isArray(deck)) {
            // 이전 저장 데이터 호환: deck 필드가 없으면 빈 배열로 처리
            return deck === undefined ? [] : undefined;
        }

        return deck
            .map((card) => this.normalizeCard(card))
            .filter((card): card is Card => !!card);
    }

    private normalizeCard(card: unknown): Card | undefined {
        if (!card || typeof card !== 'object') {
            return undefined;
        }

        const candidate = card as Partial<Card>;
        const id = typeof candidate.id === 'string' ? candidate.id : undefined;
        const name = typeof candidate.name === 'string' ? candidate.name : undefined;
        const type = this.normalizeCardType(candidate.type);
        const power = this.normalizeStat(candidate.power);

        if (!id || !name || !type || power === undefined) {
            return undefined;
        }

        const cost = this.normalizeStat(candidate.cost) ?? 0;
        const keywords = this.normalizeCardKeywords(candidate.keywords);
        const effectType = this.normalizeCardEffectType(candidate.effectType);
        const rarity = this.normalizeCardRarity(candidate.rarity) ?? CARD_RARITY.COMMON;
        const archetype = this.normalizeCardArchetype(candidate.archetype);
        if (candidate.statusEffect !== undefined && this.hasInvalidCardStatusEffect(candidate.statusEffect)) {
            return undefined;
        }
        const statusEffect = this.normalizeCardStatusEffect(candidate.statusEffect);
        if (candidate.statusEffects !== undefined && this.hasInvalidCardStatusEffects(candidate.statusEffects)) {
            return undefined;
        }
        const statusEffects = this.normalizeCardStatusEffects(candidate.statusEffects, statusEffect);
        if (candidate.condition !== undefined && this.hasInvalidCardCondition(candidate.condition)) {
            return undefined;
        }
        const condition = this.normalizeCardCondition(candidate.condition);
        if (candidate.effectPayload !== undefined && this.hasInvalidCardEffectPayload(candidate.effectPayload)) {
            return undefined;
        }
        const effectPayload = this.normalizeCardEffectPayload(candidate.effectPayload);

        return createCard({
            id,
            name,
            type,
            power,
            cost,
            keywords,
            effectType,
            rarity,
            archetype: archetype ?? CARD_ARCHETYPE.NEUTRAL,
            statusEffect,
            statusEffects,
            condition,
            secondaryPower: this.normalizeStat(candidate.secondaryPower),
            drawCount: this.normalizeStat(candidate.drawCount),
            healAmount: this.normalizeStat(candidate.healAmount),
            hitCount: this.normalizeStat(candidate.hitCount),
            discardCount: this.normalizeStat(candidate.discardCount),
            selfDamage: this.normalizeStat(candidate.selfDamage),
            buff: this.normalizeCardBuff(candidate.buff),
            effectPayload,
        });
    }

    private normalizeCardType(type: unknown): CardType | undefined {
        return type === CARD_TYPE.ATTACK
            || type === CARD_TYPE.GUARD
            || type === CARD_TYPE.SKILL
            || type === CARD_TYPE.POWER
            || type === CARD_TYPE.CURSE
            ? type
            : undefined;
    }

    private normalizeCardKeywords(keywords: unknown): Card['keywords'] {
        if (!Array.isArray(keywords)) {
            return [];
        }

        return keywords.filter((keyword): keyword is Card['keywords'][number] =>
            keyword === CARD_KEYWORD.BLOCK
            || keyword === CARD_KEYWORD.EXHAUST
            || keyword === CARD_KEYWORD.RETAIN
            || keyword === CARD_KEYWORD.INNATE
            || keyword === CARD_KEYWORD.ETHEREAL
            || keyword === CARD_KEYWORD.UNPLAYABLE,
        );
    }

    private normalizeCardEffectType(effectType: unknown): Card['effectType'] | undefined {
        return effectType === CARD_EFFECT_TYPE.DAMAGE
            || effectType === CARD_EFFECT_TYPE.BLOCK
            || effectType === CARD_EFFECT_TYPE.STATUS_EFFECT
            || effectType === CARD_EFFECT_TYPE.FLEE
            || effectType === CARD_EFFECT_TYPE.DRAW
            || effectType === CARD_EFFECT_TYPE.HEAL
            || effectType === CARD_EFFECT_TYPE.MULTI_HIT
            || effectType === CARD_EFFECT_TYPE.DAMAGE_BLOCK
            || effectType === CARD_EFFECT_TYPE.BUFF
            || effectType === CARD_EFFECT_TYPE.DISCARD_EFFECT
            || effectType === CARD_EFFECT_TYPE.CONDITIONAL
            ? effectType
            : undefined;
    }

    private normalizeCardRarity(rarity: unknown): Card['rarity'] | undefined {
        return rarity === CARD_RARITY.COMMON
            || rarity === CARD_RARITY.UNCOMMON
            || rarity === CARD_RARITY.RARE
            ? rarity
            : undefined;
    }

    private normalizeCardArchetype(archetype: unknown): CardArchetype | undefined {
        return archetype === CARD_ARCHETYPE.NEUTRAL
            || archetype === CARD_ARCHETYPE.BLOOD_OATH
            || archetype === CARD_ARCHETYPE.SHADOW_ARTS
            || archetype === CARD_ARCHETYPE.IRON_WILL
            || archetype === CARD_ARCHETYPE.CURSE
            ? archetype
            : undefined;
    }

    private normalizeCardStatusType(type: unknown): NonNullable<Card['statusEffect']>['type'] | undefined {
        return type === STATUS_EFFECT_TYPE.VULNERABLE
            || type === STATUS_EFFECT_TYPE.WEAK
            || type === STATUS_EFFECT_TYPE.POISON
            || type === STATUS_EFFECT_TYPE.STRENGTH
            || type === STATUS_EFFECT_TYPE.THORNS
            || type === STATUS_EFFECT_TYPE.REGENERATION
            || type === STATUS_EFFECT_TYPE.FRAIL
            ? type
            : undefined;
    }

    private hasInvalidCardStatusEffect(statusEffect: unknown): boolean {
        return statusEffect !== undefined && this.normalizeCardStatusEffect(statusEffect) === undefined;
    }

    private hasInvalidCardStatusEffects(statusEffects: unknown): boolean {
        if (statusEffects === undefined) {
            return false;
        }

        if (!Array.isArray(statusEffects)) {
            return true;
        }

        return statusEffects.some((statusEffect) => this.normalizeCardStatusEffect(statusEffect) === undefined);
    }

    private normalizeCardStatusEffect(statusEffect: unknown): Card['statusEffect'] | undefined {
        if (!statusEffect || typeof statusEffect !== 'object') {
            return undefined;
        }

        const candidate = statusEffect as Partial<NonNullable<Card['statusEffect']>>;
        const type = this.normalizeCardStatusType(candidate.type);
        const duration = this.normalizeStat(candidate.duration);
        const stacks = this.normalizeStat(candidate.stacks);
        const amount = this.normalizeStat(candidate.amount);
        if (!type) {
            return undefined;
        }

        if (duration === undefined && stacks === undefined && amount === undefined) {
            return undefined;
        }

        return {
            type,
            duration,
            stacks,
            amount,
        };
    }

    private normalizeCardStatusEffects(
        statusEffects: unknown,
        fallbackStatusEffect?: Card['statusEffect'],
    ): Card['statusEffects'] | undefined {
        if (!Array.isArray(statusEffects)) {
            return fallbackStatusEffect ? [fallbackStatusEffect] : undefined;
        }

        const normalized = statusEffects
            .map((statusEffect) => this.normalizeCardStatusEffect(statusEffect))
            .filter((statusEffect): statusEffect is NonNullable<Card['statusEffect']> => !!statusEffect);

        if (normalized.length > 0) {
            return normalized;
        }

        return fallbackStatusEffect ? [fallbackStatusEffect] : undefined;
    }

    private normalizeCardCondition(condition: unknown): Card['condition'] | undefined {
        if (!condition || typeof condition !== 'object') {
            return undefined;
        }

        const candidate = condition as Partial<NonNullable<Card['condition']>>;
        const type = this.normalizeCardConditionType(candidate.type);
        const value = this.normalizeStat(candidate.value);
        if (!type || value === undefined) {
            return undefined;
        }

        return { type, value };
    }

    private normalizeCardConditionType(type: unknown): CardCondition['type'] | undefined {
        return typeof type === 'string'
            && (CARD_CONDITION_TYPES as readonly string[]).includes(type)
            ? type as CardCondition['type']
            : undefined;
    }

    private hasInvalidCardCondition(condition: unknown): boolean {
        return condition !== undefined && this.normalizeCardCondition(condition) === undefined;
    }

    private normalizeCardEffectPayload(effectPayload: unknown): Card['effectPayload'] | undefined {
        if (!effectPayload || typeof effectPayload !== 'object') {
            return undefined;
        }

        const candidate = effectPayload as NonNullable<Card['effectPayload']>;
        const drawCount = this.normalizeStat(candidate.drawCount);
        const healAmount = this.normalizeStat(candidate.healAmount);
        const blockAmount = this.normalizeStat(candidate.blockAmount);
        const hitCount = this.normalizeStat(candidate.hitCount);
        const discardCount = this.normalizeStat(candidate.discardCount);
        const selfDamage = this.normalizeStat(candidate.selfDamage);
        const energyChange = this.normalizeOptionalStat(candidate.energyChange);
        const costWhenConditionMet = this.normalizeOptionalStat(candidate.costWhenConditionMet);
        const healOnKillPercent = this.normalizeOptionalStat(candidate.healOnKillPercent);
        const scaling = candidate.scaling && typeof candidate.scaling === 'object'
            ? {
                source: this.normalizeCardScalingSource(candidate.scaling.source),
                multiplier: this.normalizeOptionalStat(candidate.scaling.multiplier),
            }
            : undefined;
        const buff = this.normalizeCardBuff(candidate.buff);
        const statusEffects = this.normalizeCardStatusEffects(candidate.statusEffects);

        const hasPayload = drawCount !== undefined
            || healAmount !== undefined
            || blockAmount !== undefined
            || hitCount !== undefined
            || discardCount !== undefined
            || selfDamage !== undefined
            || energyChange !== undefined
            || costWhenConditionMet !== undefined
            || healOnKillPercent !== undefined
            || (scaling?.source !== undefined)
            || (buff?.type !== undefined && buff.value !== undefined)
            || (statusEffects !== undefined && statusEffects.length > 0);

        if (!hasPayload) {
            return undefined;
        }

        return {
            drawCount,
            healAmount,
            blockAmount,
            hitCount,
            discardCount,
            selfDamage,
            energyChange,
            costWhenConditionMet,
            healOnKillPercent,
            scaling: scaling?.source
                ? {
                    source: scaling.source,
                    multiplier: scaling.multiplier ?? 1,
                }
                : undefined,
            buff: buff?.type !== undefined && buff.value !== undefined
                ? {
                    type: buff.type,
                    value: buff.value,
                    duration: buff.duration,
                    target: buff.target,
                }
                : undefined,
            statusEffects,
        };
    }

    private normalizeCardScalingSource(source: unknown): string | undefined {
        return typeof source === 'string'
            && (CARD_SCALING_SOURCES as readonly string[]).includes(source)
            ? source
            : undefined;
    }

    private normalizeCardBuff(buff: unknown): Card['buff'] | undefined {
        if (!buff || typeof buff !== 'object') {
            return undefined;
        }

        const candidate = buff as NonNullable<Card['buff']>;
        const type = typeof candidate.type === 'string'
            && (CARD_BUFF_TYPES as readonly string[]).includes(candidate.type)
            ? candidate.type
            : undefined;
        const value = this.normalizeStat(candidate.value);
        const duration = this.normalizeStat(candidate.duration);
        const target = candidate.target === 'SELF' || candidate.target === 'TARGET'
            ? candidate.target
            : undefined;
        if (!type || value === undefined) {
            return undefined;
        }

        return {
            type,
            value,
            duration,
            target,
        };
    }

    private hasInvalidCardEffectPayload(effectPayload: unknown): boolean {
        if (effectPayload === undefined) {
            return false;
        }

        if (!effectPayload || typeof effectPayload !== 'object') {
            return true;
        }

        const candidate = effectPayload as {
            scaling?: unknown;
            buff?: unknown;
            statusEffects?: unknown;
        };

        if (candidate.scaling !== undefined) {
            if (!candidate.scaling || typeof candidate.scaling !== 'object') {
                return true;
            }
            const scaling = candidate.scaling as { source?: unknown; multiplier?: unknown };
            if (
                this.normalizeCardScalingSource(scaling.source) === undefined
                || this.normalizeOptionalStat(scaling.multiplier) === undefined
            ) {
                return true;
            }
        }

        if (candidate.buff !== undefined && this.normalizeCardBuff(candidate.buff) === undefined) {
            return true;
        }

        if (candidate.statusEffects !== undefined && this.hasInvalidCardStatusEffects(candidate.statusEffects)) {
            return true;
        }

        return false;
    }

    private normalizeCount(value: unknown) {
        return Number.isFinite(value) && (value as number) >= 0
            ? Math.floor(value as number)
            : 0;
    }

    private normalizeStat(value: unknown) {
        return Number.isFinite(value) && (value as number) >= 0
            ? Math.floor(value as number)
            : undefined;
    }

    private normalizePositiveStat(value: unknown) {
        return Number.isFinite(value) && (value as number) > 0
            ? Math.floor(value as number)
            : undefined;
    }

    private normalizeOptionalStat(value: unknown) {
        return Number.isFinite(value)
            ? Math.floor(value as number)
            : undefined;
    }

    private combineStatModifiers(
        left: CombatStatModifier,
        right?: CombatStatModifier,
    ): CombatStatModifier {
        if (!right) {
            return { ...left };
        }

        return {
            maxHealth: (left.maxHealth ?? 0) + (right.maxHealth ?? 0) || undefined,
            attack: (left.attack ?? 0) + (right.attack ?? 0) || undefined,
            defense: (left.defense ?? 0) + (right.defense ?? 0) || undefined,
            movementSpeed: (left.movementSpeed ?? 0) + (right.movementSpeed ?? 0) || undefined,
        };
    }

    private removeStatModifier(
        stats: CombatStats,
        modifier: CombatStatModifier,
    ): CombatStats {
        const maxHealth = Math.max(1, stats.maxHealth - (modifier.maxHealth ?? 0));

        return {
            health: Math.min(maxHealth, stats.health),
            maxHealth,
            attack: Math.max(0, stats.attack - (modifier.attack ?? 0)),
            defense: Math.max(0, stats.defense - (modifier.defense ?? 0)),
            movementSpeed: Math.max(1, stats.movementSpeed - (modifier.movementSpeed ?? 0)),
        };
    }

    private cloneInventoryItem(item: InventoryItem): InventoryItem {
        return cloneStoredInventoryItem(item);
    }

    private cloneCard(card: Card): Card {
        return createCard({
            ...card,
            id: card.id,
        });
    }
}
