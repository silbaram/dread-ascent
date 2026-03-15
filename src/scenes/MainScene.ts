import 'phaser';
import { Enemy } from '../domain/entities/Enemy';
import { ItemEntity, ITEM_RARITY } from '../domain/entities/Item';
import { type Position, Player } from '../domain/entities/Player';
import { EnemyAiService } from '../domain/services/EnemyAiService';
import { CombatService } from '../domain/services/CombatService';
import { EnemySpawnerService } from '../domain/services/EnemySpawnerService';
import {
    FloorProgressionService,
    type FloorSnapshot,
} from '../domain/services/FloorProgressionService';
import { ItemService } from '../domain/services/ItemService';
import {
    MetaProgressionService,
    type PermanentUpgradeKey,
} from '../domain/services/MetaProgressionService';
import {
    RunPersistenceService,
    type PersistedRunStatus,
} from '../domain/services/RunPersistenceService';
import { SoulShardService } from '../domain/services/SoulShardService';
import { VisibilityService, VisibilityState } from '../domain/services/VisibilityService';
import { MapGenerator, type MapData } from '../infra/rot/MapGenerator';
import { RotFovCalculator } from '../infra/rot/RotFovCalculator';
import { RotPathFinder } from '../infra/rot/RotPathFinder';
import { type TurnActor, TurnQueueService } from '../domain/services/TurnQueueService';
import { RotTurnScheduler } from '../infra/rot/RotTurnScheduler';
import { formatSignedNumber } from '../shared/utils/formatSignedNumber';
import { WORLD_TILE, isWalkableTile } from '../shared/types/WorldTiles';
import { type HudLogTone, GameHud } from '../ui/GameHud';

export class MainScene extends Phaser.Scene {
    private mapData?: MapData;
    private tileSize: number = 32;
    private playerEntity?: Player;
    private playerSprite?: Phaser.GameObjects.Sprite;
    private mapLayer?: Phaser.Tilemaps.TilemapLayer;
    private visibilityService?: VisibilityService;
    private fovRadius: number = 8;
    private turnQueue?: TurnQueueService;
    private enemyEntities: Enemy[] = [];
    private readonly enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
    private fieldItems: ItemEntity[] = [];
    private readonly itemLabels = new Map<string, Phaser.GameObjects.Text>();
    private isTitleScreenOpen = false;
    private isSanctuaryOpen = false;
    private isInventoryOpen = false;
    private selectedInventoryItemId?: string;
    private isGameOver = false;
    private isVictory = false;
    private defeatedEnemyCount = 0;
    private titleScreenMessage?: { text: string; tone: HudLogTone };
    private readonly combatService = new CombatService();
    private readonly enemySpawner = new EnemySpawnerService();
    private readonly floorProgression = new FloorProgressionService();
    private readonly itemService = new ItemService();
    private readonly soulShardService = new SoulShardService();
    private readonly metaProgression = new MetaProgressionService(this.soulShardService);
    private readonly runPersistence = new RunPersistenceService();

    constructor(private readonly hud: GameHud) {
        super({ key: 'MainScene' });
    }

    preload() {
        // Create simple tiles as textures if assets are missing
        this.generateDefaultTextures();
    }

    private generateDefaultTextures() {
        const graphics = this.make.graphics({ x: 0, y: 0 });

        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.lineStyle(1, 0x444444, 0.5);
        graphics.strokeRect(0, 0, this.tileSize, this.tileSize);

        graphics.fillStyle(0x666666, 1);
        graphics.fillRect(this.tileSize, 0, this.tileSize, this.tileSize);
        graphics.lineStyle(1, 0x777777, 0.5);
        graphics.strokeRect(this.tileSize, 0, this.tileSize, this.tileSize);

        graphics.fillStyle(0x5c4a16, 1);
        graphics.fillRect(this.tileSize * 2, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0xd4a017, 1);
        graphics.fillRect((this.tileSize * 2) + 8, 6, this.tileSize - 16, 4);
        graphics.fillRect((this.tileSize * 2) + 12, 14, this.tileSize - 20, 4);
        graphics.fillRect((this.tileSize * 2) + 16, 22, this.tileSize - 24, 4);
        graphics.lineStyle(1, 0xeab308, 0.7);
        graphics.strokeRect(this.tileSize * 2, 0, this.tileSize, this.tileSize);

        graphics.fillStyle(0x214f3b, 1);
        graphics.fillRect(this.tileSize * 3, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x6ee7b7, 1);
        graphics.fillCircle((this.tileSize * 3) + (this.tileSize / 2), this.tileSize / 2, this.tileSize * 0.28);
        graphics.lineStyle(1, 0x9ae6b4, 0.7);
        graphics.strokeRect(this.tileSize * 3, 0, this.tileSize, this.tileSize);

        graphics.generateTexture('tiles', this.tileSize * 4, this.tileSize);

        const playerGraphics = this.make.graphics({ x: 0, y: 0 });
        playerGraphics.fillStyle(0x00ffff, 1);
        playerGraphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize * 0.4);
        playerGraphics.generateTexture('player', this.tileSize, this.tileSize);

        const crawlerGraphics = this.make.graphics({ x: 0, y: 0 });
        crawlerGraphics.fillStyle(0x2f855a, 1);
        crawlerGraphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize * 0.34);
        crawlerGraphics.fillStyle(0x111827, 1);
        crawlerGraphics.fillCircle((this.tileSize / 2) - 5, (this.tileSize / 2) - 4, 2);
        crawlerGraphics.fillCircle((this.tileSize / 2) + 5, (this.tileSize / 2) - 4, 2);
        crawlerGraphics.generateTexture('enemy-ash-crawler', this.tileSize, this.tileSize);

        const raiderGraphics = this.make.graphics({ x: 0, y: 0 });
        raiderGraphics.fillStyle(0xb91c1c, 1);
        raiderGraphics.fillRect(6, 6, this.tileSize - 12, this.tileSize - 12);
        raiderGraphics.fillStyle(0x111827, 1);
        raiderGraphics.fillRect(10, 10, 4, 4);
        raiderGraphics.fillRect(this.tileSize - 14, 10, 4, 4);
        raiderGraphics.fillStyle(0xf97316, 1);
        raiderGraphics.fillRect(12, this.tileSize - 14, this.tileSize - 24, 4);
        raiderGraphics.generateTexture('enemy-blade-raider', this.tileSize, this.tileSize);

        const sentinelGraphics = this.make.graphics({ x: 0, y: 0 });
        sentinelGraphics.fillStyle(0x1d4ed8, 1);
        sentinelGraphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        sentinelGraphics.fillStyle(0x93c5fd, 1);
        sentinelGraphics.fillRect(10, 10, this.tileSize - 20, this.tileSize - 20);
        sentinelGraphics.fillStyle(0x111827, 1);
        sentinelGraphics.fillRect(10, 10, 4, 4);
        sentinelGraphics.fillRect(this.tileSize - 14, 10, 4, 4);
        sentinelGraphics.generateTexture('enemy-dread-sentinel', this.tileSize, this.tileSize);

        const bossGraphics = this.make.graphics({ x: 0, y: 0 });
        bossGraphics.fillStyle(0x7f1d1d, 1);
        bossGraphics.fillRect(4, 6, this.tileSize - 8, this.tileSize - 8);
        bossGraphics.fillStyle(0xfbbf24, 1);
        bossGraphics.fillRect(8, 4, 6, 6);
        bossGraphics.fillRect(this.tileSize - 14, 4, 6, 6);
        bossGraphics.fillStyle(0x111827, 1);
        bossGraphics.fillRect(10, 12, 4, 4);
        bossGraphics.fillRect(this.tileSize - 14, 12, 4, 4);
        bossGraphics.fillStyle(0xfca5a5, 1);
        bossGraphics.fillRect(10, this.tileSize - 12, this.tileSize - 20, 4);
        bossGraphics.generateTexture('boss', this.tileSize, this.tileSize);
    }

    create() {
        this.hud.clearLogs();
        this.hud.clearEventBanner();
        this.hud.setInventoryHandlers({
            onClose: () => this.setInventoryOpen(false),
            onUseItem: () => this.useSelectedInventoryItem(),
            onDropItem: () => this.dropSelectedInventoryItem(),
            onSelectItem: (instanceId) => this.selectInventoryItem(instanceId),
        });
        this.hud.setRunOverlayHandlers({
            onContinueRun: () => this.resumeSavedRun(),
            onReturnToTitle: () => this.returnToTitleScreen(),
            onStartNewRun: () => this.startNewRun(),
            onOpenSanctuary: () => this.openSanctuary(),
            onCloseSanctuary: () => this.closeSanctuary(),
            onPurchaseUpgrade: (key) => this.purchaseSanctuaryUpgrade(key),
        });
        this.hud.updateGameOver({
            isOpen: false,
            floorNumber: 1,
            defeatedEnemies: 0,
            earnedSoulShards: 0,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
        });
        this.hud.updateVictory({
            isOpen: false,
            floorNumber: 100,
            defeatedEnemies: 0,
            bossName: 'Final Boss',
        });
        this.hud.updateBoss({
            isVisible: false,
            name: 'Final Boss',
            health: 0,
            maxHealth: 0,
        });
        this.setupInput();
        this.returnToTitleScreen();
        console.log('MainScene initialized with floor progression');
    }

    private initializeVisibilityService() {
        const data = this.mapData;
        if (!data) return;

        this.visibilityService = new VisibilityService(
            data.width,
            data.height,
            new RotFovCalculator((x, y) => this.isTransparentTile(x, y)),
        );
    }

    private setupInput() {
        if (!this.input.keyboard) return;

        // Single key press events for grid-based movement
        this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        });
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.code === 'Tab') {
            event.preventDefault();
        }

        if (this.isTitleScreenOpen) {
            if (event.code === 'Escape' && this.isSanctuaryOpen) {
                this.closeSanctuary();
            }
            return;
        }

        if (event.code === 'KeyI' || event.code === 'Tab') {
            this.toggleInventoryOpen();
            return;
        }

        if (event.code === 'Escape' && this.isInventoryOpen) {
            this.setInventoryOpen(false);
            return;
        }

        if (this.isInventoryOpen || !this.playerEntity || !this.isPlayerTurn()) return;

        let dx = 0;
        let dy = 0;

        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                dx = -1;
                break;
            case 'ArrowRight':
            case 'KeyD':
                dx = 1;
                break;
            case 'ArrowUp':
            case 'KeyW':
                dy = -1;
                break;
            case 'ArrowDown':
            case 'KeyS':
                dy = 1;
                break;
        }

        if (dx !== 0 || dy !== 0) {
            this.tryMove(dx, dy);
        }
    }

    private tryMove(dx: number, dy: number) {
        if (!this.playerEntity || !this.mapData) return;

        const newX = this.playerEntity.position.x + dx;
        const newY = this.playerEntity.position.y + dy;

        // Check map bounds
        if (newX < 0 || newX >= this.mapData.width || newY < 0 || newY >= this.mapData.height) {
            return;
        }

        const targetEnemy = this.getEnemyAt(newX, newY);
        if (targetEnemy) {
            this.performPlayerAttack(targetEnemy);
            return;
        }
        const targetTile = this.mapData.tiles[newY][newX];
        if (!isWalkableTile(targetTile)) {
            return;
        }

        this.playerEntity.moveTo(newX, newY);
        if (this.playerSprite) {
            this.playerSprite.setPosition(newX * this.tileSize, newY * this.tileSize);
        }

        this.updateVisibility();
        const pickupLog = this.collectItemAtPlayerPosition();

        if (targetTile === WORLD_TILE.STAIRS) {
            this.pushTurnLog('Player climbs the stairs.');
            this.advanceToNextFloor();
            return;
        }

        if (targetTile === WORLD_TILE.REST) {
            this.completePlayerTurn('Player steps into the sanctuary.');
            return;
        }

        this.completePlayerTurn(
            `Player moved ${this.describeDirection(dx, dy)}.`,
            pickupLog ? [pickupLog] : [],
        );
    }

    private updateVisibility() {
        if (!this.playerEntity || !this.mapData || !this.mapLayer || !this.visibilityService) return;

        const snapshot = this.visibilityService.recalculate(this.playerEntity.position, this.fovRadius);

        for (let y = 0; y < this.mapData.height; y++) {
            for (let x = 0; x < this.mapData.width; x++) {
                this.applyVisibilityToTile(x, y, snapshot.tiles[y][x]);
            }
        }

        this.applyVisibilityToEnemies(snapshot.tiles);
        this.applyVisibilityToItems(snapshot.tiles);
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

    private isTransparentTile(x: number, y: number) {
        const data = this.mapData;
        if (!data) return false;
        if (x < 0 || x >= data.width || y < 0 || y >= data.height) return false;

        return isWalkableTile(data.tiles[y][x]);
    }

    private renderMap() {
        if (!this.mapData) return;
        this.mapLayer?.destroy();

        const map = this.make.tilemap({
            data: this.mapData.tiles,
            tileWidth: this.tileSize,
            tileHeight: this.tileSize
        });

        const tileset = map.addTilesetImage('tiles', 'tiles', this.tileSize, this.tileSize, 0, 0);
        if (tileset) {
            this.mapLayer = map.createLayer(0, tileset, 0, 0) || undefined;
        }
    }

    private spawnEnemies(floorNumber: number) {
        if (!this.mapData) return;

        this.clearEnemySprites();
        this.enemyEntities = this.enemySpawner.spawn({
            floorNumber,
            floorType: this.mapData.floorType,
            tiles: this.mapData.tiles,
            rooms: this.mapData.rooms,
            bossSpawn: this.mapData.bossSpawn,
            blockedPositions: [
                this.mapData.playerSpawn,
                this.mapData.stairsPosition,
                ...this.mapData.restPoints,
            ],
        });

        for (const enemy of this.enemyEntities) {
            const sprite = this.add
                .sprite(
                    enemy.position.x * this.tileSize,
                    enemy.position.y * this.tileSize,
                    this.getEnemyTextureKey(enemy),
                )
                .setOrigin(0);
            this.applyEnemySpriteStyle(sprite, enemy);
            this.enemySprites.set(enemy.id, sprite);
        }
    }

    private spawnItems(floorNumber: number) {
        if (!this.mapData) return;

        this.clearItemLabels();
        this.fieldItems = this.itemService.initializeFloor({
            floorNumber,
            floorType: this.mapData.floorType,
            tiles: this.mapData.tiles,
            rooms: this.mapData.rooms,
            blockedPositions: [
                this.mapData.playerSpawn,
                this.mapData.stairsPosition,
                ...this.mapData.restPoints,
                ...this.enemyEntities.map((enemy) => enemy.position),
            ],
        });

        for (const item of this.fieldItems) {
            this.renderFieldItem(item);
        }
    }

    private clearEnemySprites() {
        for (const sprite of this.enemySprites.values()) {
            sprite.destroy();
        }

        this.enemySprites.clear();
    }

    private clearItemLabels() {
        for (const label of this.itemLabels.values()) {
            label.destroy();
        }

        this.itemLabels.clear();
        this.fieldItems = [];
    }

    private applyVisibilityToEnemies(states: VisibilityState[][]) {
        for (const enemy of this.enemyEntities) {
            const sprite = this.enemySprites.get(enemy.id);
            if (!sprite) continue;

            const state = states[enemy.position.y]?.[enemy.position.x];
            const visible = state === 'visible';
            sprite.setVisible(visible);
            sprite.setAlpha(visible ? 1 : 0);
        }
    }

    private applyVisibilityToItems(states: VisibilityState[][]) {
        for (const item of this.fieldItems) {
            const label = this.itemLabels.get(item.instanceId);
            if (!label) continue;

            const state = states[item.position.y]?.[item.position.x];
            const visible = state === 'visible';
            label.setVisible(visible);
            label.setAlpha(visible ? 1 : 0);
        }
    }

    private placePlayer(spawn: Position) {
        if (!this.playerEntity) {
            this.playerEntity = new Player(
                { x: spawn.x, y: spawn.y },
                this.metaProgression.getRunStartStats(),
            );
        } else {
            this.playerEntity.moveTo(spawn.x, spawn.y);
        }

        if (!this.playerSprite) {
            this.playerSprite = this.add
                .sprite(spawn.x * this.tileSize, spawn.y * this.tileSize, 'player')
                .setOrigin(0);
            this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
            this.cameras.main.setZoom(1.5);
        } else {
            this.playerSprite.setPosition(spawn.x * this.tileSize, spawn.y * this.tileSize);
        }
    }

    private initializeTurnQueue() {
        if (!this.playerEntity) return;

        this.turnQueue = new TurnQueueService(new RotTurnScheduler());
        this.turnQueue.initialize(
            {
                id: 'player',
                kind: 'player',
                label: 'Player',
            },
            this.createEnemyTurnActors(),
        );
    }

    private createEnemyTurnActors(): TurnActor[] {
        return this.enemyEntities.map((enemy) => ({
            id: enemy.id,
            kind: 'enemy' as const,
            label: enemy.label,
        }));
    }

    private buildFloor(floor: FloorSnapshot, arrivalLog: string) {
        this.isGameOver = false;
        this.isVictory = false;
        this.isTitleScreenOpen = false;
        this.isSanctuaryOpen = false;
        this.isInventoryOpen = false;
        this.titleScreenMessage = undefined;
        this.mapData = MapGenerator.generate(40, 30, { floorType: floor.type });
        this.initializeVisibilityService();
        this.renderMap();
        this.placePlayer(this.mapData.playerSpawn);
        this.spawnEnemies(floor.number);
        this.spawnItems(floor.number);
        this.initializeTurnQueue();
        this.updateVisibility();
        this.cameras.main.setBounds(0, 0, this.mapData.width * this.tileSize, this.mapData.height * this.tileSize);
        this.syncTitleOverlay();
        this.hud.updateGameOver({
            isOpen: false,
            floorNumber: floor.number,
            defeatedEnemies: this.defeatedEnemyCount,
            earnedSoulShards: 0,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
        });
        this.hud.updateVictory({
            isOpen: false,
            floorNumber: floor.number,
            defeatedEnemies: this.defeatedEnemyCount,
            bossName: this.getBossEnemy()?.label ?? 'Final Boss',
        });
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.refreshTurnStatus();
        this.queueFloorEventBanner(floor);

        this.pushTurnLog(arrivalLog, 'travel');
        if (floor.type === 'safe') {
            this.pushTurnLog('A quiet sanctuary awaits on this floor.');
        } else if (floor.type === 'boss') {
            this.pushTurnLog('The summit seals itself. Only the Final Boss remains.', 'danger');
        }

        const snapshot = this.turnQueue?.getSnapshot();
        if (snapshot) {
            this.pushTurnLog(`Round ${snapshot.round}: ${snapshot.activeActor.label} turn.`);
        }
    }

    private advanceToNextFloor() {
        const nextFloor = this.floorProgression.advance();
        this.buildFloor(
            nextFloor,
            `Entered floor ${nextFloor.number} (${this.formatFloorType(nextFloor.type)}).`,
        );
        this.persistRun('active');
    }

    private completePlayerTurn(
        logLine: string,
        extraLogs: Array<{ line: string; tone: HudLogTone }> = [],
    ) {
        if (!this.turnQueue || !this.playerEntity) return;

        if (logLine) {
            this.pushTurnLog(logLine);
        }
        for (const entry of extraLogs) {
            this.pushTurnLog(entry.line, entry.tone);
        }

        const resolution = this.turnQueue.completePlayerTurn();
        for (const enemyTurn of resolution.enemyTurns) {
            this.resolveEnemyTurn(enemyTurn);
            if (this.isGameOver) {
                break;
            }
        }

        this.updateVisibility();
        this.refreshTurnStatus();
        if (!this.isGameOver) {
            this.pushTurnLog(`Round ${resolution.round}: ${resolution.nextActor.label} turn.`);
        }
    }

    private collectItemAtPlayerPosition() {
        if (!this.playerEntity) {
            return undefined;
        }

        const pickup = this.itemService.pickupAt(this.playerEntity.position);
        if (!pickup) {
            return undefined;
        }

        if (pickup.status === 'inventory-full' || !pickup.inventoryItem) {
            const inventory = this.itemService.getInventorySnapshot();

            return {
                line: `Cannot carry ${pickup.fieldItem?.definition.name ?? 'this item'} (${inventory.usedSlots}/${inventory.slotCapacity} slots full).`,
                tone: 'danger' as const,
            };
        }

        const label = this.itemLabels.get(pickup.fieldItemId);
        label?.destroy();
        this.itemLabels.delete(pickup.fieldItemId);
        this.fieldItems = this.itemService.getFieldItems();
        this.syncInventoryOverlay();
        this.persistRun('active');

        return {
            line: this.describePickup(pickup.inventoryItem),
            tone: 'item' as const,
        };
    }

    private refreshTurnStatus() {
        if (this.isTitleScreenOpen) {
            const previewStats = this.metaProgression.getRunStartStats();
            this.hud.updateStatus({
                floorNumber: 1,
                floorType: 'Normal',
                health: previewStats.health,
                maxHealth: previewStats.maxHealth,
                experience: 0,
                activeTurn: this.isSanctuaryOpen ? 'Sanctuary' : 'Title Screen',
                enemyCount: 0,
                isGameOver: false,
                runState: 'playing',
            });
            return;
        }

        if (!this.playerEntity) return;

        if (this.isVictory) {
            const floor = this.floorProgression.getSnapshot();
            this.hud.updateStatus({
                floorNumber: floor.number,
                floorType: this.formatFloorType(floor.type),
                health: this.playerEntity.stats.health,
                maxHealth: this.playerEntity.stats.maxHealth,
                experience: this.playerEntity.experience,
                activeTurn: 'Ending',
                enemyCount: 0,
                isGameOver: false,
                runState: 'victory',
            });
            return;
        }

        if (this.isGameOver) {
            this.hud.updateStatus({
                floorNumber: this.floorProgression.getSnapshot().number,
                floorType: this.formatFloorType(this.floorProgression.getSnapshot().type),
                health: this.playerEntity.stats.health,
                maxHealth: this.playerEntity.stats.maxHealth,
                experience: this.playerEntity.experience,
                activeTurn: 'Game Over',
                enemyCount: this.enemyEntities.length,
                isGameOver: true,
                runState: 'game-over',
            });
            return;
        }

        if (!this.turnQueue) return;

        const snapshot = this.turnQueue.getSnapshot();
        const floor = this.floorProgression.getSnapshot();

        this.hud.updateStatus({
            floorNumber: floor.number,
            floorType: this.formatFloorType(floor.type),
            health: this.playerEntity.stats.health,
            maxHealth: this.playerEntity.stats.maxHealth,
            experience: this.playerEntity.experience,
            activeTurn: this.isInventoryOpen
                ? `Inventory · ${snapshot.activeActor.label}`
                : `Round ${snapshot.round} · ${snapshot.activeActor.label}`,
            enemyCount: snapshot.enemyCount,
            isGameOver: false,
            runState: 'playing',
        });
    }

    private pushTurnLog(line: string, tone: HudLogTone = 'system') {
        this.hud.pushLog(line, tone);
    }

    private queueFloorEventBanner(floor: FloorSnapshot) {
        this.hud.queueEventBanner(
            `Floor ${floor.number} · ${this.formatFloorType(floor.type)}`,
            'travel',
            1700,
        );

        if (floor.type === 'boss') {
            this.hud.queueEventBanner(
                `${this.getBossEnemy()?.label ?? 'Final Boss'} Approaches`,
                'danger',
                2400,
            );
        }
    }

    private persistRun(status: PersistedRunStatus) {
        if (!this.playerEntity) {
            return;
        }

        this.runPersistence.save({
            status,
            floor: this.floorProgression.getSnapshot(),
            player: {
                stats: { ...this.playerEntity.stats },
                experience: this.playerEntity.experience,
            },
            inventory: this.itemService.getInventorySnapshot().items,
            defeatedEnemyCount: this.defeatedEnemyCount,
        });
    }

    private resumeSavedRun() {
        if (!this.isTitleScreenOpen) {
            return;
        }

        const savedRun = this.runPersistence.load();
        if (!savedRun || savedRun.status !== 'active') {
            return;
        }

        this.hud.clearLogs();
        this.selectedInventoryItemId = undefined;
        this.defeatedEnemyCount = savedRun.defeatedEnemyCount;
        this.playerSprite?.clearTint();
        const floor = this.floorProgression.restore(savedRun.floor);
        this.itemService.resetRun();
        this.buildFloor(
            floor,
            `Resumed on floor ${floor.number} (${this.formatFloorType(floor.type)}).`,
        );
        this.playerEntity?.restore(savedRun.player.stats, savedRun.player.experience);
        this.itemService.restoreInventory(savedRun.inventory);
        this.syncInventoryOverlay();
        this.refreshTurnStatus();
        this.persistRun('active');
    }

    private isPlayerTurn() {
        return !this.isGameOver
            && !this.isVictory
            && this.turnQueue?.getSnapshot().activeActor.kind === 'player';
    }

    private getEnemyAt(x: number, y: number) {
        return this.enemyEntities.find((enemy) =>
            enemy.position.x === x && enemy.position.y === y,
        );
    }

    private getEnemyById(enemyId: string) {
        return this.enemyEntities.find((enemy) => enemy.id === enemyId);
    }

    private getBossEnemy() {
        return this.enemyEntities.find((enemy) => enemy.isBoss());
    }

    private syncBossHud() {
        const boss = this.getBossEnemy();
        this.hud.updateBoss({
            isVisible: !!boss && !this.isTitleScreenOpen && !this.isGameOver && !this.isVictory,
            name: boss?.label ?? 'Final Boss',
            health: boss?.stats.health ?? 0,
            maxHealth: boss?.stats.maxHealth ?? 0,
        });
    }

    private resolveEnemyTurn(enemyTurn: TurnActor) {
        if (!this.playerEntity) return;

        const enemy = this.getEnemyById(enemyTurn.id);
        if (!enemy) {
            this.pushTurnLog(`${enemyTurn.label} is no longer present.`);
            return;
        }

        const ai = new EnemyAiService(
            this.createEnemyPathFinder(enemy.id),
            new RotFovCalculator((x, y) => this.isTransparentTile(x, y)),
            this.fovRadius,
        );
        const action = ai.decide(enemy, this.playerEntity.position);

        switch (action.type) {
            case 'move':
                this.updateEnemySpritePosition(enemy);
                this.pushTurnLog(
                    action.pursuit === 'player'
                        ? `${enemy.label} advances toward the player.`
                        : `${enemy.label} searches the last known position.`,
                    'travel',
                );
                break;
            case 'attack':
                this.resolveEnemyAttack(enemy);
                break;
            case 'wait':
                this.pushTurnLog(this.describeEnemyWait(enemy, action.reason));
                break;
        }
    }

    private createEnemyPathFinder(movingEnemyId: string) {
        return new RotPathFinder((x, y) => this.isEnemyPathTileWalkable(x, y, movingEnemyId));
    }

    private isEnemyPathTileWalkable(x: number, y: number, movingEnemyId: string) {
        if (!this.mapData || !this.playerEntity) {
            return false;
        }

        if (x < 0 || x >= this.mapData.width || y < 0 || y >= this.mapData.height) {
            return false;
        }

        if (this.playerEntity.position.x === x && this.playerEntity.position.y === y) {
            return true;
        }

        const movingEnemy = this.getEnemyById(movingEnemyId);
        if (movingEnemy && movingEnemy.position.x === x && movingEnemy.position.y === y) {
            return true;
        }

        if (!isWalkableTile(this.mapData.tiles[y][x])) {
            return false;
        }

        return !this.enemyEntities.some((enemy) =>
            enemy.id !== movingEnemyId
            && enemy.position.x === x
            && enemy.position.y === y,
        );
    }

    private updateEnemySpritePosition(enemy: Enemy) {
        const sprite = this.enemySprites.get(enemy.id);
        if (!sprite) return;

        sprite.setPosition(enemy.position.x * this.tileSize, enemy.position.y * this.tileSize);
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

    private describeEnemyWait(enemy: Enemy, reason: 'idle' | 'searching' | 'blocked') {
        switch (reason) {
            case 'searching':
                return `${enemy.label} waits at the last known position.`;
            case 'blocked':
                return `${enemy.label} cannot find a path and waits.`;
            case 'idle':
            default:
                return `${enemy.label} waits.`;
        }
    }

    private spawnFloatingDamage(
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
        const damageLabel = this.add.text(
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
            .setDepth(3)
            .setOrigin(0.5);
        damageLabel.setAlpha(0.96);

        this.tweens.add({
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

    private performPlayerAttack(enemy: Enemy) {
        if (!this.playerEntity) return;

        const resolution = this.combatService.resolveAttack(this.playerEntity.stats, enemy.stats);
        enemy.applyDamage(resolution.damage);
        this.spawnFloatingDamage(enemy.position, resolution.damage, resolution.isCritical, 'enemy');
        this.syncBossHud();

        this.pushTurnLog(
            this.describeAttack('Player', enemy.label, resolution.damage, resolution.isCritical),
            'combat',
        );

        if (resolution.targetDefeated) {
            this.handleEnemyDeath(enemy);
            if (this.isVictory) {
                return;
            }
        }

        this.completePlayerTurn('');
    }

    private resolveEnemyAttack(enemy: Enemy) {
        if (!this.playerEntity) return;

        const resolution = this.combatService.resolveAttack(enemy.stats, this.playerEntity.stats);
        this.playerEntity.applyDamage(resolution.damage);
        this.spawnFloatingDamage(this.playerEntity.position, resolution.damage, resolution.isCritical, 'player');
        this.pushTurnLog(
            this.describeAttack(enemy.label, 'Player', resolution.damage, resolution.isCritical),
            'danger',
        );

        if (resolution.targetDefeated) {
            this.handlePlayerDeath();
        }
    }

    private handleEnemyDeath(enemy: Enemy) {
        if (!this.playerEntity) return;

        this.removeEnemy(enemy.id);
        this.defeatedEnemyCount += 1;
        const totalExp = this.playerEntity.gainExperience(enemy.experienceReward);
        this.pushTurnLog(`${enemy.label} dies.`, 'danger');
        this.pushTurnLog(`Player gains ${enemy.experienceReward} EXP (${totalExp} total).`, 'item');

        if (enemy.isBoss()) {
            this.handleVictory(enemy);
            return;
        }

        this.spawnEliteReward(enemy);

        this.refreshTurnQueueRoster();
        this.syncBossHud();
    }

    private handlePlayerDeath() {
        if (this.isGameOver) {
            return;
        }

        this.isGameOver = true;
        this.isVictory = false;
        this.isInventoryOpen = false;
        this.selectedInventoryItemId = undefined;
        this.hud.clearEventBanner();
        this.playerSprite?.setTint(0x991b1b);
        const rewardSummary = this.soulShardService.awardSoulShards({
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
        });
        this.hud.updateGameOver({
            isOpen: true,
            ...rewardSummary,
        });
        this.hud.updateVictory({
            isOpen: false,
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
            bossName: this.getBossEnemy()?.label ?? 'Final Boss',
        });
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.pushTurnLog('Player dies. Combat ends.', 'danger');
        this.pushTurnLog(
            `Soul Shards +${rewardSummary.earnedSoulShards} (${rewardSummary.totalSoulShards} total).`,
            'item',
        );
        this.refreshTurnStatus();
        this.persistRun('game-over');
    }

    private handleVictory(boss: Enemy) {
        this.isVictory = true;
        this.isGameOver = false;
        this.isInventoryOpen = false;
        this.selectedInventoryItemId = undefined;
        this.hud.clearEventBanner();
        this.hud.updateGameOver({
            isOpen: false,
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
            earnedSoulShards: 0,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
        });
        this.hud.updateVictory({
            isOpen: true,
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
            bossName: boss.label,
        });
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.pushTurnLog(`${boss.label} falls. The summit is yours.`, 'item');
        this.refreshTurnStatus();
        this.persistRun('victory');
    }

    private spawnEliteReward(enemy: Enemy) {
        if (!enemy.isElite()) {
            return;
        }
        const rewardPosition = this.findRewardDropPosition(enemy.position);
        if (!rewardPosition) {
            this.pushTurnLog(`${enemy.label} carried a relic, but it is lost in the clash.`, 'danger');
            return;
        }

        const reward = this.itemService.spawnRewardDrop(
            rewardPosition,
            this.floorProgression.getSnapshot().number,
            ITEM_RARITY.RARE,
        );
        this.fieldItems = this.itemService.getFieldItems();
        this.renderFieldItem(reward);
        this.pushTurnLog(
            `${enemy.label} drops ${reward.definition.name} [${reward.definition.rarity}].`,
            'item',
        );
    }

    private findRewardDropPosition(origin: Position) {
        if (!this.mapData) {
            return undefined;
        }

        const candidates: Position[] = [{ ...origin }];
        for (let radius = 1; radius <= 2; radius += 1) {
            for (let dy = -radius; dy <= radius; dy += 1) {
                for (let dx = -radius; dx <= radius; dx += 1) {
                    candidates.push({
                        x: origin.x + dx,
                        y: origin.y + dy,
                    });
                }
            }
        }

        return candidates.find((candidate) => this.isRewardDropTileAvailable(candidate));
    }

    private isRewardDropTileAvailable(position: Position) {
        if (!this.mapData) {
            return false;
        }
        if (
            position.x < 0
            || position.x >= this.mapData.width
            || position.y < 0
            || position.y >= this.mapData.height
        ) {
            return false;
        }

        if (this.mapData.tiles[position.y][position.x] !== WORLD_TILE.FLOOR) {
            return false;
        }

        if (this.playerEntity?.position.x === position.x && this.playerEntity.position.y === position.y) {
            return false;
        }

        return !this.fieldItems.some((item) =>
            item.position.x === position.x && item.position.y === position.y,
        ) && !this.enemyEntities.some((enemy) =>
            enemy.position.x === position.x && enemy.position.y === position.y,
        );
    }

    private removeEnemy(enemyId: string) {
        this.enemyEntities = this.enemyEntities.filter((enemy) => enemy.id !== enemyId);
        const sprite = this.enemySprites.get(enemyId);
        sprite?.destroy();
        this.enemySprites.delete(enemyId);
    }

    private refreshTurnQueueRoster() {
        if (!this.turnQueue) return;

        this.turnQueue.refresh(
            {
                id: 'player',
                kind: 'player',
                label: 'Player',
            },
            this.createEnemyTurnActors(),
        );
    }

    private describeAttack(attacker: string, target: string, damage: number, isCritical: boolean) {
        const criticalLabel = isCritical ? ' critical' : '';
        return `${attacker} hits ${target} for ${damage}${criticalLabel} damage.`;
    }

    private describePickup(item: { icon: string; name: string; quantity: number }) {
        const quantity = item.quantity > 1 ? ` x${item.quantity}` : '';
        return `Get ${item.icon} ${item.name}${quantity}.`;
    }

    private describeDrop(item: { icon: string; name: string }) {
        return `Drop ${item.icon} ${item.name}.`;
    }

    private describeUse(item: { icon: string; name: string }, healedAmount: number) {
        if (healedAmount > 0) {
            return `Player uses ${item.icon} ${item.name} and recovers ${healedAmount} HP.`;
        }

        return `Player uses ${item.icon} ${item.name}, but no HP is restored.`;
    }

    private describeEquip(
        item: { icon: string; name: string },
        state: 'equip' | 'unequip',
        statModifier?: { maxHealth?: number; attack?: number; defense?: number },
    ) {
        const summary = this.formatStatModifierSummary(
            state === 'unequip' ? this.invertModifierForDisplay(statModifier) : statModifier,
        );
        const prefix = state === 'equip' ? 'Player equips' : 'Player unequips';

        return summary
            ? `${prefix} ${item.icon} ${item.name} (${summary}).`
            : `${prefix} ${item.icon} ${item.name}.`;
    }

    private formatStatModifierSummary(modifier?: { maxHealth?: number; attack?: number; defense?: number }) {
        if (!modifier) {
            return '';
        }

        const entries = [
            modifier.maxHealth ? `HP ${formatSignedNumber(modifier.maxHealth)}` : undefined,
            modifier.attack ? `ATK ${formatSignedNumber(modifier.attack)}` : undefined,
            modifier.defense ? `DEF ${formatSignedNumber(modifier.defense)}` : undefined,
        ].filter(Boolean);

        return entries.join(' · ');
    }

    private invertModifierForDisplay(modifier?: { maxHealth?: number; attack?: number; defense?: number }) {
        if (!modifier) {
            return undefined;
        }

        return {
            maxHealth: modifier.maxHealth ? -modifier.maxHealth : undefined,
            attack: modifier.attack ? -modifier.attack : undefined,
            defense: modifier.defense ? -modifier.defense : undefined,
        };
    }

    private describeDirection(dx: number, dy: number) {
        if (dx < 0) return 'west';
        if (dx > 0) return 'east';
        if (dy < 0) return 'north';
        return 'south';
    }

    private formatFloorType(type: FloorSnapshot['type']) {
        if (type === 'safe') {
            return 'Safe Zone';
        }

        if (type === 'boss') {
            return 'Boss Lair';
        }

        return 'Normal';
    }

    private toggleInventoryOpen() {
        if (this.isTitleScreenOpen || this.isGameOver || !this.playerEntity || !this.isPlayerTurn()) {
            return;
        }

        this.setInventoryOpen(!this.isInventoryOpen);
    }

    private setInventoryOpen(isOpen: boolean) {
        this.isInventoryOpen = isOpen;
        this.syncInventoryOverlay();
        this.refreshTurnStatus();
    }

    private selectInventoryItem(instanceId: string) {
        this.selectedInventoryItemId = instanceId;
        this.syncInventoryOverlay();
    }

    private syncInventoryOverlay() {
        const inventory = this.itemService.getInventorySnapshot();
        const selectedItem = inventory.items.find((item) => item.instanceId === this.selectedInventoryItemId)
            ?? inventory.items[0];

        this.selectedInventoryItemId = selectedItem?.instanceId;
        this.hud.updateInventory({
            isOpen: this.isInventoryOpen,
            items: inventory.items,
            selectedItemId: this.selectedInventoryItemId,
            usedSlots: inventory.usedSlots,
            slotCapacity: inventory.slotCapacity,
        });
    }

    private syncTitleOverlay() {
        const snapshot = this.metaProgression.getSnapshot();
        this.hud.updateTitleScreen({
            isOpen: this.isTitleScreenOpen,
            totalSoulShards: snapshot.totalSoulShards,
            canContinueRun: this.runPersistence.hasActiveRun(),
            isSanctuaryOpen: this.isSanctuaryOpen,
            sanctuaryMessage: this.titleScreenMessage?.text,
            sanctuaryMessageTone: this.titleScreenMessage?.tone ?? 'system',
            upgrades: snapshot.upgrades,
        });
    }

    private dropSelectedInventoryItem() {
        if (!this.playerEntity || !this.selectedInventoryItemId) {
            return;
        }

        const drop = this.itemService.dropItem(this.selectedInventoryItemId, this.playerEntity.position);
        if (!drop) {
            return;
        }

        if (drop.status === 'equipped-item') {
            this.pushTurnLog('Unequip an item before dropping it.', 'danger');
            return;
        }

        if (drop.status === 'tile-occupied' || !drop.fieldItem) {
            this.pushTurnLog('Cannot drop an item onto an occupied tile.', 'danger');
            return;
        }

        this.fieldItems = this.itemService.getFieldItems();
        this.renderFieldItem(drop.fieldItem);
        this.updateVisibility();
        this.syncInventoryOverlay();
        this.pushTurnLog(this.describeDrop(drop.fieldItem.definition), 'item');
    }

    private useSelectedInventoryItem() {
        if (!this.playerEntity || !this.selectedInventoryItemId) {
            return;
        }

        const selectedItem = this.itemService.getInventorySnapshot().items.find((item) =>
            item.instanceId === this.selectedInventoryItemId,
        );
        if (!selectedItem) {
            return;
        }

        const activation = this.itemService.activateItem(this.selectedInventoryItemId);
        if (!activation) {
            return;
        }

        switch (activation.status) {
            case 'consumed': {
                const healedAmount = this.playerEntity.heal(activation.healAmount ?? 0);
                this.pushTurnLog(this.describeUse(selectedItem, healedAmount), 'item');
                break;
            }
            case 'equipped':
                this.playerEntity.applyStatModifier(activation.statModifier ?? {});
                if (activation.replacedItem) {
                    this.pushTurnLog(
                        this.describeEquip(activation.replacedItem, 'unequip', activation.replacedItem.equipment?.statModifier),
                        'item',
                    );
                }
                this.pushTurnLog(
                    this.describeEquip(selectedItem, 'equip', selectedItem.equipment?.statModifier),
                    'item',
                );
                break;
            case 'unequipped':
                this.playerEntity.applyStatModifier(activation.statModifier ?? {});
                this.pushTurnLog(
                    this.describeEquip(selectedItem, 'unequip', activation.item?.equipment?.statModifier),
                    'item',
                );
                break;
            case 'not-usable':
                this.pushTurnLog(`${selectedItem.name} cannot be used right now.`, 'danger');
                break;
        }

        this.syncInventoryOverlay();
        this.refreshTurnStatus();
        this.persistRun('active');
    }

    private returnToTitleScreen() {
        this.isTitleScreenOpen = true;
        this.isSanctuaryOpen = false;
        this.isInventoryOpen = false;
        this.isVictory = false;
        this.selectedInventoryItemId = undefined;
        this.titleScreenMessage = undefined;
        this.hud.clearEventBanner();
        this.hud.updateGameOver({
            isOpen: false,
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
            earnedSoulShards: 0,
            totalSoulShards: this.soulShardService.getTotalSoulShards(),
        });
        this.hud.updateVictory({
            isOpen: false,
            floorNumber: this.floorProgression.getSnapshot().number,
            defeatedEnemies: this.defeatedEnemyCount,
            bossName: this.getBossEnemy()?.label ?? 'Final Boss',
        });
        this.syncTitleOverlay();
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.refreshTurnStatus();
    }

    private openSanctuary() {
        if (!this.isTitleScreenOpen) {
            return;
        }

        this.isSanctuaryOpen = true;
        this.titleScreenMessage = {
            text: 'Spend Soul Shards to strengthen your next descent.',
            tone: 'system',
        };
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private closeSanctuary() {
        if (!this.isTitleScreenOpen) {
            return;
        }

        this.isSanctuaryOpen = false;
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private purchaseSanctuaryUpgrade(key: PermanentUpgradeKey) {
        if (!this.isTitleScreenOpen) {
            return;
        }

        const purchase = this.metaProgression.purchaseUpgrade(key);
        if (purchase.status === 'purchased') {
            this.titleScreenMessage = {
                text: `${purchase.upgrade.label} advanced to Lv.${purchase.upgrade.level}.`,
                tone: 'item',
            };
        } else {
            this.titleScreenMessage = {
                text: `Need ${purchase.missingSoulShards} more Soul Shards for ${purchase.upgrade.label}.`,
                tone: 'danger',
            };
        }

        this.isSanctuaryOpen = true;
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private startNewRun() {
        this.defeatedEnemyCount = 0;
        this.selectedInventoryItemId = undefined;
        this.titleScreenMessage = undefined;
        this.isTitleScreenOpen = false;
        this.isSanctuaryOpen = false;
        this.isInventoryOpen = false;
        this.isGameOver = false;
        this.isVictory = false;
        this.itemService.resetRun();
        const firstFloor = this.floorProgression.reset();
        this.playerEntity?.reset(this.metaProgression.getRunStartStats());
        this.playerSprite?.clearTint();
        this.hud.clearLogs();
        this.buildFloor(
            firstFloor,
            'Entered floor 1 (Normal).',
        );
        this.persistRun('active');
    }

    private renderFieldItem(item: ItemEntity) {
        const label = this.add.text(
            (item.position.x * this.tileSize) + (this.tileSize / 2),
            (item.position.y * this.tileSize) + (this.tileSize / 2),
            `${item.definition.icon}\n${item.definition.name}`,
            {
                align: 'center',
                color: this.getItemRarityColor(item.rarity),
                fontFamily: 'monospace',
                fontSize: '11px',
                stroke: '#111827',
                strokeThickness: 2,
            },
        )
            .setDepth(1)
            .setOrigin(0.5);
        this.itemLabels.set(item.instanceId, label);
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

    update() {
    }
}
