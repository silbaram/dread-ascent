import { Enemy } from '../entities/Enemy';
import type { CombatStats } from '../entities/CombatStats';
import type { Position } from '../entities/Player';
import type { FloorType } from './FloorProgressionService';
import { WORLD_TILE } from '../../shared/types/WorldTiles';

export interface EnemyRandomSource {
    next(): number;
}

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
    maxEnemies?: number;
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

export class EnemySpawnerService {
    constructor(
        private readonly random: EnemyRandomSource = { next: () => Math.random() },
        private readonly maxEnemiesPerFloor = DEFAULT_MAX_ENEMIES_PER_FLOOR,
    ) {
        if (maxEnemiesPerFloor < 0) {
            throw new Error('Enemy count must be zero or greater.');
        }
    }

    spawn(request: EnemySpawnRequest): Enemy[] {
        if (request.floorType === 'safe') {
            return [];
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
            request.blockedPositions.map((position) => this.toKey(position)),
        );

        return this.shuffle(availableRooms)
            .slice(0, targetCount)
            .map((room, index) => {
                const position = this.selectSpawnPosition(room, request.tiles, occupied);
                occupied.add(this.toKey(position));

                return new Enemy(
                    `enemy-${index + 1}`,
                    `Enemy ${index + 1}`,
                    position,
                    this.buildStats(request.floorNumber),
                    this.buildExperienceReward(request.floorNumber),
                );
            });
    }

    private buildStats(floorNumber: number): CombatStats {
        const floorOffset = Math.max(0, floorNumber - 1);
        const maxHealth = BASE_ENEMY_STATS.maxHealth + (floorOffset * ENEMY_HEALTH_PER_FLOOR);

        return {
            health: maxHealth,
            maxHealth,
            attack: BASE_ENEMY_STATS.attack + (floorOffset * ENEMY_ATTACK_PER_FLOOR),
            defense: BASE_ENEMY_STATS.defense + (floorOffset * ENEMY_DEFENSE_PER_FLOOR),
        };
    }

    private buildExperienceReward(floorNumber: number) {
        const floorOffset = Math.max(0, floorNumber - 1);
        return BASE_ENEMY_EXP_REWARD + (floorOffset * ENEMY_EXP_REWARD_PER_FLOOR);
    }

    private selectSpawnPosition(
        room: SpawnRoom,
        tiles: number[][],
        occupied: Set<string>,
    ): Position {
        const candidates = this.shuffle(this.collectRoomPositions(room, tiles));
        const position = candidates.find((candidate) => !occupied.has(this.toKey(candidate)));
        if (!position) {
            throw new Error('No spawn position available for enemy.');
        }

        return position;
    }

    private collectRoomPositions(room: SpawnRoom, tiles: number[][]): Position[] {
        const positions: Position[] = [];

        for (let y = room.top; y <= room.bottom; y += 1) {
            for (let x = room.left; x <= room.right; x += 1) {
                if (tiles[y]?.[x] === WORLD_TILE.FLOOR) {
                    positions.push({ x, y });
                }
            }
        }

        return positions;
    }

    private shuffle<T>(values: T[]) {
        const shuffled = [...values];

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(this.random.next() * (index + 1));
            [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
        }

        return shuffled;
    }

    private toKey(position: Position) {
        return `${position.x},${position.y}`;
    }
}
