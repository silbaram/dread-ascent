import 'phaser';
import { DEFAULT_MOVEMENT_SPEED } from '../../domain/entities/CombatStats';
import type { AnimationDurationProvider } from './MovementAnimator';

export const MOVEMENT_DURATION_BASELINE_SPEED = DEFAULT_MOVEMENT_SPEED;
export const MOVEMENT_DURATION_BASELINE_MS = 150;
export const MOVEMENT_DURATION_MIN_MS = 75;
export const MOVEMENT_DURATION_MAX_MS = 300;
export const ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD = 5;
export const ENEMY_CROWD_DURATION_CAP_MS = 100;

function clampDuration(durationMs: number): number {
    return Math.min(MOVEMENT_DURATION_MAX_MS, Math.max(MOVEMENT_DURATION_MIN_MS, durationMs));
}

export function getMovementDurationMs(movementSpeed: number): number {
    const normalizedSpeed = Math.max(1, Math.floor(movementSpeed || MOVEMENT_DURATION_BASELINE_SPEED));
    const scaledDuration = Math.round(
        (MOVEMENT_DURATION_BASELINE_MS * MOVEMENT_DURATION_BASELINE_SPEED) / normalizedSpeed,
    );

    return clampDuration(scaledDuration);
}

export function getComposedEnemyMovementDurationMs(
    movementSpeed: number,
    visibleEnemyCount: number,
): number {
    const baseDuration = getMovementDurationMs(movementSpeed);

    if (visibleEnemyCount < ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD) {
        return baseDuration;
    }

    return Math.min(baseDuration, ENEMY_CROWD_DURATION_CAP_MS);
}

export class SpriteMovementDurationPolicy implements AnimationDurationProvider {
    private readonly movementSpeeds = new WeakMap<Phaser.GameObjects.Sprite, number>();

    public bindSprite(sprite: Phaser.GameObjects.Sprite, movementSpeed: number): void {
        this.movementSpeeds.set(sprite, movementSpeed);
    }

    public unbindSprite(sprite: Phaser.GameObjects.Sprite): void {
        this.movementSpeeds.delete(sprite);
    }

    public getDuration(sprite: Phaser.GameObjects.Sprite): number {
        return getMovementDurationMs(this.movementSpeeds.get(sprite) ?? MOVEMENT_DURATION_BASELINE_SPEED);
    }
}
