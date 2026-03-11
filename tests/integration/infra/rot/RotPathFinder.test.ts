import { describe, expect, it } from 'vitest';
import { RotPathFinder } from '../../../../src/infra/rot/RotPathFinder';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';

describe('RotPathFinder', () => {
    it('finds a path around walls using four-directional movement', () => {
        // Arrange
        const tiles = [
            [1, 1, 1, 1, 1],
            [1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 1, 1, 1, 1],
        ];
        const pathFinder = new RotPathFinder((x, y) =>
            tiles[y]?.[x] === WORLD_TILE.FLOOR,
        );

        // Act
        const path = pathFinder.findPath({ x: 1, y: 1 }, { x: 3, y: 1 });

        // Assert
        expect(path).not.toHaveLength(0);
        expect(path[path.length - 1]).toEqual({ x: 3, y: 1 });
        expect(path.every((step) => tiles[step.y][step.x] === WORLD_TILE.FLOOR)).toBe(true);
    });

    it('returns an empty path when the target is unreachable', () => {
        // Arrange
        const tiles = [
            [1, 1, 1, 1, 1],
            [1, 0, 1, 0, 1],
            [1, 1, 1, 1, 1],
            [1, 0, 1, 0, 1],
            [1, 1, 1, 1, 1],
        ];
        const pathFinder = new RotPathFinder((x, y) =>
            tiles[y]?.[x] === WORLD_TILE.FLOOR,
        );

        // Act
        const path = pathFinder.findPath({ x: 1, y: 1 }, { x: 3, y: 3 });

        // Assert
        expect(path).toEqual([]);
    });
});
