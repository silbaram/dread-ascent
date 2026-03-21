import 'phaser';
import { Player } from '../domain/entities/Player';
import { EnemySpawnerService } from '../domain/services/EnemySpawnerService';
import { FloorProgressionService, type FloorSnapshot } from '../domain/services/FloorProgressionService';
import { ItemService } from '../domain/services/ItemService';
import { MetaProgressionService, PermanentUpgradeKey } from '../domain/services/MetaProgressionService';
import { RunPersistenceService, PersistedRunStatus } from '../domain/services/RunPersistenceService';
import { SoulShardService } from '../domain/services/SoulShardService';
import { CardBattleService } from '../domain/services/CardBattleService';
import { CardDropService, type CardDropResult } from '../domain/services/CardDropService';
import { CombatService } from '../domain/services/CombatService';
import { DeckService } from '../domain/services/DeckService';
import { WORLD_TILE, isWalkableTile } from '../shared/types/WorldTiles';
import { GameLocalization, MovementDirection } from '../ui/GameLocalization';
import { type HudLogTone, GameHud } from '../ui/GameHud';
import { RenderSynchronizer } from './synchronizers/RenderSynchronizer';
import { FloorDirector } from './directors/FloorDirector';
import { BattleDirector, BattleOutcome } from './directors/BattleDirector';
import { BattleScene, type BattleSceneData, type BattleSceneResult } from './BattleScene';
import { OverlayController } from './controllers/OverlayController';
import { InputController, InputDelegate } from './controllers/InputController';
import { formatSignedNumber } from '../shared/utils/formatSignedNumber';
import { ITEM_RARITY } from '../domain/entities/Item';
import { Position } from '../domain/entities/Player';
import { Enemy } from '../domain/entities/Enemy';

export class MainScene extends Phaser.Scene implements InputDelegate {
    private playerEntity?: Player;
    private defeatedEnemyCount = 0;
    private tileSize: number = 32;
    private fovRadius: number = 8;
    private selectedInventoryItemId?: string;

    private readonly combatService = new CombatService();
    private readonly cardBattleService = new CardBattleService();
    private readonly cardDropService = new CardDropService();
    private readonly deckService = new DeckService();
    private readonly enemySpawner = new EnemySpawnerService();
    private readonly floorProgression = new FloorProgressionService();
    private readonly itemService = new ItemService();
    private readonly soulShardService = new SoulShardService();
    private readonly metaProgression = new MetaProgressionService(this.soulShardService);
    private readonly runPersistence = new RunPersistenceService();

    private renderSynchronizer!: RenderSynchronizer;
    private floorDirector!: FloorDirector;
    private battleDirector!: BattleDirector;
    private overlayController!: OverlayController;
    private inputController!: InputController;

    constructor(
        private readonly hud: GameHud,
        private readonly localization: GameLocalization,
    ) {
        super({ key: 'MainScene' });
        this.localization.subscribe(() => {
            this.handleLocaleChange();
        });
    }

    preload() {
        this.generateDefaultTextures();
    }

    create() {
        this.initializeComponents();
        this.setupHudHandlers();
        this.returnToTitleScreen();
    }

    private initializeComponents() {
        this.renderSynchronizer = new RenderSynchronizer(this, this.localization, this.tileSize, this.fovRadius);
        this.floorDirector = new FloorDirector(
            this.floorProgression,
            this.enemySpawner,
            this.itemService,
            this.runPersistence,
        );
        this.battleDirector = new BattleDirector(
            this.combatService,
            this.cardBattleService,
            this.deckService,
            this.itemService,
            this.localization,
            this.renderSynchronizer,
            this.floorDirector,
        );
        this.overlayController = new OverlayController(this.hud, this.localization, this.soulShardService);
        this.inputController = new InputController(this, this);
        this.inputController.setupInput();
    }

    private setupHudHandlers() {
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
    }

    private buildFloor(floor: FloorSnapshot, arrivalLog: string) {
        this.overlayController.setGameOver(false);
        this.overlayController.setVictory(false);
        this.overlayController.setTitleScreen(false);
        this.overlayController.setSanctuary(false);
        this.overlayController.setInventory(false);
        this.overlayController.setTitleScreenMessage(undefined);

        const mapData = this.floorDirector.generateMap(floor.type);
        this.renderSynchronizer.initializeVisibilityService(mapData);
        this.renderSynchronizer.renderMap(mapData);

        if (!this.playerEntity) {
            this.playerEntity = new Player(mapData.playerSpawn, this.metaProgression.getRunStartStats());
        } else {
            this.playerEntity.moveTo(mapData.playerSpawn.x, mapData.playerSpawn.y);
        }

        this.renderSynchronizer.synchronizePlayer(this.playerEntity);
        const entities = this.floorDirector.spawnEntities(floor.number);
        this.renderSynchronizer.clearEnemySprites();
        this.renderSynchronizer.synchronizeEnemies(entities.enemies);
        this.renderSynchronizer.clearItemLabels();
        this.renderSynchronizer.synchronizeItems(entities.items);

        this.battleDirector.initializeTurnQueue(this.localization.getPlayerLabel());
        this.renderSynchronizer.updateVisibility(this.playerEntity.position, mapData, entities.enemies, entities.items);
        this.renderSynchronizer.updateCameras(mapData);

        this.syncTitleOverlay();
        this.overlayController.updateGameOver(floor.number, this.defeatedEnemyCount, 0);
        this.overlayController.updateVictory(floor.number, this.defeatedEnemyCount, this.getBossName());

        this.syncInventoryOverlay();
        this.syncBossHud();
        this.refreshTurnStatus();
        this.queueFloorEventBanner(floor);

        this.pushTurnLog(arrivalLog, 'travel');
        if (floor.type === 'safe') {
            this.pushTurnLog(this.localization.formatSanctuaryAwaits());
        } else if (floor.type === 'boss') {
            this.pushTurnLog(this.localization.formatBossFloorWarning(this.getBossName()), 'danger');
        }

        const turnSnapshot = this.battleDirector.getTurnSnapshot();
        if (turnSnapshot) {
            this.pushTurnLog(this.localization.formatRoundActorTurn(turnSnapshot.round, turnSnapshot.activeActor.label));
        }
    }

    // InputDelegate Implementation
    public onMove(dx: number, dy: number) {
        if (!this.playerEntity) return;

        const mapData = this.floorDirector.getMapData();
        if (!mapData) return;

        const newX = this.playerEntity.position.x + dx;
        const newY = this.playerEntity.position.y + dy;

        if (newX < 0 || newX >= mapData.width || newY < 0 || newY >= mapData.height) return;

        const targetEnemy = this.floorDirector.getEnemyAt(newX, newY);
        if (targetEnemy) {
            // 덱이 비어있으면 기존 자동 전투, 아니면 BattleScene으로 전환
            const deckCards = this.deckService.getCards();
            if (deckCards.length === 0) {
                this.handleBattleOutcome(this.battleDirector.performPlayerAttack(this.playerEntity, targetEnemy), targetEnemy);
            } else {
                this.launchBattleScene(this.playerEntity, targetEnemy);
            }
            return;
        }

        const targetTile = mapData.tiles[newY][newX];
        if (!isWalkableTile(targetTile)) return;

        this.playerEntity.moveTo(newX, newY);
        this.renderSynchronizer.synchronizePlayer(this.playerEntity);
        this.renderSynchronizer.updateVisibility(this.playerEntity.position, mapData, this.floorDirector.getEnemyEntities(), this.floorDirector.getFieldItems());

        const pickupLog = this.collectItemAtPlayerPosition();

        if (targetTile === WORLD_TILE.STAIRS) {
            this.pushTurnLog(this.localization.formatPlayerClimbsStairs());
            this.advanceToNextFloor();
            return;
        }

        if (targetTile === WORLD_TILE.REST) {
            this.completePlayerTurn(this.localization.formatPlayerStepsIntoSanctuary());
            return;
        }

        this.completePlayerTurn(
            this.localization.formatPlayerMoved(this.describeDirection(dx, dy)),
            pickupLog ? [pickupLog] : [],
        );
    }

    public onToggleInventory() {
        const state = this.overlayController.getState();
        if (state.isTitleScreenOpen || state.isGameOver || !this.playerEntity || !this.isPlayerTurn()) return;
        this.setInventoryOpen(!state.isInventoryOpen);
    }

    public onCloseInventory() {
        this.setInventoryOpen(false);
    }

    public onCloseSanctuary() {
        this.closeSanctuary();
    }

    public isTitleScreenOpen() { return this.overlayController.getState().isTitleScreenOpen; }
    public isSanctuaryOpen() { return this.overlayController.getState().isSanctuaryOpen; }
    public isInventoryOpen() { return this.overlayController.getState().isInventoryOpen; }
    public isPlayerTurn() {
        const state = this.overlayController.getState();
        return !state.isGameOver && !state.isVictory && this.battleDirector.isPlayerTurn();
    }

    private launchBattleScene(player: Player, enemy: Enemy): void {
        const battleData: BattleSceneData = {
            player,
            enemy,
            deckService: this.deckService,
            cardBattleService: this.cardBattleService,
            itemService: this.itemService,
            enemyName: this.getEnemyName(enemy),
        };

        // BattleScene 시작
        const battleScene = this.scene.get('BattleScene') as BattleScene;
        battleScene.setOnBattleEnd((result: BattleSceneResult) => {
            this.handleBattleSceneResult(result);
        });
        this.scene.sleep('MainScene');
        this.scene.launch('BattleScene', battleData);
    }

    private handleBattleSceneResult(result: BattleSceneResult): void {
        if (!this.playerEntity) return;

        const { enemy } = result;

        // 데미지를 실제 엔티티에 적용
        if (result.totalEnemyDamage > 0) {
            enemy.applyDamage(result.totalEnemyDamage);
        }
        if (result.totalPlayerDamage > 0) {
            this.playerEntity.applyDamage(result.totalPlayerDamage);
        }

        // 로그 기록
        this.pushTurnLog(
            `⚔️ Card Battle: ${result.totalRounds} round(s) — ${result.outcome === 'player-win' ? 'Victory!' : 'Defeat...'}`,
            result.outcome === 'player-win' ? 'combat' : 'danger',
        );

        // 승패 처리
        if (result.outcome === 'player-win') {
            if (enemy.isDead()) {
                if (enemy.isBoss()) {
                    this.handleVictory(enemy);
                } else {
                    this.floorDirector.removeEnemy(enemy.id);
                    this.renderSynchronizer.removeEnemySprite(enemy.id);
                    this.battleDirector.refreshTurnQueueRoster();
                    this.handleEnemyDeath(enemy);
                }
            } else {
                this.completePlayerTurn('');
            }
        } else {
            this.handlePlayerDeath();
        }
    }

    private handleBattleOutcome(outcome: BattleOutcome, enemy: Enemy) {
        if (!this.playerEntity) return;

        for (const log of outcome.logs) {
            this.pushTurnLog(log.line, log.tone);
        }
        this.syncBossHud();

        if (outcome.type === 'game-over') {
            this.handlePlayerDeath();
        } else if (outcome.type === 'none') {
            if (enemy.stats.health <= 0) {
                this.handleEnemyDeath(enemy);
            } else {
                this.completePlayerTurn('');
            }
        } else if (outcome.type === 'victory' && outcome.boss) {
            this.handleVictory(outcome.boss);
        }
    }

    private handleEnemyDeath(enemy: Enemy) {
        if (!this.playerEntity) return;

        this.defeatedEnemyCount += 1;
        const totalExp = this.playerEntity.gainExperience(enemy.experienceReward);
        this.pushTurnLog(this.localization.formatEnemyDeath(this.getEnemyName(enemy)), 'danger');
        this.pushTurnLog(this.localization.formatExperienceGain(enemy.experienceReward, totalExp), 'item');

        this.rollCardDrop(enemy);
        this.spawnEliteReward(enemy);
        this.syncBossHud();
        this.completePlayerTurn('');
    }

    /** 적 처치 시 카드 드롭을 판정하고 결과를 로그에 표시한다. */
    private pendingCardDrop: CardDropResult | null = null;

    private rollCardDrop(enemy: Enemy): void {
        const floorNumber = this.floorDirector.getFloorSnapshot().number;
        const result = this.cardDropService.rollCardDrop(
            enemy.kind,
            enemy.elite,
            floorNumber,
            this.deckService,
        );

        if (!result.dropped) {
            return;
        }

        const cardTypeLabel = result.card.type === 'ATTACK' ? '⚔️' : '🛡️';
        this.pushTurnLog(
            `🃏 Card Drop! ${cardTypeLabel} ${result.card.name} (Power: ${result.card.power})`,
            'item',
        );

        if (result.deckFull) {
            this.pendingCardDrop = result;
            this.pushTurnLog('📦 Deck is full! Choose a card to swap or skip.', 'danger');
            this.hud.showCardSwapOverlay(
                result.card,
                this.deckService.getCards(),
                (removeCardId: string | null) => this.handleCardSwapSelection(removeCardId),
            );
        } else {
            this.persistRun('active');
        }
    }

    private handleCardSwapSelection(removeCardId: string | null): void {
        if (!this.pendingCardDrop || !this.pendingCardDrop.dropped) {
            this.pendingCardDrop = null;
            return;
        }

        if (removeCardId === null) {
            this.pushTurnLog('🃏 Card drop skipped.', 'system');
            this.pendingCardDrop = null;
            return;
        }

        const swapResult = this.cardDropService.swapCard(
            removeCardId,
            this.pendingCardDrop.card,
            this.deckService,
        );

        if (swapResult.swapped) {
            this.pushTurnLog(
                `🔄 Swapped ${swapResult.removedCard.name} → ${swapResult.addedCard.name}`,
                'item',
            );
            this.persistRun('active');
        }

        this.pendingCardDrop = null;
    }

    private completePlayerTurn(logLine: string, extraLogs: Array<{ line: string; tone: HudLogTone }> = []) {
        if (!this.playerEntity) return;

        if (logLine) this.pushTurnLog(logLine);
        for (const entry of extraLogs) this.pushTurnLog(entry.line, entry.tone);

        const resolution = this.battleDirector.completePlayerTurn();
        if (!resolution) return;

        const mapData = this.floorDirector.getMapData();
        if (!mapData) return;

        for (const enemyTurn of resolution.enemyTurns) {
            const outcome = this.battleDirector.resolveEnemyTurn(enemyTurn, this.playerEntity, mapData);
            for (const log of outcome.logs) {
                this.pushTurnLog(log.line, log.tone);
            }
            if (outcome.type === 'game-over') {
                this.handlePlayerDeath();
                break;
            }
        }

        this.renderSynchronizer.updateVisibility(this.playerEntity.position, mapData, this.floorDirector.getEnemyEntities(), this.floorDirector.getFieldItems());
        this.refreshTurnStatus();

        const state = this.overlayController.getState();
        if (!state.isGameOver) {
            this.pushTurnLog(this.localization.formatRoundActorTurn(resolution.round, resolution.nextActor.label));
        }
    }

    private advanceToNextFloor() {
        const nextFloor = this.floorDirector.advanceFloor();
        this.buildFloor(nextFloor, this.localization.formatEnteredFloor(nextFloor.number, nextFloor.type));
        this.persistRun('active');
    }

    private handlePlayerDeath() {
        this.overlayController.setGameOver(true);
        this.renderSynchronizer.setPlayerDeathStyle();
        const floor = this.floorDirector.getFloorSnapshot();
        const rewardSummary = this.soulShardService.awardSoulShards({
            floorNumber: floor.number,
            defeatedEnemies: this.defeatedEnemyCount,
        });
        this.overlayController.updateGameOver(floor.number, this.defeatedEnemyCount, rewardSummary.earnedSoulShards);
        this.pushTurnLog(this.localization.formatPlayerDeath(), 'danger');
        this.pushTurnLog(this.localization.formatSoulShardReward(rewardSummary.earnedSoulShards, rewardSummary.totalSoulShards), 'item');
        this.refreshTurnStatus();
        this.persistRun('game-over');
    }

    private handleVictory(boss: Enemy) {
        this.overlayController.setVictory(true);
        const floor = this.floorDirector.getFloorSnapshot();
        this.overlayController.updateVictory(floor.number, this.defeatedEnemyCount, this.getEnemyName(boss));
        this.pushTurnLog(this.localization.formatVictory(this.getEnemyName(boss)), 'item');
        this.refreshTurnStatus();
        this.persistRun('victory');
    }

    private returnToTitleScreen() {
        this.overlayController.setTitleScreen(true);
        this.overlayController.setSanctuary(false);
        this.overlayController.setInventory(false);
        this.overlayController.setGameOver(false);
        this.overlayController.setVictory(false);
        this.overlayController.setTitleScreenMessage(undefined);
        this.selectedInventoryItemId = undefined;
        this.hud.clearEventBanner();
        this.syncTitleOverlay();
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.refreshTurnStatus();
    }

    private startNewRun() {
        this.defeatedEnemyCount = 0;
        this.selectedInventoryItemId = undefined;
        this.overlayController.setTitleScreen(false);
        this.overlayController.setSanctuary(false);
        this.overlayController.setInventory(false);
        this.overlayController.setGameOver(false);
        this.overlayController.setVictory(false);
        this.itemService.resetRun();
        this.deckService.initializeStarterDeck();
        const firstFloor = this.floorDirector.restoreFloor({ number: 1, type: 'normal' });
        this.playerEntity?.reset(this.metaProgression.getRunStartStats());
        this.renderSynchronizer.clearPlayerTint();
        this.hud.clearLogs();
        this.buildFloor(firstFloor, this.localization.formatEnteredFloor(firstFloor.number, firstFloor.type));
        this.persistRun('active');
    }

    private resumeSavedRun() {
        const savedRun = this.floorDirector.loadSavedRun();
        if (!savedRun || savedRun.status !== 'active') return;

        this.hud.clearLogs();
        this.selectedInventoryItemId = undefined;
        this.defeatedEnemyCount = savedRun.defeatedEnemyCount;
        this.renderSynchronizer.clearPlayerTint();
        const floor = this.floorDirector.restoreFloor(savedRun.floor);
        this.itemService.resetRun();
        this.deckService.restoreDeck(savedRun.deck);
        this.buildFloor(floor, this.localization.formatResumedFloor(floor.number, floor.type));
        this.playerEntity?.restore(savedRun.player.stats, savedRun.player.experience);
        this.itemService.restoreInventory(savedRun.inventory);
        this.syncInventoryOverlay();
        this.refreshTurnStatus();
        this.persistRun('active');
    }

    private openSanctuary() {
        this.overlayController.setSanctuary(true);
        this.overlayController.setTitleScreenMessage({ key: 'sanctuary-help', tone: 'system' });
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private closeSanctuary() {
        this.overlayController.setSanctuary(false);
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private purchaseSanctuaryUpgrade(key: PermanentUpgradeKey) {
        const purchase = this.metaProgression.purchaseUpgrade(key);
        if (purchase.status === 'purchased') {
            this.overlayController.setTitleScreenMessage({ key: 'upgrade-purchased', tone: 'item', upgradeKey: key, level: purchase.upgrade.level });
        } else {
            this.overlayController.setTitleScreenMessage({ key: 'upgrade-insufficient', tone: 'danger', upgradeKey: key, missingSoulShards: purchase.missingSoulShards ?? 0 });
        }
        this.overlayController.setSanctuary(true);
        this.syncTitleOverlay();
        this.refreshTurnStatus();
    }

    private syncInventoryOverlay() {
        const inventory = this.itemService.getInventorySnapshot();
        const selectedItem = inventory.items.find((item) => item.instanceId === this.selectedInventoryItemId) ?? inventory.items[0];
        this.selectedInventoryItemId = selectedItem?.instanceId;
        this.hud.updateInventory({
            isOpen: this.overlayController.getState().isInventoryOpen,
            items: inventory.items,
            selectedItemId: this.selectedInventoryItemId,
            usedSlots: inventory.usedSlots,
            slotCapacity: inventory.slotCapacity,
        });
    }

    private syncBossHud() {
        const boss = this.floorDirector.getBossEnemy();
        this.overlayController.syncBossHud(!!boss, boss ? this.getEnemyName(boss) : '', boss?.stats.health ?? 0, boss?.stats.maxHealth ?? 0);
    }

    private refreshTurnStatus() {
        const state = this.overlayController.getState();
        if (state.isTitleScreenOpen) {
            const previewStats = this.metaProgression.getRunStartStats();
            this.hud.updateStatus({
                floorNumber: 1, floorType: this.localization.getFloorTypeLabel('normal'),
                health: previewStats.health, maxHealth: previewStats.maxHealth, experience: 0,
                activeTurn: state.isSanctuaryOpen ? this.localization.getSanctuaryTurnLabel() : this.localization.getTitleScreenTurnLabel(),
                enemyCount: 0, isGameOver: false, runState: 'playing',
            });
            return;
        }

        if (!this.playerEntity) return;
        const floor = this.floorDirector.getFloorSnapshot();

        if (state.isVictory) {
            this.hud.updateStatus({
                floorNumber: floor.number, floorType: this.localization.getFloorTypeLabel(floor.type),
                health: this.playerEntity.stats.health, maxHealth: this.playerEntity.stats.maxHealth, experience: this.playerEntity.experience,
                activeTurn: this.localization.getEndingTurnLabel(), enemyCount: 0, isGameOver: false, runState: 'victory',
            });
            return;
        }

        if (state.isGameOver) {
            this.hud.updateStatus({
                floorNumber: floor.number, floorType: this.localization.getFloorTypeLabel(floor.type),
                health: this.playerEntity.stats.health, maxHealth: this.playerEntity.stats.maxHealth, experience: this.playerEntity.experience,
                activeTurn: this.localization.getGameOverTurnLabel(), enemyCount: this.floorDirector.getEnemyEntities().length, isGameOver: true, runState: 'game-over',
            });
            return;
        }

        const turnSnapshot = this.battleDirector.getTurnSnapshot();
        if (!turnSnapshot) return;

        this.hud.updateStatus({
            floorNumber: floor.number, floorType: this.localization.getFloorTypeLabel(floor.type),
            health: this.playerEntity.stats.health, maxHealth: this.playerEntity.stats.maxHealth, experience: this.playerEntity.experience,
            activeTurn: state.isInventoryOpen ? this.localization.getInventoryTurnLabel(turnSnapshot.activeActor.label) : this.localization.getRoundTurnLabel(turnSnapshot.round, turnSnapshot.activeActor.label),
            enemyCount: turnSnapshot.enemyCount, isGameOver: false, runState: 'playing',
        });
    }

    private collectItemAtPlayerPosition() {
        if (!this.playerEntity) return undefined;
        const pickup = this.itemService.pickupAt(this.playerEntity.position);
        if (!pickup) return undefined;

        if (pickup.status === 'inventory-full' || !pickup.inventoryItem) {
            const inventory = this.itemService.getInventorySnapshot();
            const itemName = pickup.fieldItem ? this.localization.getItemName(pickup.fieldItem.definition.id, pickup.fieldItem.definition.name) : 'item';
            return { line: this.localization.formatInventoryFull(itemName, inventory.usedSlots, inventory.slotCapacity), tone: 'danger' as const };
        }

        this.renderSynchronizer.removeItemLabel(pickup.fieldItemId);
        this.syncInventoryOverlay();
        this.persistRun('active');
        return { line: this.describePickup(pickup.inventoryItem), tone: 'item' as const };
    }

    private useSelectedInventoryItem() {
        if (!this.playerEntity || !this.selectedInventoryItemId) return;
        const activation = this.itemService.activateItem(this.selectedInventoryItemId);
        if (!activation) return;

        const inventory = this.itemService.getInventorySnapshot();
        const item = inventory.items.find(i => i.instanceId === this.selectedInventoryItemId) || activation.item;
        if (!item) return;

        switch (activation.status) {
            case 'consumed':
                const healed = this.playerEntity.heal(activation.healAmount ?? 0);
                this.pushTurnLog(this.describeUse(item, healed), 'item');
                break;
            case 'equipped':
                this.playerEntity.applyStatModifier(activation.statModifier ?? {});
                if (activation.replacedItem) this.pushTurnLog(this.describeEquip(activation.replacedItem, 'unequip', activation.replacedItem.equipment?.statModifier), 'item');
                this.pushTurnLog(this.describeEquip(item, 'equip', item.equipment?.statModifier), 'item');
                break;
            case 'unequipped':
                this.playerEntity.applyStatModifier(activation.statModifier ?? {});
                this.pushTurnLog(this.describeEquip(item, 'unequip', item.equipment?.statModifier), 'item');
                break;
            case 'not-usable':
                this.pushTurnLog(this.localization.formatItemNotUsable(this.localization.getItemName(item.id, item.name)), 'danger');
                break;
        }
        this.syncInventoryOverlay();
        this.refreshTurnStatus();
        this.persistRun('active');
    }

    private dropSelectedInventoryItem() {
        if (!this.playerEntity || !this.selectedInventoryItemId) return;
        const drop = this.itemService.dropItem(this.selectedInventoryItemId, this.playerEntity.position);
        if (!drop) return;

        if (drop.status === 'equipped-item') {
            this.pushTurnLog(this.localization.formatUnequipBeforeDrop(), 'danger');
            return;
        }

        if (drop.status === 'tile-occupied' || !drop.fieldItem) {
            this.pushTurnLog(this.localization.formatOccupiedDrop(), 'danger');
            return;
        }

        this.renderSynchronizer.synchronizeItems(this.floorDirector.getFieldItems());
        this.renderSynchronizer.updateVisibility(this.playerEntity.position, this.floorDirector.getMapData()!, this.floorDirector.getEnemyEntities(), this.floorDirector.getFieldItems());
        this.syncInventoryOverlay();
        this.pushTurnLog(this.describeDrop(drop.fieldItem.definition), 'item');
    }

    private spawnEliteReward(enemy: Enemy) {
        if (!enemy.isElite()) return;
        const mapData = this.floorDirector.getMapData();
        if (!mapData) return;

        const candidates: Position[] = [{ ...enemy.position }];
        for (let r = 1; r <= 2; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    candidates.push({ x: enemy.position.x + dx, y: enemy.position.y + dy });
                }
            }
        }

        const pos = candidates.find(p => {
            if (p.x < 0 || p.x >= mapData.width || p.y < 0 || p.y >= mapData.height) return false;
            if (mapData.tiles[p.y][p.x] !== WORLD_TILE.FLOOR) return false;
            if (this.playerEntity?.position.x === p.x && this.playerEntity.position.y === p.y) return false;
            return !this.floorDirector.getFieldItems().some(i => i.position.x === p.x && i.position.y === p.y)
                && !this.floorDirector.getEnemyEntities().some(e => e.position.x === p.x && e.position.y === p.y);
        });

        if (!pos) {
            this.pushTurnLog(this.localization.formatEliteRewardLost(this.getEnemyName(enemy)), 'danger');
            return;
        }

        const reward = this.itemService.spawnRewardDrop(pos, this.floorDirector.getFloorSnapshot().number, ITEM_RARITY.RARE);
        this.renderSynchronizer.synchronizeItems(this.floorDirector.getFieldItems());
        this.pushTurnLog(this.localization.formatEnemyDrops(this.getEnemyName(enemy), this.localization.getItemName(reward.definition.id, reward.definition.name), reward.definition.rarity), 'item');
    }

    private setInventoryOpen(isOpen: boolean) {
        this.overlayController.setInventory(isOpen);
        this.syncInventoryOverlay();
        this.refreshTurnStatus();
    }

    private selectInventoryItem(id: string) {
        this.selectedInventoryItemId = id;
        this.syncInventoryOverlay();
    }

    private handleLocaleChange() {
        this.battleDirector.refreshTurnQueueRoster();
        this.renderSynchronizer.refreshFieldItemLabels(this.floorDirector.getFieldItems());
        this.overlayController.updateVictory(this.floorDirector.getFloorSnapshot().number, this.defeatedEnemyCount, this.getBossName());
        this.syncTitleOverlay();
        this.syncInventoryOverlay();
        this.syncBossHud();
        this.refreshTurnStatus();
    }

    private pushTurnLog(line: string, tone: HudLogTone = 'system') { this.hud.pushLog(line, tone); }
    private queueFloorEventBanner(floor: FloorSnapshot) {
        this.hud.queueEventBanner(this.localization.formatFloorBanner(floor.number, floor.type), 'travel', 1700);
        if (floor.type === 'boss') this.hud.queueEventBanner(this.localization.formatBossApproaches(this.getBossName()), 'danger', 2400);
    }
    private persistRun(status: PersistedRunStatus) {
        if (this.playerEntity) this.floorDirector.persistRun(status, this.playerEntity, this.defeatedEnemyCount, this.deckService.getCards());
    }

    private getEnemyName(enemy: Pick<Enemy, 'archetypeId' | 'elite'>) { return this.localization.getEnemyName(enemy.archetypeId, enemy.elite); }
    private getBossName() { const boss = this.floorDirector.getBossEnemy(); return boss ? this.getEnemyName(boss) : this.localization.getEnemyName('final-boss'); }
    private describePickup(i: any) { return this.localization.formatPickup(i.icon, this.localization.getItemName(i.id, i.name), i.quantity); }
    private describeDrop(i: any) { return this.localization.formatDrop(i.icon, this.localization.getItemName(i.id, i.name)); }
    private describeUse(i: any, h: number) { return this.localization.formatUse(i.icon, this.localization.getItemName(i.id, i.name), h); }
    private describeEquip(i: any, s: 'equip' | 'unequip', m?: any) {
        const mod = s === 'unequip' ? { maxHealth: m?.maxHealth ? -m.maxHealth : undefined, attack: m?.attack ? -m.attack : undefined, defense: m?.defense ? -m.defense : undefined } : m;
        const summary = [mod?.maxHealth ? `HP ${formatSignedNumber(mod.maxHealth)}` : undefined, mod?.attack ? `ATK ${formatSignedNumber(mod.attack)}` : undefined, mod?.defense ? `DEF ${formatSignedNumber(mod.defense)}` : undefined].filter(Boolean).join(' · ');
        return this.localization.formatEquip(i.icon, this.localization.getItemName(i.id, i.name), s, summary);
    }
    private describeDirection(dx: number, dy: number): MovementDirection {
        if (dx < 0) return 'west'; if (dx > 0) return 'east'; if (dy < 0) return 'north'; return 'south';
    }

    private syncTitleOverlay() {
        const snapshot = this.metaProgression.getSnapshot();
        this.overlayController.syncTitleOverlay(this.runPersistence.hasActiveRun(), snapshot.upgrades);
    }

    private generateDefaultTextures() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x333333, 1); graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.lineStyle(1, 0x444444, 0.5); graphics.strokeRect(0, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x666666, 1); graphics.fillRect(this.tileSize, 0, this.tileSize, this.tileSize);
        graphics.lineStyle(1, 0x777777, 0.5); graphics.strokeRect(this.tileSize, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x5c4a16, 1); graphics.fillRect(this.tileSize * 2, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0xd4a017, 1); graphics.fillRect((this.tileSize * 2) + 8, 6, this.tileSize - 16, 4);
        graphics.fillRect((this.tileSize * 2) + 12, 14, this.tileSize - 20, 4);
        graphics.fillRect((this.tileSize * 2) + 16, 22, this.tileSize - 24, 4);
        graphics.lineStyle(1, 0xeab308, 0.7); graphics.strokeRect(this.tileSize * 2, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x214f3b, 1); graphics.fillRect(this.tileSize * 3, 0, this.tileSize, this.tileSize);
        graphics.fillStyle(0x6ee7b7, 1); graphics.fillCircle((this.tileSize * 3) + (this.tileSize / 2), this.tileSize / 2, this.tileSize * 0.28);
        graphics.lineStyle(1, 0x9ae6b4, 0.7); graphics.strokeRect(this.tileSize * 3, 0, this.tileSize, this.tileSize);
        graphics.generateTexture('tiles', this.tileSize * 4, this.tileSize);

        const playerGraphics = this.make.graphics({ x: 0, y: 0 });
        playerGraphics.fillStyle(0x00ffff, 1); playerGraphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize * 0.4);
        playerGraphics.generateTexture('player', this.tileSize, this.tileSize);

        const crawlerGraphics = this.make.graphics({ x: 0, y: 0 });
        crawlerGraphics.fillStyle(0x2f855a, 1); crawlerGraphics.fillCircle(this.tileSize / 2, this.tileSize / 2, this.tileSize * 0.34);
        crawlerGraphics.fillStyle(0x111827, 1); crawlerGraphics.fillCircle((this.tileSize / 2) - 5, (this.tileSize / 2) - 4, 2);
        crawlerGraphics.fillCircle((this.tileSize / 2) + 5, (this.tileSize / 2) - 4, 2);
        crawlerGraphics.generateTexture('enemy-ash-crawler', this.tileSize, this.tileSize);

        const raiderGraphics = this.make.graphics({ x: 0, y: 0 });
        raiderGraphics.fillStyle(0xb91c1c, 1); raiderGraphics.fillRect(6, 6, this.tileSize - 12, this.tileSize - 12);
        raiderGraphics.fillStyle(0x111827, 1); raiderGraphics.fillRect(10, 10, 4, 4); raiderGraphics.fillRect(this.tileSize - 14, 10, 4, 4);
        raiderGraphics.fillStyle(0xf97316, 1); raiderGraphics.fillRect(12, this.tileSize - 14, this.tileSize - 24, 4);
        raiderGraphics.generateTexture('enemy-blade-raider', this.tileSize, this.tileSize);

        const sentinelGraphics = this.make.graphics({ x: 0, y: 0 });
        sentinelGraphics.fillStyle(0x1d4ed8, 1); sentinelGraphics.fillRect(5, 5, this.tileSize - 10, this.tileSize - 10);
        sentinelGraphics.fillStyle(0x93c5fd, 1); sentinelGraphics.fillRect(10, 10, this.tileSize - 20, this.tileSize - 20);
        sentinelGraphics.fillStyle(0x111827, 1); sentinelGraphics.fillRect(10, 10, 4, 4); sentinelGraphics.fillRect(this.tileSize - 14, 10, 4, 4);
        sentinelGraphics.generateTexture('enemy-dread-sentinel', this.tileSize, this.tileSize);

        const bossGraphics = this.make.graphics({ x: 0, y: 0 });
        bossGraphics.fillStyle(0x7f1d1d, 1); bossGraphics.fillRect(4, 6, this.tileSize - 8, this.tileSize - 8);
        bossGraphics.fillStyle(0xfbbf24, 1); bossGraphics.fillRect(8, 4, 6, 6); bossGraphics.fillRect(this.tileSize - 14, 4, 6, 6);
        bossGraphics.fillStyle(0x111827, 1); bossGraphics.fillRect(10, 12, 4, 4); bossGraphics.fillRect(this.tileSize - 14, 12, 4, 4);
        bossGraphics.fillStyle(0xfca5a5, 1); bossGraphics.fillRect(10, this.tileSize - 12, this.tileSize - 20, 4);
        bossGraphics.generateTexture('boss', this.tileSize, this.tileSize);
    }

    update() {}
}
