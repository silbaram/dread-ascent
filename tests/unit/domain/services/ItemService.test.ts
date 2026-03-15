import { describe, expect, it } from 'vitest';
import { ITEM_RARITY } from '../../../../src/domain/entities/Item';
import { ItemService, type ItemRandomSource } from '../../../../src/domain/services/ItemService';
import type { SpawnRoom } from '../../../../src/domain/services/EnemySpawnerService';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';

class SequenceRandomSource implements ItemRandomSource {
    private index = 0;

    constructor(private readonly values: number[]) {}

    next() {
        const value = this.values[this.index] ?? this.values[this.values.length - 1] ?? 0;
        this.index += 1;
        return value;
    }
}

function createTiles(width: number, height: number, rooms: SpawnRoom[]) {
    const tiles = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => WORLD_TILE.WALL),
    );

    for (const room of rooms) {
        for (let y = room.top; y <= room.bottom; y += 1) {
            for (let x = room.left; x <= room.right; x += 1) {
                tiles[y][x] = WORLD_TILE.FLOOR;
            }
        }
    }

    return tiles;
}

function isInsideRoom(position: { x: number; y: number }, room: SpawnRoom) {
    return position.x >= room.left
        && position.x <= room.right
        && position.y >= room.top
        && position.y <= room.bottom;
}

describe('ItemService', () => {
    const rooms: SpawnRoom[] = [
        { left: 1, right: 2, top: 1, bottom: 2 },
        { left: 5, right: 6, top: 1, bottom: 2 },
        { left: 1, right: 2, top: 5, bottom: 6 },
    ];
    const singleRoomRequest = {
        floorType: 'normal' as const,
        tiles: createTiles(4, 4, [{ left: 1, right: 1, top: 1, bottom: 1 }]),
        rooms: [{ left: 1, right: 1, top: 1, bottom: 1 }],
        blockedPositions: [] as { x: number; y: number }[],
        maxItems: 1,
    };

    it('spawns items into open room tiles and exposes the item definition fields', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0, 0, 0]), 2);

        // Act
        const items = service.initializeFloor({
            floorNumber: 1,
            floorType: 'normal',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [
                { x: 1, y: 1 },
                { x: 5, y: 1 },
            ],
        });

        // Assert
        expect(items).toHaveLength(2);
        expect(items.map((item) => item.position)).not.toContainEqual({ x: 1, y: 1 });
        expect(items.map((item) => item.position)).not.toContainEqual({ x: 5, y: 1 });
        expect(items.every((item) =>
            rooms.some((room) => isInsideRoom(item.position, room)),
        )).toBe(true);
        expect(items[0]?.rarity).toBe(items[0]?.definition.rarity);
        expect(items[0].definition).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            type: expect.any(String),
            rarity: expect.any(String),
            icon: expect.any(String),
            stackable: expect.any(Boolean),
            maxStack: expect.any(Number),
        });
    });

    it('caps safe floors to one field item', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0]), 3);

        // Act
        const items = service.initializeFloor({
            floorNumber: 2,
            floorType: 'safe',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        });

        // Assert
        expect(items).toHaveLength(1);
    });

    it('does not spawn field items on boss floors', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0]), 3);

        // Act
        const items = service.initializeFloor({
            floorNumber: 100,
            floorType: 'boss',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        });

        // Assert
        expect(items).toEqual([]);
    });

    it('spawns elite reward drops at rare or better rarity', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0]), 3);

        // Act
        const reward = service.spawnRewardDrop({ x: 3, y: 3 }, 1, ITEM_RARITY.RARE);

        // Assert
        expect(reward.position).toEqual({ x: 3, y: 3 });
        expect(reward.definition.rarity).toBe(ITEM_RARITY.RARE);
        expect(reward.rarity).toBe(ITEM_RARITY.RARE);
        expect(reward.instanceId).toBe('item-reward-1');
        expect(service.getFieldItems()).toHaveLength(1);
    });

    it('rolls higher item rarities more often on deeper floors', () => {
        // Arrange
        const lowFloorService = new ItemService(new SequenceRandomSource([0.95, 0]), 1);
        const highFloorService = new ItemService(new SequenceRandomSource([0.95, 0]), 1);

        // Act
        const [lowFloorItem] = lowFloorService.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        const [highFloorItem] = highFloorService.initializeFloor({
            floorNumber: 100,
            ...singleRoomRequest,
        });

        // Assert
        expect(lowFloorItem?.rarity).toBe(ITEM_RARITY.RARE);
        expect(highFloorItem?.rarity).toBe(ITEM_RARITY.LEGENDARY);
    });

    it('scales equipment stat bonuses upward for higher rarities', () => {
        // Arrange
        const commonService = new ItemService(new SequenceRandomSource([0.1, 0.3]), 1);
        const legendaryService = new ItemService(new SequenceRandomSource([0.98, 0.13]), 1);

        // Act
        const [commonItem] = commonService.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        const [legendaryItem] = legendaryService.initializeFloor({
            floorNumber: 100,
            ...singleRoomRequest,
        });

        // Assert
        expect(commonItem?.definition.name).toBe('Iron Dagger');
        expect(commonItem?.definition.rarity).toBe(ITEM_RARITY.COMMON);
        expect(commonItem?.definition.equipment?.statModifier.attack).toBe(3);
        expect(legendaryItem?.definition.name).toBe('Iron Dagger');
        expect(legendaryItem?.definition.rarity).toBe(ITEM_RARITY.LEGENDARY);
        expect(legendaryItem?.definition.equipment?.statModifier.attack).toBeGreaterThan(
            commonItem?.definition.equipment?.statModifier.attack ?? 0,
        );
    });

    it('picks up stackable items and merges their inventory quantity', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0, 0, 0]), 1);

        // Act
        const firstFloorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        const firstPickup = service.pickupAt(firstFloorItems[0].position);

        const secondFloorItems = service.initializeFloor({
            floorNumber: 2,
            ...singleRoomRequest,
        });
        const secondPickup = service.pickupAt(secondFloorItems[0].position);

        // Assert
        expect(firstPickup?.status).toBe('picked');
        expect(firstPickup?.inventoryItem.name).toBe('Small Potion');
        expect(secondPickup?.status).toBe('picked');
        expect(secondPickup?.inventoryItem.quantity).toBe(2);
        expect(service.getInventory()).toHaveLength(1);
        expect(service.getFieldItems()).toEqual([]);
    });

    it('creates separate slots for non-stackable items', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.3, 0.3]), 1);

        // Act
        const firstFloorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(firstFloorItems[0].position);
        const secondFloorItems = service.initializeFloor({
            floorNumber: 2,
            ...singleRoomRequest,
        });
        service.pickupAt(secondFloorItems[0].position);

        // Assert
        expect(service.getInventory()).toHaveLength(2);
        expect(service.getInventory().every((item) => item.name === 'Iron Dagger')).toBe(true);
    });

    it('consumes a healing potion and decrements its stack', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0]), 1);
        const firstFloorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(firstFloorItems[0].position);
        const secondFloorItems = service.initializeFloor({
            floorNumber: 2,
            ...singleRoomRequest,
        });
        service.pickupAt(secondFloorItems[0].position);
        const potionId = service.getInventory()[0]?.instanceId ?? '';

        // Act
        const activation = service.activateItem(potionId);

        // Assert
        expect(activation).toMatchObject({
            status: 'consumed',
            healAmount: 30,
        });
        expect(service.getInventory()[0]?.quantity).toBe(1);
    });

    it('toggles equipment and returns additive stat modifiers', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.3]), 1);
        const floorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(floorItems[0].position);
        const equipmentId = service.getInventory()[0]?.instanceId ?? '';

        // Act
        const equipped = service.activateItem(equipmentId);
        const unequipped = service.activateItem(equipmentId);

        // Assert
        expect(equipped).toMatchObject({
            status: 'equipped',
            statModifier: {
                attack: 3,
            },
        });
        expect(unequipped).toMatchObject({
            status: 'unequipped',
            statModifier: {
                attack: -3,
            },
        });
        expect(service.getInventory()[0]?.isEquipped).toBe(false);
    });

    it('marks materials as not usable', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.7]), 1);
        const floorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(floorItems[0].position);
        const materialId = service.getInventory()[0]?.instanceId ?? '';

        // Act
        const activation = service.activateItem(materialId);

        // Assert
        expect(activation?.status).toBe('not-usable');
    });

    it('leaves the field item in place when a new slot would exceed capacity', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.3, 0.3]), 1, 1);
        const firstFloorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(firstFloorItems[0].position);
        const secondFloorItems = service.initializeFloor({
            floorNumber: 2,
            ...singleRoomRequest,
        });

        // Act
        const secondPickup = service.pickupAt(secondFloorItems[0].position);

        // Assert
        expect(secondPickup?.status).toBe('inventory-full');
        expect(secondPickup?.fieldItem?.definition.name).toBe('Iron Dagger');
        expect(service.getInventory()).toHaveLength(1);
        expect(service.getFieldItems()).toHaveLength(1);
    });

    it('drops the selected inventory item back onto the field', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0]), 1);
        const fieldItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        const pickup = service.pickupAt(fieldItems[0].position);

        // Act
        const drop = service.dropItem(pickup?.inventoryItem?.instanceId ?? '', { x: 3, y: 3 });

        // Assert
        expect(drop?.status).toBe('dropped');
        expect(drop?.fieldItem?.position).toEqual({ x: 3, y: 3 });
        expect(drop?.fieldItem?.definition.name).toBe('Small Potion');
        expect(service.getInventory()).toEqual([]);
        expect(service.getFieldItems()).toHaveLength(1);
    });

    it('clears inventory and field state when a new run starts', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0]), 1);
        const floorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        service.pickupAt(floorItems[0].position);

        // Act
        service.resetRun();

        // Assert
        expect(service.getInventory()).toEqual([]);
        expect(service.getFieldItems()).toEqual([]);
    });

    it('rejects dropping an equipped item', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.3]), 1);
        const floorItems = service.initializeFloor({
            floorNumber: 1,
            ...singleRoomRequest,
        });
        const pickup = service.pickupAt(floorItems[0].position);
        service.activateItem(pickup?.inventoryItem?.instanceId ?? '');

        // Act
        const drop = service.dropItem(pickup?.inventoryItem?.instanceId ?? '', { x: 3, y: 3 });

        // Assert
        expect(drop?.status).toBe('equipped-item');
        expect(service.getInventory()[0]?.isEquipped).toBe(true);
        expect(service.getFieldItems()).toEqual([]);
    });

    it('resets the field item sequence when a new floor is initialized', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0]), 1);

        // Act
        const firstFloorItems = service.initializeFloor({
            floorNumber: 3,
            ...singleRoomRequest,
        });
        const secondFloorItems = service.initializeFloor({
            floorNumber: 4,
            ...singleRoomRequest,
        });

        // Assert
        expect(firstFloorItems[0].instanceId).toBe('item-f3-1');
        expect(secondFloorItems[0].instanceId).toBe('item-f4-1');
    });

    it('rejects negative item limits', () => {
        // Arrange / Act / Assert
        expect(() => new ItemService(new SequenceRandomSource([0]), -1)).toThrow(
            'Item count must be zero or greater.',
        );
    });

    it('rejects negative inventory capacity', () => {
        // Arrange / Act / Assert
        expect(() => new ItemService(new SequenceRandomSource([0]), 1, -1)).toThrow(
            'Inventory capacity must be zero or greater.',
        );
    });

    it('restores persisted inventory state for continue flow', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0]), 1);

        // Act
        service.restoreInventory([
            {
                id: 'iron-dagger',
                instanceId: 'item-f3-1',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.RARE,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'A saved blade.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: {
                        attack: 4,
                    },
                },
                quantity: 1,
                isEquipped: true,
            },
        ]);

        // Assert
        expect(service.getInventory()).toEqual([
            expect.objectContaining({
                instanceId: 'item-load-1',
                name: 'Iron Dagger',
                rarity: ITEM_RARITY.RARE,
                isEquipped: true,
            }),
        ]);
    });
});
