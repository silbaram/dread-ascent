import type { CombatStatModifier } from '../entities/CombatStats';
import {
    ITEM_CATALOG,
    ITEM_ID,
    ITEM_RARITY,
    ITEM_SPAWN_SOURCE,
    ItemEntity,
    cloneInventoryItem as cloneStoredInventoryItem,
    createInventoryItem,
    getItemRarityRank,
    isPrimaryEquipmentSlot,
    type EquipmentSlot,
    type ItemId,
    type InventoryItem,
    type ItemDefinition,
    type ItemRarity,
} from '../entities/Item';
import type { Position } from '../entities/Player';
import type { SpawnRoom } from './EnemySpawnerService';
import type { FloorType } from './FloorProgressionService';
import { getRarityWeightBonus } from './EquipmentEffectService';
import { positionToKey } from '../../shared/utils/positionKey';
import { collectRoomFloorPositions, selectUnoccupiedPosition } from '../../shared/utils/roomPositions';
import { shuffleArray, type RandomSource } from '../../shared/utils/shuffle';

export type ItemRandomSource = RandomSource;

export interface ItemSpawnRequest {
    floorNumber: number;
    floorType: FloorType;
    tiles: number[][];
    rooms: SpawnRoom[];
    blockedPositions: Position[];
    maxItems?: number;
}

export interface ItemPickupResult {
    status: 'picked' | 'inventory-full';
    fieldItemId: string;
    inventoryItem?: InventoryItem;
    fieldItem?: ItemEntity;
}

export interface InventorySnapshot {
    items: InventoryItem[];
    usedSlots: number;
    slotCapacity: number;
}

export interface ItemDropResult {
    status: 'dropped' | 'tile-occupied' | 'equipped-item';
    fieldItem?: ItemEntity;
    inventoryItem?: InventoryItem;
}

export interface ItemActivationResult {
    status: 'consumed' | 'equipped' | 'unequipped' | 'not-usable';
    item?: InventoryItem;
    replacedItem?: InventoryItem;
    healAmount?: number;
    statModifier?: CombatStatModifier;
    equipmentSlot?: EquipmentSlot;
}

export interface SpecialRewardOpenResult {
    status: 'opened' | 'not-usable';
    consumedItem?: InventoryItem;
    rewardChoices?: ItemDefinition[];
}

export interface SpecialRewardGrantResult {
    status: 'granted' | 'inventory-full' | 'unavailable';
    rewardItem?: InventoryItem;
}

export interface ClaimSpecialRewardOptions {
    ignoreInventoryCapacity?: boolean;
}

export interface InventoryLossResult {
    status: 'lost' | 'none';
    item?: InventoryItem;
}

interface ItemRarityWeights {
    COMMON: number;
    UNCOMMON: number;
    RARE: number;
    EPIC: number;
    CURSED: number;
}

export const DEFAULT_MAX_ITEMS_PER_FLOOR = 3;
export const DEFAULT_INVENTORY_SLOT_CAPACITY = 12;

const EMPTY_WEIGHTS: ItemRarityWeights = {
    COMMON: 0,
    UNCOMMON: 0,
    RARE: 0,
    EPIC: 0,
    CURSED: 0,
};

const SPECIAL_REWARD_ITEM_IDS = [
    ITEM_ID.SOULFIRE_BRAND,
    ITEM_ID.ALL_SEEING_CROWN,
    ITEM_ID.BASTION_ARMOR,
    ITEM_ID.PHANTOM_STRIDE,
    ITEM_ID.CURSED_EDGE,
    ITEM_ID.SOUL_LEECH,
    ITEM_ID.RUNIC_BLINDFOLD,
    ITEM_ID.MADMANS_HOOD,
    ITEM_ID.MARTYRDOM_PLATE,
    ITEM_ID.PACT_ARMOR,
    ITEM_ID.GAMBLERS_SHOES,
    ITEM_ID.ESCAPE_ARTISTS_BOOTS,
] as const;
const SPECIAL_REWARD_CHOICE_COUNT = 3;

export class ItemService {
    private fieldItems: ItemEntity[] = [];
    private readonly inventory: InventoryItem[] = [];
    private nextFieldItemSequence = 1;

    constructor(
        private readonly random: ItemRandomSource = { next: () => Math.random() },
        private readonly maxItemsPerFloor = DEFAULT_MAX_ITEMS_PER_FLOOR,
        private readonly inventorySlotCapacity = DEFAULT_INVENTORY_SLOT_CAPACITY,
    ) {
        if (maxItemsPerFloor < 0) {
            throw new Error('Item count must be zero or greater.');
        }
        if (inventorySlotCapacity < 0) {
            throw new Error('Inventory capacity must be zero or greater.');
        }
    }

    initializeFloor(request: ItemSpawnRequest) {
        this.nextFieldItemSequence = 1;
        this.fieldItems = this.spawn(request);
        return this.getFieldItems();
    }

    resetRun() {
        this.fieldItems = [];
        this.inventory.length = 0;
        this.nextFieldItemSequence = 1;
    }

    restoreInventory(items: InventoryItem[]) {
        this.inventory.length = 0;
        items.forEach((item, index) => {
            const restoredItem = cloneStoredInventoryItem({
                ...item,
                instanceId: item.instanceId || `item-load-${index + 1}`,
            });
            if (restoredItem.equipment && !isPrimaryEquipmentSlot(restoredItem.equipment.slot)) {
                restoredItem.isEquipped = false;
            }
            this.inventory.push(restoredItem);
        });
    }

    getFieldItems() {
        return this.fieldItems.map((item) => new ItemEntity(
            item.instanceId,
            this.cloneItemDefinition(item.definition),
            { ...item.position },
        ));
    }

    getInventory() {
        return this.inventory.map((item) => this.cloneInventoryItem(item));
    }

    getInventorySnapshot(): InventorySnapshot {
        return {
            items: this.getInventory(),
            usedSlots: this.inventory.length,
            slotCapacity: this.inventorySlotCapacity,
        };
    }

    spawnRewardDrop(
        position: Position,
        floorNumber: number,
        minimumRarity: ItemRarity = ITEM_RARITY.RARE,
        maximumRarity?: ItemRarity,
    ) {
        const fieldItem = new ItemEntity(
            this.createFieldItemId('reward'),
            this.generateDefinition(floorNumber, minimumRarity, ITEM_SPAWN_SOURCE.REWARD, maximumRarity),
            { ...position },
        );
        this.fieldItems.push(fieldItem);

        return new ItemEntity(
            fieldItem.instanceId,
            this.cloneItemDefinition(fieldItem.definition),
            { ...fieldItem.position },
        );
    }

    spawnEliteRewardDrop(position: Position, floorNumber: number) {
        const minimumRarity = floorNumber >= 25
            ? ITEM_RARITY.RARE
            : floorNumber >= 10
                ? ITEM_RARITY.UNCOMMON
                : ITEM_RARITY.COMMON;
        return this.spawnRewardDrop(position, floorNumber, minimumRarity, ITEM_RARITY.EPIC);
    }

    openSpecialReward(instanceId: string, floorNumber: number): SpecialRewardOpenResult | undefined {
        const inventoryIndex = this.inventory.findIndex((item) => item.instanceId === instanceId);
        if (inventoryIndex === -1) {
            return undefined;
        }

        const item = this.inventory[inventoryIndex];
        if (item.type !== 'KEY' || item.id !== ITEM_ID.BRONZE_SIGIL) {
            return {
                status: 'not-usable',
                consumedItem: this.cloneInventoryItem(item),
            };
        }

        const consumedItem = this.cloneInventoryItem(item);
        this.inventory.splice(inventoryIndex, 1);

        const rewardChoices = this.createSpecialRewardChoices(floorNumber, 'cache', SPECIAL_REWARD_CHOICE_COUNT, item.id);

        return {
            status: 'opened',
            consumedItem,
            rewardChoices,
        };
    }

    createSpecialRewardChoices(
        floorNumber: number,
        sourceType: 'cache' | 'boss',
        count = SPECIAL_REWARD_CHOICE_COUNT,
        keyItemId?: ItemId,
    ): ItemDefinition[] {
        return this.generateSpecialRewardChoices(floorNumber, sourceType, count, keyItemId);
    }

    grantBossReward(floorNumber: number): SpecialRewardGrantResult {
        let definition: ItemDefinition;
        try {
            definition = this.generateDefinition(
                floorNumber,
                ITEM_RARITY.RARE,
                ITEM_SPAWN_SOURCE.REWARD,
                ITEM_RARITY.EPIC,
            );
        } catch {
            return {
                status: 'unavailable',
            };
        }

        return {
            status: 'granted',
            rewardItem: this.addDefinitionToInventory(
                definition,
                this.createFieldItemId('special'),
            ),
        };
    }

    grantSpecialReward(floorNumber: number): SpecialRewardGrantResult {
        let definition: ItemDefinition;
        try {
            definition = this.generateSpecialDefinition(floorNumber);
        } catch {
            return {
                status: 'unavailable',
            };
        }

        if (!this.canAddToInventory(definition)) {
            return {
                status: 'inventory-full',
            };
        }

        return {
            status: 'granted',
            rewardItem: this.addDefinitionToInventory(
                definition,
                this.createFieldItemId('special'),
            ),
        };
    }

    claimSpecialReward(itemId: ItemId, options: ClaimSpecialRewardOptions = {}): SpecialRewardGrantResult {
        const definition = ITEM_CATALOG.find((entry) =>
            SPECIAL_REWARD_ITEM_IDS.includes(entry.id as (typeof SPECIAL_REWARD_ITEM_IDS)[number])
            && entry.id === itemId,
        );
        if (!definition) {
            return {
                status: 'unavailable',
            };
        }

        if (!options.ignoreInventoryCapacity && !this.canAddToInventory(definition)) {
            return {
                status: 'inventory-full',
            };
        }

        return {
            status: 'granted',
            rewardItem: this.addDefinitionToInventory(
                this.cloneItemDefinition(definition),
                this.createFieldItemId('special'),
            ),
        };
    }

    grantPactReward(itemId: ItemId = ITEM_ID.PACT_ARMOR): SpecialRewardGrantResult {
        return this.claimSpecialReward(itemId, { ignoreInventoryCapacity: true });
    }

    getSpecialRewardChoiceDefinitions(itemIds: readonly ItemId[]): ItemDefinition[] {
        return itemIds.flatMap((itemId) => {
            const definition = ITEM_CATALOG.find((entry) =>
                SPECIAL_REWARD_ITEM_IDS.includes(entry.id as (typeof SPECIAL_REWARD_ITEM_IDS)[number])
                && entry.id === itemId,
            );
            return definition
                ? [this.cloneItemDefinition(definition)]
                : [];
        });
    }

    loseRandomInventoryItem(includeEquipped = false): InventoryLossResult {
        const eligibleIndices = this.inventory.reduce<number[]>((indices, item, index) => {
            if (!includeEquipped && item.isEquipped) {
                return indices;
            }

            indices.push(index);
            return indices;
        }, []);

        if (eligibleIndices.length === 0) {
            return {
                status: 'none',
            };
        }

        const selectedIndex = eligibleIndices[
            Math.min(
                Math.floor(this.random.next() * eligibleIndices.length),
                eligibleIndices.length - 1,
            )
        ];
        if (selectedIndex === undefined) {
            return {
                status: 'none',
            };
        }

        const item = this.inventory[selectedIndex];
        if (!item) {
            return {
                status: 'none',
            };
        }

        if (item.quantity > 1) {
            item.quantity -= 1;
            return {
                status: 'lost',
                item: {
                    ...this.cloneInventoryItem(item),
                    quantity: 1,
                },
            };
        }

        const [lostItem] = this.inventory.splice(selectedIndex, 1);
        return {
            status: 'lost',
            item: lostItem ? this.cloneInventoryItem(lostItem) : undefined,
        };
    }

    pickupAt(position: Position): ItemPickupResult | undefined {
        const index = this.fieldItems.findIndex((item) =>
            item.position.x === position.x
            && item.position.y === position.y,
        );
        if (index === -1) {
            return undefined;
        }

        const fieldItem = this.fieldItems[index];
        if (!this.canAddToInventory(fieldItem.definition)) {
            return {
                status: 'inventory-full',
                fieldItemId: fieldItem.instanceId,
                fieldItem: new ItemEntity(
                    fieldItem.instanceId,
                    this.cloneItemDefinition(fieldItem.definition),
                    { ...fieldItem.position },
                ),
            };
        }

        this.fieldItems.splice(index, 1);
        const inventoryItem = this.addToInventory(fieldItem);

        return {
            status: 'picked',
            fieldItemId: fieldItem.instanceId,
            inventoryItem,
        };
    }

    dropItem(instanceId: string, position: Position): ItemDropResult | undefined {
        const inventoryIndex = this.inventory.findIndex((item) => item.instanceId === instanceId);
        if (inventoryIndex === -1) {
            return undefined;
        }

        const inventoryItem = this.inventory[inventoryIndex];
        if (inventoryItem.isEquipped) {
            return {
                status: 'equipped-item',
                inventoryItem: this.cloneInventoryItem(inventoryItem),
            };
        }

        const fieldOccupied = this.fieldItems.some((item) =>
            item.position.x === position.x
            && item.position.y === position.y,
        );
        if (fieldOccupied) {
            return {
                status: 'tile-occupied',
            };
        }

        const fieldItem = new ItemEntity(
            this.createFieldItemId('drop'),
            this.cloneItemDefinition(inventoryItem),
            { ...position },
        );

        if (inventoryItem.quantity > 1) {
            inventoryItem.quantity -= 1;
        } else {
            this.inventory.splice(inventoryIndex, 1);
        }

        this.fieldItems.push(fieldItem);

        return {
            status: 'dropped',
            fieldItem: new ItemEntity(
                fieldItem.instanceId,
                this.cloneItemDefinition(fieldItem.definition),
                { ...fieldItem.position },
            ),
            inventoryItem: inventoryItem.quantity > 0
                ? this.cloneInventoryItem(inventoryItem)
                : undefined,
        };
    }

    activateItem(instanceId: string): ItemActivationResult | undefined {
        const inventoryIndex = this.inventory.findIndex((item) => item.instanceId === instanceId);
        if (inventoryIndex === -1) {
            return undefined;
        }

        const item = this.inventory[inventoryIndex];
        if (item.type === 'CONSUMABLE' && item.consumableEffect?.kind === 'heal') {
            const updatedItem = this.consumeItem(item, inventoryIndex);
            return {
                status: 'consumed',
                item: updatedItem,
                healAmount: item.consumableEffect.amount,
            };
        }

        if (item.type === 'EQUIPMENT' && item.equipment) {
            return this.toggleEquipment(item);
        }

        return {
            status: 'not-usable',
            item: this.cloneInventoryItem(item),
        };
    }

    private addToInventory(fieldItem: ItemEntity) {
        return this.addDefinitionToInventory(fieldItem.definition, fieldItem.instanceId);
    }

    private addDefinitionToInventory(definition: ItemDefinition, instanceId: string) {
        if (definition.stackable) {
            const existing = this.inventory.find((item) =>
                item.id === definition.id
                && item.rarity === definition.rarity
                && item.quantity < item.maxStack,
            );
            if (existing) {
                existing.quantity += 1;
                return this.cloneInventoryItem(existing);
            }
        }

        const inventoryItem = createInventoryItem(
            this.cloneItemDefinition(definition),
            instanceId,
        );
        this.inventory.push(inventoryItem);
        return this.cloneInventoryItem(inventoryItem);
    }

    private consumeItem(item: InventoryItem, inventoryIndex: number) {
        if (item.quantity > 1) {
            item.quantity -= 1;
            return this.cloneInventoryItem(item);
        }

        this.inventory.splice(inventoryIndex, 1);
        return undefined;
    }

    private toggleEquipment(item: InventoryItem): ItemActivationResult {
        if (!item.equipment || !isPrimaryEquipmentSlot(item.equipment.slot)) {
            return {
                status: 'not-usable',
                item: this.cloneInventoryItem(item),
            };
        }

        if (item.isEquipped) {
            item.isEquipped = false;

            return {
                status: 'unequipped',
                item: this.cloneInventoryItem(item),
                equipmentSlot: item.equipment.slot,
                statModifier: this.invertStatModifier(item.equipment.statModifier),
            };
        }

        const replacedItem = this.inventory.find((inventoryItem) =>
            inventoryItem.isEquipped
            && inventoryItem.instanceId !== item.instanceId
            && inventoryItem.equipment?.slot === item.equipment?.slot,
        );
        let statModifier = item.equipment.statModifier;

        if (replacedItem?.equipment) {
            replacedItem.isEquipped = false;
            statModifier = this.combineStatModifiers(
                item.equipment.statModifier,
                this.invertStatModifier(replacedItem.equipment.statModifier),
            );
        }

        item.isEquipped = true;

        return {
            status: 'equipped',
            item: this.cloneInventoryItem(item),
            replacedItem: replacedItem ? this.cloneInventoryItem(replacedItem) : undefined,
            equipmentSlot: item.equipment.slot,
            statModifier,
        };
    }

    private canAddToInventory(definition: ItemDefinition) {
        if (definition.stackable) {
            const existing = this.inventory.find((item) =>
                item.id === definition.id
                && item.rarity === definition.rarity
                && item.quantity < item.maxStack,
            );
            if (existing) {
                return true;
            }
        }

        return this.inventory.length < this.inventorySlotCapacity;
    }

    private spawn(request: ItemSpawnRequest) {
        const occupied = new Set(
            request.blockedPositions.map((position) => positionToKey(position)),
        );
        const availableRooms = shuffleArray(request.rooms, this.random).filter((room) =>
            collectRoomFloorPositions(room, request.tiles).some((position) =>
                !occupied.has(positionToKey(position)),
            ),
        );
        const floorLimit = request.floorType === 'boss'
            ? 0
            : request.floorType === 'safe'
                ? 1
                : request.maxItems ?? this.maxItemsPerFloor;
        const targetCount = Math.min(floorLimit, availableRooms.length);

        return availableRooms
            .slice(0, targetCount)
            .map((room) => {
                const position = selectUnoccupiedPosition(room, request.tiles, occupied, this.random, 'item');
                occupied.add(positionToKey(position));

                return new ItemEntity(
                    this.createFieldItemId(request.floorNumber),
                    this.generateDefinition(request.floorNumber, ITEM_RARITY.COMMON, ITEM_SPAWN_SOURCE.FIELD),
                    position,
                );
            });
    }

    private generateDefinition(
        floorNumber: number,
        minimumRarity: ItemRarity,
        source: typeof ITEM_SPAWN_SOURCE[keyof typeof ITEM_SPAWN_SOURCE],
        maximumRarity?: ItemRarity,
    ) {
        const rarity = this.rollRarity(floorNumber, minimumRarity, source, maximumRarity);
        const eligibleDefinitions = ITEM_CATALOG.filter((definition) =>
            definition.rarity === rarity
            && definition.spawnSources?.includes(source),
        );

        const fallbackDefinitions = eligibleDefinitions.length > 0
            ? eligibleDefinitions
            : ITEM_CATALOG.filter((definition) =>
                definition.spawnSources?.includes(source)
                && getItemRarityRank(definition.rarity) >= getItemRarityRank(minimumRarity)
                && (
                    !maximumRarity
                    || getItemRarityRank(definition.rarity) <= getItemRarityRank(maximumRarity)
                ),
            );

        if (fallbackDefinitions.length === 0) {
            throw new Error(`No item definitions available for source ${source} at rarity ${rarity}.`);
        }

        const index = Math.floor(this.random.next() * fallbackDefinitions.length);
        const template = fallbackDefinitions[Math.min(index, fallbackDefinitions.length - 1)];
        if (!template) {
            throw new Error('Item template selection failed.');
        }

        return this.cloneItemDefinition(template);
    }

    private generateSpecialDefinition(floorNumber: number): ItemDefinition {
        const candidates = ITEM_CATALOG.filter((definition) =>
            SPECIAL_REWARD_ITEM_IDS.includes(definition.id as (typeof SPECIAL_REWARD_ITEM_IDS)[number])
            && (
                definition.rarity === ITEM_RARITY.CURSED
                || (floorNumber >= 50 && definition.rarity === ITEM_RARITY.EPIC)
            ),
        );

        if (candidates.length === 0) {
            throw new Error(`No special reward definitions available for floor ${floorNumber}.`);
        }

        const index = Math.floor(this.random.next() * candidates.length);
        const template = candidates[Math.min(index, candidates.length - 1)];
        if (!template) {
            throw new Error('Special reward template selection failed.');
        }

        return this.cloneItemDefinition(template);
    }

    private generateSpecialRewardChoices(
        floorNumber: number,
        sourceType: 'cache' | 'boss',
        count: number,
        keyItemId?: ItemId,
    ): ItemDefinition[] {
        const allowEpic = sourceType === 'cache'
            && keyItemId !== ITEM_ID.BRONZE_SIGIL
            && floorNumber >= 50;
        const candidates = ITEM_CATALOG.filter((definition) =>
            SPECIAL_REWARD_ITEM_IDS.includes(definition.id as (typeof SPECIAL_REWARD_ITEM_IDS)[number])
            && (
                definition.rarity === ITEM_RARITY.CURSED
                || (allowEpic && definition.rarity === ITEM_RARITY.EPIC)
            ),
        );

        return shuffleArray(candidates, this.random)
            .slice(0, Math.min(count, candidates.length))
            .map((definition) => this.cloneItemDefinition(definition));
    }

    private combineStatModifiers(
        left: CombatStatModifier,
        right: CombatStatModifier,
    ): CombatStatModifier {
        return {
            maxHealth: (left.maxHealth ?? 0) + (right.maxHealth ?? 0) || undefined,
            attack: (left.attack ?? 0) + (right.attack ?? 0) || undefined,
            defense: (left.defense ?? 0) + (right.defense ?? 0) || undefined,
        };
    }

    private invertStatModifier(modifier: CombatStatModifier): CombatStatModifier {
        return {
            maxHealth: modifier.maxHealth ? -modifier.maxHealth : undefined,
            attack: modifier.attack ? -modifier.attack : undefined,
            defense: modifier.defense ? -modifier.defense : undefined,
        };
    }

    private createFieldItemId(floorNumber: number | 'drop' | 'reward' | 'special') {
        const sequence = this.nextFieldItemSequence;
        this.nextFieldItemSequence += 1;
        if (floorNumber === 'drop') {
            return `item-drop-${sequence}`;
        }
        if (floorNumber === 'reward') {
            return `item-reward-${sequence}`;
        }
        if (floorNumber === 'special') {
            return `item-special-${sequence}`;
        }

        return `item-f${floorNumber}-${sequence}`;
    }

    private rollRarity(
        floorNumber: number,
        minimumRarity: ItemRarity,
        source: typeof ITEM_SPAWN_SOURCE[keyof typeof ITEM_SPAWN_SOURCE],
        maximumRarity?: ItemRarity,
    ) {
        const weights = this.resolveWeights(floorNumber, source);
        const uncommonWeightBonus = getRarityWeightBonus(this.inventory, ITEM_RARITY.UNCOMMON);
        if (weights.UNCOMMON > 0 && uncommonWeightBonus > 0) {
            const shiftedCommonWeight = Math.min(weights.COMMON, uncommonWeightBonus);
            weights.COMMON -= shiftedCommonWeight;
            weights.UNCOMMON += shiftedCommonWeight;
        }

        const availableEntries = (Object.entries(weights) as Array<[ItemRarity, number]>)
            .filter(([rarity, weight]) =>
                weight > 0
                && getItemRarityRank(rarity) >= getItemRarityRank(minimumRarity)
                && (
                    !maximumRarity
                    || getItemRarityRank(rarity) <= getItemRarityRank(maximumRarity)
                ),
            );

        if (availableEntries.length === 0) {
            return minimumRarity;
        }

        const totalWeight = availableEntries.reduce((sum, [, weight]) => sum + weight, 0);
        const roll = this.random.next() * totalWeight;
        let cursor = 0;

        for (const [rarity, weight] of availableEntries) {
            cursor += weight;
            if (roll < cursor) {
                return rarity;
            }
        }

        return availableEntries[availableEntries.length - 1]?.[0] ?? minimumRarity;
    }

    private resolveWeights(
        floorNumber: number,
        source: typeof ITEM_SPAWN_SOURCE[keyof typeof ITEM_SPAWN_SOURCE],
    ): ItemRarityWeights {
        if (source === ITEM_SPAWN_SOURCE.SPECIAL) {
            return { ...EMPTY_WEIGHTS, CURSED: 1 };
        }

        const allowEpic = source === ITEM_SPAWN_SOURCE.REWARD;
        if (floorNumber >= 100) {
            return {
                ...EMPTY_WEIGHTS,
                RARE: 0.5,
                EPIC: allowEpic ? 0.5 : 0,
            };
        }

        if (floorNumber >= 80) {
            return {
                ...EMPTY_WEIGHTS,
                COMMON: 0.10,
                UNCOMMON: 0.20,
                RARE: 0.45,
                EPIC: allowEpic ? 0.25 : 0,
            };
        }

        if (floorNumber >= 50) {
            return {
                ...EMPTY_WEIGHTS,
                COMMON: 0.20,
                UNCOMMON: 0.30,
                RARE: 0.40,
                EPIC: allowEpic ? 0.10 : 0,
            };
        }

        if (floorNumber >= 25) {
            return {
                ...EMPTY_WEIGHTS,
                COMMON: 0.40,
                UNCOMMON: 0.35,
                RARE: 0.22,
                EPIC: allowEpic ? 0.03 : 0,
            };
        }

        if (floorNumber >= 10) {
            return {
                ...EMPTY_WEIGHTS,
                COMMON: 0.65,
                UNCOMMON: 0.30,
                RARE: 0.05,
            };
        }

        return {
            ...EMPTY_WEIGHTS,
            COMMON: 1,
        };
    }

    private cloneItemDefinition(definition: ItemDefinition): ItemDefinition {
        return {
            id: definition.id,
            name: definition.name,
            type: definition.type,
            rarity: definition.rarity,
            icon: definition.icon,
            stackable: definition.stackable,
            maxStack: definition.maxStack,
            description: definition.description,
            spawnSources: definition.spawnSources ? [...definition.spawnSources] : undefined,
            consumableEffect: definition.consumableEffect
                ? { ...definition.consumableEffect }
                : undefined,
            equipment: definition.equipment
                ? {
                    slot: definition.equipment.slot,
                    statModifier: { ...definition.equipment.statModifier },
                    passives: definition.equipment.passives?.map((passive) => ({ ...passive })),
                }
                : undefined,
        };
    }

    private cloneInventoryItem(item: InventoryItem): InventoryItem {
        return {
            ...this.cloneItemDefinition(item),
            instanceId: item.instanceId,
            quantity: item.quantity,
            isEquipped: item.isEquipped,
        };
    }
}
