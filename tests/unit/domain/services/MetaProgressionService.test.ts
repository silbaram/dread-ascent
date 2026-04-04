import { describe, expect, it } from 'vitest';
import { MetaProgressionService } from '../../../../src/domain/services/MetaProgressionService';
import {
    SOUL_SHARD_STORAGE_KEY,
    SoulShardService,
    type StorageLike,
} from '../../../../src/domain/services/SoulShardService';

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

describe('MetaProgressionService', () => {
    it('builds upgraded run-start stats from persisted meta levels', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem('dread-ascent.meta-progression', JSON.stringify({
            maxHealth: 2,
            attack: 1,
            defense: 3,
        }));
        const soulShardService = new SoulShardService(storage);
        const service = new MetaProgressionService(soulShardService, storage);

        // Act
        const stats = service.getRunStartStats();

        // Assert
        expect(stats).toEqual({
            health: 120,
            maxHealth: 120,
            attack: 12,
            defense: 8,
            movementSpeed: 100,
        });
    });

    it('purchases an upgrade, spends soul shards, and persists the new level', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem(SOUL_SHARD_STORAGE_KEY, '60');
        const soulShardService = new SoulShardService(storage);
        const service = new MetaProgressionService(soulShardService, storage);

        // Act
        const result = service.purchaseUpgrade('maxHealth');
        const snapshot = service.getSnapshot();

        // Assert
        expect(result.status).toBe('purchased');
        expect(result.cost).toBe(20);
        expect(result.totalSoulShards).toBe(40);
        expect(result.upgrade.level).toBe(1);
        expect(result.upgrade.currentValue).toBe(110);
        expect(snapshot.totalSoulShards).toBe(40);
        expect(snapshot.upgrades.find((upgrade) => upgrade.key === 'maxHealth')).toMatchObject({
            level: 1,
            currentValue: 110,
            nextValue: 120,
            cost: 30,
            affordable: true,
        });
    });

    it('rejects purchases when soul shards are insufficient', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem(SOUL_SHARD_STORAGE_KEY, '9');
        const soulShardService = new SoulShardService(storage);
        const service = new MetaProgressionService(soulShardService, storage);

        // Act
        const result = service.purchaseUpgrade('attack');

        // Assert
        expect(result).toMatchObject({
            status: 'insufficient-funds',
            cost: 25,
            totalSoulShards: 9,
            missingSoulShards: 16,
        });
        expect(result.upgrade.level).toBe(0);
        expect(result.upgrade.affordable).toBe(false);
        expect(soulShardService.getTotalSoulShards()).toBe(9);
    });

    it('falls back to default levels when persisted meta data is invalid', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem('dread-ascent.meta-progression', 'broken-json');
        const soulShardService = new SoulShardService(storage);
        const service = new MetaProgressionService(soulShardService, storage);

        // Act
        const snapshot = service.getSnapshot();

        // Assert
        expect(snapshot.upgrades).toMatchObject([
            { key: 'maxHealth', level: 0, currentValue: 100 },
            { key: 'attack', level: 0, currentValue: 10 },
            { key: 'defense', level: 0, currentValue: 5 },
        ]);
    });
});
