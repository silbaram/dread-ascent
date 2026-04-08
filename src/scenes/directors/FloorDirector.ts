import { Enemy } from '../../domain/entities/Enemy';
import { ItemEntity } from '../../domain/entities/Item';
import { Player } from '../../domain/entities/Player';
import { EnemySpawnerService } from '../../domain/services/EnemySpawnerService';
import { FloorProgressionService, type FloorSnapshot } from '../../domain/services/FloorProgressionService';
import { ItemService } from '../../domain/services/ItemService';
import {
    RunPersistenceService,
    type PersistedRunStatus,
    type PersistedSpecialRewardOffer,
} from '../../domain/services/RunPersistenceService';
import type { Card } from '../../domain/entities/Card';
import { MapGenerator, type MapData } from '../../infra/rot/MapGenerator';

export class FloorDirector {
    private mapData?: MapData;
    private enemyEntities: Enemy[] = [];
    private fieldItems: ItemEntity[] = [];

    constructor(
        private readonly floorProgression: FloorProgressionService,
        private readonly enemySpawner: EnemySpawnerService,
        private readonly itemService: ItemService,
        private readonly runPersistence: RunPersistenceService,
    ) {}

    public generateMap(floorType: FloorSnapshot['type']): MapData {
        this.mapData = MapGenerator.generate(40, 30, { floorType });
        return this.mapData;
    }

    public spawnEntities(floorNumber: number) {
        if (!this.mapData) throw new Error('Map data not initialized');

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

        return {
            enemies: this.enemyEntities,
            items: this.fieldItems,
        };
    }

    public getMapData() {
        return this.mapData;
    }

    public getEnemyEntities() {
        return this.enemyEntities;
    }

    public getFieldItems() {
        return this.fieldItems;
    }

    public removeEnemy(enemyId: string) {
        this.enemyEntities = this.enemyEntities.filter((e) => e.id !== enemyId);
    }

    public getEnemyAt(x: number, y: number) {
        return this.enemyEntities.find((enemy) => enemy.position.x === x && enemy.position.y === y);
    }

    public getEnemyById(enemyId: string) {
        return this.enemyEntities.find((enemy) => enemy.id === enemyId);
    }

    public buildBattleEncounter(leadEnemy: Enemy) {
        if (!this.mapData || this.mapData.floorType === 'safe') {
            return [leadEnemy];
        }

        return this.enemySpawner.buildBattleEncounter({
            leadEnemy,
            floorNumber: this.floorProgression.getSnapshot().number,
            floorType: this.mapData.floorType,
        });
    }

    public getBossEnemy() {
        return this.enemyEntities.find((enemy) => enemy.isBoss());
    }

    public advanceFloor() {
        return this.floorProgression.advance();
    }

    public getFloorSnapshot() {
        return this.floorProgression.getSnapshot();
    }

    public restoreFloor(snapshot: FloorSnapshot) {
        return this.floorProgression.restore(snapshot);
    }

    public persistRun(
        status: PersistedRunStatus,
        player: Player,
        defeatedEnemyCount: number,
        deckCards: readonly Card[] = [],
        pendingBattleStartEnergy = 0,
        pendingSpecialRewardOffer?: PersistedSpecialRewardOffer,
    ) {
        this.runPersistence.save({
            status,
            floor: this.floorProgression.getSnapshot(),
            player: {
                stats: { ...player.stats },
                experience: player.experience,
            },
            inventory: this.itemService.getInventorySnapshot().items,
            deck: [...deckCards],
            defeatedEnemyCount,
            pendingBattleStartEnergy,
            pendingSpecialRewardOffer,
        });
    }

    public loadSavedRun() {
        return this.runPersistence.load();
    }
}
