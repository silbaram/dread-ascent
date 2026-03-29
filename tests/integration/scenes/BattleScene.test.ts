import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../src/domain/entities/Card';
import { CardEffectService } from '../../../src/domain/services/CardEffectService';
import { DrawCycleService } from '../../../src/domain/services/DrawCycleService';
import { EnergyService } from '../../../src/domain/services/EnergyService';
import {
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
} from '../../../src/domain/services/EnemyIntentService';
import {
    StatusEffectService,
    type StatusEffectState,
} from '../../../src/domain/services/StatusEffectService';

vi.mock('phaser', () => ({}));

type BattleSceneModule = typeof import('../../../src/scenes/BattleScene');

class FixedRandom {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

interface TestScene {
    readonly onEndTurn: () => void;
    readonly afterEnemyTurn: () => void;
    readonly onPlayCard: (handIndex: number) => void;
    readonly displayHandCards: () => void;
    readonly executeEnemyTurn: () => void;
    readonly endBattle: (outcome: 'player-win' | 'player-lose') => void;
    drawCycleService: DrawCycleService;
    cardEffectService: CardEffectService;
    energyService: EnergyService;
    statusEffectService: StatusEffectService;
    enemyIntentService: EnemyIntentService;
    drawCycleState: ReturnType<DrawCycleService['initialize']>;
    energyState: {
        current: number;
        max: number;
    };
    playerStatusEffects: StatusEffectState;
    enemyStatusEffects: StatusEffectState;
    playerState: {
        health: number;
        maxHealth: number;
        block: number;
    };
    enemyState: {
        health: number;
        maxHealth: number;
        block: number;
    };
    enemyCardPool: ReturnType<typeof createCard>[];
    time: {
        delayedCall: ReturnType<typeof vi.fn>;
    };
    clearCardSprites: ReturnType<typeof vi.fn>;
    clearEffectText: ReturnType<typeof vi.fn>;
    showEffectText: ReturnType<typeof vi.fn>;
    showEnemyActionText: ReturnType<typeof vi.fn>;
    updateAllDisplays: ReturnType<typeof vi.fn>;
    showBattleEnd: ReturnType<typeof vi.fn>;
    startPlayerTurn: ReturnType<typeof vi.fn>;
    createCardVisual: ReturnType<typeof vi.fn>;
    cardSprites: unknown[];
    totalPlayerDamage: number;
    totalEnemyDamage: number;
    turnNumber: number;
    battleResolution: 'victory' | 'defeat' | 'escape';
    onBattleEndCallback?: ReturnType<typeof vi.fn>;
    sceneData: {
        enemy: {
            id: string;
            label: string;
            position: { x: number; y: number };
            stats: {
                health: number;
                maxHealth: number;
                attack: number;
                defense: number;
            };
            experienceReward: number;
            kind: 'normal' | 'boss';
            archetypeId: 'ash-crawler' | 'blade-raider' | 'dread-sentinel' | 'final-boss';
            elite: boolean;
        };
    };
    scene: {
        stop: ReturnType<typeof vi.fn>;
        wake: ReturnType<typeof vi.fn>;
    };
    isInputLocked: boolean;
    battleLogLines: string[];
    enemyAttackBuff: number;
    currentEnemyIntent?: {
        type: 'attack' | 'defend' | 'buff';
        damage?: number;
        block?: number;
        amount?: number;
        label: string;
        sourceCardId?: string;
    };
    damagePopupController: {
        showBatch: ReturnType<typeof vi.fn>;
    };
    enemyIntentText?: {
        setText: ReturnType<typeof vi.fn>;
        setAlpha: ReturnType<typeof vi.fn>;
    };
}

describe('BattleScene block lifecycle', () => {
    let BattleScene: BattleSceneModule['BattleScene'];

    beforeAll(async () => {
        (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser = {
            Scene: class {
                constructor(_config?: unknown) {}
            },
        };
        ({ BattleScene } = await import('../../../src/scenes/BattleScene'));
    });

    afterAll(() => {
        delete (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser;
    });

    function createImmediateTimer(): TestScene['time'] {
        return {
            delayedCall: vi.fn((_delayMs: number, callback: () => void) => {
                callback();
                return undefined;
            }),
        };
    }

    function createScene(): TestScene {
        resetCardSequence();

        const scene = new BattleScene() as unknown as TestScene;
        const drawCycleService = new DrawCycleService();

        scene.drawCycleService = drawCycleService;
        scene.cardEffectService = new CardEffectService();
        scene.energyService = new EnergyService();
        scene.statusEffectService = new StatusEffectService();
        scene.enemyIntentService = new EnemyIntentService(new FixedRandom(0));
        scene.drawCycleState = drawCycleService.initialize([]);
        scene.energyState = { current: 3, max: 3 };
        scene.playerStatusEffects = scene.statusEffectService.createState();
        scene.enemyStatusEffects = scene.statusEffectService.createState();
        scene.playerState = { health: 100, maxHealth: 100, block: 5 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.enemyCardPool = [
            createCard({
                name: 'Enemy Strike',
                type: CARD_TYPE.ATTACK,
                power: 4,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
        scene.time = createImmediateTimer();
        scene.clearCardSprites = vi.fn();
        scene.clearEffectText = vi.fn();
        scene.showEffectText = vi.fn();
        scene.showEnemyActionText = vi.fn();
        scene.updateAllDisplays = vi.fn();
        scene.showBattleEnd = vi.fn();
        scene.startPlayerTurn = vi.fn();
        scene.createCardVisual = vi.fn(() => ({}));
        scene.cardSprites = [];
        scene.totalPlayerDamage = 0;
        scene.totalEnemyDamage = 0;
        scene.turnNumber = 0;
        scene.battleResolution = 'victory';
        scene.onBattleEndCallback = vi.fn();
        scene.sceneData = {
            enemy: {
                id: 'enemy-1',
                label: 'Enemy',
                position: { x: 0, y: 0 },
                stats: {
                    health: 40,
                    maxHealth: 40,
                    attack: 4,
                    defense: 2,
                },
                experienceReward: 10,
                kind: 'normal',
                archetypeId: 'ash-crawler',
                elite: false,
            },
        };
        scene.scene = {
            stop: vi.fn(),
            wake: vi.fn(),
        };
        scene.isInputLocked = false;
        scene.battleLogLines = [];
        scene.enemyAttackBuff = 0;
        scene.currentEnemyIntent = undefined;
        scene.damagePopupController = {
            showBatch: vi.fn(),
        };
        scene.enemyIntentText = {
            setText: vi.fn(),
            setAlpha: vi.fn(),
        };

        return scene;
    }

    it('removes player block before the enemy attack resolves after end turn', () => {
        const scene = createScene();

        scene.onEndTurn();

        expect(scene.playerState.block).toBe(0);
        expect(scene.playerState.health).toBe(96);
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
    });

    it('clears enemy block when the enemy turn finishes', () => {
        const scene = createScene();
        scene.enemyState = { health: 40, maxHealth: 40, block: 7 };

        scene.afterEnemyTurn();

        expect(scene.enemyState.block).toBe(0);
        expect(scene.currentEnemyIntent).toEqual({
            type: ENEMY_INTENT_TYPE.ATTACK,
            damage: 4,
            label: 'Enemy Strike',
            sourceCardId: expect.any(String),
        });
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
    });

    it('disables Last Stand in hand when player health is above the threshold', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 10, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Last Stand',
                    type: CARD_TYPE.ATTACK,
                    power: 30,
                    cost: 3,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    keywords: [CARD_KEYWORD.RETAIN],
                    rarity: CARD_RARITY.RARE,
                    condition: { type: 'HP_THRESHOLD', value: 5 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.displayHandCards();

        expect(scene.createCardVisual).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Last Stand' }),
            expect.any(Number),
            expect.any(Number),
            0,
            false,
        );
    });

    it('prevents Last Stand from being played when player health is above the threshold', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 30,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.RETAIN],
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_THRESHOLD', value: 5 },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 9, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [lastStand],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.energyState.current).toBe(3);
        expect(scene.drawCycleState.hand).toEqual([lastStand]);
        expect(scene.showEffectText).not.toHaveBeenCalled();
    });

    it('shows an escape result instead of ending immediately when a flee card is played', () => {
        const scene = createScene();
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Shadow Step',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 0,
                    effectType: CARD_EFFECT_TYPE.FLEE,
                    keywords: [CARD_KEYWORD.EXHAUST],
                    rarity: CARD_RARITY.RARE,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.showBattleEnd).toHaveBeenCalledWith('player-win', 'escape');
    });

    it('applies Vulnerable from Weaken and increases the next attack damage', () => {
        const scene = createScene();
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Weaken',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
                    statusEffect: { type: 'VULNERABLE', duration: 2 },
                }),
                createCard({
                    name: 'Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onPlayCard(0);

        expect(scene.enemyStatusEffects.vulnerable).toBe(2);
        expect(scene.enemyState.health).toBe(31);
        expect(scene.totalEnemyDamage).toBe(9);
        expect(scene.battleLogLines).toContain('Enemy gains Vulnerable 2');
    });

    it('applies Poison at turn end and records status expiry in the battle log', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 20, maxHealth: 20, block: 5 };
        scene.playerStatusEffects = {
            vulnerable: 1,
            weak: 0,
            poison: 3,
        };

        scene.onEndTurn();

        expect(scene.playerState.health).toBe(17);
        expect(scene.playerStatusEffects).toEqual({
            vulnerable: 0,
            weak: 0,
            poison: 2,
        });
        expect(scene.battleLogLines).toContain('Player takes 3 poison');
        expect(scene.battleLogLines).toContain('Player Vulnerable expired');
    });

    it('executes the revealed defend intent instead of choosing a random attack', () => {
        const scene = createScene();
        scene.playerState = { health: 20, maxHealth: 20, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            block: 5,
            label: 'Enemy Guard 5',
            sourceCardId: 'enemy-guard-5',
        };
        scene.enemyCardPool = [
            createCard({
                id: 'enemy-strike-4',
                name: 'Enemy Strike 4',
                type: CARD_TYPE.ATTACK,
                power: 4,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
            createCard({
                id: 'enemy-guard-5',
                name: 'Enemy Guard 5',
                type: CARD_TYPE.GUARD,
                power: 5,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            }),
        ];

        scene.executeEnemyTurn();

        expect(scene.enemyState.block).toBe(0);
        expect(scene.playerState.health).toBe(20);
        expect(scene.showEnemyActionText).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Enemy Guard 5' }),
            0,
            5,
            0,
        );
    });

    it('returns the battle result to MainScene and wakes it after battle end', () => {
        const scene = createScene();
        scene.turnNumber = 4;
        scene.totalPlayerDamage = 7;
        scene.totalEnemyDamage = 12;
        scene.battleResolution = 'victory';

        BattleScene.prototype.endBattle.call(scene, 'player-win');

        expect(scene.onBattleEndCallback).toHaveBeenCalledWith({
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 4,
            totalPlayerDamage: 7,
            totalEnemyDamage: 12,
            enemy: scene.sceneData.enemy,
        });
        expect(scene.scene.stop).toHaveBeenCalledWith('BattleScene');
        expect(scene.scene.wake).toHaveBeenCalledWith('MainScene');
    });
});

describe('BattleScene popup feedback', () => {
    let BattleScene: BattleSceneModule['BattleScene'];

    beforeAll(async () => {
        (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser = {
            Scene: class {
                constructor(_config?: unknown) {}
            },
        };
        ({ BattleScene } = await import('../../../src/scenes/BattleScene'));
    });

    afterAll(() => {
        delete (globalThis as typeof globalThis & { Phaser?: unknown }).Phaser;
    });

    function createFallbackText() {
        return {
            setOrigin: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
        };
    }

    it('shows blocked and damage popups together near the enemy HP anchor', () => {
        const fallbackText = createFallbackText();
        const scene = new BattleScene() as unknown as {
            damagePopupController: { showBatch: ReturnType<typeof vi.fn> };
            add: { text: ReturnType<typeof vi.fn> };
            effectText?: { destroy: ReturnType<typeof vi.fn> };
        };
        scene.damagePopupController = { showBatch: vi.fn() };
        scene.add = {
            text: vi.fn(() => fallbackText),
        };

        (BattleScene.prototype as unknown as {
            showEffectText: (
                card: ReturnType<typeof createCard>,
                effect: {
                    damageDealt: number;
                    damageBlocked: number;
                    blockGained: number;
                    fled: boolean;
                },
            ) => void;
        }).showEffectText.call(
            scene,
            createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 6,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
            {
                damageDealt: 3,
                damageBlocked: 5,
                blockGained: 0,
                fled: false,
            },
        );

        expect(scene.damagePopupController.showBatch).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'enemy-hp' }),
            [
                { type: 'blocked', value: 5 },
                { type: 'damage', value: 3 },
            ],
        );
        expect(scene.add.text).toHaveBeenCalledWith(
            400,
            230,
            'Strike: strike',
            expect.objectContaining({ fontSize: '14px' }),
        );
        expect(fallbackText.setAlpha).toHaveBeenCalledWith(0.78);
    });

    it('shows player-side poison popups when turn-end poison damage resolves', () => {
        const scene = new BattleScene() as unknown as {
            statusEffectService: StatusEffectService;
            playerState: { health: number; maxHealth: number; block: number };
            enemyState: { health: number; maxHealth: number; block: number };
            playerStatusEffects: StatusEffectState;
            enemyStatusEffects: StatusEffectState;
            damagePopupController: { showBatch: ReturnType<typeof vi.fn> };
            appendBattleLog: ReturnType<typeof vi.fn>;
            appendStatusEventLogs: ReturnType<typeof vi.fn>;
            sceneData: { enemyName: string };
        };
        scene.statusEffectService = new StatusEffectService();
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 12, maxHealth: 12, block: 0 };
        scene.playerStatusEffects = scene.statusEffectService.createState();
        scene.enemyStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 3,
        };
        scene.damagePopupController = { showBatch: vi.fn() };
        scene.appendBattleLog = vi.fn();
        scene.appendStatusEventLogs = vi.fn();
        scene.sceneData = { enemyName: 'Enemy' };

        (BattleScene.prototype as unknown as {
            resolveTurnEndStatusEffects: (actor: 'player' | 'enemy') => void;
        }).resolveTurnEndStatusEffects.call(scene, 'enemy');

        expect(scene.enemyState.health).toBe(9);
        expect(scene.damagePopupController.showBatch).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'enemy-hp' }),
            [{ type: 'poison', value: 3 }],
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Enemy takes 3 poison');
    });
});
