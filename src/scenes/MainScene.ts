import 'phaser';
import { Enemy } from '../domain/entities/Enemy';
import { type Position, Player } from '../domain/entities/Player';
import { EnemyAiService } from '../domain/services/EnemyAiService';
import { CombatService } from '../domain/services/CombatService';
import { EnemySpawnerService } from '../domain/services/EnemySpawnerService';
import {
    FloorProgressionService,
    type FloorSnapshot,
} from '../domain/services/FloorProgressionService';
import { VisibilityService, VisibilityState } from '../domain/services/VisibilityService';
import { MapGenerator, type MapData } from '../infra/rot/MapGenerator';
import { RotFovCalculator } from '../infra/rot/RotFovCalculator';
import { RotPathFinder } from '../infra/rot/RotPathFinder';
import { type TurnActor, TurnQueueService } from '../domain/services/TurnQueueService';
import { RotTurnScheduler } from '../infra/rot/RotTurnScheduler';
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
    private isGameOver = false;
    private readonly combatService = new CombatService();
    private readonly enemySpawner = new EnemySpawnerService();
    private readonly floorProgression = new FloorProgressionService();

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

        const enemyGraphics = this.make.graphics({ x: 0, y: 0 });
        enemyGraphics.fillStyle(0xef4444, 1);
        enemyGraphics.fillRect(6, 6, this.tileSize - 12, this.tileSize - 12);
        enemyGraphics.fillStyle(0x111827, 1);
        enemyGraphics.fillRect(10, 10, 4, 4);
        enemyGraphics.fillRect(this.tileSize - 14, 10, 4, 4);
        enemyGraphics.fillStyle(0xf97316, 1);
        enemyGraphics.fillRect(12, this.tileSize - 14, this.tileSize - 24, 4);
        enemyGraphics.generateTexture('enemy', this.tileSize, this.tileSize);
    }

    create() {
        this.hud.clearLogs();
        this.buildFloor(
            this.floorProgression.getSnapshot(),
            'Entered floor 1 (Normal).',
        );
        this.setupInput();
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
            this.handleKeyDown(event.code);
        });
    }

    private handleKeyDown(code: string) {
        if (!this.playerEntity || !this.isPlayerTurn()) return;

        let dx = 0;
        let dy = 0;

        switch (code) {
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

        if (targetTile === WORLD_TILE.STAIRS) {
            this.pushTurnLog('Player climbs the stairs.');
            this.advanceToNextFloor();
            return;
        }

        if (targetTile === WORLD_TILE.REST) {
            this.completePlayerTurn('Player steps into the sanctuary.');
            return;
        }

        this.completePlayerTurn(`Player moved ${this.describeDirection(dx, dy)}.`);
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
            blockedPositions: [
                this.mapData.playerSpawn,
                this.mapData.stairsPosition,
                ...this.mapData.restPoints,
            ],
        });

        for (const enemy of this.enemyEntities) {
            const sprite = this.add
                .sprite(enemy.position.x * this.tileSize, enemy.position.y * this.tileSize, 'enemy')
                .setOrigin(0);
            this.enemySprites.set(enemy.id, sprite);
        }
    }

    private clearEnemySprites() {
        for (const sprite of this.enemySprites.values()) {
            sprite.destroy();
        }

        this.enemySprites.clear();
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

    private placePlayer(spawn: Position) {
        if (!this.playerEntity) {
            this.playerEntity = new Player({ x: spawn.x, y: spawn.y });
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
        this.mapData = MapGenerator.generate(40, 30, { floorType: floor.type });
        this.initializeVisibilityService();
        this.renderMap();
        this.placePlayer(this.mapData.playerSpawn);
        this.spawnEnemies(floor.number);
        this.initializeTurnQueue();
        this.updateVisibility();
        this.cameras.main.setBounds(0, 0, this.mapData.width * this.tileSize, this.mapData.height * this.tileSize);
        this.refreshTurnStatus();

        this.pushTurnLog(arrivalLog, 'travel');
        if (floor.type === 'safe') {
            this.pushTurnLog('Player acquires sanctuary supplies.', 'item');
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
    }

    private completePlayerTurn(logLine: string) {
        if (!this.turnQueue || !this.playerEntity) return;

        if (logLine) {
            this.pushTurnLog(logLine);
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

    private refreshTurnStatus() {
        if (!this.playerEntity) return;

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
            activeTurn: `Round ${snapshot.round} · ${snapshot.activeActor.label}`,
            enemyCount: snapshot.enemyCount,
            isGameOver: false,
        });
    }

    private pushTurnLog(line: string, tone: HudLogTone = 'system') {
        this.hud.pushLog(line, tone);
    }

    private isPlayerTurn() {
        return !this.isGameOver && this.turnQueue?.getSnapshot().activeActor.kind === 'player';
    }

    private getEnemyAt(x: number, y: number) {
        return this.enemyEntities.find((enemy) =>
            enemy.position.x === x && enemy.position.y === y,
        );
    }

    private getEnemyById(enemyId: string) {
        return this.enemyEntities.find((enemy) => enemy.id === enemyId);
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

    private performPlayerAttack(enemy: Enemy) {
        if (!this.playerEntity) return;

        const resolution = this.combatService.resolveAttack(this.playerEntity.stats, enemy.stats);
        enemy.applyDamage(resolution.damage);

        this.pushTurnLog(
            this.describeAttack('Player', enemy.label, resolution.damage, resolution.isCritical),
            'combat',
        );

        if (resolution.targetDefeated) {
            this.handleEnemyDeath(enemy);
        }

        this.completePlayerTurn('');
    }

    private resolveEnemyAttack(enemy: Enemy) {
        if (!this.playerEntity) return;

        const resolution = this.combatService.resolveAttack(enemy.stats, this.playerEntity.stats);
        this.playerEntity.applyDamage(resolution.damage);
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
        const totalExp = this.playerEntity.gainExperience(enemy.experienceReward);
        this.pushTurnLog(`${enemy.label} dies.`, 'danger');
        this.pushTurnLog(`Player gains ${enemy.experienceReward} EXP (${totalExp} total).`, 'item');
        this.refreshTurnQueueRoster();
    }

    private handlePlayerDeath() {
        this.isGameOver = true;
        this.playerSprite?.setTint(0x991b1b);
        this.pushTurnLog('Player dies. Combat ends.', 'danger');
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

    private describeDirection(dx: number, dy: number) {
        if (dx < 0) return 'west';
        if (dx > 0) return 'east';
        if (dy < 0) return 'north';
        return 'south';
    }

    private formatFloorType(type: FloorSnapshot['type']) {
        return type === 'safe' ? 'Safe Zone' : 'Normal';
    }

    update() {
    }
}
