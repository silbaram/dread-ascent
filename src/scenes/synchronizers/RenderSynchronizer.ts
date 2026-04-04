import 'phaser';
import { Enemy } from '../../domain/entities/Enemy';
import { ItemEntity, ITEM_RARITY } from '../../domain/entities/Item';
import { type Position, Player } from '../../domain/entities/Player';
import { VisibilityService, VisibilityState } from '../../domain/services/VisibilityService';
import { MapData } from '../../infra/rot/MapGenerator';
import { RotFovCalculator } from '../../infra/rot/RotFovCalculator';
import { isWalkableTile } from '../../shared/types/WorldTiles';
import { GameLocalization } from '../../ui/GameLocalization';
import { SpriteMovementDurationPolicy } from './MovementDurationPolicy';
import { MovementAnimator } from './MovementAnimator';

const MAP_LAYER_DEPTH = 0;
const PLAYER_SPRITE_DEPTH = 1;
const ITEM_LABEL_DEPTH = 1;
const FLOATING_DAMAGE_DEPTH = 3;

export class RenderSynchronizer {
    private mapLayer?: Phaser.Tilemaps.TilemapLayer;
    private playerSprite?: Phaser.GameObjects.Sprite;
    private readonly enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
    private readonly itemLabels = new Map<string, Phaser.GameObjects.Text>();
    private visibilityService?: VisibilityService;
    private immediateMode = false;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly localization: GameLocalization,
        private readonly tileSize: number,
        private readonly fovRadius: number,
        private readonly movementAnimator?: MovementAnimator,
        private readonly movementDurationPolicy?: SpriteMovementDurationPolicy,
    ) {}

    /**
     * When immediate mode is enabled, synchronizePlayer and synchronizeEnemies
     * place sprites instantly without animation. Used during buildFloor transitions.
     */
    public setImmediateMode(enabled: boolean): void {
        this.immediateMode = enabled;
    }

    public initializeVisibilityService(mapData: MapData) {
        this.visibilityService = new VisibilityService(
            mapData.width,
            mapData.height,
            new RotFovCalculator((x, y) => this.isTransparentTile(x, y, mapData)),
        );
    }

    private isTransparentTile(x: number, y: number, mapData: MapData) {
        if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) return false;
        return isWalkableTile(mapData.tiles[y][x]);
    }

    public renderMap(mapData: MapData) {
        this.mapLayer?.destroy();

        const map = this.scene.make.tilemap({
            data: mapData.tiles,
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
        });

        const tileset = map.addTilesetImage('tiles', 'tiles', this.tileSize, this.tileSize, 0, 0);
        if (tileset) {
            this.mapLayer = map.createLayer(0, tileset, 0, 0) || undefined;
            this.mapLayer?.setDepth(MAP_LAYER_DEPTH);
        }
    }

    public synchronizePlayer(player: Player): Promise<void> {
        const isFirstCreation = !this.playerSprite;

        if (isFirstCreation) {
            this.playerSprite = this.scene.add
                .sprite(player.position.x * this.tileSize, player.position.y * this.tileSize, 'player')
                .setOrigin(0);
            this.scene.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
            this.scene.cameras.main.setZoom(1.5);
        }

        this.playerSprite!
            .setDepth(PLAYER_SPRITE_DEPTH)
            .setVisible(true)
            .setAlpha(1);
        this.movementDurationPolicy?.bindSprite(this.playerSprite!, player.stats.movementSpeed);

        if (isFirstCreation || this.immediateMode || !this.movementAnimator) {
            this.movementAnimator?.cancel(this.playerSprite!);
            this.playerSprite!.setPosition(
                player.position.x * this.tileSize,
                player.position.y * this.tileSize,
            );
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.movementAnimator!.moveTo(this.playerSprite!, player.position, {
                onComplete: resolve,
            });
        });
    }

    public clearEnemySprites() {
        for (const sprite of this.enemySprites.values()) {
            this.movementAnimator?.cancel(sprite);
            this.movementDurationPolicy?.unbindSprite(sprite);
            sprite.destroy();
        }
        this.enemySprites.clear();
    }

    /**
     * Returns true if the given position is currently visible to the player.
     */
    public isPositionVisible(pos: { x: number; y: number }): boolean {
        if (!this.visibilityService) return false;
        return this.visibilityService.getState(pos.x, pos.y) === 'visible';
    }

    public synchronizeEnemies(enemies: Enemy[], options: { duration?: number; immediate?: boolean } = {}): Promise<void> {
        const animationPromises: Promise<void>[] = [];

        for (const enemy of enemies) {
            let sprite = this.enemySprites.get(enemy.id);
            const isFirstCreation = !sprite;

            if (isFirstCreation) {
                sprite = this.scene.add
                    .sprite(
                        enemy.position.x * this.tileSize,
                        enemy.position.y * this.tileSize,
                        this.getEnemyTextureKey(enemy),
                    )
                    .setOrigin(0);
                this.applyEnemySpriteStyle(sprite, enemy);
                this.enemySprites.set(enemy.id, sprite);
                this.movementDurationPolicy?.bindSprite(sprite, enemy.stats.movementSpeed);
                continue;
            }

            this.movementDurationPolicy?.bindSprite(sprite!, enemy.stats.movementSpeed);
            const immediate = options.immediate || this.immediateMode || !this.movementAnimator;
            if (immediate) {
                this.movementAnimator?.cancel(sprite!);
                sprite!.setPosition(enemy.position.x * this.tileSize, enemy.position.y * this.tileSize);
                continue;
            }

            animationPromises.push(
                new Promise<void>((resolve) => {
                    this.movementAnimator!.moveTo(sprite!, enemy.position, {
                        duration: options.duration,
                        onComplete: resolve,
                    });
                }),
            );
        }

        if (animationPromises.length === 0) {
            return Promise.resolve();
        }
        return Promise.all(animationPromises).then(() => undefined);
    }

    public removeEnemySprite(enemyId: string) {
        const sprite = this.enemySprites.get(enemyId);
        if (sprite) {
            this.movementAnimator?.cancel(sprite);
            this.movementDurationPolicy?.unbindSprite(sprite);
        }
        sprite?.destroy();
        this.enemySprites.delete(enemyId);
    }

    public clearItemLabels() {
        for (const label of this.itemLabels.values()) {
            label.destroy();
        }
        this.itemLabels.clear();
    }

    public synchronizeItems(items: ItemEntity[]) {
        for (const item of items) {
            if (!this.itemLabels.has(item.instanceId)) {
                this.renderFieldItem(item);
            }
        }
    }

    public removeItemLabel(instanceId: string) {
        const label = this.itemLabels.get(instanceId);
        label?.destroy();
        this.itemLabels.delete(instanceId);
    }

    private renderFieldItem(item: ItemEntity) {
        const label = this.scene.add.text(
            (item.position.x * this.tileSize) + (this.tileSize / 2),
            (item.position.y * this.tileSize) + (this.tileSize / 2),
            `${item.definition.icon}\n${this.getItemDisplayName(item.definition)}`,
            {
                align: 'center',
                color: this.getItemRarityColor(item.rarity),
                fontFamily: 'monospace',
                fontSize: '11px',
                stroke: '#111827',
                strokeThickness: 2,
            },
        )
            .setDepth(ITEM_LABEL_DEPTH)
            .setOrigin(0.5);
        this.itemLabels.set(item.instanceId, label);
    }

    public refreshFieldItemLabels(items: ItemEntity[]) {
        for (const item of items) {
            const label = this.itemLabels.get(item.instanceId);
            if (label) {
                label.setText(`${item.definition.icon}\n${this.getItemDisplayName(item.definition)}`);
            }
        }
    }

    public updateVisibility(playerPos: Position, mapData: MapData, enemies: Enemy[], items: ItemEntity[]) {
        if (!this.mapLayer || !this.visibilityService) return;

        const snapshot = this.visibilityService.recalculate(playerPos, this.fovRadius);

        for (let y = 0; y < mapData.height; y++) {
            for (let x = 0; x < mapData.width; x++) {
                this.applyVisibilityToTile(x, y, snapshot.tiles[y][x]);
            }
        }

        this.applyVisibilityToEnemies(enemies, snapshot.tiles);
        this.applyVisibilityToItems(items, snapshot.tiles);
    }

    private applyVisibilityToTile(x: number, y: number, state: VisibilityState) {
        const tile = this.mapLayer?.getTileAt(x, y);
        if (!tile) return;

        switch (state) {
            case 'visible':
                tile.setAlpha(1);
                tile.tint = 0xffffff;
                break;
            case 'explored':
                tile.setAlpha(0.3);
                tile.tint = 0x888888;
                break;
            case 'hidden':
                tile.setAlpha(0);
                tile.tint = 0xffffff;
                break;
        }
    }

    private applyVisibilityToEnemies(enemies: Enemy[], states: VisibilityState[][]) {
        for (const enemy of enemies) {
            const sprite = this.enemySprites.get(enemy.id);
            if (!sprite) continue;

            const state = states[enemy.position.y]?.[enemy.position.x];
            const visible = state === 'visible';
            sprite.setVisible(visible);
            sprite.setAlpha(visible ? 1 : 0);
        }
    }

    private applyVisibilityToItems(items: ItemEntity[], states: VisibilityState[][]) {
        for (const item of items) {
            const label = this.itemLabels.get(item.instanceId);
            if (!label) continue;

            const state = states[item.position.y]?.[item.position.x];
            const visible = state === 'visible';
            label.setVisible(visible);
            label.setAlpha(visible ? 1 : 0);
        }
    }

    public spawnFloatingDamage(
        position: Position,
        damage: number,
        isCritical: boolean,
        target: 'enemy' | 'player',
    ) {
        const color = isCritical
            ? '#fbbf24'
            : target === 'enemy'
                ? '#fca5a5'
                : '#93c5fd';
        const damageLabel = this.scene.add.text(
            (position.x * this.tileSize) + (this.tileSize / 2),
            (position.y * this.tileSize) + 8,
            `${damage}`,
            {
                color,
                fontFamily: 'monospace',
                fontSize: isCritical ? '18px' : '15px',
                stroke: '#111827',
                strokeThickness: 4,
            },
        )
            .setDepth(FLOATING_DAMAGE_DEPTH)
            .setOrigin(0.5);
        damageLabel.setAlpha(0.96);

        this.scene.tweens.add({
            targets: damageLabel,
            y: damageLabel.y - (this.tileSize * 0.7),
            alpha: 0,
            scaleX: isCritical ? 1.16 : 1,
            scaleY: isCritical ? 1.16 : 1,
            duration: isCritical ? 520 : 420,
            ease: 'Cubic.easeOut',
            onComplete: () => damageLabel.destroy(),
        });
    }

    /**
     * Returns true if any movement animation is currently in progress.
     */
    public isAnimating(): boolean {
        return this.movementAnimator?.hasActiveAnimations() ?? false;
    }

    public setPlayerDeathStyle() {
        this.playerSprite?.setTint(0x991b1b);
    }

    public clearPlayerTint() {
        this.playerSprite?.clearTint();
    }

    public updateCameras(mapData: MapData) {
        this.scene.cameras.main.setBounds(0, 0, mapData.width * this.tileSize, mapData.height * this.tileSize);
    }

    private getEnemyTextureKey(enemy: Enemy) {
        if (enemy.isBoss()) {
            return 'boss';
        }
        return `enemy-${enemy.archetypeId}`;
    }

    private applyEnemySpriteStyle(sprite: Phaser.GameObjects.Sprite, enemy: Enemy) {
        if (enemy.isBoss()) {
            sprite.setDepth(1);
            return;
        }
        sprite.setScale(enemy.isElite() ? 1.14 : 1);
        if (enemy.isElite()) {
            sprite.setTint(0xfbbf24);
        }
    }

    private getItemDisplayName(item: { id: string; name: string }) {
        return this.localization.getItemName(item.id, item.name);
    }

    private getItemRarityColor(rarity: ItemEntity['rarity']) {
        switch (rarity) {
            case ITEM_RARITY.LEGENDARY:
                return '#facc15';
            case ITEM_RARITY.RARE:
                return '#7dd3fc';
            case ITEM_RARITY.COMMON:
            default:
                return '#fef08a';
        }
    }
}
