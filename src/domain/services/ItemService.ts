import {
    ITEM_CATALOG,
    ITEM_RARITY,
    ItemEntity,
    createGeneratedItemDefinition,
    createInventoryItem,
    getItemRarityRank,
    type EquipmentSlot,
    type InventoryItem,
    type ItemDefinition,
    type ItemRarity,
} from '../entities/Item';
import type { CombatStatModifier } from '../entities/CombatStats';
import type { Position } from '../entities/Player';
import type { SpawnRoom } from './EnemySpawnerService';
import type { FloorType } from './FloorProgressionService';
import { positionToKey } from '../../shared/utils/positionKey';
import { shuffleArray, type RandomSource } from '../../shared/utils/shuffle';
import { collectRoomFloorPositions, selectUnoccupiedPosition } from '../../shared/utils/roomPositions';

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

export const DEFAULT_MAX_ITEMS_PER_FLOOR = 3;
export const DEFAULT_INVENTORY_SLOT_CAPACITY = 12;
export const ITEM_RARITY_FLOOR_BAND_SIZE = 20;
export const ITEM_RARITY_MAX_FLOOR_BANDS = 4;
export const RARE_WEIGHT_PER_BAND = 0.03;
export const LEGENDARY_WEIGHT_PER_BAND = 0.01;

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
            this.inventory.push({
                ...item,
                instanceId: `item-load-${index + 1}`,
                consumableEffect: item.consumableEffect
                    ? { ...item.consumableEffect }
                    : undefined,
                equipment: item.equipment
                    ? {
                        ...item.equipment,
                        statModifier: { ...item.equipment.statModifier },
                    }
                    : undefined,
            });
        });
    }

    getFieldItems() {
        return this.fieldItems.map((item) => new ItemEntity(
            item.instanceId,
            item.definition,
            { ...item.position },
        ));
    }

    getInventory() {
        return this.inventory.map((item) => ({ ...item }));
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
    ) {
        const fieldItem = new ItemEntity(
            this.createFieldItemId('reward'),
            this.generateDefinition(floorNumber, minimumRarity),
            { ...position },
        );
        this.fieldItems.push(fieldItem);

        return new ItemEntity(fieldItem.instanceId, fieldItem.definition, { ...fieldItem.position });
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
                    fieldItem.definition,
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
                inventoryItem: { ...inventoryItem },
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
            {
                id: inventoryItem.id,
                name: inventoryItem.name,
                type: inventoryItem.type,
                rarity: inventoryItem.rarity,
                icon: inventoryItem.icon,
                stackable: inventoryItem.stackable,
                maxStack: inventoryItem.maxStack,
                description: inventoryItem.description,
                consumableEffect: inventoryItem.consumableEffect,
                equipment: inventoryItem.equipment,
            },
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
            fieldItem: new ItemEntity(fieldItem.instanceId, fieldItem.definition, { ...fieldItem.position }),
            inventoryItem: inventoryItem.quantity > 0 ? { ...inventoryItem } : undefined,
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
            item: { ...item },
        };
    }

    private addToInventory(fieldItem: ItemEntity) {
        if (fieldItem.definition.stackable) {
            const existing = this.inventory.find((item) =>
                item.id === fieldItem.definition.id
                && item.rarity === fieldItem.rarity
                && item.quantity < item.maxStack,
            );
            if (existing) {
                existing.quantity += 1;
                return { ...existing };
            }
        }

        const inventoryItem = createInventoryItem(fieldItem.definition, fieldItem.instanceId);
        this.inventory.push(inventoryItem);
        return { ...inventoryItem };
    }

    private consumeItem(item: InventoryItem, inventoryIndex: number) {
        if (item.quantity > 1) {
            item.quantity -= 1;
            return { ...item };
        }

        this.inventory.splice(inventoryIndex, 1);
        return undefined;
    }

    private toggleEquipment(item: InventoryItem): ItemActivationResult {
        if (!item.equipment) {
            return {
                status: 'not-usable',
                item: { ...item },
            };
        }

        if (item.isEquipped) {
            item.isEquipped = false;

            return {
                status: 'unequipped',
                item: { ...item },
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
            item: { ...item },
            replacedItem: replacedItem ? { ...replacedItem } : undefined,
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
                    this.generateDefinition(request.floorNumber),
                    position,
                );
            });
    }

    private generateDefinition(floorNumber: number, minimumRarity: ItemRarity = ITEM_RARITY.COMMON) {
        const rarity = this.rollRarity(floorNumber, minimumRarity);
        const eligibleDefinitions = ITEM_CATALOG.filter((definition) =>
            getItemRarityRank(definition.rarity) <= getItemRarityRank(rarity),
        );
        if (eligibleDefinitions.length === 0) {
            throw new Error(`No item definitions available for rarity ${rarity}.`);
        }

        const index = Math.floor(this.random.next() * eligibleDefinitions.length);
        const template = eligibleDefinitions[Math.min(index, eligibleDefinitions.length - 1)];
        if (!template) {
            throw new Error('Item template selection failed.');
        }

        return createGeneratedItemDefinition(template, rarity);
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

    private createFieldItemId(floorNumber: number | 'drop' | 'reward') {
        const sequence = this.nextFieldItemSequence;
        this.nextFieldItemSequence += 1;
        if (floorNumber === 'drop') {
            return `item-drop-${sequence}`;
        }
        if (floorNumber === 'reward') {
            return `item-reward-${sequence}`;
        }

        return `item-f${floorNumber}-${sequence}`;
    }

    private rollRarity(floorNumber: number, minimumRarity: ItemRarity) {
        const floorBands = Math.min(
            ITEM_RARITY_MAX_FLOOR_BANDS,
            Math.max(0, Math.floor((floorNumber - 1) / ITEM_RARITY_FLOOR_BAND_SIZE)),
        );
        const rareWeight = 0.15 + (floorBands * RARE_WEIGHT_PER_BAND);
        const legendaryWeight = 0.03 + (floorBands * LEGENDARY_WEIGHT_PER_BAND);
        const commonWeight = Math.max(0, 1 - rareWeight - legendaryWeight);
        const weights = [
            { rarity: ITEM_RARITY.COMMON, weight: commonWeight },
            { rarity: ITEM_RARITY.RARE, weight: rareWeight },
            { rarity: ITEM_RARITY.LEGENDARY, weight: legendaryWeight },
        ].filter((entry) => getItemRarityRank(entry.rarity) >= getItemRarityRank(minimumRarity));

        const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
        const roll = this.random.next() * totalWeight;
        let cursor = 0;

        for (const entry of weights) {
            cursor += entry.weight;
            if (roll < cursor) {
                return entry.rarity;
            }
        }

        return weights[weights.length - 1]?.rarity ?? minimumRarity;
    }

}
