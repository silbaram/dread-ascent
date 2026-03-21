import { describe, expect, it } from 'vitest';
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
            },
            experience: 55,
        },
        inventory: [
            {
                id: 'iron-dagger',
                instanceId: 'item-f7-1',
                name: 'Iron Dagger',
                type: 'EQUIPMENT',
                rarity: ITEM_RARITY.RARE,
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'A restored blade.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: {
                        attack: 4,
                    },
                },
                quantity: 1,
                isEquipped: true,
            },
        ],
        deck: [
            { id: 'card-1', name: 'Slash', type: 'ATTACK', power: 8 },
            { id: 'card-2', name: 'Thrust', type: 'ATTACK', power: 8 },
            { id: 'card-3', name: 'Shield Block', type: 'GUARD', power: 5 },
        ],
        defeatedEnemyCount: 12,
    };
}

describe('RunPersistenceService', () => {
    it('saves and reloads a persisted run snapshot', () => {
        // Arrange
        const storage = new MemoryStorage();
        const service = new RunPersistenceService(storage);

        // Act
        service.save(createSnapshot());
        const snapshot = service.load();

        // Assert
        expect(snapshot).toEqual(createSnapshot());
        expect(service.hasActiveRun()).toBe(true);
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
});
