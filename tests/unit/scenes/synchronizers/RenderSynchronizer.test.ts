import { describe, expect, it, vi } from 'vitest';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import { Player } from '../../../../src/domain/entities/Player';
import type { MapData } from '../../../../src/infra/rot/MapGenerator';
import { RenderSynchronizer } from '../../../../src/scenes/synchronizers/RenderSynchronizer';
import { MovementAnimator, type TweenFactory } from '../../../../src/scenes/synchronizers/MovementAnimator';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';
import { GameLocalization } from '../../../../src/ui/GameLocalization';

vi.mock('phaser', () => ({}));

class FakeTilemapLayer {
    depth = 0;
    destroyed = false;

    setDepth(depth: number) {
        this.depth = depth;
        return this;
    }

    destroy() {
        this.destroyed = true;
    }
}

class FakeTilemap {
    public readonly layers: FakeTilemapLayer[] = [];

    addTilesetImage() {
        return {};
    }

    createLayer() {
        const layer = new FakeTilemapLayer();
        this.layers.push(layer);
        return layer;
    }
}

class FakeSprite {
    depth = 0;
    visible = true;
    alpha = 1;
    x = 0;
    y = 0;
    scale = 1;
    tintValue?: number;

    setOrigin() {
        return this;
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
    }

    setDepth(depth: number) {
        this.depth = depth;
        return this;
    }

    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    setAlpha(alpha: number) {
        this.alpha = alpha;
        return this;
    }

    clearTint() {
        return this;
    }

    setTint(tint?: number) {
        this.tintValue = tint;
        return this;
    }

    setScale(scale: number) {
        this.scale = scale;
        return this;
    }
}

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
}

function createFakeTweenFactory(): { factory: TweenFactory; tweens: FakeTweenRecord[] } {
    const tweens: FakeTweenRecord[] = [];

    const factory: TweenFactory = {
        create(config) {
            const record: FakeTweenRecord = {
                config: { ...config },
                triggerComplete: () => config.onComplete?.(),
            };
            tweens.push(record);
            return {
                stop: () => {},
                complete: () => { config.onComplete?.(); },
            };
        },
    };

    return { factory, tweens };
}

class FakeScene {
    public readonly tilemaps: FakeTilemap[] = [];
    public readonly sprites: FakeSprite[] = [];
    public readonly cameras = {
        main: {
            startFollow() {
                return undefined;
            },
            setZoom() {
                return undefined;
            },
            setBounds() {
                return undefined;
            },
        },
    };
    public readonly make = {
        tilemap: () => {
            const tilemap = new FakeTilemap();
            this.tilemaps.push(tilemap);
            return tilemap;
        },
    };
    public readonly add = {
        sprite: (x: number, y: number) => {
            const sprite = new FakeSprite();
            sprite.x = x;
            sprite.y = y;
            this.sprites.push(sprite);
            return sprite;
        },
        text: () => ({
            setDepth() {
                return this;
            },
            setOrigin() {
                return this;
            },
        }),
    };
}

function createMapData(): MapData {
    return {
        width: 4,
        height: 4,
        tiles: [
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
        ],
        rooms: [],
        playerSpawn: { x: 1, y: 1 },
        stairsPosition: { x: 2, y: 2 },
        restPoints: [],
        floorType: 'normal',
    };
}

const TILE_SIZE = 32;

function createEnemy(id: string, x: number, y: number): Enemy {
    return new Enemy(id, 'Test Enemy', { x, y }, { health: 10, attack: 2, defense: 1 }, 5);
}

function createSynchronizerWithAnimator(): {
    synchronizer: RenderSynchronizer;
    scene: FakeScene;
    tweens: FakeTweenRecord[];
} {
    const scene = new FakeScene();
    const { factory, tweens } = createFakeTweenFactory();
    const animator = new MovementAnimator(factory, TILE_SIZE);
    const synchronizer = new RenderSynchronizer(
        scene as unknown as Phaser.Scene,
        new GameLocalization(),
        TILE_SIZE,
        8,
        animator,
    );
    return { synchronizer, scene, tweens };
}

describe('RenderSynchronizer', () => {
    it('keeps the reused player sprite visible above a newly rendered floor map', () => {
        // Arrange
        const scene = new FakeScene();
        const synchronizer = new RenderSynchronizer(
            scene as unknown as Phaser.Scene,
            new GameLocalization(),
            TILE_SIZE,
            8,
        );
        const player = new Player({ x: 1, y: 1 });
        const firstFloor = createMapData();
        const secondFloor = {
            ...createMapData(),
            playerSpawn: { x: 2, y: 1 },
        };

        // Act
        synchronizer.renderMap(firstFloor);
        synchronizer.synchronizePlayer(player);

        player.moveTo(secondFloor.playerSpawn.x, secondFloor.playerSpawn.y);
        synchronizer.renderMap(secondFloor);
        const reusedPlayerSprite = (synchronizer as any).playerSprite as FakeSprite;
        reusedPlayerSprite.setVisible(false).setAlpha(0);
        synchronizer.synchronizePlayer(player);

        // Assert
        const mapLayer = (synchronizer as any).mapLayer as FakeTilemapLayer;
        expect(mapLayer.depth).toBe(0);
        expect(reusedPlayerSprite.depth).toBeGreaterThan(mapLayer.depth);
        expect(reusedPlayerSprite.visible).toBe(true);
        expect(reusedPlayerSprite.alpha).toBe(1);
        expect(reusedPlayerSprite.x).toBe(64);
        expect(reusedPlayerSprite.y).toBe(32);
        expect(scene.sprites).toHaveLength(1);
    });

    describe('animation integration', () => {
        it('places player sprite immediately on first creation without animation', () => {
            // Arrange
            const { synchronizer, scene, tweens } = createSynchronizerWithAnimator();
            const player = new Player({ x: 2, y: 3 });

            // Act
            synchronizer.synchronizePlayer(player);

            // Assert - no tween created, position set directly
            expect(tweens).toHaveLength(0);
            const sprite = scene.sprites[0];
            expect(sprite.x).toBe(2 * TILE_SIZE);
            expect(sprite.y).toBe(3 * TILE_SIZE);
        });

        it('uses tween animation when player sprite already exists', async () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const player = new Player({ x: 1, y: 1 });
            synchronizer.synchronizePlayer(player);
            expect(tweens).toHaveLength(0);

            // Act
            player.moveTo(3, 2);
            const promise = synchronizer.synchronizePlayer(player);

            // Assert - tween created
            expect(tweens).toHaveLength(1);
            expect(tweens[0].config.x).toBe(3 * TILE_SIZE);
            expect(tweens[0].config.y).toBe(2 * TILE_SIZE);

            // Resolve the animation
            tweens[0].triggerComplete();
            await promise;
        });

        it('returns a resolved promise on first creation', async () => {
            // Arrange
            const { synchronizer } = createSynchronizerWithAnimator();
            const player = new Player({ x: 1, y: 1 });

            // Act & Assert - should resolve immediately
            const promise = synchronizer.synchronizePlayer(player);
            await expect(promise).resolves.toBeUndefined();
        });

        it('returns a promise that resolves when player animation completes', async () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const player = new Player({ x: 1, y: 1 });
            synchronizer.synchronizePlayer(player);

            // Act
            player.moveTo(2, 2);
            const promise = synchronizer.synchronizePlayer(player);

            let resolved = false;
            promise.then(() => { resolved = true; });

            // Assert - not resolved yet
            await Promise.resolve(); // flush microtasks
            expect(resolved).toBe(false);

            // Trigger completion
            tweens[0].triggerComplete();
            await promise;
            expect(resolved).toBe(true);
        });

        it('places player immediately when immediate mode is enabled', () => {
            // Arrange
            const { synchronizer, scene, tweens } = createSynchronizerWithAnimator();
            const player = new Player({ x: 1, y: 1 });
            synchronizer.synchronizePlayer(player);

            // Act
            synchronizer.setImmediateMode(true);
            player.moveTo(3, 3);
            synchronizer.synchronizePlayer(player);

            // Assert - no tween, position set directly
            expect(tweens).toHaveLength(0);
            const sprite = scene.sprites[0];
            expect(sprite.x).toBe(3 * TILE_SIZE);
            expect(sprite.y).toBe(3 * TILE_SIZE);
        });

        it('resumes animation after immediate mode is disabled', async () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const player = new Player({ x: 1, y: 1 });
            synchronizer.synchronizePlayer(player);

            // Act - enable then disable immediate mode
            synchronizer.setImmediateMode(true);
            player.moveTo(2, 2);
            synchronizer.synchronizePlayer(player);
            synchronizer.setImmediateMode(false);

            player.moveTo(3, 3);
            const promise = synchronizer.synchronizePlayer(player);

            // Assert - tween should be created now
            expect(tweens).toHaveLength(1);
            expect(tweens[0].config.x).toBe(3 * TILE_SIZE);
            tweens[0].triggerComplete();
            await promise;
        });

        it('places enemy sprites immediately on first creation', () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const enemies = [createEnemy('e1', 2, 3), createEnemy('e2', 4, 5)];

            // Act
            synchronizer.synchronizeEnemies(enemies);

            // Assert - no tweens, sprites placed directly
            expect(tweens).toHaveLength(0);
        });

        it('animates existing enemy sprites to new positions', async () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const enemy = createEnemy('e1', 2, 3);
            synchronizer.synchronizeEnemies([enemy]);
            expect(tweens).toHaveLength(0);

            // Act - move enemy and re-synchronize
            enemy.moveTo(3, 4);
            const promise = synchronizer.synchronizeEnemies([enemy]);

            // Assert
            expect(tweens).toHaveLength(1);
            expect(tweens[0].config.x).toBe(3 * TILE_SIZE);
            expect(tweens[0].config.y).toBe(4 * TILE_SIZE);

            tweens[0].triggerComplete();
            await promise;
        });

        it('returns a promise that resolves when all enemy animations complete', async () => {
            // Arrange
            const { synchronizer, tweens } = createSynchronizerWithAnimator();
            const enemy1 = createEnemy('e1', 1, 1);
            const enemy2 = createEnemy('e2', 2, 2);
            synchronizer.synchronizeEnemies([enemy1, enemy2]);

            // Act
            enemy1.moveTo(3, 3);
            enemy2.moveTo(4, 4);
            const promise = synchronizer.synchronizeEnemies([enemy1, enemy2]);

            let resolved = false;
            promise.then(() => { resolved = true; });

            // Complete only the first animation
            tweens[0].triggerComplete();
            await Promise.resolve();
            expect(resolved).toBe(false);

            // Complete the second animation
            tweens[1].triggerComplete();
            await promise;
            expect(resolved).toBe(true);
        });

        it('places enemies immediately in immediate mode', () => {
            // Arrange
            const { synchronizer, scene, tweens } = createSynchronizerWithAnimator();
            const enemy = createEnemy('e1', 2, 3);
            synchronizer.synchronizeEnemies([enemy]);

            // Act
            synchronizer.setImmediateMode(true);
            enemy.moveTo(4, 5);
            synchronizer.synchronizeEnemies([enemy]);

            // Assert
            expect(tweens).toHaveLength(0);
            const sprite = scene.sprites[0];
            expect(sprite.x).toBe(4 * TILE_SIZE);
            expect(sprite.y).toBe(5 * TILE_SIZE);
        });

        it('handles mix of new and existing enemy sprites', async () => {
            // Arrange
            const { synchronizer, scene, tweens } = createSynchronizerWithAnimator();
            const existingEnemy = createEnemy('e1', 1, 1);
            synchronizer.synchronizeEnemies([existingEnemy]);

            // Act - add a new enemy alongside the existing one
            const newEnemy = createEnemy('e2', 5, 5);
            existingEnemy.moveTo(2, 2);
            const promise = synchronizer.synchronizeEnemies([existingEnemy, newEnemy]);

            // Assert - only existing enemy gets a tween; new one placed immediately
            expect(tweens).toHaveLength(1);
            expect(tweens[0].config.x).toBe(2 * TILE_SIZE);
            expect(scene.sprites).toHaveLength(2);
            const newSprite = scene.sprites[1];
            expect(newSprite.x).toBe(5 * TILE_SIZE);
            expect(newSprite.y).toBe(5 * TILE_SIZE);

            tweens[0].triggerComplete();
            await promise;
        });

        it('works without MovementAnimator (backward compatibility)', () => {
            // Arrange
            const scene = new FakeScene();
            const synchronizer = new RenderSynchronizer(
                scene as unknown as Phaser.Scene,
                new GameLocalization(),
                TILE_SIZE,
                8,
            );
            const player = new Player({ x: 1, y: 1 });

            // Act
            synchronizer.synchronizePlayer(player);
            player.moveTo(3, 3);
            synchronizer.synchronizePlayer(player);

            // Assert - falls back to setPosition
            const sprite = scene.sprites[0];
            expect(sprite.x).toBe(3 * TILE_SIZE);
            expect(sprite.y).toBe(3 * TILE_SIZE);
        });
    });
});
