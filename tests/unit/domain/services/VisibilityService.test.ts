import { describe, expect, it } from 'vitest';
import {
    type FieldOfViewCalculator,
    type GridPosition,
    VisibilityService,
} from '../../../../src/domain/services/VisibilityService';

class ReplayFieldOfViewCalculator implements FieldOfViewCalculator {
    private callIndex = 0;

    constructor(private readonly frames: GridPosition[][]) {}

    computeVisibleTiles(): GridPosition[] {
        const frame = this.frames[Math.min(this.callIndex, this.frames.length - 1)] ?? [];
        this.callIndex += 1;
        return frame;
    }
}

describe('VisibilityService', () => {
    it('marks current tiles as visible and unknown tiles as hidden', () => {
        // Arrange
        const calculator = new ReplayFieldOfViewCalculator([
            [
                { x: 1, y: 1 },
                { x: 1, y: 2 },
            ],
        ]);
        const service = new VisibilityService(3, 3, calculator);

        // Act
        const snapshot = service.recalculate({ x: 1, y: 1 }, 8);

        // Assert
        expect(snapshot.tiles).toEqual([
            ['hidden', 'hidden', 'hidden'],
            ['hidden', 'visible', 'hidden'],
            ['hidden', 'visible', 'hidden'],
        ]);
    });

    it('keeps previously visible tiles as explored after they leave the current view', () => {
        // Arrange
        const calculator = new ReplayFieldOfViewCalculator([
            [
                { x: 1, y: 1 },
                { x: 1, y: 2 },
            ],
            [{ x: 2, y: 2 }],
        ]);
        const service = new VisibilityService(3, 3, calculator);

        // Act
        service.recalculate({ x: 1, y: 1 }, 8);
        const snapshot = service.recalculate({ x: 2, y: 2 }, 8);

        // Assert
        expect(snapshot.tiles[1][1]).toBe('explored');
        expect(snapshot.tiles[2][1]).toBe('explored');
        expect(snapshot.tiles[2][2]).toBe('visible');
    });

    it('ignores out-of-bounds tiles returned by the calculator', () => {
        // Arrange
        const calculator = new ReplayFieldOfViewCalculator([
            [
                { x: -1, y: 0 },
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
        ]);
        const service = new VisibilityService(2, 2, calculator);

        // Act
        const snapshot = service.recalculate({ x: 0, y: 0 }, 8);

        // Assert
        expect(snapshot.tiles).toEqual([
            ['visible', 'hidden'],
            ['hidden', 'hidden'],
        ]);
    });
});
