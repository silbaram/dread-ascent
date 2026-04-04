import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Enemy } from '../../../src/domain/entities/Enemy';
import { BASE_PLAYER_STATS, cloneCombatStats } from '../../../src/domain/entities/CombatStats';
import { Player } from '../../../src/domain/entities/Player';
import { WORLD_TILE } from '../../../src/shared/types/WorldTiles';

vi.mock('phaser', () => ({}));

type MainSceneModule = typeof import('../../../src/scenes/MainScene');

interface MainSceneStub {
    playerEntity: Player;
    hud: {
        setViewportMode: ReturnType<typeof vi.fn>;
    };
    pushTurnLog: ReturnType<typeof vi.fn>;
    completePlayerTurn: ReturnType<typeof vi.fn>;
    handleVictory: ReturnType<typeof vi.fn>;
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
                hud: {
                    setViewportMode: vi.fn(),
                },
                pushTurnLog: vi.fn(),
                completePlayerTurn: vi.fn(),
                handleVictory: vi.fn(),
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
            enemy,
        });

        expect(scene.playerEntity.stats.health).toBe(93);
        expect(enemy.stats.health).toBe(0);
        expect(scene.hud.setViewportMode).toHaveBeenCalledWith('field');
        expect(scene.floorDirector.removeEnemy).toHaveBeenCalledWith(enemy.id);
        expect(scene.renderSynchronizer.removeEnemySprite).toHaveBeenCalledWith(enemy.id);
        expect(scene.battleDirector.refreshTurnQueueRoster).toHaveBeenCalledOnce();
        expect(scene.handleEnemyDeath).toHaveBeenCalledWith(enemy);
        expect(scene.completePlayerTurn).not.toHaveBeenCalled();
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
        const setOnBattleEnd = vi.fn();
        const scene = {
            deckService: {},
            cardBattleService: {},
            itemService: {},
            hud: {
                setViewportMode: vi.fn(),
            },
            floorDirector: {
                getFloorSnapshot: vi.fn(() => ({ number: 4 })),
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

        expect(scene.hud.setViewportMode).toHaveBeenCalledWith('battle-scene');
        expect(scene.scene.sleep).toHaveBeenCalledWith('MainScene');
        expect(scene.scene.launch).toHaveBeenCalledWith('BattleScene', expect.objectContaining({
            player,
            enemy,
            enemyName: 'Ash Crawler',
            floorNumber: 4,
        }));
        expect(setOnBattleEnd).toHaveBeenCalledOnce();
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
