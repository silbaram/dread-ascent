import { describe, expect, it } from 'vitest';
import { RotTurnScheduler } from '../../../../src/infra/rot/RotTurnScheduler';

describe('RotTurnScheduler', () => {
    it('returns actors in round-robin order', () => {
        // Arrange
        const scheduler = new RotTurnScheduler();
        scheduler.add('player', true);
        scheduler.add('enemy-1', true);
        scheduler.add('enemy-2', true);

        // Act
        const order = [
            scheduler.next(),
            scheduler.next(),
            scheduler.next(),
            scheduler.next(),
        ];

        // Assert
        expect(order).toEqual(['player', 'enemy-1', 'enemy-2', 'player']);
    });

    it('drops all actors after clear', () => {
        // Arrange
        const scheduler = new RotTurnScheduler();
        scheduler.add('player', true);

        // Act
        scheduler.clear();

        // Assert
        expect(scheduler.next()).toBeNull();
    });
});
