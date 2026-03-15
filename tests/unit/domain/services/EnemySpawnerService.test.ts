import { describe, expect, it } from 'vitest';
import {
    DEFAULT_ELITE_CHANCE,
    EnemySpawnerService,
    type EnemyRandomSource,
    type SpawnRoom,
} from '../../../../src/domain/services/EnemySpawnerService';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';

class SequenceRandomSource implements EnemyRandomSource {
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

describe('EnemySpawnerService', () => {
    const rooms: SpawnRoom[] = [
        { left: 1, right: 2, top: 1, bottom: 2 },
        { left: 5, right: 6, top: 1, bottom: 2 },
        { left: 1, right: 2, top: 5, bottom: 6 },
    ];

    it('returns no enemies on safe floors', () => {
        // Arrange
        const service = new EnemySpawnerService(new SequenceRandomSource([0]), 3, 0);

        // Act
        const enemies = service.spawn({
            floorNumber: 2,
            floorType: 'safe',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        });

        // Assert
        expect(enemies).toEqual([]);
    });

    it('spawns enemies only in non-start rooms and avoids blocked positions', () => {
        // Arrange
        const service = new EnemySpawnerService(new SequenceRandomSource([0, 0, 0, 0, 0, 0]), 2, 0);
        const blockedPosition = { x: 5, y: 1 };

        // Act
        const enemies = service.spawn({
            floorNumber: 1,
            floorType: 'normal',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [
                { x: 1, y: 1 },
                blockedPosition,
            ],
        });

        // Assert
        expect(enemies).toHaveLength(2);
        expect(enemies.map((enemy) => enemy.position)).not.toContainEqual(blockedPosition);
        expect(enemies.every((enemy) => !isInsideRoom(enemy.position, rooms[0]))).toBe(true);
        expect(enemies.every((enemy) =>
            isInsideRoom(enemy.position, rooms[1]) || isInsideRoom(enemy.position, rooms[2]),
        )).toBe(true);
        expect(enemies.every((enemy) => enemy.archetypeId === 'ash-crawler')).toBe(true);
        expect(enemies.every((enemy) => enemy.isElite() === false)).toBe(true);
        expect(new Set(enemies.map((enemy) => `${enemy.position.x},${enemy.position.y}`)).size).toBe(2);
    });

    it('changes the available monster archetype pool as floors rise', () => {
        // Arrange
        const lowFloorService = new EnemySpawnerService(new SequenceRandomSource([0]), 1, 0);
        const midFloorService = new EnemySpawnerService(new SequenceRandomSource([0.9]), 1, 0);
        const highFloorService = new EnemySpawnerService(new SequenceRandomSource([0.9]), 1, 0);
        const request = {
            floorType: 'normal' as const,
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        };

        // Act
        const [lowEnemy] = lowFloorService.spawn({
            floorNumber: 5,
            ...request,
        });
        const [midEnemy] = midFloorService.spawn({
            floorNumber: 35,
            ...request,
        });
        const [highEnemy] = highFloorService.spawn({
            floorNumber: 75,
            ...request,
        });

        // Assert
        expect(lowEnemy.archetypeId).toBe('ash-crawler');
        expect(midEnemy.archetypeId).toBe('blade-raider');
        expect(highEnemy.archetypeId).toBe('dread-sentinel');
    });

    it('upgrades spawned enemies to elite variants when the elite roll succeeds', () => {
        // Arrange
        const normalService = new EnemySpawnerService(new SequenceRandomSource([0, 0, 0]), 1, 0);
        const eliteService = new EnemySpawnerService(new SequenceRandomSource([0, 0, 0]), 1, 1);
        const request = {
            floorNumber: 30,
            floorType: 'normal' as const,
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        };

        // Act
        const [normalEnemy] = normalService.spawn(request);
        const [eliteEnemy] = eliteService.spawn(request);

        // Assert
        expect(normalEnemy.label).toBe('Ash Crawler');
        expect(eliteEnemy.label).toBe('Elite Ash Crawler');
        expect(eliteEnemy.isElite()).toBe(true);
        expect(eliteEnemy.stats.health).toBeGreaterThan(normalEnemy.stats.health);
        expect(eliteEnemy.stats.attack).toBeGreaterThan(normalEnemy.stats.attack);
        expect(eliteEnemy.stats.defense).toBeGreaterThan(normalEnemy.stats.defense);
        expect(eliteEnemy.experienceReward).toBeGreaterThan(normalEnemy.experienceReward);
    });

    it('spawns a single boss enemy on boss floors', () => {
        // Arrange
        const service = new EnemySpawnerService(new SequenceRandomSource([0]), 3, 0);

        // Act
        const enemies = service.spawn({
            floorNumber: 100,
            floorType: 'boss',
            tiles: createTiles(8, 8, rooms),
            rooms,
            bossSpawn: { x: 2, y: 6 },
            blockedPositions: [{ x: 1, y: 1 }],
        });

        // Assert
        expect(enemies).toHaveLength(1);
        expect(enemies[0]?.kind).toBe('boss');
        expect(enemies[0]?.archetypeId).toBe('final-boss');
        expect(enemies[0]?.label).toBe('Final Boss');
        expect(enemies[0]?.position).toEqual({ x: 2, y: 6 });
    });

    it('rejects negative enemy limits', () => {
        // Arrange / Act / Assert
        expect(() =>
            new EnemySpawnerService(new SequenceRandomSource([0]), -1),
        ).toThrow('Enemy count must be zero or greater.');
    });

    it('rejects invalid elite probabilities', () => {
        // Arrange / Act / Assert
        expect(() =>
            new EnemySpawnerService(new SequenceRandomSource([0]), 1, DEFAULT_ELITE_CHANCE + 1),
        ).toThrow('Elite chance must be between 0 and 1.');
    });
});
