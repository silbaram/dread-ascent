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
    readonly updatePowerDisplays: () => void;
    readonly showCardDetail: (card: ReturnType<typeof createCard>) => void;
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
    playCardSelectionMotion: ReturnType<typeof vi.fn>;
    playResolvedActionMotion: ReturnType<typeof vi.fn>;
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
        stat?: 'attack';
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
    playerPowerText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    enemyPowerText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    cardDetailTitleText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    cardDetailBodyText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    activePowerCards?: ReturnType<typeof createCard>[];
    playerDamageTakenWindow?: number;
    playerOngoingBuffs?: {
        blockPersist: boolean;
        blockPersistCharges: number;
        strengthOnSelfDamage: number;
        poisonPerTurn: number;
    };
    enemyOngoingBuffs?: {
        blockPersist: boolean;
        blockPersistCharges: number;
        strengthOnSelfDamage: number;
        poisonPerTurn: number;
    };
    enemyAttackDebuff?: number;
    enemyAttackDebuffDuration?: number;
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
        scene.playCardSelectionMotion = vi.fn();
        scene.playResolvedActionMotion = vi.fn();
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
        scene.playerPowerText = {
            setText: vi.fn(),
        };
        scene.enemyPowerText = {
            setText: vi.fn(),
        };
        scene.cardDetailTitleText = {
            setText: vi.fn(),
        };
        scene.cardDetailBodyText = {
            setText: vi.fn(),
        };
        scene.activePowerCards = [];
        scene.playerDamageTakenWindow = 0;
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 0,
            poisonPerTurn: 0,
        };
        scene.enemyOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 0,
            poisonPerTurn: 0,
        };
        scene.enemyAttackDebuff = 0;
        scene.enemyAttackDebuffDuration = 0;

        return scene;
    }

    it('applies player block to the incoming enemy attack before the next turn starts', () => {
        const scene = createScene();

        scene.onEndTurn();

        expect(scene.playerState.health).toBe(100);
        expect(scene.playerState.block).toBe(0);
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
    });

    it('expires enemy block at the start of its next turn', () => {
        const scene = createScene();
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 7 };
        scene.time = {
            delayedCall: vi.fn(),
        };

        scene.executeEnemyTurn();

        expect(scene.enemyState.block).toBe(0);
        expect(scene.playerState.health).toBe(96);
    });

    it('uses player block before health when the enemy attack is fully absorbed', () => {
        const scene = createScene();
        scene.playerState = { health: 100, maxHealth: 100, block: 10 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            damage: 8,
            label: 'Heavy Strike',
            sourceCardId: 'enemy-heavy-strike-8',
        };
        scene.enemyCardPool = [
            createCard({
                id: 'enemy-heavy-strike-8',
                name: 'Heavy Strike',
                type: CARD_TYPE.ATTACK,
                power: 8,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
        scene.time = {
            delayedCall: vi.fn(),
        };

        scene.executeEnemyTurn();

        expect(scene.playerState.health).toBe(100);
        expect(scene.playerState.block).toBe(2);
    });

    it('uses enemy block before health when the player attack hits a defended enemy', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 4 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 8,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(36);
        expect(scene.enemyState.block).toBe(0);
        expect(scene.totalEnemyDamage).toBe(4);
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
            1,
        );
    });

    it('compresses wide hands so cards stay inside the narrowed hand lane', () => {
        const scene = createScene();
        scene.energyState = { current: 7, max: 7 };
        scene.drawCycleState = {
            drawPile: [],
            hand: Array.from({ length: 7 }, (_, index) => createCard({
                id: `card-${index + 1}`,
                name: `Strike ${index + 1}`,
                type: CARD_TYPE.ATTACK,
                power: 6,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            })),
            discardPile: [],
            exhaustPile: [],
        };

        scene.displayHandCards();

        const firstCall = scene.createCardVisual.mock.calls[0];
        const lastCall = scene.createCardVisual.mock.calls.at(-1);

        expect(firstCall?.[5]).toBeLessThan(1);
        expect(firstCall?.[1]).toBeGreaterThanOrEqual(80);
        expect(lastCall?.[1]).toBeLessThanOrEqual(505);
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

    it('plays card selection motion before resolving a playable card effect', () => {
        const scene = createScene();
        const strike = createCard({
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
        });

        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [strike],
            discardPile: [],
            exhaustPile: [],
        };
        scene.cardSprites = [{ x: 100, y: 220 }];

        scene.onPlayCard(0);

        expect(scene.playCardSelectionMotion).toHaveBeenCalledWith(0, strike);
    });

    it('triggers resolved action motion for player attack cards', () => {
        const scene = createScene();
        const strike = createCard({
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
        });

        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [strike],
            discardPile: [],
            exhaustPile: [],
        };
        scene.cardSprites = [{ x: 100, y: 220 }];

        scene.onPlayCard(0);

        expect(scene.playResolvedActionMotion).toHaveBeenCalledWith(
            'player',
            expect.objectContaining({ effectType: CARD_EFFECT_TYPE.DAMAGE }),
            expect.any(Object),
        );
    });

    it('triggers resolved action motion for enemy defend turns', () => {
        const scene = createScene();
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.playerState = { health: 26, maxHealth: 26, block: 0 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            block: 4,
            label: 'Enemy Guard',
            sourceCardId: 'enemy-guard-4',
        };
        scene.enemyCardPool = [
            createCard({
                id: 'enemy-guard-4',
                name: 'Enemy Guard',
                type: CARD_TYPE.GUARD,
                power: 4,
                effectType: CARD_EFFECT_TYPE.BLOCK,
                rarity: CARD_RARITY.COMMON,
            }),
        ];

        scene.executeEnemyTurn();

        expect(scene.playResolvedActionMotion).toHaveBeenCalledWith(
            'enemy',
            expect.objectContaining({ effectType: CARD_EFFECT_TYPE.BLOCK }),
            expect.any(Object),
        );
    });

    it('applies discard-and-draw card effects to the draw cycle after the played card leaves hand', () => {
        const scene = createScene();
        const recycle = createCard({
            name: 'Recycle',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DISCARD_EFFECT,
            effectPayload: { discardCount: 1, drawCount: 2 },
        });
        const handCard = createCard({
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const drawOne = createCard({
            name: 'Quick Draw',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DRAW,
            effectPayload: { drawCount: 1 },
        });
        const drawTwo = createCard({
            name: 'Fortify',
            type: CARD_TYPE.GUARD,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.BLOCK,
        });

        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [drawOne, drawTwo],
            hand: [recycle, handCard],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.drawCycleState.hand.map((card) => card.name)).toEqual(['Quick Draw', 'Fortify']);
        expect(scene.drawCycleState.discardPile.map((card) => card.name)).toEqual(['Recycle', 'Strike']);
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

    it('prevents Counter Strike from being played when no damage was taken in the window', () => {
        const scene = createScene();
        const counterStrike = createCard({
            name: 'Counter Strike',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.CONDITIONAL,
            condition: { type: 'TURN_DAMAGE_TAKEN_AT_LEAST', value: 1 },
            effectPayload: {
                scaling: { source: 'TURN_DAMAGE_TAKEN', multiplier: 1 },
            },
        });
        scene.drawCycleState = {
            drawPile: [],
            hand: [counterStrike],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playerDamageTakenWindow = 0;

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(40);
        expect(scene.drawCycleState.hand).toEqual([counterStrike]);
    });

    it('uses the stored damage window for Counter Strike', () => {
        const scene = createScene();
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Counter Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.CONDITIONAL,
                    condition: { type: 'TURN_DAMAGE_TAKEN_AT_LEAST', value: 1 },
                    effectPayload: {
                        scaling: { source: 'TURN_DAMAGE_TAKEN', multiplier: 1 },
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playerDamageTakenWindow = 6;

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(34);
    });

    it('applies attached status effects from damage cards', () => {
        const scene = createScene();
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Venom Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    statusEffect: { type: 'POISON', duration: 3 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(36);
        expect(scene.enemyStatusEffects.poison).toBe(3);
    });

    it('reduces the revealed enemy attack when Taunt is played', () => {
        const scene = createScene();
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Taunt',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'ENEMY_ATTACK_DOWN', value: 3, duration: 1, target: 'TARGET' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            damage: 4,
            label: 'Enemy Strike',
            sourceCardId: scene.enemyCardPool[0]?.id,
        };

        scene.onPlayCard(0);

        expect(scene.currentEnemyIntent?.damage).toBe(1);
        expect(scene.enemyAttackDebuff).toBe(3);
    });

    it('keeps Brace block through the next turn end once', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Brace',
                    type: CARD_TYPE.GUARD,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onEndTurn();

        expect(scene.playerState.block).toBe(4);
        expect(scene.playerOngoingBuffs?.blockPersistCharges).toBe(0);
    });

    it('doubles existing Poison when Toxic Burst is played', () => {
        const scene = createScene();
        scene.enemyStatusEffects = {
            ...scene.enemyStatusEffects,
            poison: 3,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Toxic Burst',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'POISON_MULTIPLIER', value: 2, target: 'TARGET' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyStatusEffects.poison).toBe(6);
    });

    it('applies Noxious Aura poison at the start of the player turn', () => {
        const scene = createScene();
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 0,
            poisonPerTurn: 2,
        };

        (BattleScene.prototype as unknown as {
            applyPlayerTurnStartOngoingEffects: () => boolean;
        }).applyPlayerTurnStartOngoingEffects.call(scene);

        expect(scene.enemyStatusEffects.poison).toBe(2);
    });

    it('grants Strength when Berserker Rage owner loses HP', () => {
        const scene = createScene();
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Blood Price',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    effectPayload: {
                        drawCount: 2,
                        selfDamage: 4,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerStatusEffects.strength).toBe(1);
    });

    it('applies status effects from damage cards after dealing damage', () => {
        const scene = createScene();
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Crippling Blow',
                    type: CARD_TYPE.ATTACK,
                    power: 8,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    statusEffects: [
                        { type: 'WEAK', duration: 1 },
                        { type: 'FRAIL', duration: 1 },
                    ],
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(32);
        expect(scene.enemyStatusEffects.weak).toBe(1);
        expect(scene.enemyStatusEffects.frail).toBe(1);
    });

    it('does not grant Strength from poison tick damage when Berserker Rage is active', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.playerStatusEffects = {
            ...scene.playerStatusEffects,
            poison: 2,
        };
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };

        scene.onEndTurn();

        expect(scene.playerState.health).toBe(98);
        expect(scene.playerStatusEffects.strength).toBe(0);
    });

    it('tracks played power cards and applies supported self buffs to ongoing effects', () => {
        const scene = createScene();
        const crimsonPact = createCard({
            name: 'Crimson Pact',
            type: CARD_TYPE.POWER,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.BUFF,
            rarity: CARD_RARITY.UNCOMMON,
            buff: { type: 'STRENGTH', value: 2, target: 'SELF' },
        });

        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [crimsonPact],
            discardPile: [],
            exhaustPile: [],
        };
        scene.cardSprites = [{ x: 100, y: 220 }];

        scene.onPlayCard(0);

        expect(scene.playerStatusEffects.strength).toBe(2);
        expect(scene.activePowerCards).toEqual([
            expect.objectContaining({ name: 'Crimson Pact', type: CARD_TYPE.POWER }),
        ]);
        expect(scene.battleLogLines).toContain('Player gains Strength 2');
    });

    it('reduces the next enemy attack when Taunt applies attack down', () => {
        const scene = createScene();
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyCardPool = [
            createCard({
                id: 'enemy-strike-4',
                name: 'Enemy Strike',
                type: CARD_TYPE.ATTACK,
                power: 4,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Taunt',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 0,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'ENEMY_ATTACK_DOWN', value: 3, duration: 1, target: 'TARGET' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onEndTurn();

        expect(scene.playerState.health).toBe(99);
        expect(scene.battleLogLines).toContain('Enemy loses 3 attack');
        expect(scene.enemyAttackDebuff).toBe(0);
    });

    it('retains block for one extra turn when Brace applies block persistence', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Brace',
                    type: CARD_TYPE.GUARD,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onEndTurn();

        expect(scene.playerState.block).toBe(4);

        scene.onEndTurn();

        expect(scene.playerState.block).toBe(0);
    });

    it('grants strength after self-damage when Berserker Rage is active', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.enemyCardPool = [];
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Berserker Rage',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'STRENGTH_ON_SELF_DAMAGE', value: 1, target: 'SELF' },
                }),
                createCard({
                    name: 'Blood Price',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    effectPayload: { drawCount: 2, selfDamage: 4 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onPlayCard(0);

        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.playerState.health).toBe(96);
    });

    it('does not grant strength from poison ticks when Berserker Rage is active', () => {
        const scene = createScene();
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };
        scene.playerStatusEffects = {
            ...scene.playerStatusEffects,
            poison: 2,
        };

        (BattleScene.prototype as unknown as {
            resolveTurnEndStatusEffects: (actor: 'player' | 'enemy') => void;
        }).resolveTurnEndStatusEffects.call(scene, 'player');

        expect(scene.playerState.health).toBe(98);
        expect(scene.playerStatusEffects.strength).toBe(0);
    });

    it('amplifies existing poison when Toxic Burst resolves', () => {
        const scene = createScene();
        scene.enemyStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 3,
            strength: 0,
            thorns: 0,
            regeneration: 0,
            frail: 0,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Toxic Burst',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'POISON_MULTIPLIER', value: 2, target: 'TARGET' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyStatusEffects.poison).toBe(6);
        expect(scene.battleLogLines).toContain('Enemy Poison rises to 6');
    });

    it('applies poison per turn when Noxious Aura is active at player turn start', () => {
        const scene = createScene();
        scene.enemyStatusEffects = scene.statusEffectService.createState();
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 0,
            poisonPerTurn: 2,
        };

        (BattleScene.prototype as unknown as {
            applyPlayerTurnStartOngoingEffects: () => boolean;
        }).applyPlayerTurnStartOngoingEffects.call(scene);

        expect(scene.enemyStatusEffects.poison).toBe(2);
        expect(scene.damagePopupController.showBatch).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'enemy-hp' }),
            [{ type: 'poison', value: 2 }],
        );
    });

    it('executes the Blood Oath setup into payoff loop', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Berserker Rage',
                    type: CARD_TYPE.POWER,
                    power: 0,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'STRENGTH_ON_SELF_DAMAGE', value: 1, target: 'SELF' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        scene.energyState = { current: 2, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Blood Price',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    effectPayload: { drawCount: 2, selfDamage: 4 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        scene.energyState = { current: 1, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Death Wish',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    effectPayload: {
                        scaling: { source: 'MISSING_HEALTH', multiplier: 1 },
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerState.health).toBe(96);
        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.enemyState.health).toBe(35);
    });

    it('executes the Shadow Arts poison setup into payoff loop', () => {
        const scene = createScene();
        scene.energyState = { current: 2, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Venom Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    statusEffect: { type: 'POISON', duration: 3 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        scene.energyState = { current: 2, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Toxic Burst',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BUFF,
                    buff: { type: 'POISON_MULTIPLIER', value: 2, target: 'TARGET' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        (BattleScene.prototype as unknown as {
            resolveTurnEndStatusEffects: (actor: 'player' | 'enemy') => void;
        }).resolveTurnEndStatusEffects.call(scene, 'enemy');

        expect(scene.enemyStatusEffects.poison).toBe(5);
        expect(scene.enemyState.health).toBe(30);
    });

    it('executes the Iron Will setup into payoff loop', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Brace',
                    type: CARD_TYPE.GUARD,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onEndTurn();

        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Shield Bash',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    effectPayload: {
                        scaling: { source: 'USER_BLOCK', multiplier: 1 },
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerState.block).toBe(4);
        expect(scene.enemyState.health).toBe(36);
    });

    it('renders ongoing effect summaries with status buffs and tracked power cards', () => {
        const scene = createScene();
        scene.playerStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 0,
            strength: 2,
            thorns: 3,
            regeneration: 1,
            frail: 0,
        };
        scene.enemyStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 0,
            strength: 0,
            thorns: 0,
            regeneration: 0,
            frail: 0,
        };
        scene.enemyAttackBuff = 4;
        scene.activePowerCards = [
            createCard({
                name: 'Barricade',
                type: CARD_TYPE.POWER,
                power: 0,
                cost: 2,
                effectType: CARD_EFFECT_TYPE.BUFF,
                rarity: CARD_RARITY.RARE,
            }),
        ];

        scene.updatePowerDisplays();

        expect(scene.playerPowerText?.setText).toHaveBeenLastCalledWith(
            expect.stringContaining('STR +2'),
        );
        expect(scene.playerPowerText?.setText).toHaveBeenLastCalledWith(
            expect.stringContaining('Barricade'),
        );
        expect(scene.enemyPowerText?.setText).toHaveBeenLastCalledWith(
            expect.stringContaining('ATK +4'),
        );
    });

    it('fills the card detail panel with type, rarity, archetype, and effect summary', () => {
        const scene = createScene();
        const toxicBurst = createCard({
            name: 'Toxic Burst',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.BUFF,
            rarity: CARD_RARITY.RARE,
            archetype: 'SHADOW_ARTS',
            buff: { type: 'POISON_MULTIPLIER', value: 2, target: 'TARGET' },
        });

        scene.showCardDetail(toxicBurst);

        expect(scene.cardDetailTitleText?.setText).toHaveBeenCalledWith('Toxic Burst');
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('SKILL · RARE · Shadow Arts'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('POISON_MULTIPLIER 2.'),
        );
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
        expect(scene.playerStatusEffects).toMatchObject({
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

        expect(scene.enemyState.block).toBe(5);
        expect(scene.playerState.health).toBe(20);
        expect(scene.showEnemyActionText).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Enemy Guard 5' }),
            0,
            5,
            0,
        );
    });

    it('renders the buff intent with the target stat and amount', () => {
        const scene = createScene();
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.BUFF,
            stat: 'attack',
            amount: 4,
            label: 'Battle Cry',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next ⬆️ ATK +4');
        expect(scene.enemyIntentText?.setAlpha).toHaveBeenCalledWith(1);
    });

    it('renders defend intent as the next-turn block preview', () => {
        const scene = createScene();
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            block: 4,
            label: 'Enemy Guard 4',
            sourceCardId: 'enemy-guard-4',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next 🛡️ +4');
        expect(scene.enemyIntentText?.setAlpha).toHaveBeenCalledWith(1);
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
            playerRemainingHealth: 100,
            enemyRemainingHealth: 40,
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
            appendBattleLog: ReturnType<typeof vi.fn>;
            formatPlayerActionLog: (
                card: ReturnType<typeof createCard>,
                effect: {
                    damageDealt: number;
                    damageBlocked: number;
                    blockGained: number;
                    fled: boolean;
                },
            ) => string;
        };
        scene.damagePopupController = { showBatch: vi.fn() };
        scene.add = {
            text: vi.fn(() => fallbackText),
        };
        scene.appendBattleLog = vi.fn();
        scene.formatPlayerActionLog = (
            BattleScene.prototype as unknown as {
                formatPlayerActionLog: (
                    card: ReturnType<typeof createCard>,
                    effect: {
                        damageDealt: number;
                        damageBlocked: number;
                        blockGained: number;
                        fled: boolean;
                    },
                ) => string;
            }
        ).formatPlayerActionLog;

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
            292,
            188,
            'Strike: strike',
            expect.objectContaining({ fontSize: '14px' }),
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Strike: strike');
        expect(fallbackText.setAlpha).toHaveBeenCalledWith(0.78);
    });

    it('clips battle history text to the activity panel bounds', () => {
        const mask = {};
        const headerText = {
            setOrigin: vi.fn().mockReturnThis(),
        };
        const battleLogText = {
            setOrigin: vi.fn().mockReturnThis(),
            setMask: vi.fn(),
            setText: vi.fn(),
        };
        const maskGraphics = {
            destroy: vi.fn(),
            setVisible: vi.fn().mockReturnThis(),
            fillStyle: vi.fn().mockReturnThis(),
            fillRect: vi.fn().mockReturnThis(),
            createGeometryMask: vi.fn(() => mask),
        };
        const scene = new BattleScene() as unknown as {
            add: { text: ReturnType<typeof vi.fn> };
            make: { graphics: ReturnType<typeof vi.fn> };
            battleLogLines: string[];
        };
        scene.add = {
            text: vi.fn()
                .mockReturnValueOnce(headerText)
                .mockReturnValueOnce(battleLogText),
        };
        scene.make = {
            graphics: vi.fn(() => maskGraphics),
        };
        scene.battleLogLines = ['Strike: strike'];

        (BattleScene.prototype as unknown as {
            createBattleLog: () => void;
        }).createBattleLog.call(scene);

        expect(scene.make.graphics).toHaveBeenCalledWith({ x: 0, y: 0 });
        expect(maskGraphics.fillRect).toHaveBeenCalledWith(584, 68, 168, 186);
        expect(battleLogText.setMask).toHaveBeenCalledWith(mask);
        expect(battleLogText.setText).toHaveBeenCalledWith('Strike: strike');
    });

    it('keeps only the latest three battle history entries', () => {
        const scene = new BattleScene() as unknown as {
            battleLogLines: string[];
            updateBattleLog: ReturnType<typeof vi.fn>;
        };
        scene.battleLogLines = [];
        scene.updateBattleLog = vi.fn();

        const appendBattleLog = (
            BattleScene.prototype as unknown as {
                appendBattleLog: (message: string) => void;
            }
        ).appendBattleLog;

        appendBattleLog.call(scene, 'Entry 1');
        appendBattleLog.call(scene, 'Entry 2');
        appendBattleLog.call(scene, 'Entry 3');
        appendBattleLog.call(scene, 'Entry 4');

        expect(scene.battleLogLines).toEqual(['Entry 2', 'Entry 3', 'Entry 4']);
    });

    it('writes enemy action summaries into the battle history', () => {
        const fallbackText = createFallbackText();
        const scene = new BattleScene() as unknown as {
            damagePopupController: { showBatch: ReturnType<typeof vi.fn> };
            add: { text: ReturnType<typeof vi.fn> };
            effectText?: { destroy: ReturnType<typeof vi.fn> };
            appendBattleLog: ReturnType<typeof vi.fn>;
            formatEnemyActionLog: (
                card: ReturnType<typeof createCard>,
                damage: number,
                blockGained: number,
                damageBlocked?: number,
            ) => string;
        };
        scene.damagePopupController = { showBatch: vi.fn() };
        scene.add = {
            text: vi.fn(() => fallbackText),
        };
        scene.appendBattleLog = vi.fn();
        scene.formatEnemyActionLog = (
            BattleScene.prototype as unknown as {
                formatEnemyActionLog: (
                    card: ReturnType<typeof createCard>,
                    damage: number,
                    blockGained: number,
                    damageBlocked?: number,
                ) => string;
            }
        ).formatEnemyActionLog;

        (BattleScene.prototype as unknown as {
            showEnemyActionText: (
                card: ReturnType<typeof createCard>,
                damage: number,
                blockGained: number,
                damageBlocked?: number,
            ) => void;
        }).showEnemyActionText.call(
            scene,
            createCard({
                name: 'Enemy Guard',
                type: CARD_TYPE.GUARD,
                power: 5,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            }),
            0,
            5,
            0,
        );

        expect(scene.appendBattleLog).toHaveBeenCalledWith('Enemy Enemy Guard: +5 Block');
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

describe('BattleScene card readability overlays', () => {
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

    function createDisplayObject() {
        return {
            setOrigin: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setStrokeStyle: vi.fn().mockReturnThis(),
            setInteractive: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
        };
    }

    it('renders type, rarity, effect tag, and archetype on the card face', () => {
        const textCalls: string[] = [];
        const container = {
            add: vi.fn(),
            setDepth: vi.fn(),
            setVisible: vi.fn(),
            setScale: vi.fn(),
            destroy: vi.fn(),
        };
        const scene = new BattleScene() as unknown as {
            add: {
                container: ReturnType<typeof vi.fn>;
                rectangle: ReturnType<typeof vi.fn>;
                circle: ReturnType<typeof vi.fn>;
                text: ReturnType<typeof vi.fn>;
            };
            isInputLocked: boolean;
            showCardDetail: ReturnType<typeof vi.fn>;
            clearCardDetail: ReturnType<typeof vi.fn>;
        };
        scene.add = {
            container: vi.fn(() => container),
            rectangle: vi.fn(() => createDisplayObject()),
            circle: vi.fn(() => createDisplayObject()),
            text: vi.fn((_x: number, _y: number, value: string) => {
                textCalls.push(value);
                return createDisplayObject();
            }),
        };
        scene.isInputLocked = false;
        scene.showCardDetail = vi.fn();
        scene.clearCardDetail = vi.fn();

        (BattleScene.prototype as unknown as {
            createCardVisual: (
                card: ReturnType<typeof createCard>,
                x: number,
                y: number,
                index: number,
                canAfford: boolean,
            ) => unknown;
        }).createCardVisual.call(
            scene,
            createCard({
                name: 'Berserker Rage',
                type: CARD_TYPE.POWER,
                power: 0,
                cost: 1,
                rarity: CARD_RARITY.RARE,
                archetype: 'BLOOD_OATH',
                effectType: CARD_EFFECT_TYPE.BUFF,
                buff: {
                    type: 'Strength',
                    value: 2,
                    target: 'SELF',
                },
            }),
            100,
            220,
            0,
            true,
        );

        expect(textCalls).toContain('POWER');
        expect(textCalls).toContain('R');
        expect(textCalls).toContain('Strength');
        expect(textCalls).toContain('Blood Oath');
    });

    it('writes ongoing effect summaries and card detail copy into their UI texts', () => {
        const titleText = { setText: vi.fn() };
        const bodyText = { setText: vi.fn() };
        const playerPowerText = { setText: vi.fn() };
        const enemyPowerText = { setText: vi.fn() };
        const scene = new BattleScene() as unknown as {
            playerPowerText: typeof playerPowerText;
            enemyPowerText: typeof enemyPowerText;
            playerStatusEffects: StatusEffectState;
            enemyStatusEffects: StatusEffectState;
            cardDetailTitleText: typeof titleText;
            cardDetailBodyText: typeof bodyText;
        };
        scene.playerPowerText = playerPowerText;
        scene.enemyPowerText = enemyPowerText;
        scene.playerStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 0,
            strength: 2,
            thorns: 1,
            regeneration: 0,
            frail: 0,
        };
        scene.enemyStatusEffects = {
            vulnerable: 0,
            weak: 0,
            poison: 0,
            strength: 0,
            thorns: 0,
            regeneration: 3,
            frail: 0,
        };
        scene.cardDetailTitleText = titleText;
        scene.cardDetailBodyText = bodyText;

        (BattleScene.prototype as unknown as {
            updatePowerDisplays: () => void;
            showCardDetail: (card: ReturnType<typeof createCard>) => void;
        }).updatePowerDisplays.call(scene);

        expect(playerPowerText.setText).toHaveBeenCalledWith('STR +2 · THR 1');
        expect(enemyPowerText.setText).toHaveBeenCalledWith('REG 3');

        (BattleScene.prototype as unknown as {
            showCardDetail: (card: ReturnType<typeof createCard>) => void;
        }).showCardDetail.call(
            scene,
            createCard({
                name: 'Iron Guard',
                type: CARD_TYPE.GUARD,
                power: 10,
                cost: 2,
                rarity: CARD_RARITY.UNCOMMON,
                archetype: 'IRON_WILL',
                effectType: CARD_EFFECT_TYPE.BLOCK,
            }),
        );

        expect(titleText.setText).toHaveBeenCalledWith('Iron Guard');
        expect(bodyText.setText).toHaveBeenCalledWith(
            expect.stringContaining('GUARD · UNCOMMON · Iron Will'),
        );
    });
});
