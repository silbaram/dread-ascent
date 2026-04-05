import { describe, expect, it } from 'vitest';
import { ITEM_ID, ITEM_RARITY } from '../../../../src/domain/entities/Item';
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

    it('allows elite reward drops to roll epic items on deep floors', () => {
        const service = new ItemService(new SequenceRandomSource([0.95, 0]), 3);

        const reward = service.spawnEliteRewardDrop({ x: 3, y: 3 }, 100);

        expect(reward.definition.id).toBe(ITEM_ID.SOULFIRE_BRAND);
        expect(reward.definition.rarity).toBe(ITEM_RARITY.EPIC);
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
        const highFloorItem = highFloorService.spawnRewardDrop({ x: 2, y: 2 }, 100, ITEM_RARITY.RARE);

        // Assert
        expect(lowFloorItem?.rarity).toBe(ITEM_RARITY.COMMON);
        expect(highFloorItem?.rarity).toBe(ITEM_RARITY.EPIC);
    });

    it('selects exact catalog items instead of scaling a common template upward', () => {
        // Arrange
        const uncommonService = new ItemService(new SequenceRandomSource([0.7, 0]), 1);
        const epicService = new ItemService(new SequenceRandomSource([0.95, 0]), 1);

        // Act
        const [uncommonItem] = uncommonService.initializeFloor({
            floorNumber: 10,
            ...singleRoomRequest,
        });
        const epicItem = epicService.spawnRewardDrop({ x: 2, y: 2 }, 100, ITEM_RARITY.RARE);

        // Assert
        expect(uncommonItem?.definition.id).toBe('blood-fang');
        expect(uncommonItem?.definition.rarity).toBe(ITEM_RARITY.UNCOMMON);
        expect(uncommonItem?.definition.equipment?.statModifier.attack).toBe(2);
        expect(epicItem.definition.id).toBe('soulfire-brand');
        expect(epicItem.definition.rarity).toBe(ITEM_RARITY.EPIC);
        expect(epicItem.definition.equipment?.statModifier.attack).toBe(6);
    });

    it('keeps legacy moonsteel saber out of the general uncommon reward pool', () => {
        const service = new ItemService(new SequenceRandomSource([0, 0.99]), 1);

        const reward = service.spawnRewardDrop({ x: 2, y: 2 }, 10, ITEM_RARITY.UNCOMMON);

        expect(reward.definition.id).toBe(ITEM_ID.SILENT_STEPS);
        expect(reward.definition.id).not.toBe(ITEM_ID.MOONSTEEL_SABER);
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
        expect(service.getInventory().every((item) => item.quantity === 1)).toBe(true);
        expect(service.getInventory().every((item) => item.stackable === false)).toBe(true);
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
                attack: 2,
            },
        });
        expect(unequipped).toMatchObject({
            status: 'unequipped',
            statModifier: {
                attack: -2,
            },
        });
        expect(service.getInventory()[0]?.isEquipped).toBe(false);
    });

    it('marks materials as not usable', () => {
        // Arrange
        const service = new ItemService(new SequenceRandomSource([0.1]), 1);
        service.restoreInventory([
            {
                id: 'scrap-bundle',
                instanceId: 'item-f1-1',
                name: 'Scrap Bundle',
                type: 'MATERIAL',
                rarity: ITEM_RARITY.COMMON,
                icon: '*',
                stackable: true,
                maxStack: 10,
                quantity: 1,
                description: 'Loose salvaged parts.',
                isEquipped: false,
            },
        ]);
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
        expect(secondPickup?.fieldItem?.definition.name).toBe('Bone Club');
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
                instanceId: 'item-f3-1',
                name: 'Iron Dagger',
                rarity: ITEM_RARITY.RARE,
                isEquipped: true,
            }),
        ]);
    });

    it('shifts a small portion of common drop weight into uncommon when worn sandals are equipped', () => {
        // Arrange
        const baselineService = new ItemService(new SequenceRandomSource([0.64, 0]), 1);
        const boostedService = new ItemService(new SequenceRandomSource([0.64, 0]), 1);
        boostedService.restoreInventory([
            {
                id: 'worn-sandals',
                instanceId: 'item-f3-1',
                name: 'Worn Sandals',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: 'v',
                stackable: false,
                maxStack: 1,
                description: 'Boost uncommon item drops a little.',
                equipment: {
                    slot: 'BOOTS',
                    statModifier: {},
                },
                quantity: 1,
                isEquipped: true,
            },
        ]);

        // Act
        const baselineReward = baselineService.spawnRewardDrop({ x: 2, y: 2 }, 10, ITEM_RARITY.COMMON);
        const boostedReward = boostedService.spawnRewardDrop({ x: 2, y: 2 }, 10, ITEM_RARITY.COMMON);

        // Assert
        expect(baselineReward.definition.rarity).toBe(ITEM_RARITY.COMMON);
        expect(boostedReward.definition.rarity).toBe(ITEM_RARITY.UNCOMMON);
    });

    it('does not unlock uncommon drops before floor 10 when worn sandals are equipped', () => {
        const service = new ItemService(new SequenceRandomSource([0.99, 0]), 1);
        service.restoreInventory([
            {
                id: 'worn-sandals',
                instanceId: 'item-f1-1',
                name: 'Worn Sandals',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: 'v',
                stackable: false,
                maxStack: 1,
                description: 'Boost uncommon item drops a little.',
                equipment: {
                    slot: 'BOOTS',
                    statModifier: {},
                },
                quantity: 1,
                isEquipped: true,
            },
        ]);

        const reward = service.spawnRewardDrop({ x: 1, y: 1 }, 1, ITEM_RARITY.COMMON);

        expect(reward.definition.rarity).toBe(ITEM_RARITY.COMMON);
    });

    it('grants cursed special rewards directly into inventory without spawning a field item', () => {
        const service = new ItemService(new SequenceRandomSource([0]), 1);

        const reward = service.grantSpecialReward(25);

        expect(reward).toMatchObject({
            status: 'granted',
            rewardItem: {
                instanceId: 'item-special-1',
                id: ITEM_ID.CURSED_EDGE,
                rarity: ITEM_RARITY.CURSED,
            },
        });
        expect(service.getFieldItems()).toEqual([]);
        expect(service.getInventory()).toHaveLength(1);
    });

    it('unlocks epic special rewards from floor 50 onward without selecting legacy sunfire idol', () => {
        const service = new ItemService(new SequenceRandomSource([0.3]), 1);

        const reward = service.grantSpecialReward(50);

        expect(reward).toMatchObject({
            status: 'granted',
            rewardItem: {
                rarity: ITEM_RARITY.EPIC,
            },
        });
        expect([
            ITEM_ID.SOULFIRE_BRAND,
            ITEM_ID.ALL_SEEING_CROWN,
            ITEM_ID.BASTION_ARMOR,
            ITEM_ID.PHANTOM_STRIDE,
        ]).toContain(reward.rewardItem?.id);
        expect(reward.rewardItem?.id).not.toBe(ITEM_ID.SUNFIRE_IDOL);
    });

    it('returns inventory-full when a special reward cannot be granted', () => {
        const service = new ItemService(new SequenceRandomSource([0]), 1, 1);
        service.restoreInventory([
            {
                id: 'iron-dagger',
                instanceId: 'item-f1-1',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'A full inventory test item.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: {
                        attack: 2,
                    },
                },
                quantity: 1,
                isEquipped: false,
            },
        ]);

        const reward = service.grantSpecialReward(25);

        expect(reward).toEqual({
            status: 'inventory-full',
        });
        expect(service.getInventory()).toHaveLength(1);
        expect(service.getFieldItems()).toEqual([]);
    });

    it('opens bronze sigils into three cursed reward choices instead of granting immediately', () => {
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0, 0, 0, 0, 0]), 1);
        service.restoreInventory([
            {
                id: ITEM_ID.BRONZE_SIGIL,
                instanceId: 'bronze-1',
                name: 'Bronze Sigil',
                type: 'KEY',
                rarity: ITEM_RARITY.COMMON,
                icon: '?',
                stackable: false,
                maxStack: 1,
                quantity: 1,
                description: 'Break the seal to reveal a special cache.',
                isEquipped: false,
            },
        ]);

        const reward = service.openSpecialReward('bronze-1', 25);

        expect(reward).toMatchObject({
            status: 'opened',
            rewardChoices: [
                expect.objectContaining({ rarity: ITEM_RARITY.CURSED }),
                expect.objectContaining({ rarity: ITEM_RARITY.CURSED }),
                expect.objectContaining({ rarity: ITEM_RARITY.CURSED }),
            ],
        });
        expect(reward?.rewardChoices).toHaveLength(3);
        expect(new Set(reward?.rewardChoices?.map((item) => item.id)).size).toBe(3);
        expect(service.getInventory()).toEqual([]);
        expect(service.getFieldItems()).toEqual([]);
    });

    it('builds boss reward choices from the boss special reward pool', () => {
        const service = new ItemService(new SequenceRandomSource([0, 0, 0, 0, 0, 0, 0, 0]), 1);

        const choices = service.createSpecialRewardChoices(100, 'boss');

        expect(choices).toHaveLength(3);
        expect(new Set(choices.map((item) => item.id)).size).toBe(3);
        expect(choices.every((item) =>
            item.rarity === ITEM_RARITY.CURSED
            || item.rarity === ITEM_RARITY.EPIC,
        )).toBe(true);
    });

    it('grants a guaranteed boss reward from the rare or epic reward pool', () => {
        const service = new ItemService(new SequenceRandomSource([0.75, 0]), 1);

        const reward = service.grantBossReward(100);

        expect(reward).toMatchObject({
            status: 'granted',
            rewardItem: {
                rarity: ITEM_RARITY.EPIC,
            },
        });
        expect([
            ITEM_ID.SOULFIRE_BRAND,
            ITEM_ID.ALL_SEEING_CROWN,
            ITEM_ID.BASTION_ARMOR,
            ITEM_ID.PHANTOM_STRIDE,
        ]).toContain(reward.rewardItem?.id);
        expect(service.getFieldItems()).toEqual([]);
        expect(service.getInventory()).toHaveLength(1);
    });

    it('still grants the guaranteed boss reward when the inventory is already full', () => {
        const service = new ItemService(new SequenceRandomSource([0.75, 0]), 1, 1);
        service.restoreInventory([
            {
                id: ITEM_ID.IRON_DAGGER,
                instanceId: 'item-f1-1',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'ATK +2.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 2 },
                },
                quantity: 1,
                isEquipped: false,
            },
        ]);

        const reward = service.grantBossReward(100);

        expect(reward).toMatchObject({
            status: 'granted',
            rewardItem: {
                rarity: ITEM_RARITY.EPIC,
            },
        });
        expect(service.getInventory()).toHaveLength(2);
    });

    it('loses one unequipped inventory item on escape without touching equipped gear', () => {
        const service = new ItemService(new SequenceRandomSource([0]), 1);
        service.restoreInventory([
            {
                id: ITEM_ID.IRON_DAGGER,
                instanceId: 'equipped-weapon',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'ATK +2.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 2 },
                },
                quantity: 1,
                isEquipped: true,
            },
            {
                id: ITEM_ID.SMALL_POTION,
                instanceId: 'potion-1',
                name: 'Small Potion',
                type: 'CONSUMABLE',
                rarity: ITEM_RARITY.COMMON,
                icon: '!',
                stackable: true,
                maxStack: 5,
                description: 'Recover HP.',
                consumableEffect: {
                    kind: 'heal',
                    amount: 30,
                },
                quantity: 2,
                isEquipped: false,
            },
        ]);

        const lostItem = service.loseRandomInventoryItem();

        expect(lostItem).toEqual({
            status: 'lost',
            item: expect.objectContaining({
                id: ITEM_ID.SMALL_POTION,
                quantity: 1,
            }),
        });
        expect(service.getInventory()).toEqual([
            expect.objectContaining({ instanceId: 'equipped-weapon', isEquipped: true }),
            expect.objectContaining({ instanceId: 'potion-1', quantity: 1 }),
        ]);
    });

    it('marks legacy non-primary equipment as unequipped when inventory is restored', () => {
        const service = new ItemService(new SequenceRandomSource([0]), 1);
        service.restoreInventory([
            {
                id: 'sunfire-idol',
                instanceId: 'legacy-trinket-1',
                name: 'Sunfire Idol',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.EPIC,
                icon: '&',
                stackable: false,
                maxStack: 1,
                description: 'A legacy trinket.',
                equipment: {
                    slot: 'TRINKET',
                    statModifier: {
                        attack: 2,
                    },
                    passives: [{ kind: 'legacy-bonus', value: 1 }],
                },
                quantity: 1,
                isEquipped: true,
            },
        ]);

        const [restoredItem] = service.getInventory();

        expect(restoredItem?.isEquipped).toBe(false);
        expect(restoredItem?.equipment?.passives).toEqual([{ kind: 'legacy-bonus', value: 1 }]);
    });

    it('rejects equipping legacy non-primary slot items', () => {
        const service = new ItemService(new SequenceRandomSource([0]), 1);
        service.restoreInventory([
            {
                id: 'sunfire-idol',
                instanceId: 'legacy-trinket-1',
                name: 'Sunfire Idol',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.EPIC,
                icon: '&',
                stackable: false,
                maxStack: 1,
                description: 'A legacy trinket.',
                equipment: {
                    slot: 'TRINKET',
                    statModifier: {
                        attack: 2,
                    },
                },
                quantity: 1,
                isEquipped: false,
            },
        ]);

        const activation = service.activateItem('legacy-trinket-1');

        expect(activation?.status).toBe('not-usable');
        expect(service.getInventory()[0]?.isEquipped).toBe(false);
    });
});
