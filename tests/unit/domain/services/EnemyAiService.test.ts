import { describe, expect, it } from 'vitest';
import type { CombatStats } from '../../../../src/domain/entities/CombatStats';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import { type Position } from '../../../../src/domain/entities/Player';
import {
    EnemyAiService,
    type PathFinder,
} from '../../../../src/domain/services/EnemyAiService';
import {
    type FieldOfViewCalculator,
    type GridPosition,
} from '../../../../src/domain/services/VisibilityService';

const DEFAULT_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
};

class ReplayPathFinder implements PathFinder {
    private callIndex = 0;

    constructor(private readonly paths: Position[][]) {}

    findPath(): Position[] {
        const path = this.paths[Math.min(this.callIndex, this.paths.length - 1)] ?? [];
        this.callIndex += 1;
        return path;
    }
}

class ReplayFieldOfViewCalculator implements FieldOfViewCalculator {
    private callIndex = 0;

    constructor(private readonly frames: GridPosition[][]) {}

    computeVisibleTiles(): GridPosition[] {
        const frame = this.frames[Math.min(this.callIndex, this.frames.length - 1)] ?? [];
        this.callIndex += 1;
        return frame;
    }
}

function createEnemy(
    position: Position = { x: 1, y: 1 },
    kind: 'normal' | 'boss' = 'normal',
) {
    return new Enemy('enemy-1', 'Enemy 1', { ...position }, { ...DEFAULT_STATS }, 25, kind);
}

describe('EnemyAiService', () => {
    it('moves toward the player when the player is visible but not adjacent', () => {
        // Arrange
        const enemy = createEnemy();
        const service = new EnemyAiService(
            new ReplayPathFinder([[{ x: 2, y: 1 }, { x: 3, y: 1 }]]),
            new ReplayFieldOfViewCalculator([[{ x: 3, y: 1 }]]),
            8,
        );

        // Act
        const action = service.decide(enemy, { x: 3, y: 1 });

        // Assert
        expect(action).toEqual({
            type: 'move',
            destination: { x: 2, y: 1 },
            pursuit: 'player',
        });
        expect(enemy.position).toEqual({ x: 2, y: 1 });
        expect(enemy.lastKnownPlayerPosition).toEqual({ x: 3, y: 1 });
    });

    it('chooses an attack when the player is adjacent and visible', () => {
        // Arrange
        const enemy = createEnemy();
        const service = new EnemyAiService(
            new ReplayPathFinder([[]]),
            new ReplayFieldOfViewCalculator([[{ x: 2, y: 1 }]]),
            8,
        );

        // Act
        const action = service.decide(enemy, { x: 2, y: 1 });

        // Assert
        expect(action).toEqual({
            type: 'attack',
            target: { x: 2, y: 1 },
        });
        expect(enemy.position).toEqual({ x: 1, y: 1 });
        expect(enemy.lastKnownPlayerPosition).toEqual({ x: 2, y: 1 });
    });

    it('moves toward the last known player position after losing sight of the player', () => {
        // Arrange
        const enemy = createEnemy();
        enemy.rememberPlayer({ x: 3, y: 1 });
        const service = new EnemyAiService(
            new ReplayPathFinder([[{ x: 2, y: 1 }, { x: 3, y: 1 }]]),
            new ReplayFieldOfViewCalculator([[]]),
            8,
        );

        // Act
        const action = service.decide(enemy, { x: 6, y: 6 });

        // Assert
        expect(action).toEqual({
            type: 'move',
            destination: { x: 2, y: 1 },
            pursuit: 'last-known',
        });
        expect(enemy.position).toEqual({ x: 2, y: 1 });
        expect(enemy.lastKnownPlayerPosition).toEqual({ x: 3, y: 1 });
    });

    it('waits after arriving at the last known player position', () => {
        // Arrange
        const enemy = createEnemy({ x: 3, y: 1 });
        enemy.rememberPlayer({ x: 3, y: 1 });
        const service = new EnemyAiService(
            new ReplayPathFinder([[]]),
            new ReplayFieldOfViewCalculator([[]]),
            8,
        );

        // Act
        const action = service.decide(enemy, { x: 6, y: 6 });

        // Assert
        expect(action).toEqual({
            type: 'wait',
            reason: 'searching',
        });
        expect(enemy.lastKnownPlayerPosition).toBeUndefined();
    });

    it('lets the boss track the player without vision and attack from two tiles away', () => {
        // Arrange
        const boss = createEnemy({ x: 1, y: 1 }, 'boss');
        const service = new EnemyAiService(
            new ReplayPathFinder([[{ x: 2, y: 1 }, { x: 3, y: 1 }]]),
            new ReplayFieldOfViewCalculator([[]]),
            8,
        );

        // Act
        const action = service.decide(boss, { x: 3, y: 1 });

        // Assert
        expect(action).toEqual({
            type: 'attack',
            target: { x: 3, y: 1 },
        });
        expect(boss.lastKnownPlayerPosition).toEqual({ x: 3, y: 1 });
    });
});
