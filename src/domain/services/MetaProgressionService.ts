import {
    BASE_PLAYER_STATS,
    cloneCombatStats,
    type CombatStats,
} from '../entities/CombatStats';
import { SoulShardService, type StorageLike } from './SoulShardService';

export type PermanentUpgradeKey = 'maxHealth' | 'attack' | 'defense';

interface UpgradeLevelState {
    maxHealth: number;
    attack: number;
    defense: number;
}

interface PermanentUpgradeDefinition {
    readonly key: PermanentUpgradeKey;
    readonly label: string;
    readonly statLabel: 'HP' | 'ATK' | 'DEF';
    readonly description: string;
    readonly bonusPerLevel: number;
    readonly baseCost: number;
    readonly costStep: number;
}

export interface MetaUpgradeSnapshot {
    key: PermanentUpgradeKey;
    label: string;
    statLabel: 'HP' | 'ATK' | 'DEF';
    description: string;
    level: number;
    currentValue: number;
    nextValue: number;
    bonusPerLevel: number;
    cost: number;
    affordable: boolean;
}

export interface MetaProgressionSnapshot {
    totalSoulShards: number;
    upgrades: MetaUpgradeSnapshot[];
}

export interface MetaUpgradePurchaseResult {
    status: 'purchased' | 'insufficient-funds';
    upgrade: MetaUpgradeSnapshot;
    totalSoulShards: number;
    cost: number;
    missingSoulShards?: number;
}

export const META_PROGRESSION_STORAGE_KEY = 'dread-ascent.meta-progression';

const DEFAULT_LEVELS: UpgradeLevelState = {
    maxHealth: 0,
    attack: 0,
    defense: 0,
};

const UPGRADE_DEFINITIONS: Record<PermanentUpgradeKey, PermanentUpgradeDefinition> = {
    maxHealth: {
        key: 'maxHealth',
        label: 'Vitality',
        statLabel: 'HP',
        description: 'Raise starting HP by 10.',
        bonusPerLevel: 10,
        baseCost: 20,
        costStep: 10,
    },
    attack: {
        key: 'attack',
        label: 'Ferocity',
        statLabel: 'ATK',
        description: 'Raise starting attack by 2.',
        bonusPerLevel: 2,
        baseCost: 25,
        costStep: 15,
    },
    defense: {
        key: 'defense',
        label: 'Bulwark',
        statLabel: 'DEF',
        description: 'Raise starting defense by 1.',
        bonusPerLevel: 1,
        baseCost: 20,
        costStep: 12,
    },
};

export class MetaProgressionService {
    constructor(
        private readonly soulShardService = new SoulShardService(),
        private readonly storage: StorageLike | undefined = globalThis.localStorage,
        private readonly storageKey = META_PROGRESSION_STORAGE_KEY,
    ) {}

    getSnapshot(): MetaProgressionSnapshot {
        const levels = this.getStoredLevels();
        return this.buildSnapshot(levels, this.soulShardService.getTotalSoulShards());
    }

    getRunStartStats(): CombatStats {
        return this.buildRunStartStats(this.getStoredLevels());
    }

    purchaseUpgrade(key: PermanentUpgradeKey): MetaUpgradePurchaseResult {
        const definition = UPGRADE_DEFINITIONS[key];
        const levels = this.getStoredLevels();
        const currentLevel = levels[key];
        const cost = this.calculateUpgradeCost(definition, currentLevel);
        const spendResult = this.soulShardService.spendSoulShards(cost);
        if (spendResult.status === 'insufficient-funds') {
            const snapshot = this.buildSnapshot(levels, spendResult.totalSoulShards);
            return {
                status: 'insufficient-funds',
                upgrade: this.requireUpgradeSnapshot(snapshot, key),
                totalSoulShards: spendResult.totalSoulShards,
                cost,
                missingSoulShards: cost - spendResult.totalSoulShards,
            };
        }

        const nextLevels: UpgradeLevelState = {
            ...levels,
            [key]: currentLevel + 1,
        };
        this.persistLevels(nextLevels);

        const snapshot = this.buildSnapshot(nextLevels, spendResult.totalSoulShards);
        return {
            status: 'purchased',
            upgrade: this.requireUpgradeSnapshot(snapshot, key),
            totalSoulShards: spendResult.totalSoulShards,
            cost,
        };
    }

    private getStoredLevels(): UpgradeLevelState {
        if (!this.storage) {
            return { ...DEFAULT_LEVELS };
        }

        const rawValue = this.storage.getItem(this.storageKey);
        if (!rawValue) {
            return { ...DEFAULT_LEVELS };
        }

        try {
            const parsed = JSON.parse(rawValue) as Partial<UpgradeLevelState>;
            return {
                maxHealth: this.normalizeLevel(parsed.maxHealth),
                attack: this.normalizeLevel(parsed.attack),
                defense: this.normalizeLevel(parsed.defense),
            };
        } catch {
            return { ...DEFAULT_LEVELS };
        }
    }

    private persistLevels(levels: UpgradeLevelState) {
        this.storage?.setItem(this.storageKey, JSON.stringify(levels));
    }

    private normalizeLevel(level?: number) {
        return Number.isFinite(level) && level && level > 0
            ? Math.floor(level)
            : 0;
    }

    private calculateUpgradeCost(definition: PermanentUpgradeDefinition, currentLevel: number) {
        return definition.baseCost + (currentLevel * definition.costStep);
    }

    private buildRunStartStats(levels: UpgradeLevelState): CombatStats {
        const nextStats = cloneCombatStats(BASE_PLAYER_STATS);
        nextStats.maxHealth += levels.maxHealth * UPGRADE_DEFINITIONS.maxHealth.bonusPerLevel;
        nextStats.health = nextStats.maxHealth;
        nextStats.attack += levels.attack * UPGRADE_DEFINITIONS.attack.bonusPerLevel;
        nextStats.defense += levels.defense * UPGRADE_DEFINITIONS.defense.bonusPerLevel;

        return nextStats;
    }

    private buildSnapshot(levels: UpgradeLevelState, totalSoulShards: number): MetaProgressionSnapshot {
        const startingStats = this.buildRunStartStats(levels);

        return {
            totalSoulShards,
            upgrades: (Object.keys(UPGRADE_DEFINITIONS) as PermanentUpgradeKey[]).map((key) => {
                const definition = UPGRADE_DEFINITIONS[key];
                const level = levels[key];
                const currentValue = this.getBaseStatValue(startingStats, key);
                const cost = this.calculateUpgradeCost(definition, level);

                return {
                    key,
                    label: definition.label,
                    statLabel: definition.statLabel,
                    description: definition.description,
                    level,
                    currentValue,
                    nextValue: currentValue + definition.bonusPerLevel,
                    bonusPerLevel: definition.bonusPerLevel,
                    cost,
                    affordable: totalSoulShards >= cost,
                };
            }),
        };
    }

    private getBaseStatValue(stats: CombatStats, key: PermanentUpgradeKey) {
        switch (key) {
            case 'maxHealth':
                return stats.maxHealth;
            case 'attack':
                return stats.attack;
            case 'defense':
                return stats.defense;
        }
    }

    private requireUpgradeSnapshot(snapshot: MetaProgressionSnapshot, key: PermanentUpgradeKey) {
        const upgrade = snapshot.upgrades.find((entry) => entry.key === key);
        if (!upgrade) {
            throw new Error(`Meta upgrade not found for key: ${key}`);
        }

        return upgrade;
    }
}
