import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Enemy } from '../../../src/domain/entities/Enemy';
import { BASE_PLAYER_STATS, cloneCombatStats } from '../../../src/domain/entities/CombatStats';
import { Player } from '../../../src/domain/entities/Player';
import { WORLD_TILE } from '../../../src/shared/types/WorldTiles';

vi.mock('phaser', () => ({}));

type MainSceneModule = typeof import('../../../src/scenes/MainScene');

interface MainSceneStub {
    playerEntity: Player;
    pendingBattleStartEnergy: number;
    hud: {
        setViewportMode: ReturnType<typeof vi.fn>;
    };
    pushTurnLog: ReturnType<typeof vi.fn>;
    completePlayerTurn: ReturnType<typeof vi.fn>;
    handleVictory: ReturnType<typeof vi.fn>;
    handleBossDefeat: ReturnType<typeof vi.fn>;
    handleEnemyDeath: ReturnType<typeof vi.fn>;
    handlePlayerDeath: ReturnType<typeof vi.fn>;
    getEnemyName: ReturnType<typeof vi.fn>;
    clampHealth: (value: number, maxHealth: number) => number;
    floorDirector: {
        removeEnemy: ReturnType<typeof vi.fn>;
    };
    renderSynchronizer: {
        removeEnemySprite: ReturnType<typeof vi.fn>;
    };
    battleDirector: {
        refreshTurnQueueRoster: ReturnType<typeof vi.fn>;
    };
}

describe('MainScene battle result handling', () => {
    let MainScene: MainSceneModule['MainScene'];

    beforeAll(async () => {
        (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser = {
            Scene: class {
                constructor(_config?: unknown) {}
            },
        };
        ({ MainScene } = await import('../../../src/scenes/MainScene'));
    });

    afterAll(() => {
        delete (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser;
    });

    function createSceneStub(): { scene: MainSceneStub; enemy: Enemy } {
        const enemy = new Enemy(
            'enemy-1',
            'Ash Crawler',
            { x: 4, y: 7 },
            {
                health: 12,
                maxHealth: 12,
                attack: 4,
                defense: 1,
                movementSpeed: 100,
            },
            10,
            'normal',
            'ash-crawler',
            false,
        );

        return {
            enemy,
            scene: {
                playerEntity: new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS)),
                pendingBattleStartEnergy: 0,
                hud: {
                    setViewportMode: vi.fn(),
                },
                pushTurnLog: vi.fn(),
                completePlayerTurn: vi.fn(),
                handleVictory: vi.fn(),
                handleBossDefeat: vi.fn(),
                handleEnemyDeath: vi.fn(),
                handlePlayerDeath: vi.fn(),
                getEnemyName: vi.fn().mockReturnValue('Ash Crawler'),
                clampHealth: (value: number, maxHealth: number) => Math.max(0, Math.min(Math.floor(value), maxHealth)),
                floorDirector: {
                    removeEnemy: vi.fn(),
                },
                renderSynchronizer: {
                    removeEnemySprite: vi.fn(),
                },
                battleDirector: {
                    refreshTurnQueueRoster: vi.fn(),
                },
            },
        };
    }

    function createEncounterMoveScene(deckCards: readonly unknown[]) {
        const player = new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS));
        const enemy = new Enemy(
            'enemy-1',
            'Ash Crawler',
            { x: 2, y: 1 },
            {
                health: 12,
                maxHealth: 12,
                attack: 4,
                defense: 1,
                movementSpeed: 100,
            },
            10,
            'normal',
            'ash-crawler',
            false,
        );
        const scene = {
            playerEntity: player,
            floorDirector: {
                getMapData: vi.fn(() => ({
                    width: 3,
                    height: 3,
                    tiles: [
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
                    ],
                })),
                getEnemyAt: vi.fn(() => enemy),
            },
            deckService: {
                getCards: vi.fn(() => deckCards),
            },
            launchBattleScene: vi.fn(),
        };

        return { scene, player, enemy };
    }

    function callOnMove(scene: object, dx: number, dy: number): void {
        const onMove = (
            MainScene.prototype as unknown as {
                onMove: (this: object, dx: number, dy: number) => void;
            }
        ).onMove;

        onMove.call(scene, dx, dy);
    }

    it('uses remaining enemy health to resolve victory rewards after status-based kills', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: MainSceneStub, result: object) => void;
            }
        ).handleBattleSceneResult;

        handleBattleSceneResult.call(scene, {
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 3,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 93,
            enemyRemainingHealth: 0,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(scene.playerEntity.stats.health).toBe(93);
        expect(enemy.stats.health).toBe(0);
        expect(scene.pendingBattleStartEnergy).toBe(0);
        expect(scene.hud.setViewportMode).toHaveBeenCalledWith('field');
        expect(scene.floorDirector.removeEnemy).toHaveBeenCalledWith(enemy.id);
        expect(scene.renderSynchronizer.removeEnemySprite).toHaveBeenCalledWith(enemy.id);
        expect(scene.battleDirector.refreshTurnQueueRoster).toHaveBeenCalledOnce();
        expect(scene.handleEnemyDeath).toHaveBeenCalledWith(enemy);
        expect(scene.completePlayerTurn).not.toHaveBeenCalled();
    });

    it('routes boss victories into the boss reward flow instead of ending immediately', () => {
        const { scene } = createSceneStub();
        const boss = new Enemy(
            'boss-1',
            'Final Boss',
            { x: 8, y: 8 },
            {
                health: 40,
                maxHealth: 40,
                attack: 12,
                defense: 6,
                movementSpeed: 100,
            },
            40,
            'boss',
            'final-boss',
            false,
        );
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: MainSceneStub, result: object) => void;
            }
        ).handleBattleSceneResult;

        handleBattleSceneResult.call(scene, {
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 5,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 82,
            enemyRemainingHealth: 0,
            nextBattleStartEnergyBonus: 0,
            enemy: boss,
        });

        expect(scene.handleBossDefeat).toHaveBeenCalledWith(boss);
        expect(scene.handleVictory).not.toHaveBeenCalled();
        expect(scene.handleEnemyDeath).not.toHaveBeenCalled();
    });

    it('routes enemy contact with a normal deck into BattleScene', () => {
        const { scene, player, enemy } = createEncounterMoveScene([{ id: 'card-1' }]);

        callOnMove(scene, 1, 0);

        expect(scene.launchBattleScene).toHaveBeenCalledWith(player, enemy);
    });

    it('routes enemy contact with an empty saved deck into BattleScene', () => {
        const { scene, player, enemy } = createEncounterMoveScene([]);

        callOnMove(scene, 1, 0);

        expect(scene.launchBattleScene).toHaveBeenCalledWith(player, enemy);
        expect(scene.deckService.getCards).not.toHaveBeenCalled();
    });

    it('grants a boss reward, opens cursed choices, and persists the pending boss offer', () => {
        const boss = new Enemy(
            'boss-1',
            'Final Boss',
            { x: 8, y: 8 },
            {
                health: 0,
                maxHealth: 40,
                attack: 12,
                defense: 6,
                movementSpeed: 100,
            },
            40,
            'boss',
            'final-boss',
            false,
        );
        const rewardChoices = [
            {
                id: 'cursed-edge',
                name: 'Cursed Edge',
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'ATK +7.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 7 },
                },
            },
            {
                id: 'runic-blindfold',
                name: 'Runic Blindfold',
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '^',
                stackable: false,
                maxStack: 1,
                description: 'Draw +1.',
                equipment: {
                    slot: 'HELMET',
                    statModifier: {},
                },
            },
            {
                id: 'madmans-hood',
                name: "Madman's Hood",
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '^',
                stackable: false,
                maxStack: 1,
                description: 'Opening hand cards gain +3 power.',
                equipment: {
                    slot: 'HELMET',
                    statModifier: {},
                },
            },
        ];
        const scene = {
            recordEnemyDefeat: vi.fn(),
            removeBossFromFloor: vi.fn(),
            syncBossHud: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            pushTurnLog: vi.fn(),
            beginSpecialRewardFlow: vi.fn(),
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 100 })),
            },
            itemService: {
                grantBossReward: vi.fn(() => ({
                    status: 'granted',
                    rewardItem: {
                        id: 'soulfire-brand',
                        instanceId: 'item-special-1',
                        name: 'Soulfire Brand',
                        type: 'EQUIPMENT',
                        rarity: 'EPIC',
                        icon: '/',
                        stackable: false,
                        maxStack: 1,
                        quantity: 1,
                        description: 'Start battle with Strength +2.',
                        isEquipped: false,
                    },
                })),
                createSpecialRewardChoices: vi.fn(() => rewardChoices),
                getInventorySnapshot: vi.fn(() => ({ usedSlots: 5, slotCapacity: 12 })),
            },
            localization: {
                getItemName: vi.fn((_id: string, name: string) => name),
                formatBossRewardClaimed: vi.fn((name: string, rarity: string) => `${name}:${rarity}`),
                formatInventoryFull: vi.fn(),
                getBundle: vi.fn(() => ({
                    ui: {
                        bossRewardTitle: 'Choose a Boss Reward',
                    },
                })),
            },
            completeVictory: vi.fn(),
        };
        const handleBossDefeat = (
            MainScene.prototype as unknown as {
                handleBossDefeat: (this: typeof scene, bossArg: Enemy) => void;
            }
        ).handleBossDefeat;

        handleBossDefeat.call(scene, boss);

        expect(scene.recordEnemyDefeat).toHaveBeenCalledWith(boss);
        expect(scene.removeBossFromFloor).toHaveBeenCalledWith(boss.id);
        expect(scene.itemService.grantBossReward).toHaveBeenCalledWith(100);
        expect(scene.pushTurnLog).toHaveBeenCalledWith('Soulfire Brand:EPIC', 'item');
        expect(scene.beginSpecialRewardFlow).toHaveBeenCalledWith(rewardChoices, {
            sourceType: 'boss',
            bossArchetypeId: 'final-boss',
            offeredItemIds: ['cursed-edge', 'runic-blindfold', 'madmans-hood'],
        });
        expect(scene.syncInventoryOverlay).toHaveBeenCalledOnce();
        expect(scene.persistRun).toHaveBeenCalledWith('active');
    });

    it('switches the fixed HUD chrome off before launching BattleScene', () => {
        const player = new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS));
        const enemy = new Enemy(
            'enemy-2',
            'Ash Crawler',
            { x: 2, y: 1 },
            {
                health: 18,
                maxHealth: 18,
                attack: 4,
                defense: 1,
                movementSpeed: 100,
            },
            12,
            'normal',
            'ash-crawler',
            false,
        );
        const encounterCompanion = new Enemy(
            'enemy-2:encounter:back-harasser:1',
            'Ash Crawler',
            { x: 2, y: 1 },
            {
                health: 18,
                maxHealth: 18,
                attack: 4,
                defense: 1,
                movementSpeed: 100,
            },
            0,
            'normal',
            'ash-crawler',
            false,
        );
        const setOnBattleEnd = vi.fn();
        const scene = {
            deckService: {},
            cardBattleService: {},
            itemService: {},
            hud: {
                setViewportMode: vi.fn(),
            },
            pendingBattleStartEnergy: 2,
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 4 })),
                buildBattleEncounter: vi.fn(() => [enemy, encounterCompanion]),
            },
            getEnemyName: vi.fn(() => 'Ash Crawler'),
            handleBattleSceneResult: vi.fn(),
            scene: {
                get: vi.fn(() => ({ setOnBattleEnd })),
                sleep: vi.fn(),
                launch: vi.fn(),
            },
        };
        const launchBattleScene = (
            MainScene.prototype as unknown as {
                launchBattleScene: (this: typeof scene, playerArg: Player, enemyArg: Enemy) => void;
            }
        ).launchBattleScene;

        launchBattleScene.call(scene, player, enemy);

        const launchedData = scene.scene.launch.mock.calls[0]?.[1] as { isShowdown?: boolean };
        expect(scene.hud.setViewportMode).toHaveBeenCalledWith('battle-scene');
        expect(scene.scene.sleep).toHaveBeenCalledWith('MainScene');
        expect(scene.scene.launch).toHaveBeenCalledWith('BattleScene', expect.objectContaining({
            player,
            enemy,
            encounterEnemies: [enemy, encounterCompanion],
            enemyName: 'Ash Crawler',
            floorNumber: 4,
            startEnergyBonus: 2,
        }));
        expect(launchedData.isShowdown).toBeUndefined();
        expect(setOnBattleEnd).toHaveBeenCalledOnce();
    });

    it('marks Showdown BattleScene launches with the Showdown Dread Rule context', () => {
        const player = new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS));
        const enemy = new Enemy(
            'showdown-final-boss',
            'Showdown Echo',
            { x: 2, y: 1 },
            {
                health: 42,
                maxHealth: 42,
                attack: 8,
                defense: 3,
                movementSpeed: 100,
            },
            0,
            'boss',
            'final-boss',
            false,
        );
        const setOnBattleEnd = vi.fn();
        const scene = {
            deckService: {},
            cardBattleService: {},
            itemService: {},
            hud: {
                setViewportMode: vi.fn(),
            },
            pendingBattleStartEnergy: 1,
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 100 })),
            },
            getEnemyName: vi.fn(() => 'Showdown Echo'),
            handleBattleSceneResult: vi.fn(),
            scene: {
                get: vi.fn(() => ({ setOnBattleEnd })),
                sleep: vi.fn(),
                launch: vi.fn(),
            },
        };
        const launchShowdownBattle = (
            MainScene.prototype as unknown as {
                launchShowdownBattle: (this: typeof scene, playerArg: Player, enemyArg: Enemy) => void;
            }
        ).launchShowdownBattle;

        launchShowdownBattle.call(scene, player, enemy);

        expect(scene.hud.setViewportMode).toHaveBeenCalledWith('battle-scene');
        expect(scene.scene.sleep).toHaveBeenCalledWith('MainScene');
        expect(scene.scene.launch).toHaveBeenCalledWith('BattleScene', expect.objectContaining({
            player,
            enemy,
            encounterEnemies: [enemy],
            enemyName: 'Showdown Echo',
            floorNumber: 100,
            isShowdown: true,
            startEnergyBonus: 1,
        }));
        expect(setOnBattleEnd).toHaveBeenCalledOnce();
    });

    it('stores the next battle start energy bonus returned from BattleScene', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: MainSceneStub, result: object) => void;
            }
        ).handleBattleSceneResult;

        handleBattleSceneResult.call(scene, {
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 2,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 96,
            enemyRemainingHealth: 6,
            nextBattleStartEnergyBonus: 1,
            enemy,
        });

        expect(scene.pendingBattleStartEnergy).toBe(1);
        expect(scene.completePlayerTurn).toHaveBeenCalledWith('');
    });

    it('opens special reward choices from key items without forcing an immediate grant', () => {
        const scene = {
            playerEntity: new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS)),
            selectedInventoryItemId: 'bronze-1',
            pushTurnLog: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            pendingSpecialRewardChoices: [],
            pendingSpecialRewardOffer: undefined,
            isSpecialRewardFlowOpen: false,
            itemService: {
                getInventorySnapshot: vi.fn(() => ({
                    items: [
                        {
                            id: 'bronze-sigil',
                            instanceId: 'bronze-1',
                            name: 'Bronze Sigil',
                            type: 'KEY',
                            rarity: 'RARE',
                            icon: '?',
                            stackable: false,
                            maxStack: 1,
                            quantity: 1,
                            description: 'Break the seal to reveal a special cache.',
                            isEquipped: false,
                        },
                    ],
                })),
                openSpecialReward: vi.fn(() => ({
                    status: 'opened',
                    rewardChoices: [
                        {
                            id: 'cursed-edge',
                            name: 'Cursed Edge',
                            type: 'EQUIPMENT',
                            rarity: 'CURSED',
                            icon: '/',
                            stackable: false,
                            maxStack: 1,
                            description: 'ATK +7.',
                            equipment: {
                                slot: 'WEAPON',
                                statModifier: { attack: 7 },
                            },
                        },
                    ],
                })),
            },
            hud: {
                showSpecialRewardOverlay: vi.fn(),
            },
            overlayController: {
                setInventory: vi.fn(),
            },
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 25 })),
            },
            localization: {
                getItemName: vi.fn((_id: string, name: string) => name),
                formatItemNotUsable: vi.fn((name: string) => `${name}:nope`),
            },
            handleSpecialRewardSelection: vi.fn(),
            beginSpecialRewardFlow: undefined as unknown as (
                rewardChoices: readonly unknown[],
                offer: object,
            ) => void,
        };
        scene.beginSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                beginSpecialRewardFlow: (
                    this: typeof scene,
                    rewardChoices: readonly unknown[],
                    offer: object,
                ) => void;
            }
        ).beginSpecialRewardFlow;
        const useSelectedInventoryItem = (
            MainScene.prototype as unknown as {
                useSelectedInventoryItem: (this: typeof scene) => void;
            }
        ).useSelectedInventoryItem;

        useSelectedInventoryItem.call(scene);

        expect(scene.itemService.openSpecialReward).toHaveBeenCalledWith('bronze-1', 25);
        expect(scene.hud.showSpecialRewardOverlay).toHaveBeenCalledOnce();
        expect(scene.pendingSpecialRewardChoices).toEqual([
            expect.objectContaining({ id: 'cursed-edge' }),
        ]);
        expect(scene.pendingSpecialRewardOffer).toEqual({
            sourceType: 'cache',
            keyItemId: 'bronze-sigil',
            offeredItemIds: ['cursed-edge'],
        });
        expect(scene.isSpecialRewardFlowOpen).toBe(true);
        expect(scene.persistRun).toHaveBeenCalledWith('active');
        expect(scene.syncInventoryOverlay).toHaveBeenCalledOnce();
        expect(scene.refreshTurnStatus).toHaveBeenCalledOnce();
    });

    it('grants the selected special reward and persists the updated inventory', () => {
        const scene = {
            pushTurnLog: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            pendingSpecialRewardOffer: {
                sourceType: 'cache',
                keyItemId: 'bronze-sigil',
                offeredItemIds: ['cursed-edge'],
            },
            pendingSpecialRewardChoices: [
                {
                    id: 'cursed-edge',
                    name: 'Cursed Edge',
                    type: 'EQUIPMENT',
                    rarity: 'CURSED',
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'ATK +7.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: { attack: 7 },
                    },
                },
            ],
            isSpecialRewardFlowOpen: true,
            itemService: {
                claimSpecialReward: vi.fn(() => ({
                    status: 'granted',
                    rewardItem: {
                        id: 'cursed-edge',
                        instanceId: 'item-special-1',
                        name: 'Cursed Edge',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '/',
                        stackable: false,
                        maxStack: 1,
                        quantity: 1,
                        description: 'ATK +7.',
                        isEquipped: false,
                    },
                })),
            },
            hud: {
                hideSpecialRewardOverlay: vi.fn(),
            },
            localization: {
                getItemName: vi.fn((_id: string, name: string) => name),
                formatSpecialCacheOpened: vi.fn((name: string, rarity: string) => `${name}:${rarity}`),
                formatInventoryFull: vi.fn(),
                formatSpecialCacheChoiceExpired: vi.fn(),
            },
            completeSpecialRewardFlow() {
                this.resetSpecialRewardFlowState();
                this.syncInventoryOverlay();
                this.refreshTurnStatus();
                this.persistRun('active');
            },
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
        };
        const handleSpecialRewardSelection = (
            MainScene.prototype as unknown as {
                handleSpecialRewardSelection: (this: typeof scene, selectedItemId: string | null) => void;
            }
        ).handleSpecialRewardSelection;

        handleSpecialRewardSelection.call(scene, 'cursed-edge');

        expect(scene.itemService.claimSpecialReward).toHaveBeenCalledWith('cursed-edge');
        expect(scene.pushTurnLog).toHaveBeenCalledWith('Cursed Edge:CURSED', 'item');
        expect(scene.syncInventoryOverlay).toHaveBeenCalledOnce();
        expect(scene.refreshTurnStatus).toHaveBeenCalledOnce();
        expect(scene.persistRun).toHaveBeenCalledWith('active');
        expect(scene.pendingSpecialRewardOffer).toBeUndefined();
        expect(scene.pendingSpecialRewardChoices).toEqual([]);
        expect(scene.isSpecialRewardFlowOpen).toBe(false);
    });

    it('claims boss rewards and ends the run in victory', () => {
        const scene = {
            pushTurnLog: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            pendingSpecialRewardOffer: {
                sourceType: 'boss',
                bossArchetypeId: 'final-boss',
                offeredItemIds: ['cursed-edge'],
            },
            pendingSpecialRewardChoices: [
                {
                    id: 'cursed-edge',
                    name: 'Cursed Edge',
                    type: 'EQUIPMENT',
                    rarity: 'CURSED',
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'ATK +7.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: { attack: 7 },
                    },
                },
            ],
            isSpecialRewardFlowOpen: true,
            itemService: {
                claimSpecialReward: vi.fn(() => ({
                    status: 'granted',
                    rewardItem: {
                        id: 'cursed-edge',
                        instanceId: 'item-special-1',
                        name: 'Cursed Edge',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '/',
                        stackable: false,
                        maxStack: 1,
                        quantity: 1,
                        description: 'ATK +7.',
                        isEquipped: false,
                    },
                })),
            },
            hud: {
                hideSpecialRewardOverlay: vi.fn(),
            },
            localization: {
                getItemName: vi.fn((_id: string, name: string) => name),
                formatBossRewardClaimed: vi.fn((name: string, rarity: string) => `${name}:${rarity}`),
                formatInventoryFull: vi.fn(),
                formatBossRewardChoiceExpired: vi.fn(),
                getEnemyName: vi.fn(() => 'Final Boss'),
                formatVictory: vi.fn((bossName: string) => `${bossName}:victory`),
                getFloorTypeLabel: vi.fn(() => 'Boss Lair'),
                getEndingTurnLabel: vi.fn(() => 'Ending'),
            },
            overlayController: {
                setInventory: vi.fn(),
                setVictory: vi.fn(),
                updateVictory: vi.fn(),
                getState: vi.fn(() => ({
                    isTitleScreenOpen: false,
                    isVictory: false,
                    isGameOver: false,
                    isInventoryOpen: false,
                })),
            },
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 100, type: 'boss' })),
            },
            playerEntity: {
                stats: cloneCombatStats(BASE_PLAYER_STATS),
                experience: 12,
            },
            getBossName: vi.fn(() => 'Final Boss'),
            beginPostBossDecisionFlow: vi.fn(),
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
            completeSpecialRewardFlow: undefined as unknown as () => void,
            completeVictory: undefined as unknown as (bossName: string) => void,
        };
        scene.completeVictory = (
            MainScene.prototype as unknown as {
                completeVictory: (this: typeof scene, bossName: string) => void;
            }
        ).completeVictory;
        scene.completeSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                completeSpecialRewardFlow: (this: typeof scene) => void;
            }
        ).completeSpecialRewardFlow;
        const handleSpecialRewardSelection = (
            MainScene.prototype as unknown as {
                handleSpecialRewardSelection: (this: typeof scene, selectedItemId: string | null) => void;
            }
        ).handleSpecialRewardSelection;

        handleSpecialRewardSelection.call(scene, 'cursed-edge');

        expect(scene.itemService.claimSpecialReward).toHaveBeenCalledWith('cursed-edge', {
            ignoreInventoryCapacity: true,
        });
        expect(scene.pushTurnLog).toHaveBeenCalledWith('Cursed Edge:CURSED', 'item');
        expect(scene.beginPostBossDecisionFlow).toHaveBeenCalledWith('final-boss');
        expect(scene.overlayController.setVictory).not.toHaveBeenCalled();
        expect(scene.pendingSpecialRewardOffer).toBeUndefined();
        expect(scene.isSpecialRewardFlowOpen).toBe(false);
    });

    it('falls back to the final boss name when a legacy boss reward offer has no boss archetype id', () => {
        const scene = {
            pushTurnLog: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            pendingSpecialRewardOffer: {
                sourceType: 'boss',
                offeredItemIds: ['cursed-edge'],
            },
            pendingSpecialRewardChoices: [
                {
                    id: 'cursed-edge',
                    name: 'Cursed Edge',
                    type: 'EQUIPMENT',
                    rarity: 'CURSED',
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'ATK +7.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: { attack: 7 },
                    },
                },
            ],
            isSpecialRewardFlowOpen: true,
            hud: {
                hideSpecialRewardOverlay: vi.fn(),
            },
            localization: {
                getEnemyName: vi.fn(() => 'Final Boss'),
                formatVictory: vi.fn((bossName: string) => `${bossName}:victory`),
                getFloorTypeLabel: vi.fn(() => 'Boss Lair'),
                getEndingTurnLabel: vi.fn(() => 'Ending'),
            },
            overlayController: {
                setInventory: vi.fn(),
                setVictory: vi.fn(),
                updateVictory: vi.fn(),
                getState: vi.fn(() => ({
                    isTitleScreenOpen: false,
                    isVictory: false,
                    isGameOver: false,
                    isInventoryOpen: false,
                })),
            },
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 100, type: 'boss' })),
            },
            playerEntity: {
                stats: cloneCombatStats(BASE_PLAYER_STATS),
                experience: 12,
            },
            defeatedEnemyCount: 9,
            getBossName: vi.fn(() => 'Final Boss'),
            persistRun: vi.fn(),
            beginPostBossDecisionFlow: vi.fn(),
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
            completeSpecialRewardFlow: undefined as unknown as () => void,
            completeVictory: undefined as unknown as (bossName: string) => void,
        };
        scene.completeVictory = (
            MainScene.prototype as unknown as {
                completeVictory: (this: typeof scene, bossName: string) => void;
            }
        ).completeVictory;
        scene.completeSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                completeSpecialRewardFlow: (this: typeof scene) => void;
            }
        ).completeSpecialRewardFlow;

        scene.completeSpecialRewardFlow();

        expect(scene.beginPostBossDecisionFlow).toHaveBeenCalledWith('final-boss');
        expect(scene.persistRun).not.toHaveBeenCalledWith('victory');
        expect(scene.overlayController.setVictory).not.toHaveBeenCalled();
        expect(scene.pendingSpecialRewardOffer).toBeUndefined();
        expect(scene.isSpecialRewardFlowOpen).toBe(false);
    });

    it('claims Pact Reward and finishes from the post-boss decision', () => {
        const scene = new MainScene(
            {
                hidePostBossDecisionOverlay: vi.fn(),
            } as never,
            {
                subscribe: vi.fn(),
                getEnemyName: vi.fn(() => 'Final Boss'),
                getItemName: vi.fn((_id: string, name: string) => name),
                formatPactRewardClaimed: vi.fn((name: string, rarity: string) => `pact:${name}:${rarity}`),
                formatPactRewardUnavailable: vi.fn(),
            } as never,
        ) as unknown as {
            pendingPostBossDecision?: object;
            isPostBossDecisionFlowOpen: boolean;
            itemService: object;
            pushTurnLog: ReturnType<typeof vi.fn>;
            syncInventoryOverlay: ReturnType<typeof vi.fn>;
            completeVictory: ReturnType<typeof vi.fn>;
        };
        scene.pendingPostBossDecision = {
            state: 'offered',
            bossArchetypeId: 'final-boss',
            pactItemId: 'pact-armor',
            showdownEnemyId: 'showdown-final-boss',
        };
        scene.isPostBossDecisionFlowOpen = true;
        scene.itemService = {
            grantPactReward: vi.fn(() => ({
                status: 'granted',
                rewardItem: {
                    id: 'pact-armor',
                    name: 'Pact Armor',
                    rarity: 'CURSED',
                },
            })),
        };
        scene.pushTurnLog = vi.fn();
        scene.syncInventoryOverlay = vi.fn();
        scene.completeVictory = vi.fn();
        const handlePostBossDecisionSelection = (
            MainScene.prototype as unknown as {
                handlePostBossDecisionSelection: (this: typeof scene, action: 'pact') => void;
            }
        ).handlePostBossDecisionSelection;

        handlePostBossDecisionSelection.call(scene, 'pact');

        expect((scene.itemService as { grantPactReward: ReturnType<typeof vi.fn> }).grantPactReward)
            .toHaveBeenCalledWith('pact-armor');
        expect(scene.pushTurnLog).toHaveBeenCalledWith('pact:Pact Armor:CURSED', 'item');
        expect(scene.syncInventoryOverlay).toHaveBeenCalledOnce();
        expect(scene.completeVictory).toHaveBeenCalledWith('Final Boss');
        expect(scene.pendingPostBossDecision).toBeUndefined();
        expect(scene.isPostBossDecisionFlowOpen).toBe(false);
    });

    it('starts a Showdown battle from the post-boss decision and persists the risk state', () => {
        const player = new Player({ x: 3, y: 4 }, cloneCombatStats(BASE_PLAYER_STATS));
        const scene = new MainScene(
            {
                hidePostBossDecisionOverlay: vi.fn(),
                setViewportMode: vi.fn(),
            } as never,
            {
                subscribe: vi.fn(),
                getEnemyName: vi.fn(() => 'Final Boss'),
                formatShowdownStarted: vi.fn(() => 'showdown-start'),
            } as never,
        ) as unknown as {
            pendingPostBossDecision?: { state: string };
            isPostBossDecisionFlowOpen: boolean;
            playerEntity: Player;
            floorDirector: object;
            deckService: object;
            cardBattleService: object;
            itemService: object;
            pushTurnLog: ReturnType<typeof vi.fn>;
            persistRun: ReturnType<typeof vi.fn>;
            launchShowdownBattle: ReturnType<typeof vi.fn>;
        };
        scene.pendingPostBossDecision = {
            state: 'offered',
            bossArchetypeId: 'final-boss',
            pactItemId: 'pact-armor',
            showdownEnemyId: 'showdown-final-boss',
        } as never;
        scene.isPostBossDecisionFlowOpen = true;
        scene.playerEntity = player;
        scene.floorDirector = {
            getFloorSnapshot: vi.fn(() => ({ number: 100 })),
        };
        scene.deckService = {};
        scene.cardBattleService = {};
        scene.itemService = {};
        scene.pushTurnLog = vi.fn();
        scene.persistRun = vi.fn();
        scene.launchShowdownBattle = vi.fn();
        const handlePostBossDecisionSelection = (
            MainScene.prototype as unknown as {
                handlePostBossDecisionSelection: (this: typeof scene, action: 'showdown') => void;
            }
        ).handlePostBossDecisionSelection;

        handlePostBossDecisionSelection.call(scene, 'showdown');

        expect(scene.pendingPostBossDecision?.state).toBe('showdown');
        expect(scene.isPostBossDecisionFlowOpen).toBe(false);
        expect(scene.pushTurnLog).toHaveBeenCalledWith('showdown-start', 'danger');
        expect(scene.persistRun).toHaveBeenCalledWith('active');
        expect(scene.launchShowdownBattle).toHaveBeenCalledWith(player, expect.objectContaining({
            id: 'showdown-final-boss',
            kind: 'boss',
        }));
    });

    it('completes victory on Showdown win and fails the run on Showdown escape', () => {
        const { enemy } = createSceneStub();
        const scene = new MainScene(
            {
                hidePostBossDecisionOverlay: vi.fn(),
                setViewportMode: vi.fn(),
            } as never,
            {
                subscribe: vi.fn(),
                getEnemyName: vi.fn(() => 'Final Boss'),
                formatShowdownVictory: vi.fn(() => 'showdown-win'),
                formatShowdownFailed: vi.fn(() => 'showdown-failed'),
            } as never,
        ) as unknown as {
            pendingPostBossDecision?: object;
            isPostBossDecisionFlowOpen: boolean;
            pushTurnLog: ReturnType<typeof vi.fn>;
            completeVictory: ReturnType<typeof vi.fn>;
            handlePlayerDeath: ReturnType<typeof vi.fn>;
        };
        scene.pendingPostBossDecision = {
            state: 'showdown',
            bossArchetypeId: 'final-boss',
            pactItemId: 'pact-armor',
            showdownEnemyId: 'showdown-final-boss',
        };
        scene.pushTurnLog = vi.fn();
        scene.completeVictory = vi.fn();
        scene.handlePlayerDeath = vi.fn();
        const handleShowdownBattleResult = (
            MainScene.prototype as unknown as {
                handleShowdownBattleResult: (this: typeof scene, result: object) => void;
            }
        ).handleShowdownBattleResult;

        handleShowdownBattleResult.call(scene, {
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 2,
            totalPlayerDamage: 0,
            totalEnemyDamage: 20,
            playerRemainingHealth: 90,
            enemyRemainingHealth: 0,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(scene.pushTurnLog).toHaveBeenCalledWith('showdown-win', 'combat');
        expect(scene.completeVictory).toHaveBeenCalledWith('Final Boss');
        expect(scene.pendingPostBossDecision).toBeUndefined();

        scene.pendingPostBossDecision = {
            state: 'showdown',
            bossArchetypeId: 'final-boss',
            pactItemId: 'pact-armor',
            showdownEnemyId: 'showdown-final-boss',
        };
        handleShowdownBattleResult.call(scene, {
            outcome: 'player-win',
            resolution: 'escape',
            totalRounds: 1,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 90,
            enemyRemainingHealth: 10,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(scene.pushTurnLog).toHaveBeenCalledWith('showdown-failed', 'danger');
        expect(scene.handlePlayerDeath).toHaveBeenCalledOnce();
        expect(scene.pendingPostBossDecision).toBeUndefined();
    });

    it('allows skipping a special reward after opening the cache', () => {
        const scene = {
            pushTurnLog: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            pendingSpecialRewardOffer: {
                sourceType: 'cache',
                keyItemId: 'bronze-sigil',
                offeredItemIds: ['cursed-edge'],
            },
            pendingSpecialRewardChoices: [
                {
                    id: 'cursed-edge',
                    name: 'Cursed Edge',
                    type: 'EQUIPMENT',
                    rarity: 'CURSED',
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'ATK +7.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: { attack: 7 },
                    },
                },
            ],
            isSpecialRewardFlowOpen: true,
            hud: {
                hideSpecialRewardOverlay: vi.fn(),
            },
            localization: {
                formatSpecialCacheSkipped: vi.fn(() => 'skipped'),
            },
            completeSpecialRewardFlow() {
                this.resetSpecialRewardFlowState();
                this.syncInventoryOverlay();
                this.refreshTurnStatus();
                this.persistRun('active');
            },
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
        };
        const handleSpecialRewardSelection = (
            MainScene.prototype as unknown as {
                handleSpecialRewardSelection: (this: typeof scene, selectedItemId: string | null) => void;
            }
        ).handleSpecialRewardSelection;

        handleSpecialRewardSelection.call(scene, null);

        expect(scene.pushTurnLog).toHaveBeenCalledWith('skipped', 'system');
        expect(scene.persistRun).toHaveBeenCalledWith('active');
        expect(scene.pendingSpecialRewardOffer).toBeUndefined();
        expect(scene.pendingSpecialRewardChoices).toEqual([]);
        expect(scene.isSpecialRewardFlowOpen).toBe(false);
    });

    it('restores a pending special reward offer when resuming a saved run', () => {
        const savedRun = {
            status: 'active',
            floor: { number: 25, type: 'normal' },
            player: {
                stats: cloneCombatStats(BASE_PLAYER_STATS),
                experience: 12,
            },
            inventory: [],
            deck: [],
            defeatedEnemyCount: 3,
            pendingBattleStartEnergy: 0,
            pendingSpecialRewardOffer: {
                sourceType: 'cache',
                keyItemId: 'bronze-sigil',
                offeredItemIds: ['cursed-edge', 'runic-blindfold'],
            },
        };
        const scene = {
            hud: {
                clearLogs: vi.fn(),
                showSpecialRewardOverlay: vi.fn(),
                hideSpecialRewardOverlay: vi.fn(),
            },
            selectedInventoryItemId: 'old-item',
            defeatedEnemyCount: 0,
            pendingBattleStartEnergy: 0,
            pendingSpecialRewardChoices: [],
            pendingSpecialRewardOffer: undefined,
            isSpecialRewardFlowOpen: false,
            resetCardRewardFlowState: vi.fn(),
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
            resetPostBossDecisionFlowState: vi.fn(),
            renderSynchronizer: {
                clearPlayerTint: vi.fn(),
            },
            floorDirector: {
                loadSavedRun: vi.fn(() => savedRun),
                restoreFloor: vi.fn(() => savedRun.floor),
            },
            itemService: {
                resetRun: vi.fn(),
                restoreInventory: vi.fn(),
                getSpecialRewardChoiceDefinitions: vi.fn(() => [
                    {
                        id: 'cursed-edge',
                        name: 'Cursed Edge',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '/',
                        stackable: false,
                        maxStack: 1,
                        description: 'ATK +7.',
                        equipment: {
                            slot: 'WEAPON',
                            statModifier: { attack: 7 },
                        },
                    },
                    {
                        id: 'runic-blindfold',
                        name: 'Runic Blindfold',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '^',
                        stackable: false,
                        maxStack: 1,
                        description: 'Draw +1.',
                        equipment: {
                            slot: 'HELMET',
                            statModifier: {},
                        },
                    },
                ]),
            },
            deckService: {
                restoreDeck: vi.fn(),
            },
            buildFloor: vi.fn(),
            playerEntity: {
                restore: vi.fn(),
            },
            overlayController: {
                setInventory: vi.fn(),
            },
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            localization: {
                formatResumedFloor: vi.fn(() => 'resume'),
            },
            handleSpecialRewardSelection: vi.fn(),
            beginSpecialRewardFlow: undefined as unknown as (
                rewardChoices: readonly unknown[],
                offer: object,
            ) => void,
            restorePendingSpecialRewardFlow: undefined as unknown as (
                pendingSpecialRewardOffer: typeof savedRun.pendingSpecialRewardOffer,
            ) => void,
            restorePendingPostBossDecisionFlow: vi.fn(),
        };
        scene.beginSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                beginSpecialRewardFlow: (
                    this: typeof scene,
                    rewardChoices: readonly unknown[],
                    offer: object,
                ) => void;
            }
        ).beginSpecialRewardFlow;
        scene.restorePendingSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                restorePendingSpecialRewardFlow: (
                    this: typeof scene,
                    pendingSpecialRewardOffer: typeof savedRun.pendingSpecialRewardOffer,
                ) => void;
            }
        ).restorePendingSpecialRewardFlow;
        const resumeSavedRun = (
            MainScene.prototype as unknown as {
                resumeSavedRun: (this: typeof scene) => void;
            }
        ).resumeSavedRun;

        resumeSavedRun.call(scene);

        expect(scene.itemService.getSpecialRewardChoiceDefinitions).toHaveBeenCalledWith([
            'cursed-edge',
            'runic-blindfold',
        ]);
        expect(scene.overlayController.setInventory).toHaveBeenCalledWith(true);
        expect(scene.hud.showSpecialRewardOverlay).toHaveBeenCalledOnce();
        expect(scene.pendingSpecialRewardOffer).toEqual(savedRun.pendingSpecialRewardOffer);
        expect(scene.pendingSpecialRewardChoices).toEqual([
            expect.objectContaining({ id: 'cursed-edge' }),
            expect.objectContaining({ id: 'runic-blindfold' }),
        ]);
        expect(scene.isSpecialRewardFlowOpen).toBe(true);
        expect(scene.persistRun).toHaveBeenCalledWith('active');
    });

    it('restores boss reward offers without reopening the inventory and removes the boss again', () => {
        const savedRun = {
            status: 'active',
            floor: { number: 100, type: 'boss' },
            player: {
                stats: cloneCombatStats(BASE_PLAYER_STATS),
                experience: 20,
            },
            inventory: [],
            deck: [],
            defeatedEnemyCount: 9,
            pendingBattleStartEnergy: 0,
            pendingSpecialRewardOffer: {
                sourceType: 'boss',
                bossArchetypeId: 'final-boss',
                offeredItemIds: ['cursed-edge', 'runic-blindfold'],
            },
        };
        const scene = {
            hud: {
                clearLogs: vi.fn(),
                showSpecialRewardOverlay: vi.fn(),
                hideSpecialRewardOverlay: vi.fn(),
            },
            selectedInventoryItemId: undefined,
            defeatedEnemyCount: 0,
            pendingBattleStartEnergy: 0,
            pendingSpecialRewardChoices: [],
            pendingSpecialRewardOffer: undefined,
            isSpecialRewardFlowOpen: false,
            resetCardRewardFlowState: vi.fn(),
            resetSpecialRewardFlowState() {
                this.pendingSpecialRewardChoices = [];
                this.pendingSpecialRewardOffer = undefined;
                this.isSpecialRewardFlowOpen = false;
                this.hud.hideSpecialRewardOverlay();
            },
            resetPostBossDecisionFlowState: vi.fn(),
            renderSynchronizer: {
                clearPlayerTint: vi.fn(),
                removeEnemySprite: vi.fn(),
            },
            floorDirector: {
                loadSavedRun: vi.fn(() => savedRun),
                restoreFloor: vi.fn(() => savedRun.floor),
                getBossEnemy: vi.fn(() => ({ id: 'boss-1' })),
                removeEnemy: vi.fn(),
            },
            itemService: {
                resetRun: vi.fn(),
                restoreInventory: vi.fn(),
                getSpecialRewardChoiceDefinitions: vi.fn(() => [
                    {
                        id: 'cursed-edge',
                        name: 'Cursed Edge',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '/',
                        stackable: false,
                        maxStack: 1,
                        description: 'ATK +7.',
                        equipment: {
                            slot: 'WEAPON',
                            statModifier: { attack: 7 },
                        },
                    },
                    {
                        id: 'runic-blindfold',
                        name: 'Runic Blindfold',
                        type: 'EQUIPMENT',
                        rarity: 'CURSED',
                        icon: '^',
                        stackable: false,
                        maxStack: 1,
                        description: 'Draw +1.',
                        equipment: {
                            slot: 'HELMET',
                            statModifier: {},
                        },
                    },
                ]),
            },
            deckService: {
                restoreDeck: vi.fn(),
            },
            buildFloor: vi.fn(),
            playerEntity: {
                restore: vi.fn(),
            },
            overlayController: {
                setInventory: vi.fn(),
                syncBossHud: vi.fn(),
            },
            battleDirector: {
                refreshTurnQueueRoster: vi.fn(),
            },
            syncBossHud: vi.fn(),
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            localization: {
                formatResumedFloor: vi.fn(() => 'resume'),
            },
            handleSpecialRewardSelection: vi.fn(),
            beginSpecialRewardFlow: undefined as unknown as (
                rewardChoices: readonly unknown[],
                offer: object,
            ) => void,
            removeBossFromFloor: undefined as unknown as (enemyId?: string) => void,
            restorePendingSpecialRewardFlow: undefined as unknown as (
                pendingSpecialRewardOffer: typeof savedRun.pendingSpecialRewardOffer,
            ) => void,
            restorePendingPostBossDecisionFlow: vi.fn(),
        };
        scene.beginSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                beginSpecialRewardFlow: (
                    this: typeof scene,
                    rewardChoices: readonly unknown[],
                    offer: object,
                ) => void;
            }
        ).beginSpecialRewardFlow;
        scene.removeBossFromFloor = (
            MainScene.prototype as unknown as {
                removeBossFromFloor: (this: typeof scene, enemyId?: string) => void;
            }
        ).removeBossFromFloor;
        scene.restorePendingSpecialRewardFlow = (
            MainScene.prototype as unknown as {
                restorePendingSpecialRewardFlow: (
                    this: typeof scene,
                    pendingSpecialRewardOffer: typeof savedRun.pendingSpecialRewardOffer,
                ) => void;
            }
        ).restorePendingSpecialRewardFlow;
        const resumeSavedRun = (
            MainScene.prototype as unknown as {
                resumeSavedRun: (this: typeof scene) => void;
            }
        ).resumeSavedRun;

        resumeSavedRun.call(scene);

        expect(scene.floorDirector.removeEnemy).toHaveBeenCalledWith('boss-1');
        expect(scene.renderSynchronizer.removeEnemySprite).toHaveBeenCalledWith('boss-1');
        expect(scene.overlayController.setInventory).toHaveBeenCalledWith(false);
        expect(scene.hud.showSpecialRewardOverlay).toHaveBeenCalledOnce();
        expect(scene.pendingSpecialRewardOffer).toEqual(savedRun.pendingSpecialRewardOffer);
    });

    it('drops a random inventory item on escape unless Escape Artist\'s Boots are equipped', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: typeof scene & {
                    itemService: object;
                    localization: object;
                    persistRun: ReturnType<typeof vi.fn>;
                    syncInventoryOverlay: ReturnType<typeof vi.fn>;
                }, result: object) => void;
            }
        ).handleBattleSceneResult;
        const escapeScene = {
            ...scene,
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            lastEscapeResult: undefined,
            itemService: {
                getInventory: vi.fn(() => []),
                loseRandomInventoryItem: vi.fn(() => ({
                    status: 'lost',
                    item: {
                        id: 'small-potion',
                        name: 'Small Potion',
                    },
                })),
            },
            localization: {
                getItemName: vi.fn((_id: string, name: string) => name),
                formatCleanEscape: vi.fn(() => 'clean'),
                formatEscapeItemLost: vi.fn((name: string) => `lost:${name}`),
                formatEscapeItemLossPrevented: vi.fn(() => 'prevented'),
            },
        };

        handleBattleSceneResult.call(escapeScene, {
            outcome: 'player-win',
            resolution: 'escape',
            totalRounds: 1,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 100,
            enemyRemainingHealth: 12,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(escapeScene.itemService.loseRandomInventoryItem).toHaveBeenCalledOnce();
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('clean', 'travel');
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('lost:Small Potion', 'danger');
        expect(escapeScene.persistRun).toHaveBeenCalledWith('active');
        expect(escapeScene.completePlayerTurn).toHaveBeenCalledWith('');
        expect(escapeScene.lastEscapeResult).toMatchObject({
            tier: 'clean_escape',
            battleHealthLoss: 0,
            healthLoss: 0,
            itemLossPolicy: 'lose-random-item',
            itemLostId: 'small-potion',
            rewardPolicy: 'none',
            modifierSources: [],
            goldPolicy: 'not-implemented',
            goldPolicyNote: '[TBD: gold economy not implemented]',
        });
    });

    it('keeps inventory intact on escape when Escape Artist\'s Boots are equipped', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: typeof scene & {
                    itemService: object;
                    localization: object;
                    persistRun: ReturnType<typeof vi.fn>;
                }, result: object) => void;
            }
        ).handleBattleSceneResult;
        const escapeScene = {
            ...scene,
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            lastEscapeResult: undefined,
            itemService: {
                getInventory: vi.fn(() => [{ id: 'escape-artists-boots', isEquipped: true }]),
                loseRandomInventoryItem: vi.fn(),
            },
            localization: {
                formatPerfectVanish: vi.fn((energyBonus: number) => `perfect:${energyBonus}`),
                formatEscapeItemLossPrevented: vi.fn(() => 'prevented'),
            },
        };

        handleBattleSceneResult.call(escapeScene, {
            outcome: 'player-win',
            resolution: 'escape',
            totalRounds: 1,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 100,
            enemyRemainingHealth: 12,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(escapeScene.itemService.loseRandomInventoryItem).not.toHaveBeenCalled();
        expect(escapeScene.pendingBattleStartEnergy).toBe(1);
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('perfect:1', 'travel');
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('prevented', 'item');
        expect(escapeScene.lastEscapeResult).toMatchObject({
            tier: 'perfect_vanish',
            battleHealthLoss: 0,
            itemLossPolicy: 'protected-by-gear',
            itemLossPrevented: true,
            nextBattleStartEnergyBonus: 1,
            perfectVanishEnergyBonus: 1,
            rewardPolicy: 'next-battle-energy',
            modifierSources: ['escape-artists-boots'],
            goldPolicy: 'not-implemented',
            goldPolicyNote: '[TBD: gold economy not implemented]',
        });
    });

    it('consumes card-driven Perfect Vanish escape economy without boots', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: typeof scene & {
                    itemService: object;
                    localization: object;
                    persistRun: ReturnType<typeof vi.fn>;
                    syncInventoryOverlay: ReturnType<typeof vi.fn>;
                    refreshTurnStatus: ReturnType<typeof vi.fn>;
                    lastEscapeResult?: object;
                }, result: object) => void;
            }
        ).handleBattleSceneResult;
        const escapeScene = {
            ...scene,
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            lastEscapeResult: undefined,
            itemService: {
                getInventory: vi.fn(() => []),
                loseRandomInventoryItem: vi.fn(),
            },
            localization: {
                formatPerfectVanish: vi.fn((energyBonus: number) => `perfect:${energyBonus}`),
            },
        };

        handleBattleSceneResult.call(escapeScene, {
            outcome: 'player-win',
            resolution: 'escape',
            totalRounds: 2,
            totalPlayerDamage: 0,
            totalEnemyDamage: 0,
            playerRemainingHealth: 100,
            enemyRemainingHealth: 12,
            nextBattleStartEnergyBonus: 0,
            perfectVanish: true,
            enemy,
        });

        expect(escapeScene.itemService.loseRandomInventoryItem).not.toHaveBeenCalled();
        expect(escapeScene.pendingBattleStartEnergy).toBe(1);
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('perfect:1', 'travel');
        expect(escapeScene.lastEscapeResult).toMatchObject({
            tier: 'perfect_vanish',
            battleHealthLoss: 0,
            itemLossPolicy: 'none',
            itemLossPrevented: false,
            nextBattleStartEnergyBonus: 1,
            perfectVanishEnergyBonus: 1,
            rewardPolicy: 'next-battle-energy',
            modifierSources: ['card-perfect-vanish'],
            goldPolicy: 'not-implemented',
            goldPolicyNote: '[TBD: gold economy not implemented]',
        });
        expect(escapeScene.persistRun).toHaveBeenCalledWith('active');
        expect(escapeScene.completePlayerTurn).toHaveBeenCalledWith('');
    });

    it('applies a Bloody Escape wound without dropping an item after battle damage', () => {
        const { scene, enemy } = createSceneStub();
        const handleBattleSceneResult = (
            MainScene.prototype as unknown as {
                handleBattleSceneResult: (this: typeof scene & {
                    itemService: object;
                    localization: object;
                    persistRun: ReturnType<typeof vi.fn>;
                    syncInventoryOverlay: ReturnType<typeof vi.fn>;
                    refreshTurnStatus: ReturnType<typeof vi.fn>;
                }, result: object) => void;
            }
        ).handleBattleSceneResult;
        const escapeScene = {
            ...scene,
            syncInventoryOverlay: vi.fn(),
            refreshTurnStatus: vi.fn(),
            persistRun: vi.fn(),
            lastEscapeResult: undefined,
            itemService: {
                getInventory: vi.fn(() => []),
                loseRandomInventoryItem: vi.fn(),
            },
            localization: {
                formatBloodyEscape: vi.fn((healthLoss: number) => `bloody:${healthLoss}`),
            },
        };

        handleBattleSceneResult.call(escapeScene, {
            outcome: 'player-win',
            resolution: 'escape',
            totalRounds: 3,
            totalPlayerDamage: 20,
            totalEnemyDamage: 0,
            playerRemainingHealth: 80,
            enemyRemainingHealth: 12,
            nextBattleStartEnergyBonus: 0,
            enemy,
        });

        expect(escapeScene.playerEntity.stats.health).toBe(70);
        expect(escapeScene.itemService.loseRandomInventoryItem).not.toHaveBeenCalled();
        expect(escapeScene.pushTurnLog).toHaveBeenCalledWith('bloody:10', 'danger');
        expect(escapeScene.lastEscapeResult).toMatchObject({
            tier: 'bloody_escape',
            battleHealthLoss: 20,
            healthLoss: 10,
            itemLossPolicy: 'none',
            itemLossPrevented: false,
            rewardPolicy: 'none',
            modifierSources: [],
            goldPolicy: 'not-implemented',
            goldPolicyNote: '[TBD: gold economy not implemented]',
        });
    });

    it('releases the movement lock immediately when the player climbs stairs', () => {
        const unresolvedAnimation = new Promise<void>(() => {});
        const player = new Player({ x: 1, y: 1 }, cloneCombatStats(BASE_PLAYER_STATS));
        const scene = {
            playerEntity: player,
            isAnimatingMovement: false,
            floorDirector: {
                getMapData: vi.fn(() => ({
                    width: 3,
                    height: 3,
                    tiles: [
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.STAIRS],
                        [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
                    ],
                })),
                getEnemyAt: vi.fn(() => undefined),
                getEnemyEntities: vi.fn(() => []),
                getFieldItems: vi.fn(() => []),
            },
            renderSynchronizer: {
                synchronizePlayer: vi.fn(() => unresolvedAnimation),
                updateVisibility: vi.fn(),
            },
            collectItemAtPlayerPosition: vi.fn(() => undefined),
            pushTurnLog: vi.fn(),
            localization: {
                formatPlayerClimbsStairs: vi.fn(() => 'Player climbs the stairs.'),
            },
            advanceToNextFloor: vi.fn(),
            beginAnimationLock() {
                this.isAnimatingMovement = true;
            },
            endAnimationLock() {
                this.isAnimatingMovement = false;
            },
        };
        const onMove = (
            MainScene.prototype as unknown as {
                onMove: (this: typeof scene, dx: number, dy: number) => void;
            }
        ).onMove;

        onMove.call(scene, 1, 0);

        expect(scene.advanceToNextFloor).toHaveBeenCalledOnce();
        expect(scene.isAnimatingMovement).toBe(false);
        expect(scene.renderSynchronizer.synchronizePlayer).toHaveBeenCalledOnce();
    });
});
