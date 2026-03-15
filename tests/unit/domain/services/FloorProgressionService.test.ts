import { describe, expect, it } from 'vitest';
import {
    BOSS_FLOOR_NUMBER,
    DEFAULT_SAFE_FLOOR_CHANCE,
    FloorProgressionService,
    type RandomSource,
} from '../../../../src/domain/services/FloorProgressionService';

class FixedRandomSource implements RandomSource {
    constructor(private readonly value: number) {}

    next() {
        return this.value;
    }
}

describe('FloorProgressionService', () => {
    it('starts a run on floor 1 as a normal floor', () => {
        // Arrange
        const service = new FloorProgressionService();

        // Act
        const snapshot = service.getSnapshot();

        // Assert
        expect(snapshot).toEqual({ number: 1, type: 'normal' });
    });

    it('creates a safe floor when the random roll is below the safe-floor chance', () => {
        // Arrange
        const service = new FloorProgressionService(
            new FixedRandomSource(DEFAULT_SAFE_FLOOR_CHANCE / 2),
        );

        // Act
        const snapshot = service.advance();

        // Assert
        expect(snapshot).toEqual({ number: 2, type: 'safe' });
    });

    it('keeps the next floor normal when the random roll meets the safe-floor threshold', () => {
        // Arrange
        const service = new FloorProgressionService(
            new FixedRandomSource(DEFAULT_SAFE_FLOOR_CHANCE),
        );

        // Act
        const snapshot = service.advance();

        // Assert
        expect(snapshot).toEqual({ number: 2, type: 'normal' });
    });

    it('resets the run back to floor 1 normal', () => {
        // Arrange
        const service = new FloorProgressionService(new FixedRandomSource(0));
        service.advance();
        service.advance();

        // Act
        const snapshot = service.reset();

        // Assert
        expect(snapshot).toEqual({ number: 1, type: 'normal' });
    });

    it('forces floor 100 to become the boss floor', () => {
        // Arrange
        const service = new FloorProgressionService(new FixedRandomSource(0));
        let snapshot = service.getSnapshot();

        // Act
        for (let step = 2; step <= BOSS_FLOOR_NUMBER; step += 1) {
            snapshot = service.advance();
        }

        // Assert
        expect(snapshot).toEqual({ number: BOSS_FLOOR_NUMBER, type: 'boss' });
    });

    it('restores a saved floor snapshot for continue flow', () => {
        // Arrange
        const service = new FloorProgressionService(new FixedRandomSource(0));

        // Act
        const snapshot = service.restore({
            number: 12,
            type: 'safe',
        });

        // Assert
        expect(snapshot).toEqual({
            number: 12,
            type: 'safe',
        });
        expect(service.getSnapshot()).toEqual(snapshot);
    });

    it('rejects invalid safe-floor probabilities', () => {
        // Arrange / Act / Assert
        expect(() =>
            new FloorProgressionService(new FixedRandomSource(0), 1.1),
        ).toThrow('Safe floor chance must be between 0 and 1.');
    });
});
