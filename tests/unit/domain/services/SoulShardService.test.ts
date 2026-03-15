import { describe, expect, it } from 'vitest';
import {
    SOUL_SHARDS_PER_DEFEATED_ENEMY,
    SOUL_SHARDS_PER_FLOOR,
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

describe('SoulShardService', () => {
    it('calculates reward from floor and defeated enemies', () => {
        // Arrange
        const service = new SoulShardService(new MemoryStorage());

        // Act
        const reward = service.calculateReward({
            floorNumber: 4,
            defeatedEnemies: 3,
        });

        // Assert
        expect(reward).toBe((4 * SOUL_SHARDS_PER_FLOOR) + (3 * SOUL_SHARDS_PER_DEFEATED_ENEMY));
    });

    it('awards and persists cumulative soul shards', () => {
        // Arrange
        const storage = new MemoryStorage();
        const service = new SoulShardService(storage);

        // Act
        const firstAward = service.awardSoulShards({
            floorNumber: 2,
            defeatedEnemies: 1,
        });
        const secondAward = service.awardSoulShards({
            floorNumber: 1,
            defeatedEnemies: 0,
        });

        // Assert
        expect(firstAward).toMatchObject({
            earnedSoulShards: 23,
            totalSoulShards: 23,
        });
        expect(secondAward).toMatchObject({
            earnedSoulShards: 10,
            totalSoulShards: 33,
        });
        expect(service.getTotalSoulShards()).toBe(33);
    });

    it('treats invalid stored values as zero', () => {
        // Arrange
        const storage = new MemoryStorage();
        storage.setItem('dread-ascent.soul-shards', 'not-a-number');
        const service = new SoulShardService(storage);

        // Act / Assert
        expect(service.getTotalSoulShards()).toBe(0);
    });

    it('spends stored soul shards when there is enough currency', () => {
        // Arrange
        const storage = new MemoryStorage();
        const service = new SoulShardService(storage);
        service.awardSoulShards({
            floorNumber: 3,
            defeatedEnemies: 0,
        });

        // Act
        const result = service.spendSoulShards(12);

        // Assert
        expect(result).toEqual({
            status: 'spent',
            spentSoulShards: 12,
            totalSoulShards: 18,
        });
        expect(service.getTotalSoulShards()).toBe(18);
    });
});
