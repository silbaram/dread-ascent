import { describe, expect, it, vi } from 'vitest';
import {
    MovementAnimator,
    type TweenFactory,
} from '../../../../src/scenes/synchronizers/MovementAnimator';

vi.mock('phaser', () => ({}));

interface FakeTweenRecord {
    readonly config: {
        targets: unknown;
        x: number;
        y: number;
        duration: number;
        ease: string;
        onComplete?: () => void;
    };
    triggerComplete: () => void;
    stopCalled: boolean;
    completeCalled: boolean;
}

function createFakeTweenFactory(): { factory: TweenFactory; tweens: FakeTweenRecord[] } {
    const tweens: FakeTweenRecord[] = [];

    const factory: TweenFactory = {
        create(config) {
            const record: FakeTweenRecord = {
                config: { ...config },
                triggerComplete: () => config.onComplete?.(),
                stopCalled: false,
                completeCalled: false,
            };
            tweens.push(record);
            return {
                stop: () => { (record as { stopCalled: boolean }).stopCalled = true; },
                complete: () => { (record as { completeCalled: boolean }).completeCalled = true; },
            };
        },
    };

    return { factory, tweens };
}

function createFakeSprite(x = 0, y = 0): Phaser.GameObjects.Sprite {
    return { x, y } as unknown as Phaser.GameObjects.Sprite;
}

const TILE_SIZE = 32;

describe('MovementAnimator', () => {
    it('creates a tween to the target tile pixel position', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite(0, 0);

        // Act
        animator.moveTo(sprite, { x: 3, y: 5 });

        // Assert
        expect(tweens).toHaveLength(1);
        expect(tweens[0].config.x).toBe(3 * TILE_SIZE);
        expect(tweens[0].config.y).toBe(5 * TILE_SIZE);
        expect(tweens[0].config.targets).toBe(sprite);
    });

    it('uses default duration of 150ms and default easing', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite();

        // Act
        animator.moveTo(sprite, { x: 1, y: 1 });

        // Assert
        expect(tweens[0].config.duration).toBe(150);
        expect(tweens[0].config.ease).toBe('Cubic.easeOut');
    });

    it('allows overriding duration and easing via options', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite();

        // Act
        animator.moveTo(sprite, { x: 1, y: 1 }, { duration: 300, ease: 'Linear' });

        // Assert
        expect(tweens[0].config.duration).toBe(300);
        expect(tweens[0].config.ease).toBe('Linear');
    });

    it('invokes onComplete callback when animation finishes', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite();
        const onComplete = vi.fn();

        // Act
        animator.moveTo(sprite, { x: 2, y: 2 }, { onComplete });
        tweens[0].triggerComplete();

        // Assert
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('reports isAnimating as true while tween is active', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite();

        // Act & Assert
        expect(animator.isAnimating(sprite)).toBe(false);

        animator.moveTo(sprite, { x: 1, y: 1 });
        expect(animator.isAnimating(sprite)).toBe(true);

        tweens[0].triggerComplete();
        expect(animator.isAnimating(sprite)).toBe(false);
    });

    it('completes existing tween before starting a new one for the same sprite', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const sprite = createFakeSprite();

        // Act
        animator.moveTo(sprite, { x: 1, y: 1 });
        animator.moveTo(sprite, { x: 2, y: 2 });

        // Assert
        expect(tweens).toHaveLength(2);
        expect(tweens[0].completeCalled).toBe(true);
        expect(tweens[1].config.x).toBe(2 * TILE_SIZE);
        expect(tweens[1].config.y).toBe(2 * TILE_SIZE);
    });

    it('does not interfere with tweens of different sprites', () => {
        // Arrange
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, TILE_SIZE);
        const spriteA = createFakeSprite();
        const spriteB = createFakeSprite();

        // Act
        animator.moveTo(spriteA, { x: 1, y: 1 });
        animator.moveTo(spriteB, { x: 2, y: 2 });

        // Assert
        expect(tweens).toHaveLength(2);
        expect(tweens[0].completeCalled).toBe(false);
        expect(animator.isAnimating(spriteA)).toBe(true);
        expect(animator.isAnimating(spriteB)).toBe(true);
    });

    it('respects custom tileSize from constructor', () => {
        // Arrange
        const customTileSize = 64;
        const { factory, tweens } = createFakeTweenFactory();
        const animator = new MovementAnimator(factory, customTileSize);
        const sprite = createFakeSprite();

        // Act
        animator.moveTo(sprite, { x: 2, y: 3 });

        // Assert
        expect(tweens[0].config.x).toBe(2 * customTileSize);
        expect(tweens[0].config.y).toBe(3 * customTileSize);
    });
});
