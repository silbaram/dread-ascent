import { Enemy, type EnemyArchetypeId } from '../entities/Enemy';
import type { CombatStats } from '../entities/CombatStats';
import type { Position } from '../entities/Player';
import type { FloorType } from './FloorProgressionService';
import { positionToKey } from '../../shared/utils/positionKey';
import { shuffleArray, type RandomSource } from '../../shared/utils/shuffle';
import { selectUnoccupiedPosition } from '../../shared/utils/roomPositions';

export type EnemyRandomSource = RandomSource;

export interface SpawnRoom {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface EnemySpawnRequest {
    floorNumber: number;
    floorType: FloorType;
    tiles: number[][];
    rooms: SpawnRoom[];
    blockedPositions: Position[];
    bossSpawn?: Position;
    maxEnemies?: number;
}

export interface EnemyArchetype {
    id: EnemyArchetypeId;
    label: string;
    minFloor: number;
    maxFloor: number;
    statModifier: {
        maxHealth?: number;
        attack?: number;
        defense?: number;
    };
    experienceBonus: number;
}

export const BASE_ENEMY_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
};

export const DEFAULT_MAX_ENEMIES_PER_FLOOR = 3;
export const ENEMY_HEALTH_PER_FLOOR = 10;
export const ENEMY_ATTACK_PER_FLOOR = 1;
export const ENEMY_DEFENSE_PER_FLOOR = 1;
export const BASE_ENEMY_EXP_REWARD = 25;
export const ENEMY_EXP_REWARD_PER_FLOOR = 5;
export const BOSS_HEALTH_MULTIPLIER = 2;
export const BOSS_ATTACK_BONUS = 18;
export const BOSS_DEFENSE_BONUS = 12;
export const BOSS_EXP_REWARD_MULTIPLIER = 4;
export const DEFAULT_ELITE_CHANCE = 0.1;
export const ELITE_HEALTH_MULTIPLIER = 1.5;
export const ELITE_ATTACK_BONUS = 4;
export const ELITE_DEFENSE_BONUS = 3;
export const ELITE_EXP_REWARD_MULTIPLIER = 2;

export const ENEMY_ARCHETYPES: readonly EnemyArchetype[] = [
    {
        id: 'ash-crawler',
        label: 'Ash Crawler',
        minFloor: 1,
        maxFloor: 45,
        statModifier: {
            maxHealth: 0,
            attack: 0,
            defense: 0,
        },
        experienceBonus: 0,
    },
    {
        id: 'blade-raider',
        label: 'Blade Raider',
        minFloor: 20,
        maxFloor: 80,
        statModifier: {
            maxHealth: 20,
            attack: 2,
            defense: 0,
        },
        experienceBonus: 8,
    },
    {
        id: 'dread-sentinel',
        label: 'Dread Sentinel',
        minFloor: 50,
        maxFloor: 99,
        statModifier: {
            maxHealth: 40,
            attack: 1,
            defense: 3,
        },
        experienceBonus: 14,
    },
] as const;

export class EnemySpawnerService {
    constructor(
        private readonly random: EnemyRandomSource = { next: () => Math.random() },
        private readonly maxEnemiesPerFloor = DEFAULT_MAX_ENEMIES_PER_FLOOR,
        private readonly eliteChance = DEFAULT_ELITE_CHANCE,
    ) {
        if (maxEnemiesPerFloor < 0) {
            throw new Error('Enemy count must be zero or greater.');
        }
        if (eliteChance < 0 || eliteChance > 1) {
            throw new Error('Elite chance must be between 0 and 1.');
        }
    }

    spawn(request: EnemySpawnRequest): Enemy[] {
        if (request.floorType === 'safe') {
            return [];
        }

        if (request.floorType === 'boss') {
            return [this.spawnBoss(request)];
        }

        const availableRooms = request.rooms.slice(1);
        const targetCount = Math.min(
            request.maxEnemies ?? this.maxEnemiesPerFloor,
            availableRooms.length,
        );
        if (targetCount === 0) {
            return [];
        }

        const occupied = new Set(
            request.blockedPositions.map((position) => positionToKey(position)),
        );

        return shuffleArray(availableRooms, this.random)
            .slice(0, targetCount)
            .map((room, index) => {
                const position = selectUnoccupiedPosition(room, request.tiles, occupied, this.random, 'enemy');
                occupied.add(positionToKey(position));
                const archetype = this.selectArchetype(request.floorNumber);
                const isElite = this.random.next() < this.eliteChance;

                return new Enemy(
                    `enemy-${index + 1}`,
                    isElite ? `Elite ${archetype.label}` : archetype.label,
                    position,
                    this.buildStats(request.floorNumber, archetype, isElite),
                    this.buildExperienceReward(request.floorNumber, archetype, isElite),
                    'normal',
                    archetype.id,
                    isElite,
                );
            });
    }

    private spawnBoss(request: EnemySpawnRequest) {
        const position = request.bossSpawn ?? this.resolveBossSpawn(request.rooms);
        const occupied = new Set(
            request.blockedPositions.map((blockedPosition) => positionToKey(blockedPosition)),
        );
        if (occupied.has(positionToKey(position))) {
            throw new Error('Boss spawn position cannot overlap a blocked tile.');
        }

        return new Enemy(
            'boss-final',
            'Final Boss',
            position,
            this.buildBossStats(request.floorNumber),
            this.buildBossExperienceReward(request.floorNumber),
            'boss',
            'final-boss',
        );
    }

    private buildStats(
        floorNumber: number,
        archetype: EnemyArchetype,
        isElite: boolean,
    ): CombatStats {
        const floorOffset = Math.max(0, floorNumber - 1);
        const baseMaxHealth = BASE_ENEMY_STATS.maxHealth
            + (floorOffset * ENEMY_HEALTH_PER_FLOOR)
            + (archetype.statModifier.maxHealth ?? 0);
        const maxHealth = isElite
            ? Math.round(baseMaxHealth * ELITE_HEALTH_MULTIPLIER)
            : baseMaxHealth;

        return {
            health: maxHealth,
            maxHealth,
            attack: BASE_ENEMY_STATS.attack
                + (floorOffset * ENEMY_ATTACK_PER_FLOOR)
                + (archetype.statModifier.attack ?? 0)
                + (isElite ? ELITE_ATTACK_BONUS : 0),
            defense: BASE_ENEMY_STATS.defense
                + (floorOffset * ENEMY_DEFENSE_PER_FLOOR)
                + (archetype.statModifier.defense ?? 0)
                + (isElite ? ELITE_DEFENSE_BONUS : 0),
        };
    }

    private buildBossStats(floorNumber: number): CombatStats {
        const bossBaseArchetype = ENEMY_ARCHETYPES.find((archetype) => archetype.id === 'dread-sentinel');
        if (!bossBaseArchetype) {
            throw new Error('Boss archetype configuration is missing.');
        }

        const baseStats = this.buildStats(floorNumber, bossBaseArchetype, false);
        const maxHealth = baseStats.maxHealth * BOSS_HEALTH_MULTIPLIER;

        return {
            health: maxHealth,
            maxHealth,
            attack: baseStats.attack + BOSS_ATTACK_BONUS,
            defense: baseStats.defense + BOSS_DEFENSE_BONUS,
        };
    }

    private buildExperienceReward(
        floorNumber: number,
        archetype?: EnemyArchetype,
        isElite = false,
    ) {
        const floorOffset = Math.max(0, floorNumber - 1);
        const reward = BASE_ENEMY_EXP_REWARD
            + (floorOffset * ENEMY_EXP_REWARD_PER_FLOOR)
            + (archetype?.experienceBonus ?? 0);

        return isElite ? reward * ELITE_EXP_REWARD_MULTIPLIER : reward;
    }

    private buildBossExperienceReward(floorNumber: number) {
        return this.buildExperienceReward(floorNumber) * BOSS_EXP_REWARD_MULTIPLIER;
    }

    private resolveBossSpawn(rooms: SpawnRoom[]) {
        const room = rooms[rooms.length - 1];
        if (!room) {
            throw new Error('Boss floor requires at least one room.');
        }

        return {
            x: Math.floor((room.left + room.right) / 2),
            y: Math.floor((room.top + room.bottom) / 2),
        };
    }

    private selectArchetype(floorNumber: number) {
        const fallbackArchetype = ENEMY_ARCHETYPES[0];
        if (!fallbackArchetype) {
            throw new Error('At least one enemy archetype must be configured.');
        }

        const availableArchetypes = ENEMY_ARCHETYPES.filter((archetype) =>
            floorNumber >= archetype.minFloor && floorNumber <= archetype.maxFloor,
        );
        const pool = availableArchetypes.length > 0 ? availableArchetypes : [fallbackArchetype];
        const index = Math.floor(this.random.next() * pool.length);

        return pool[Math.min(index, pool.length - 1)];
    }

}
