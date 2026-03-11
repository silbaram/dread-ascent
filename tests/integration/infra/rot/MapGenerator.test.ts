import { describe, expect, it } from 'vitest';
import { MapGenerator } from '../../../../src/infra/rot/MapGenerator';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';

describe('MapGenerator', () => {
    it('places stairs on a walkable tile that is separate from the player spawn on normal floors', () => {
        // Arrange
        const width = 40;
        const height = 30;

        // Act
        const map = MapGenerator.generate(width, height);

        // Assert
        expect(map.floorType).toBe('normal');
        expect(map.tiles[map.playerSpawn.y][map.playerSpawn.x]).toBe(WORLD_TILE.FLOOR);
        expect(map.tiles[map.stairsPosition.y][map.stairsPosition.x]).toBe(WORLD_TILE.STAIRS);
        expect(map.stairsPosition).not.toEqual(map.playerSpawn);
        expect(map.restPoints).toEqual([]);
    });

    it('builds safe floors with a dedicated rest point and stairs', () => {
        // Arrange
        const width = 40;
        const height = 30;

        // Act
        const map = MapGenerator.generate(width, height, { floorType: 'safe' });

        // Assert
        expect(map.floorType).toBe('safe');
        expect(map.rooms).toHaveLength(1);
        expect(map.restPoints).toHaveLength(1);
        expect(map.tiles[map.playerSpawn.y][map.playerSpawn.x]).toBe(WORLD_TILE.FLOOR);
        expect(map.tiles[map.restPoints[0].y][map.restPoints[0].x]).toBe(WORLD_TILE.REST);
        expect(map.tiles[map.stairsPosition.y][map.stairsPosition.x]).toBe(WORLD_TILE.STAIRS);
        expect(map.stairsPosition).not.toEqual(map.playerSpawn);
    });
});
