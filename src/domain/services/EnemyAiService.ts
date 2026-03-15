import type { Enemy } from '../entities/Enemy';
import type { Position } from '../entities/Player';
import type { FieldOfViewCalculator } from './VisibilityService';

export interface PathFinder {
    findPath(origin: Position, target: Position): Position[];
}

export type EnemyAction =
    | { type: 'wait'; reason: 'idle' | 'searching' | 'blocked' }
    | { type: 'move'; destination: Position; pursuit: 'player' | 'last-known' }
    | { type: 'attack'; target: Position };

export class EnemyAiService {
    constructor(
        private readonly pathFinder: PathFinder,
        private readonly fieldOfViewCalculator: FieldOfViewCalculator,
        private readonly visionRadius: number,
    ) {}

    decide(enemy: Enemy, playerPosition: Position): EnemyAction {
        if (enemy.isBoss()) {
            return this.decideBoss(enemy, playerPosition);
        }

        if (this.canSeePlayer(enemy.position, playerPosition)) {
            enemy.rememberPlayer(playerPosition);

            if (this.isWithinAttackRange(enemy, playerPosition)) {
                return { type: 'attack', target: { ...playerPosition } };
            }

            return this.moveTowards(enemy, playerPosition, 'player');
        }

        if (!enemy.lastKnownPlayerPosition) {
            return { type: 'wait', reason: 'idle' };
        }

        if (this.isSamePosition(enemy.position, enemy.lastKnownPlayerPosition)) {
            enemy.forgetPlayer();
            return { type: 'wait', reason: 'searching' };
        }

        return this.moveTowards(enemy, enemy.lastKnownPlayerPosition, 'last-known');
    }

    private decideBoss(enemy: Enemy, playerPosition: Position): EnemyAction {
        enemy.rememberPlayer(playerPosition);

        if (this.isWithinAttackRange(enemy, playerPosition)) {
            return { type: 'attack', target: { ...playerPosition } };
        }

        return this.moveTowards(enemy, playerPosition, 'player');
    }

    private moveTowards(
        enemy: Enemy,
        target: Position,
        pursuit: 'player' | 'last-known',
    ): EnemyAction {
        const [nextStep] = this.pathFinder.findPath(enemy.position, target);
        if (!nextStep) {
            return { type: 'wait', reason: 'blocked' };
        }

        enemy.moveTo(nextStep.x, nextStep.y);
        if (pursuit === 'last-known' && this.isSamePosition(nextStep, target)) {
            enemy.forgetPlayer();
        }

        return {
            type: 'move',
            destination: { ...nextStep },
            pursuit,
        };
    }

    private canSeePlayer(origin: Position, playerPosition: Position) {
        return this.fieldOfViewCalculator
            .computeVisibleTiles(origin, this.visionRadius)
            .some((position) => this.isSamePosition(position, playerPosition));
    }

    private isWithinAttackRange(enemy: Enemy, target: Position) {
        const range = enemy.isBoss() ? 2 : 1;
        return Math.abs(enemy.position.x - target.x) + Math.abs(enemy.position.y - target.y) <= range;
    }

    private isSamePosition(a: Position, b: Position) {
        return a.x === b.x && a.y === b.y;
    }
}
