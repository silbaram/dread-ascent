import { describe, expect, it } from 'vitest';
import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
} from '../../../../src/domain/entities/Card';
import { ITEM_RARITY } from '../../../../src/domain/entities/Item';
import {
    RunPersistenceService,
    RUN_PERSISTENCE_STORAGE_KEY,
    type RunPersistenceSnapshot,
} from '../../../../src/domain/services/RunPersistenceService';
import type { StorageLike } from '../../../../src/domain/services/SoulShardService';

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

function createSnapshot(): RunPersistenceSnapshot {
    return {
        status: 'active',
        floor: {
            number: 7,
            type: 'safe',
        },
        player: {
            stats: {
                health: 84,
                maxHealth: 110,
                attack: 14,
                defense: 8,
                movementSpeed: 100,
            },
            experience: 55,
        },
        inventory: [
            {
                id: 'iron-dagger',
                instanceId: 'item-f7-1',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.COMMON,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'A light blade with ATK +2.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: {
                        attack: 2,
                    },
                },
                quantity: 1,
                isEquipped: true,
            },
        ],
        deck: [
            {
                id: 'card-1',
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 6,
                cost: 1,
                keywords: [],
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                rarity: CARD_RARITY.COMMON,
            },
            {
                id: 'card-2',
                name: 'Weaken',
                type: CARD_TYPE.ATTACK,
                power: 0,
                cost: 1,
                keywords: [],
                effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
                rarity: CARD_RARITY.COMMON,
                statusEffect: {
                    type: 'VULNERABLE',
                    duration: 2,
                },
            },
            {
                id: 'card-3',
                name: 'Last Stand',
                type: CARD_TYPE.ATTACK,
                power: 30,
                cost: 3,
                keywords: [CARD_KEYWORD.RETAIN],
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                rarity: CARD_RARITY.RARE,
                condition: {
                    type: 'HP_THRESHOLD',
                    value: 5,
                },
            },
            {
                id: 'card-4',
                name: 'Blood Price',
                type: CARD_TYPE.SKILL,
                power: 0,
                cost: 1,
                keywords: [],
                effectType: CARD_EFFECT_TYPE.DRAW,
                rarity: CARD_RARITY.UNCOMMON,
                archetype: CARD_ARCHETYPE.BLOOD_OATH,
                effectPayload: {
                    drawCount: 2,
                    selfDamage: 4,
                },
            },
        ],
        defeatedEnemyCount: 12,
        pendingBattleStartEnergy: 2,
    };
}

describe('RunPersistenceService', () => {
    it('saves and reloads a persisted run snapshot', () => {
        // Arrange
        const storage = new MemoryStorage();
        const saveService = new RunPersistenceService(storage);

        // Act
        saveService.save(createSnapshot());
        const service = new RunPersistenceService(storage);
        const snapshot = service.load();

        // Assert
        expect(snapshot).toBeDefined();
        expect(snapshot).toMatchObject({
            ...createSnapshot(),
            deck: expect.arrayContaining([
                expect.objectContaining({ id: 'card-1', name: 'Strike', type: CARD_TYPE.ATTACK }),
                expect.objectContaining({
                    id: 'card-2',
                    name: 'Weaken',
                    statusEffect: { type: 'VULNERABLE', duration: 2 },
                }),
                expect.objectContaining({
                    id: 'card-4',
                    name: 'Blood Price',
                    type: CARD_TYPE.SKILL,
                    effectPayload: { drawCount: 2, selfDamage: 4 },
                }),
            ]),
        });
        expect(snapshot?.deck).toHaveLength(createSnapshot().deck.length);
        expect(service.hasActiveRun()).toBe(true);
    });

    it('preserves a pending special reward offer across save and load', () => {
        const storage = new MemoryStorage();
        const saveService = new RunPersistenceService(storage);

        saveService.save({
            ...createSnapshot(),
            pendingSpecialRewardOffer: {
                sourceType: 'cache',
                keyItemId: 'bronze-sigil',
                offeredItemIds: ['cursed-edge', 'runic-blindfold'],
            },
        });

        const service = new RunPersistenceService(storage);
        const snapshot = service.load();

        expect(snapshot?.pendingSpecialRewardOffer).toEqual({
            sourceType: 'cache',
            keyItemId: 'bronze-sigil',
            offeredItemIds: ['cursed-edge', 'runic-blindfold'],
        });
    });

    it('preserves boss reward offers across save and load', () => {
        const storage = new MemoryStorage();
        const saveService = new RunPersistenceService(storage);

        saveService.save({
            ...createSnapshot(),
            pendingSpecialRewardOffer: {
                sourceType: 'boss',
                bossArchetypeId: 'final-boss',
                offeredItemIds: ['cursed-edge', 'soulfire-brand'],
            },
        });

        const service = new RunPersistenceService(storage);
        const snapshot = service.load();

        expect(snapshot?.pendingSpecialRewardOffer).toEqual({
            sourceType: 'boss',
            bossArchetypeId: 'final-boss',
            offeredItemIds: ['cursed-edge', 'soulfire-brand'],
        });
    });

    it('preserves legacy boss reward offers without a boss archetype id', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            pendingSpecialRewardOffer: {
                sourceType: 'boss',
                offeredItemIds: ['cursed-edge', 'soulfire-brand'],
            },
        }));

        const service = new RunPersistenceService(storage);
        const snapshot = service.load();

        expect(snapshot?.pendingSpecialRewardOffer).toEqual({
            sourceType: 'boss',
            offeredItemIds: ['cursed-edge', 'soulfire-brand'],
        });
    });

    it('drops invalid pending special reward offers during load normalization', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            pendingSpecialRewardOffer: {
                sourceType: 'cache',
                keyItemId: 'not-a-real-key',
                offeredItemIds: ['small-potion', 'missing-item', 'cursed-edge'],
            },
        }));

        const service = new RunPersistenceService(storage);
        const snapshot = service.load();

        expect(snapshot?.pendingSpecialRewardOffer).toBeUndefined();
    });

    it('ignores corrupt persisted data', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, 'broken-json');
        const service = new RunPersistenceService(storage);

        // Act / Assert
        expect(service.load()).toBeUndefined();
        expect(service.hasActiveRun()).toBe(false);
    });

    it('does not report ended runs as continuable', () => {
        // Arrange
        const storage = new MemoryStorage();
        const service = new RunPersistenceService(storage);

        // Act
        service.save({
            ...createSnapshot(),
            status: 'game-over',
        });

        // Assert
        expect(service.load()?.status).toBe('game-over');
        expect(service.hasActiveRun()).toBe(false);
    });

    it('defaults missing movementSpeed from older save data to the baseline value', () => {
        // Arrange
        const storage = new MemoryStorage();
        const legacySnapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...legacySnapshot,
            player: {
                ...legacySnapshot.player,
                stats: {
                    health: legacySnapshot.player.stats.health,
                    maxHealth: legacySnapshot.player.stats.maxHealth,
                    attack: legacySnapshot.player.stats.attack,
                    defense: legacySnapshot.player.stats.defense,
                },
            },
        }));
        const service = new RunPersistenceService(storage);

        // Act
        const snapshot = service.load();

        // Assert
        expect(snapshot?.player.stats.movementSpeed).toBe(100);
        expect(service.hasActiveRun()).toBe(true);
    });

    it('maps legacy item rarity and slot values into the new equipment model', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            inventory: [
                {
                    id: 'warden-plate',
                    instanceId: 'legacy-item-1',
                    name: 'Legacy Plate',
                    type: 'EQUIPMENT',
                    rarity: 'LEGENDARY',
                    icon: ']',
                    stackable: false,
                    maxStack: 1,
                    description: 'A migrated armor piece.',
                    equipment: {
                        slot: 'ARMOR',
                        statModifier: {
                            defense: 4,
                        },
                    },
                    quantity: 1,
                    isEquipped: true,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const snapshot = service.load();

        expect(snapshot?.inventory[0]).toMatchObject({
            id: 'warden-plate',
            rarity: ITEM_RARITY.RARE,
            equipment: {
                slot: 'BODY_ARMOR',
                statModifier: {
                    defense: 4,
                },
            },
        });
    });

    it('preserves stored equipment passives during load normalization', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            inventory: [
                {
                    id: 'blood-fang',
                    instanceId: 'passive-item-1',
                    name: 'Blood Fang',
                    type: 'EQUIPMENT',
                    rarity: ITEM_RARITY.UNCOMMON,
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'A passive test item.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: {
                            attack: 2,
                        },
                        passives: [
                            { kind: 'self-damage-attack', value: 3 },
                        ],
                    },
                    quantity: 1,
                    isEquipped: true,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const snapshot = service.load();

        expect(snapshot?.inventory[0]?.equipment?.passives).toEqual([
            { kind: 'self-damage-attack', value: 3 },
        ]);
    });

    it('forces legacy non-primary slot items to load unequipped', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            inventory: [
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
                            maxHealth: 20,
                            attack: 2,
                        },
                    },
                    quantity: 1,
                    isEquipped: true,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const snapshot = service.load();

        expect(snapshot?.inventory[0]).toMatchObject({
            id: 'sunfire-idol',
            isEquipped: false,
            equipment: {
                slot: 'TRINKET',
            },
        });
    });

    it('removes legacy non-primary equipped stat bonuses from persisted player stats', () => {
        const storage = new MemoryStorage();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...createSnapshot(),
            player: {
                stats: {
                    health: 125,
                    maxHealth: 130,
                    attack: 16,
                    defense: 8,
                    movementSpeed: 100,
                },
                experience: 55,
            },
            inventory: [
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
                            maxHealth: 20,
                            attack: 2,
                        },
                    },
                    quantity: 1,
                    isEquipped: true,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const snapshot = service.load();

        expect(snapshot?.player.stats).toMatchObject({
            health: 110,
            maxHealth: 110,
            attack: 14,
            defense: 8,
            movementSpeed: 100,
        });
        expect(snapshot?.inventory[0]?.isEquipped).toBe(false);
    });

    it('drops invalid expanded card enums while keeping valid legacy cards', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...snapshot,
            deck: [
                ...snapshot.deck,
                {
                    id: 'card-invalid',
                    name: 'Broken Card',
                    type: 'NOT_A_REAL_TYPE',
                    power: 1,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck).toHaveLength(snapshot.deck.length);
        expect(loaded?.deck.at(-1)?.name).toBe('Blood Price');
    });

    it('defaults missing optional card fields when loading legacy card entries', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...snapshot,
            deck: [
                {
                    id: 'legacy-attack',
                    name: 'Legacy Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 8,
                },
                {
                    id: 'card-invalid',
                    name: 'Broken Legacy',
                    power: 2,
                    type: 'INVALID_TYPE',
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck).toHaveLength(1);
        expect(loaded?.deck[0]).toMatchObject({
            id: 'legacy-attack',
            name: 'Legacy Strike',
            type: CARD_TYPE.ATTACK,
            power: 8,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
            archetype: CARD_ARCHETYPE.NEUTRAL,
            keywords: [],
        });
    });

    it('loads legacy snapshots without deck field as empty deck', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        const { deck, ...snapshotWithoutDeck } = snapshot;

        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify(snapshotWithoutDeck));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck).toEqual([]);
        expect(service.hasActiveRun()).toBe(true);
    });

    it('reconstructs derived expanded card fields from persisted payload data', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...snapshot,
            deck: [
                {
                    id: 'shadow-cloak',
                    name: 'Shadow Cloak',
                    type: CARD_TYPE.GUARD,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    rarity: CARD_RARITY.UNCOMMON,
                    archetype: CARD_ARCHETYPE.SHADOW_ARTS,
                    effectPayload: { drawCount: 1 },
                },
                {
                    id: 'blood-shield',
                    name: 'Blood Shield',
                    type: CARD_TYPE.GUARD,
                    power: 12,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    rarity: CARD_RARITY.UNCOMMON,
                    archetype: CARD_ARCHETYPE.BLOOD_OATH,
                    effectPayload: { selfDamage: 3 },
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck[0]).toMatchObject({
            name: 'Shadow Cloak',
            drawCount: 1,
            effectPayload: { drawCount: 1 },
        });
        expect(loaded?.deck[1]).toMatchObject({
            name: 'Blood Shield',
            selfDamage: 3,
            effectPayload: { selfDamage: 3 },
        });
    });

    it('uses type-specific default effect types for legacy expanded cards', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...snapshot,
            deck: [
                {
                    id: 'legacy-skill',
                    name: 'Legacy Skill',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                },
                {
                    id: 'legacy-power',
                    name: 'Legacy Power',
                    type: CARD_TYPE.POWER,
                    power: 0,
                },
                {
                    id: 'legacy-curse',
                    name: 'Legacy Curse',
                    type: CARD_TYPE.CURSE,
                    power: 0,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck.map((card) => card.effectType)).toEqual([
            CARD_EFFECT_TYPE.DRAW,
            CARD_EFFECT_TYPE.BUFF,
            CARD_EFFECT_TYPE.CONDITIONAL,
        ]);
    });

    it('drops cards with invalid nested payload enums instead of loading corrupted effects', () => {
        const storage = new MemoryStorage();
        const snapshot = createSnapshot();
        storage.setItem(RUN_PERSISTENCE_STORAGE_KEY, JSON.stringify({
            ...snapshot,
            deck: [
                {
                    id: 'broken-buff',
                    name: 'Broken Buff',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    effectPayload: {
                        buff: { type: 'NOT_REAL', value: 2, target: 'SELF' },
                    },
                },
                {
                    id: 'broken-scaling',
                    name: 'Broken Scaling',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    effectPayload: {
                        scaling: { source: 'NOPE', multiplier: 2 },
                    },
                },
                {
                    id: 'valid-card',
                    name: 'Valid Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 7,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                },
            ],
        }));
        const service = new RunPersistenceService(storage);

        const loaded = service.load();

        expect(loaded?.deck).toHaveLength(1);
        expect(loaded?.deck[0].name).toBe('Valid Strike');
    });
});
