import { describe, expect, it, vi } from 'vitest';
import {
    ENEMY_CROWD_DURATION_CAP_MS,
    ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD,
    getComposedEnemyMovementDurationMs,
    getMovementDurationMs,
    MOVEMENT_DURATION_BASELINE_MS,
    MOVEMENT_DURATION_BASELINE_SPEED,
    MOVEMENT_DURATION_MAX_MS,
    MOVEMENT_DURATION_MIN_MS,
    SpriteMovementDurationPolicy,
} from '../../../../src/scenes/synchronizers/MovementDurationPolicy';

vi.mock('phaser', () => ({}));

function createFakeSprite(): Phaser.GameObjects.Sprite {
    return {} as Phaser.GameObjects.Sprite;
}

describe('MovementDurationPolicy', () => {
    it('maps the baseline movement speed to the legacy 150ms duration', () => {
        expect(getMovementDurationMs(MOVEMENT_DURATION_BASELINE_SPEED)).toBe(MOVEMENT_DURATION_BASELINE_MS);
    });

    it('shortens duration for higher movement speed and lengthens it for lower movement speed', () => {
        expect(getMovementDurationMs(150)).toBe(100);
        expect(getMovementDurationMs(50)).toBe(MOVEMENT_DURATION_MAX_MS);
    });

    it('clamps duration with explicit minimum and maximum bounds', () => {
        expect(getMovementDurationMs(999)).toBe(MOVEMENT_DURATION_MIN_MS);
        expect(getMovementDurationMs(1)).toBe(MOVEMENT_DURATION_MAX_MS);
    });

    it('keeps the movementSpeed duration unchanged below the visible enemy crowd threshold', () => {
        expect(
            getComposedEnemyMovementDurationMs(50, ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD - 1),
        ).toBe(MOVEMENT_DURATION_MAX_MS);
        expect(
            getComposedEnemyMovementDurationMs(150, ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD - 1),
        ).toBe(100);
    });

    it('caps slower crowd movement durations without overriding faster movementSpeed actors', () => {
        expect(
            getComposedEnemyMovementDurationMs(
                MOVEMENT_DURATION_BASELINE_SPEED,
                ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD,
            ),
        ).toBe(ENEMY_CROWD_DURATION_CAP_MS);
        expect(
            getComposedEnemyMovementDurationMs(50, ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD),
        ).toBe(ENEMY_CROWD_DURATION_CAP_MS);
        expect(
            getComposedEnemyMovementDurationMs(150, ENEMY_CROWD_DURATION_CAP_VISIBLE_THRESHOLD),
        ).toBe(100);
    });

    it('returns the baseline duration for unbound sprites', () => {
        const policy = new SpriteMovementDurationPolicy();

        expect(policy.getDuration(createFakeSprite())).toBe(MOVEMENT_DURATION_BASELINE_MS);
    });

    it('reads bound sprite movement speeds through the MovementAnimator extension point contract', () => {
        const policy = new SpriteMovementDurationPolicy();
        const sprite = createFakeSprite();
        policy.bindSprite(sprite, 75);

        expect(policy.getDuration(sprite)).toBe(200);
    });
});
