import { describe, expect, it } from 'vitest';
import {
    type TurnScheduler,
    TurnQueueService,
} from '../../../../src/domain/services/TurnQueueService';

class CyclingTurnScheduler implements TurnScheduler {
    private actors: string[] = [];
    private index = 0;

    add(actorId: string, _repeat: boolean) {
        this.actors.push(actorId);
    }

    next() {
        if (this.actors.length === 0) {
            return null;
        }

        const actorId = this.actors[this.index];
        this.index = (this.index + 1) % this.actors.length;
        return actorId;
    }

    clear() {
        this.actors = [];
        this.index = 0;
    }
}

describe('TurnQueueService', () => {
    it('starts each cycle on the player turn', () => {
        // Arrange
        const service = new TurnQueueService(new CyclingTurnScheduler());

        // Act
        const snapshot = service.initialize(
            { id: 'player', kind: 'player', label: 'Player' },
            [
                { id: 'enemy-1', kind: 'enemy', label: 'Enemy 1' },
                { id: 'enemy-2', kind: 'enemy', label: 'Enemy 2' },
            ],
        );

        // Assert
        expect(snapshot.round).toBe(1);
        expect(snapshot.activeActor.id).toBe('player');
        expect(snapshot.enemyCount).toBe(2);
    });

    it('processes every enemy turn before returning control to the player', () => {
        // Arrange
        const service = new TurnQueueService(new CyclingTurnScheduler());
        service.initialize(
            { id: 'player', kind: 'player', label: 'Player' },
            [
                { id: 'enemy-1', kind: 'enemy', label: 'Enemy 1' },
                { id: 'enemy-2', kind: 'enemy', label: 'Enemy 2' },
            ],
        );

        // Act
        const resolution = service.completePlayerTurn();

        // Assert
        expect(resolution.enemyTurns.map((actor) => actor.id)).toEqual(['enemy-1', 'enemy-2']);
        expect(resolution.nextActor.id).toBe('player');
        expect(resolution.round).toBe(2);
    });

    it('supports rounds with only the player actor', () => {
        // Arrange
        const service = new TurnQueueService(new CyclingTurnScheduler());
        service.initialize(
            { id: 'player', kind: 'player', label: 'Player' },
            [],
        );

        // Act
        const resolution = service.completePlayerTurn();

        // Assert
        expect(resolution.enemyTurns).toEqual([]);
        expect(resolution.nextActor.id).toBe('player');
        expect(resolution.round).toBe(2);
    });

    it('rejects duplicate actor identifiers', () => {
        // Arrange
        const service = new TurnQueueService(new CyclingTurnScheduler());

        // Act / Assert
        expect(() =>
            service.initialize(
                { id: 'player', kind: 'player', label: 'Player' },
                [{ id: 'player', kind: 'enemy', label: 'Duplicate Enemy' }],
            ),
        ).toThrow('Duplicate turn actor id: player');
    });

    it('refreshes the enemy roster without resetting the current round', () => {
        // Arrange
        const service = new TurnQueueService(new CyclingTurnScheduler());
        service.initialize(
            { id: 'player', kind: 'player', label: 'Player' },
            [
                { id: 'enemy-1', kind: 'enemy', label: 'Enemy 1' },
                { id: 'enemy-2', kind: 'enemy', label: 'Enemy 2' },
            ],
        );
        service.completePlayerTurn();

        // Act
        const snapshot = service.refresh(
            { id: 'player', kind: 'player', label: 'Player' },
            [{ id: 'enemy-2', kind: 'enemy', label: 'Enemy 2' }],
        );

        // Assert
        expect(snapshot.round).toBe(2);
        expect(snapshot.activeActor.id).toBe('player');
        expect(snapshot.enemyCount).toBe(1);
    });
});
