import 'phaser';

const DEFAULT_DURATION_MS = 150;
const DEFAULT_EASING = 'Cubic.easeOut';

interface TilePosition {
    readonly x: number;
    readonly y: number;
}

interface MovementAnimationOptions {
    readonly duration?: number;
    readonly ease?: string;
    readonly onComplete?: () => void;
}

interface TweenConfig {
    readonly targets: Phaser.GameObjects.Sprite;
    readonly x: number;
    readonly y: number;
    readonly duration: number;
    readonly ease: string;
    readonly onComplete?: () => void;
}

interface ActiveTween {
    readonly stop: () => void;
    readonly complete: () => void;
}

/**
 * Abstracts Tween creation so unit tests can verify behavior
 * without a real Phaser Scene.
 */
export interface TweenFactory {
    create(config: TweenConfig): ActiveTween;
}

/**
 * Default factory that delegates to Phaser's Scene tween manager.
 */
export class PhaserTweenFactory implements TweenFactory {
    constructor(private readonly scene: Phaser.Scene) {}

    public create(config: TweenConfig): ActiveTween {
        const tween = this.scene.tweens.add({
            targets: config.targets,
            x: config.x,
            y: config.y,
            duration: config.duration,
            ease: config.ease,
            onComplete: config.onComplete,
        });
        return {
            stop: () => tween.stop(),
            complete: () => tween.complete(),
        };
    }
}

/**
 * Provides animation duration for a given sprite.
 * This allows different entities to have different movement speeds.
 */
export interface AnimationDurationProvider {
    getDuration(sprite: Phaser.GameObjects.Sprite): number;
}

export class MovementAnimator {
    private readonly activeTweens = new Map<Phaser.GameObjects.Sprite, ActiveTween>();

    constructor(
        private readonly tweenFactory: TweenFactory,
        private readonly tileSize: number,
        private readonly durationProvider?: AnimationDurationProvider,
    ) {}

    /**
     * Animate a sprite from its current pixel position to the target tile coordinate.
     * If the sprite already has an active tween, it is completed immediately
     * before starting the new one.
     */
    public moveTo(
        sprite: Phaser.GameObjects.Sprite,
        targetTile: TilePosition,
        options: MovementAnimationOptions = {},
    ): void {
        this.completeExistingTween(sprite);

        const targetX = targetTile.x * this.tileSize;
        const targetY = targetTile.y * this.tileSize;
        const duration = options.duration ?? this.durationProvider?.getDuration(sprite) ?? DEFAULT_DURATION_MS;
        const ease = options.ease ?? DEFAULT_EASING;

        const tween = this.tweenFactory.create({
            targets: sprite,
            x: targetX,
            y: targetY,
            duration,
            ease,
            onComplete: () => {
                this.activeTweens.delete(sprite);
                options.onComplete?.();
            },
        });

        this.activeTweens.set(sprite, tween);
    }

    /**
     * Returns true if the given sprite currently has an active movement tween.
     */
    public isAnimating(sprite: Phaser.GameObjects.Sprite): boolean {
        return this.activeTweens.has(sprite);
    }

    /**
     * Returns true if any sprite currently has an active movement tween.
     */
    public hasActiveAnimations(): boolean {
        return this.activeTweens.size > 0;
    }

    /**
     * Cancels an active tween without forcing it to complete.
     * Used when a floor transition or scene reset must place the sprite immediately.
     */
    public cancel(sprite: Phaser.GameObjects.Sprite): void {
        const existing = this.activeTweens.get(sprite);
        if (!existing) {
            return;
        }

        existing.stop();
        this.activeTweens.delete(sprite);
    }

    private completeExistingTween(sprite: Phaser.GameObjects.Sprite): void {
        const existing = this.activeTweens.get(sprite);
        if (!existing) return;

        existing.complete();
        this.activeTweens.delete(sprite);
    }
}
