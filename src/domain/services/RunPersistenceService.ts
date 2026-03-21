import { type Card, type CardType, CARD_TYPE } from '../entities/Card';
import { cloneCombatStats, type CombatStats } from '../entities/CombatStats';
import {
    EQUIPMENT_SLOT,
    ITEM_RARITY,
    ITEM_TYPE,
    type InventoryItem,
    type ItemRarity,
    type ItemType,
} from '../entities/Item';
import type { FloorSnapshot, FloorType } from './FloorProgressionService';
import type { StorageLike } from './SoulShardService';

export type PersistedRunStatus = 'active' | 'game-over' | 'victory';

export interface PersistedPlayerSnapshot {
    stats: CombatStats;
    experience: number;
}

export interface RunPersistenceSnapshot {
    status: PersistedRunStatus;
    floor: FloorSnapshot;
    player: PersistedPlayerSnapshot;
    inventory: InventoryItem[];
    deck: Card[];
    defeatedEnemyCount: number;
}

export const RUN_PERSISTENCE_STORAGE_KEY = 'dread-ascent.run-state';

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
            deck: snapshot.deck.map((card) => ({ ...card })),
            defeatedEnemyCount: snapshot.defeatedEnemyCount,
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
            player,
            inventory,
            deck,
            defeatedEnemyCount: this.normalizeCount(snapshot.defeatedEnemyCount),
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
        if (maxHealth === undefined || health === undefined || attack === undefined || defense === undefined) {
            return undefined;
        }

        return {
            health: Math.min(maxHealth, health),
            maxHealth,
            attack,
            defense,
        };
    }

    private normalizeInventory(inventory: unknown): InventoryItem[] | undefined {
        if (!Array.isArray(inventory)) {
            return undefined;
        }

        return inventory
            .map((item) => this.normalizeInventoryItem(item))
            .filter((item): item is InventoryItem => !!item);
    }

    private normalizeInventoryItem(item: unknown): InventoryItem | undefined {
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

        const consumableEffect = candidate.consumableEffect
            && typeof candidate.consumableEffect === 'object'
            && (candidate.consumableEffect as { kind?: unknown }).kind === 'heal'
            && this.normalizePositiveStat((candidate.consumableEffect as { amount?: unknown }).amount) !== undefined
            ? {
                kind: 'heal' as const,
                amount: this.normalizePositiveStat((candidate.consumableEffect as { amount?: unknown }).amount) ?? 1,
            }
            : undefined;
        const equipment = this.normalizeEquipment(candidate.equipment);

        return {
            instanceId,
            id,
            name,
            type,
            rarity,
            icon,
            stackable,
            maxStack,
            quantity,
            description,
            isEquipped,
            consumableEffect,
            equipment,
        };
    }

    private normalizeEquipment(equipment: unknown) {
        if (!equipment || typeof equipment !== 'object') {
            return undefined;
        }

        const candidate = equipment as {
            slot?: unknown;
            statModifier?: Partial<CombatStats>;
        };
        const slot = candidate.slot === EQUIPMENT_SLOT.WEAPON
            || candidate.slot === EQUIPMENT_SLOT.ARMOR
            || candidate.slot === EQUIPMENT_SLOT.TRINKET
            ? candidate.slot
            : undefined;
        const modifier = candidate.statModifier && typeof candidate.statModifier === 'object'
            ? {
                maxHealth: this.normalizeOptionalStat(candidate.statModifier.maxHealth),
                attack: this.normalizeOptionalStat(candidate.statModifier.attack),
                defense: this.normalizeOptionalStat(candidate.statModifier.defense),
            }
            : undefined;
        if (!slot || !modifier) {
            return undefined;
        }

        return {
            slot,
            statModifier: modifier,
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
            || rarity === ITEM_RARITY.RARE
            || rarity === ITEM_RARITY.LEGENDARY
            ? rarity
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

        return { id, name, type, power };
    }

    private normalizeCardType(type: unknown): CardType | undefined {
        return type === CARD_TYPE.ATTACK || type === CARD_TYPE.GUARD
            ? type
            : undefined;
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

    private cloneInventoryItem(item: InventoryItem): InventoryItem {
        return {
            ...item,
            consumableEffect: item.consumableEffect
                ? { ...item.consumableEffect }
                : undefined,
            equipment: item.equipment
                ? {
                    ...item.equipment,
                    statModifier: { ...item.equipment.statModifier },
                }
                : undefined,
        };
    }
}
