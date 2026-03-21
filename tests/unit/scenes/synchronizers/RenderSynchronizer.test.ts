import { describe, expect, it, vi } from 'vitest';
import { Player } from '../../../../src/domain/entities/Player';
import type { MapData } from '../../../../src/infra/rot/MapGenerator';
import { RenderSynchronizer } from '../../../../src/scenes/synchronizers/RenderSynchronizer';
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

    setTint() {
        return this;
    }
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

describe('RenderSynchronizer', () => {
    it('keeps the reused player sprite visible above a newly rendered floor map', () => {
        // Arrange
        const scene = new FakeScene();
        const synchronizer = new RenderSynchronizer(
            scene as unknown as Phaser.Scene,
            new GameLocalization(),
            32,
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
});
