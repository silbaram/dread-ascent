export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface SoulShardAwardRequest {
    floorNumber: number;
    defeatedEnemies: number;
}

export interface SoulShardAwardSummary extends SoulShardAwardRequest {
    earnedSoulShards: number;
    totalSoulShards: number;
}

export interface SoulShardSpendResult {
    status: 'spent' | 'insufficient-funds';
    spentSoulShards: number;
    totalSoulShards: number;
}

export const SOUL_SHARD_STORAGE_KEY = 'dread-ascent.soul-shards';
export const SOUL_SHARDS_PER_FLOOR = 10;
export const SOUL_SHARDS_PER_DEFEATED_ENEMY = 3;

export class SoulShardService {
    constructor(
        private readonly storage: StorageLike | undefined = globalThis.localStorage,
        private readonly storageKey = SOUL_SHARD_STORAGE_KEY,
    ) {}

    getTotalSoulShards() {
        if (!this.storage) {
            return 0;
        }

        const rawValue = this.storage.getItem(this.storageKey);
        if (!rawValue) {
            return 0;
        }

        const parsedValue = Number.parseInt(rawValue, 10);
        return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
    }

    awardSoulShards(request: SoulShardAwardRequest): SoulShardAwardSummary {
        const earnedSoulShards = this.calculateReward(request);
        const totalSoulShards = this.getTotalSoulShards() + earnedSoulShards;
        this.setTotalSoulShards(totalSoulShards);

        return {
            ...request,
            earnedSoulShards,
            totalSoulShards,
        };
    }

    spendSoulShards(amount: number): SoulShardSpendResult {
        const spentSoulShards = Math.max(0, amount);
        const totalSoulShards = this.getTotalSoulShards();
        if (totalSoulShards < spentSoulShards) {
            return {
                status: 'insufficient-funds',
                spentSoulShards: 0,
                totalSoulShards,
            };
        }

        const remainingSoulShards = totalSoulShards - spentSoulShards;
        this.setTotalSoulShards(remainingSoulShards);

        return {
            status: 'spent',
            spentSoulShards,
            totalSoulShards: remainingSoulShards,
        };
    }

    calculateReward(request: SoulShardAwardRequest) {
        const floorReward = Math.max(0, request.floorNumber) * SOUL_SHARDS_PER_FLOOR;
        const enemyReward = Math.max(0, request.defeatedEnemies) * SOUL_SHARDS_PER_DEFEATED_ENEMY;

        return floorReward + enemyReward;
    }

    private setTotalSoulShards(totalSoulShards: number) {
        this.storage?.setItem(this.storageKey, `${Math.max(0, totalSoulShards)}`);
    }
}
