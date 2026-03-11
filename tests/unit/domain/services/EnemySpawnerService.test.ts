import { describe, expect, it } from 'vitest';
import {
    EnemySpawnerService,
    type EnemyRandomSource,
    type SpawnRoom,
} from '../../../../src/domain/services/EnemySpawnerService';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';

class FixedRandomSource implements EnemyRandomSource {
    constructor(private readonly value: number) {}

    next() {
        return this.value;
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

function isInsideRoom(
    position: { x: number; y: number },
    room: SpawnRoom,
) {
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
        const service = new EnemySpawnerService(new FixedRandomSource(0));

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
        const service = new EnemySpawnerService(new FixedRandomSource(0), 2);
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
        expect(new Set(enemies.map((enemy) => `${enemy.position.x},${enemy.position.y}`)).size).toBe(2);
    });

    it('scales enemy stats with the current floor number', () => {
        // Arrange
        const service = new EnemySpawnerService(new FixedRandomSource(0), 1);

        // Act
        const [enemy] = service.spawn({
            floorNumber: 3,
            floorType: 'normal',
            tiles: createTiles(8, 8, rooms),
            rooms,
            blockedPositions: [{ x: 1, y: 1 }],
        });

        // Assert
        expect(enemy.stats).toEqual({
            health: 120,
            maxHealth: 120,
            attack: 12,
            defense: 7,
        });
        expect(enemy.experienceReward).toBe(35);
    });

    it('rejects negative enemy limits', () => {
        // Arrange / Act / Assert
        expect(() =>
            new EnemySpawnerService(new FixedRandomSource(0), -1),
        ).toThrow('Enemy count must be zero or greater.');
    });
});
