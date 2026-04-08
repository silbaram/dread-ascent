import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../src/domain/entities/Card';
import type { EnemyArchetypeId } from '../../../src/domain/entities/Enemy';
import { CardEffectService } from '../../../src/domain/services/CardEffectService';
import { CardBattleService } from '../../../src/domain/services/CardBattleService';
import { DrawCycleService } from '../../../src/domain/services/DrawCycleService';
import { EnergyService } from '../../../src/domain/services/EnergyService';
import { DREAD_RULE_ID } from '../../../src/domain/services/DreadRuleService';
import {
    ENEMY_INTENT_PATTERN,
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
    type EnemyIntent,
} from '../../../src/domain/services/EnemyIntentService';
import {
    StatusEffectService,
    type StatusEffectState,
} from '../../../src/domain/services/StatusEffectService';
import { getBattleEquipmentConfig } from '../../../src/domain/services/EquipmentEffectService';
import {
    BATTLE_EVENT_NAME,
    LEGACY_BATTLE_EVENT_NAME,
    type BattleEventBus,
    type BattleEventRecord,
} from '../../../src/scenes/events/BattleEventBus.ts';

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
    readonly resolveTurnEndStatusEffects: (actor: 'player' | 'enemy') => void;
    readonly updatePowerDisplays: () => void;
    readonly showCardDetail: (card: ReturnType<typeof createCard>) => void;
    updateTurnDisplay?: ReturnType<typeof vi.fn>;
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
            archetypeId: EnemyArchetypeId;
            elite: boolean;
        };
        enemyName?: string;
        encounterEnemies?: readonly {
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
            archetypeId: EnemyArchetypeId;
            elite: boolean;
        }[];
    };
    encounterEnemyStates?: Array<{
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
            archetypeId: EnemyArchetypeId;
            elite: boolean;
        };
        state: {
            health: number;
            maxHealth: number;
            block: number;
        };
        statusEffects?: StatusEffectState;
        cardPool?: ReturnType<typeof createCard>[];
        intentQueue?: EnemyIntent[];
        currentIntent?: EnemyIntent;
        ongoingBuffs?: {
            blockPersist: boolean;
            blockPersistCharges: number;
            strengthOnSelfDamage: number;
            poisonPerTurn: number;
        };
        attackBuff?: number;
        attackDebuff?: number;
        attackDebuffDuration?: number;
    }>;
    scene: {
        stop: ReturnType<typeof vi.fn>;
        wake: ReturnType<typeof vi.fn>;
    };
    isInputLocked: boolean;
    battleLogLines: string[];
    enemyAttackBuff: number;
    dreadRule?: {
        id: string;
        name: string;
        summary: string;
        description: string;
        effects: {
            hideEnemyIntentOnEvenTurns?: boolean;
            firstSelfDamageStrength?: number;
            turnEndSelfDamagePerUnspentEnergy?: number;
            poisonDoesNotDecay?: boolean;
        };
    };
    dreadRuleSelfDamageTriggeredThisTurn?: boolean;
    currentEnemyIntent?: {
        type: 'attack' | 'defend' | 'buff';
        pattern?: 'strike' | 'flurry' | 'guard' | 'ritual';
        damage?: number;
        hitCount?: number;
        damagePerHit?: number;
        block?: number;
        amount?: number;
        stat?: 'attack';
        label: string;
        sourceCardId?: string;
    };
    damagePopupController: {
        showBatch: ReturnType<typeof vi.fn>;
    };
    battlePresentationFacade?: object;
    battleEventBus?: BattleEventBus;
    enemyIntentText?: {
        setText: ReturnType<typeof vi.fn>;
        setAlpha: ReturnType<typeof vi.fn>;
    };
    playerStatusText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    playerBreakpointText?: {
        setText: ReturnType<typeof vi.fn>;
        setColor: ReturnType<typeof vi.fn>;
        setAlpha: ReturnType<typeof vi.fn>;
    };
    playerPowerText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    enemyPowerText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    playerStatusText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    enemyStatusText?: {
        setText: ReturnType<typeof vi.fn>;
    };
    playerBreakpointText?: {
        setText: ReturnType<typeof vi.fn>;
        setColor: ReturnType<typeof vi.fn>;
        setAlpha: ReturnType<typeof vi.fn>;
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
    equipmentConfig?: ReturnType<typeof getBattleEquipmentConfig>;
    equipmentInventory?: readonly object[];
    queuedAttackPowerBonus?: number;
    pendingNextTurnDrawBonus?: number;
    martyrStrengthGainedThisTurn?: number;
    openingHandCardIds?: Set<string>;
    battleStartEnergyBonus?: number;
    nextBattleStartEnergyBonus?: number;
    playerSelfDamageTotal?: number;
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
        const encounterEnemy = {
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
            kind: 'normal' as const,
            archetypeId: 'ash-crawler' as const,
            elite: false,
        };
        scene.sceneData = {
            enemy: encounterEnemy,
            enemyName: encounterEnemy.label,
            encounterEnemies: [encounterEnemy],
        };
        scene.encounterEnemyStates = [
            {
                enemy: encounterEnemy,
                state: { health: 40, maxHealth: 40, block: 0 },
            },
        ];
        scene.scene = {
            stop: vi.fn(),
            wake: vi.fn(),
        };
        scene.isInputLocked = false;
        scene.battleLogLines = [];
        scene.enemyAttackBuff = 0;
        scene.dreadRule = undefined;
        scene.dreadRuleSelfDamageTriggeredThisTurn = false;
        scene.currentEnemyIntent = undefined;
        scene.damagePopupController = {
            showBatch: vi.fn(),
        };
        scene.enemyIntentText = {
            setText: vi.fn(),
            setAlpha: vi.fn(),
        };
        scene.playerStatusText = {
            setText: vi.fn(),
        };
        scene.playerBreakpointText = {
            setText: vi.fn(),
            setColor: vi.fn(),
            setAlpha: vi.fn(),
        };
        scene.playerPowerText = {
            setText: vi.fn(),
        };
        scene.enemyPowerText = {
            setText: vi.fn(),
        };
        scene.playerStatusText = {
            setText: vi.fn(),
        };
        scene.enemyStatusText = {
            setText: vi.fn(),
        };
        scene.playerBreakpointText = {
            setText: vi.fn(),
            setColor: vi.fn(),
            setAlpha: vi.fn(),
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
        scene.equipmentConfig = getBattleEquipmentConfig([]);
        scene.equipmentInventory = [];
        scene.queuedAttackPowerBonus = 0;
        scene.pendingNextTurnDrawBonus = 0;
        scene.martyrStrengthGainedThisTurn = 0;
        scene.openingHandCardIds = new Set();
        scene.battleStartEnergyBonus = 0;
        scene.nextBattleStartEnergyBonus = 0;
        scene.playerSelfDamageTotal = 0;
        scene.updateTurnDisplay = vi.fn();
        scene.battlePresentationFacade = (
            BattleScene.prototype as unknown as {
                createBattlePresentationFacade: () => object;
            }
        ).createBattlePresentationFacade.call(scene);

        return scene;
    }

    function getBattleEvents(scene: TestScene): readonly BattleEventRecord[] {
        return scene.battleEventBus?.snapshot() ?? [];
    }

    it('emits battle and legacy turn-start events with draw payload', () => {
        const scene = createScene();
        scene.drawCycleState = scene.drawCycleService.initialize([
            createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 6,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
            createCard({
                name: 'Fortify',
                type: CARD_TYPE.GUARD,
                power: 5,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            }),
            createCard({
                name: 'Quick Draw',
                type: CARD_TYPE.SKILL,
                power: 0,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.DRAW,
            }),
        ]);

        (BattleScene.prototype as unknown as {
            startPlayerTurn: () => void;
        }).startPlayerTurn.call(scene);

        expect(getBattleEvents(scene)).toEqual([
            {
                name: BATTLE_EVENT_NAME.TURN_STARTED,
                payload: expect.objectContaining({
                    battleId: 'battle:local',
                    turnNumber: 1,
                    energy: 3,
                    drawCount: 3,
                    handCount: 3,
                }),
            },
            {
                name: LEGACY_BATTLE_EVENT_NAME.TURN_STARTED,
                payload: expect.objectContaining({
                    turnNumber: 1,
                    energy: 3,
                    drawCount: 3,
                    handCount: 3,
                }),
            },
        ]);
    });

    it('emits battle and legacy card events before the action-resolved event', () => {
        const scene = createScene();
        const strike = createCard({
            id: 'strike-test',
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [strike],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(getBattleEvents(scene).map((event) => event.name)).toEqual([
            BATTLE_EVENT_NAME.CARD_PLAYED,
            LEGACY_BATTLE_EVENT_NAME.CARD_PLAYED,
            BATTLE_EVENT_NAME.ACTION_RESOLVED,
        ]);
        expect(getBattleEvents(scene)[0]).toEqual({
            name: BATTLE_EVENT_NAME.CARD_PLAYED,
            payload: expect.objectContaining({
                battleId: 'battle:local',
                turnNumber: 0,
                cardId: 'strike-test',
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                cost: 1,
                remainingEnergy: 2,
                targetIds: ['enemy-1'],
            }),
        });
        expect(getBattleEvents(scene)[2]).toEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                battleId: 'battle:local',
                turnNumber: 0,
                actionType: CARD_EFFECT_TYPE.DAMAGE,
                sourceId: 'player',
                targetIds: ['enemy-1'],
                damage: 7,
                block: 0,
                queueIndex: 0,
            }),
        });
    });

    it('keeps emitting legacy STATUS_APPLIED while action-resolved status deltas are added', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
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
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(getBattleEvents(scene)).toContainEqual({
            name: LEGACY_BATTLE_EVENT_NAME.STATUS_APPLIED,
            payload: {
                targetId: 'enemy-1',
                statusType: 'VULNERABLE',
                value: 2,
                expiresAtTurn: 2,
            },
        });
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                actionType: CARD_EFFECT_TYPE.STATUS_EFFECT,
                statusDelta: [{ targetId: 'enemy-1', statusType: 'VULNERABLE', value: 2 }],
            }),
        });
    });

    it('emits battle and legacy turn-end events with retained and exhausted counts', () => {
        const scene = createScene();
        scene.energyState = { current: 2, max: 3 };
        scene.time = {
            delayedCall: vi.fn(),
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Planning',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    keywords: [CARD_KEYWORD.RETAIN],
                }),
                createCard({
                    name: 'Dread',
                    type: CARD_TYPE.CURSE,
                    power: 0,
                    cost: 0,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    keywords: [CARD_KEYWORD.ETHEREAL],
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

        scene.onEndTurn();

        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.TURN_ENDED,
            payload: expect.objectContaining({
                battleId: 'battle:local',
                turnNumber: 0,
                remainingEnergy: 2,
                handCount: 1,
                retainedCount: 1,
                exhaustedCount: 1,
            }),
        });
        expect(getBattleEvents(scene)).toContainEqual({
            name: LEGACY_BATTLE_EVENT_NAME.TURN_ENDED,
            payload: {
                turnNumber: 0,
                remainingEnergy: 2,
                handCount: 1,
            },
        });
    });

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

    it('drops stale battle log text refs before breakpoint sync runs in a relaunched scene', () => {
        const staleBattleLogText = {
            setText: vi.fn(() => {
                throw new Error('stale battle log should not be used');
            }),
        };
        const scene = new BattleScene() as unknown as TestScene & {
            battleLogText?: typeof staleBattleLogText;
            battleLogMaskGraphics?: object;
            activeBreakpointReactionKeys: Set<string>;
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
            appendBreakpointCardReactions: ReturnType<typeof vi.fn>;
        };

        scene.battleLogText = staleBattleLogText;
        scene.battleLogMaskGraphics = {};
        scene.playerStatusText = { setText: vi.fn() };
        scene.enemyStatusText = { setText: vi.fn() };
        scene.playerBreakpointText = {
            setText: vi.fn(),
            setColor: vi.fn(),
            setAlpha: vi.fn(),
        };
        scene.playPanelPulseMotion = vi.fn();
        scene.playPanelImpactMotion = vi.fn();
        scene.appendBreakpointCardReactions = vi.fn();

        (BattleScene.prototype as unknown as {
            init: (data: {
                player: { stats: { health: number; maxHealth: number } };
                enemy: {
                    stats: { health: number; maxHealth: number };
                    kind: 'normal' | 'boss';
                    elite: boolean;
                };
                deckService: { getCards: () => ReturnType<typeof createCard>[] };
                cardBattleService: CardBattleService;
                itemService: { getInventory: () => readonly object[] };
                enemyName: string;
            }) => void;
        }).init.call(scene, {
            player: { stats: { health: 40, maxHealth: 40 } },
            enemy: {
                stats: { health: 24, maxHealth: 24 },
                kind: 'normal',
                elite: true,
            },
            deckService: { getCards: () => [] },
            cardBattleService: new CardBattleService(),
            itemService: { getInventory: () => [] },
            enemyName: 'Elite Enemy',
        });

        scene.playerState = { health: 18, maxHealth: 40, block: 0 };

        expect(() => {
            (BattleScene.prototype as unknown as {
                updateStatusDisplays: () => void;
            }).updateStatusDisplays.call(scene);
        }).not.toThrow();
        expect(scene.battleLogText).toBeUndefined();
        expect(scene.battleLogLines).toContain('Bloodied');
        expect(staleBattleLogText.setText).not.toHaveBeenCalled();
    });

    it('resolves Shockwave against the current enemy in the 1:1 battle model', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 20, maxHealth: 20, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Shockwave',
                    type: CARD_TYPE.ATTACK,
                    power: 8,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    rarity: CARD_RARITY.COMMON,
                    archetype: 'NEUTRAL',
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(12);
        expect(scene.totalEnemyDamage).toBe(8);
        expect(scene.energyState.current).toBe(1);
    });

    it('renders Last Stand as playable at full cost when the HP discount is not active', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 60, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Last Stand',
                    type: CARD_TYPE.ATTACK,
                    power: 40,
                    cost: 3,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    keywords: [CARD_KEYWORD.EXHAUST],
                    rarity: CARD_RARITY.RARE,
                    condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
                    effectPayload: {
                        costWhenConditionMet: 0,
                        healOnKillPercent: 30,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.displayHandCards();

        expect(scene.createCardVisual).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Last Stand', cost: 3 }),
            expect.any(Number),
            expect.any(Number),
            0,
            true,
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

    it('discounts Last Stand to zero cost when the HP threshold is met', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 40,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.EXHAUST],
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
            effectPayload: {
                costWhenConditionMet: 0,
                healOnKillPercent: 30,
            },
        });
        scene.energyState = { current: 0, max: 3 };
        scene.playerState = { health: 25, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [lastStand],
            discardPile: [],
            exhaustPile: [],
        };

        scene.displayHandCards();

        expect(scene.createCardVisual).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Last Stand', cost: 0 }),
            expect.any(Number),
            expect.any(Number),
            0,
            true,
            1,
        );
    });

    it('plays Last Stand for zero cost at low health and restores health on kill', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 40,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.EXHAUST],
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
            effectPayload: {
                costWhenConditionMet: 0,
                healOnKillPercent: 30,
            },
        });
        scene.energyState = { current: 0, max: 3 };
        scene.playerState = { health: 20, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [lastStand],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.energyState.current).toBe(0);
        expect(scene.playerState.health).toBe(50);
        expect(scene.drawCycleState.hand).toEqual([]);
        expect(scene.drawCycleState.exhaustPile).toEqual([
            expect.objectContaining({ name: 'Last Stand' }),
        ]);
        expect(scene.showBattleEnd).toHaveBeenCalledWith('player-win');
    });

    it('shows Bloodied breakpoint state in the player HUD', () => {
        const scene = createScene();
        scene.playerState = { health: 50, maxHealth: 100, block: 0 };

        scene.updateStatusDisplays();

        expect(scene.playerStatusText?.setText).toHaveBeenCalledWith('BLOODIED');
        expect(scene.playerBreakpointText?.setText).toHaveBeenCalledWith('BLOODIED');
        expect(scene.playerBreakpointText?.setColor).toHaveBeenCalledWith('#ffb347');
    });

    it('logs breakpoint reactions when self-damage pushes Bloodrush online', () => {
        const scene = createScene();
        scene.energyState = { current: 2, max: 3 };
        scene.playerState = { health: 54, maxHealth: 100, block: 0 };
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
                createCard({
                    name: 'Bloodrush',
                    type: CARD_TYPE.ATTACK,
                    power: 20,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    condition: { type: 'HP_PERCENT_THRESHOLD', value: 50 },
                    effectPayload: {
                        costWhenConditionMet: 0,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.battleLogLines).toContain('Bloodied');
        expect(scene.battleLogLines).toContain('Bloodrush cost 0');
        expect(scene.isInputLocked).toBe(false);
    });

    it('splits multi-hit damage popups and self-damage popups in the reaction feed', () => {
        const scene = createScene();
        const recklessFury = createCard({
            name: 'Reckless Fury',
            type: CARD_TYPE.ATTACK,
            power: 3,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            effectPayload: { hitCount: 4, selfDamage: 2 },
        });

        BattleScene.prototype.showEffectText.call(scene, recklessFury, {
            damageDealt: 12,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            selfDamageTaken: 2,
            hitsResolved: 4,
        });

        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            1,
            { id: 'player-hp', x: 292, y: 248 },
            [{ type: 'damage', value: 2 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            2,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            3,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            4,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            5,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 3 }],
        );
    });

    it('does not overstate multi-hit damage popups when only some hits connect', () => {
        const scene = createScene();
        const recklessFury = createCard({
            name: 'Reckless Fury',
            type: CARD_TYPE.ATTACK,
            power: 3,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            effectPayload: { hitCount: 4, selfDamage: 2 },
        });

        BattleScene.prototype.showEffectText.call(scene, recklessFury, {
            damageDealt: 2,
            damageBlocked: 10,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            selfDamageTaken: 0,
            hitsResolved: 4,
        });

        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            1,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'blocked', value: 10 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            2,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 1 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            3,
            { id: 'enemy-hp', x: 292, y: 68 },
            [{ type: 'damage', value: 1 }],
        );
    });

    it('plays repeated impact motion for multi-hit attacks', () => {
        const scene = createScene();
        const recklessFury = createCard({
            name: 'Reckless Fury',
            type: CARD_TYPE.ATTACK,
            power: 3,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            effectPayload: { hitCount: 4, selfDamage: 2 },
        });
        scene.playPanelImpactMotion = vi.fn();

        BattleScene.prototype.playResolvedActionMotion.call(scene, 'player', recklessFury, {
            damageDealt: 12,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            selfDamageTaken: 2,
            hitsResolved: 4,
        });

        expect(scene.playPanelImpactMotion).toHaveBeenNthCalledWith(1, 'player', 0xff8f8f);
        expect(scene.playPanelImpactMotion).toHaveBeenCalledTimes(5);
        expect(scene.playPanelImpactMotion).toHaveBeenLastCalledWith('enemy', 0xff8f8f);
    });

    it('describes Desperation breakpoints in card intel for Last Stand', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 40,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.EXHAUST],
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
            effectPayload: {
                costWhenConditionMet: 0,
                healOnKillPercent: 30,
            },
        });
        scene.playerState = { health: 25, maxHealth: 100, block: 0 };

        scene.showCardDetail(lastStand);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Breakpoint active: Desperation'),
        );
    });

    it('grants energy and draw when Adrenaline Rush resolves', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.energyState = { current: 1, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [
                createCard({
                    name: 'Strike A',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    name: 'Strike B',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    name: 'Strike C',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
            hand: [
                createCard({
                    name: 'Adrenaline Rush',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DRAW,
                    keywords: [CARD_KEYWORD.EXHAUST],
                    effectPayload: {
                        drawCount: 3,
                        selfDamage: 5,
                        energyChange: 3,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.energyState.current).toBe(3);
        expect(scene.playerState.health).toBe(95);
        expect(scene.drawCycleState.hand).toHaveLength(3);
        expect(scene.showEffectText).toHaveBeenCalled();
    });

    it('treats self-inflicted lethal damage as a player loss even when the enemy also dies', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 2, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 3, maxHealth: 3, block: 0 };
        scene.enemyCardPool = [];
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Reckless Fury',
                    type: CARD_TYPE.ATTACK,
                    power: 3,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                    effectPayload: { hitCount: 4, selfDamage: 2 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerState.health).toBe(0);
        expect(scene.enemyState.health).toBe(0);
        expect(scene.showBattleEnd).toHaveBeenCalledWith('player-lose');
        expect(scene.showBattleEnd).not.toHaveBeenCalledWith('player-win');
    });

    it('restores health when Last Stand kills the target', () => {
        const scene = createScene();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 20, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.enemyCardPool = [];
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Last Stand',
                    type: CARD_TYPE.ATTACK,
                    power: 40,
                    cost: 3,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    keywords: [CARD_KEYWORD.EXHAUST],
                    rarity: CARD_RARITY.RARE,
                    condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
                    effectPayload: {
                        costWhenConditionMet: 0,
                        healOnKillPercent: 30,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(0);
        expect(scene.playerState.health).toBe(50);
        expect(scene.battleLogLines).toContain('Last Stand restores 30 HP on kill');
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

    it('switches to the next living enemy in a multi-enemy encounter instead of ending the battle', () => {
        const scene = createScene() as TestScene & {
            getEnemyActorId: () => string;
            getEncounterEnemyStateById: (enemyId: string) => { health: number; maxHealth: number; block: number } | undefined;
        };
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 6,
                maxHealth: 6,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 12,
                maxHealth: 12,
            },
        };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 6, maxHealth: 6, block: 0 } },
            { enemy: supportEnemy, state: { health: 12, maxHealth: 12, block: 0 } },
        ];
        scene.enemyState = { health: 6, maxHealth: 6, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
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

        expect(scene.showBattleEnd).not.toHaveBeenCalled();
        expect(scene.sceneData.enemy.id).toBe('enemy-2');
        expect(scene.getEnemyActorId()).toBe('enemy-2');
        expect(scene.enemyState.health).toBe(12);
        expect(scene.getEncounterEnemyStateById('enemy-1')?.health).toBe(0);
        expect(scene.getEncounterEnemyStateById('enemy-2')?.health).toBe(12);
        expect(getBattleEvents(scene)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
                payload: expect.objectContaining({
                    targetIds: ['enemy-1'],
                }),
            }),
        ]));
    });

    it('retargets subsequent card actions to the new active enemy in a multi-enemy encounter', () => {
        const scene = createScene() as TestScene & {
            getEnemyActorId: () => string;
        };
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 6,
                maxHealth: 6,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 12,
                maxHealth: 12,
            },
        };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 6, maxHealth: 6, block: 0 } },
            { enemy: supportEnemy, state: { health: 12, maxHealth: 12, block: 0 } },
        ];
        scene.enemyState = { health: 6, maxHealth: 6, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Heavy Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    name: 'Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 3,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onPlayCard(0);

        expect(scene.getEnemyActorId()).toBe('enemy-2');
        expect(scene.enemyState.health).toBe(9);
        expect(getBattleEvents(scene).filter((event) =>
            event.name === BATTLE_EVENT_NAME.ACTION_RESOLVED,
        )).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({ targetIds: ['enemy-1'] }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ targetIds: ['enemy-2'] }),
            }),
        ]));
    });

    it('executes each living enemy once during the enemy phase and keeps source ids per enemy', () => {
        const scene = createScene();
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 10,
                maxHealth: 10,
                attack: 4,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 12,
                maxHealth: 12,
                attack: 7,
            },
        };
        const leadIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK as const,
            pattern: ENEMY_INTENT_PATTERN.STRIKE as const,
            damage: 4,
            label: 'Lead Strike',
            sourceCardId: 'enemy-1-strike',
        };
        const supportIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK as const,
            pattern: ENEMY_INTENT_PATTERN.STRIKE as const,
            damage: 7,
            label: 'Support Strike',
            sourceCardId: 'enemy-2-strike',
        };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            {
                enemy: leadEnemy,
                state: { health: 10, maxHealth: 10, block: 0 },
                statusEffects: scene.statusEffectService.createState(),
                cardPool: [
                    createCard({
                        id: 'enemy-1-strike',
                        name: 'Lead Strike',
                        type: CARD_TYPE.ATTACK,
                        power: 4,
                        effectType: CARD_EFFECT_TYPE.DAMAGE,
                    }),
                ],
                intentQueue: [leadIntent],
                currentIntent: leadIntent,
                ongoingBuffs: {
                    blockPersist: false,
                    blockPersistCharges: 0,
                    strengthOnSelfDamage: 0,
                    poisonPerTurn: 0,
                },
                attackBuff: 0,
                attackDebuff: 0,
                attackDebuffDuration: 0,
            },
            {
                enemy: supportEnemy,
                state: { health: 12, maxHealth: 12, block: 0 },
                statusEffects: scene.statusEffectService.createState(),
                cardPool: [
                    createCard({
                        id: 'enemy-2-strike',
                        name: 'Support Strike',
                        type: CARD_TYPE.ATTACK,
                        power: 7,
                        effectType: CARD_EFFECT_TYPE.DAMAGE,
                    }),
                ],
                intentQueue: [supportIntent],
                currentIntent: supportIntent,
                ongoingBuffs: {
                    blockPersist: false,
                    blockPersistCharges: 0,
                    strengthOnSelfDamage: 0,
                    poisonPerTurn: 0,
                },
                attackBuff: 0,
                attackDebuff: 0,
                attackDebuffDuration: 0,
            },
        ];
        scene.enemyState = { health: 10, maxHealth: 10, block: 0 };
        scene.enemyCardPool = [
            createCard({
                id: 'enemy-1-strike',
                name: 'Lead Strike',
                type: CARD_TYPE.ATTACK,
                power: 4,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
        scene.currentEnemyIntent = leadIntent;

        scene.onEndTurn();

        const actionEvents = getBattleEvents(scene)
            .filter((event) => event.name === BATTLE_EVENT_NAME.ACTION_RESOLVED);

        expect(scene.playerState.health).toBe(89);
        expect(scene.startPlayerTurn).toHaveBeenCalledOnce();
        expect(scene.sceneData.enemy.id).toBe('enemy-1');
        expect(actionEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({
                    sourceId: 'enemy-1',
                    targetIds: ['player'],
                    damage: 4,
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    sourceId: 'enemy-2',
                    targetIds: ['player'],
                    damage: 7,
                }),
            }),
        ]));
    });

    it('renders labeled intent previews for each living enemy in a multi-enemy encounter', () => {
        const scene = createScene();
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
        };
        const leadIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK as const,
            pattern: ENEMY_INTENT_PATTERN.STRIKE as const,
            damage: 4,
            label: 'Lead Strike',
        };
        const supportIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND as const,
            pattern: ENEMY_INTENT_PATTERN.GUARD as const,
            block: 3,
            label: 'Support Guard',
        };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            {
                enemy: leadEnemy,
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: leadIntent,
                intentQueue: [leadIntent],
            },
            {
                enemy: supportEnemy,
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: supportIntent,
                intentQueue: [supportIntent],
            },
        ];

        (BattleScene.prototype as unknown as {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay.call(scene, false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith(
            'Ash Crawler: STRIKE ⚔️ 4\nBlade Raider: GUARD 🛡️ +3',
        );
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

    it('grants Strength when Berserker Rage owner is hit by an enemy attack', () => {
        const scene = createScene();
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            damage: 4,
            label: 'Enemy Strike 4',
        };

        scene.executeEnemyTurn();

        expect(scene.playerState.health).toBe(96);
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

    it('adds self-damage to the reaction feed when Blood Price resolves', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.showEffectText = BattleScene.prototype.showEffectText;
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

        expect(scene.battleLogLines).toContain('Self-Damage 4');
        expect(scene.damagePopupController.showBatch).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'player-hp' }),
            expect.arrayContaining([expect.objectContaining({ type: 'damage', value: 4 })]),
        );
        expect(
            scene.damagePopupController.showBatch.mock.calls.filter(
                ([anchor, requests]) => anchor.id === 'player-hp'
                    && requests.some((request: { type: string; value: number }) => (
                        request.type === 'damage'
                        && request.value === 4
                    )),
            ),
        ).toHaveLength(1);
    });

    it('surfaces bloodied breakpoints in the reaction feed and status strip', () => {
        const scene = createScene() as TestScene & {
            playerSelfDamageTotal: number;
            playerBreakpointState: 'stable' | 'bloodied' | 'desperation';
            playerStatusText: {
                setText: ReturnType<typeof vi.fn>;
            };
            enemyStatusText: {
                setText: ReturnType<typeof vi.fn>;
            };
            playerBreakpointText: {
                setText: ReturnType<typeof vi.fn>;
                setColor: ReturnType<typeof vi.fn>;
                setAlpha: ReturnType<typeof vi.fn>;
            };
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
            updateStatusDisplays: () => void;
        };
        scene.playerState = { health: 18, maxHealth: 40, block: 0 };
        scene.playerSelfDamageTotal = 4;
        scene.playerBreakpointState = 'stable';
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Bloodrush',
                    type: CARD_TYPE.ATTACK,
                    power: 20,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    condition: { type: 'HP_PERCENT_THRESHOLD', value: 50 },
                    effectPayload: { costWhenConditionMet: 0 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playerStatusText = { setText: vi.fn() };
        scene.enemyStatusText = { setText: vi.fn() };
        scene.playerBreakpointText = {
            setText: vi.fn(),
            setColor: vi.fn(),
            setAlpha: vi.fn(),
        };
        scene.playPanelPulseMotion = vi.fn();

        (BattleScene.prototype as unknown as {
            syncPlayerBreakpointState: () => void;
        }).syncPlayerBreakpointState.call(scene);
        (BattleScene.prototype as unknown as {
            updateStatusDisplays: () => void;
        }).updateStatusDisplays.call(scene);

        expect(scene.battleLogLines).toContain('Bloodied');
        expect(scene.battleLogLines).toContain('Bloodrush cost 0');
        expect(scene.playerStatusText.setText).toHaveBeenCalledWith('BLOODIED');
        expect(scene.playerBreakpointText.setText).toHaveBeenCalledWith('BLOODIED');
    });

    it('does not spam repeated breakpoint reaction logs when the active hand state is unchanged', () => {
        const scene = createScene() as TestScene & {
            playerSelfDamageTotal: number;
            playerBreakpointState: 'stable' | 'bloodied' | 'desperation';
            appendBreakpointCardReactions: () => void;
        };
        scene.playerState = { health: 18, maxHealth: 40, block: 0 };
        scene.playerSelfDamageTotal = 4;
        scene.playerBreakpointState = 'stable';
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Bloodrush',
                    type: CARD_TYPE.ATTACK,
                    power: 20,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    condition: { type: 'HP_PERCENT_THRESHOLD', value: 50 },
                    effectPayload: { costWhenConditionMet: 0 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        (BattleScene.prototype as unknown as {
            syncPlayerBreakpointState: () => void;
        }).syncPlayerBreakpointState.call(scene);
        (BattleScene.prototype as unknown as {
            appendBreakpointCardReactions: () => void;
        }).appendBreakpointCardReactions.call(scene);

        expect(scene.battleLogLines.filter((line) => line === 'Bloodrush cost 0')).toHaveLength(1);
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

        scene.energyState = { current: 2, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Death Wish',
                    type: CARD_TYPE.ATTACK,
                    power: 0,
                    cost: 2,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    keywords: [CARD_KEYWORD.RETAIN],
                    effectPayload: {
                        scaling: { source: 'MISSING_HEALTH', multiplier: 1.5 },
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerState.health).toBe(96);
        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.enemyState.health).toBe(33);
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

    it('describes Shockwave as current-target damage in the card detail panel', () => {
        const scene = createScene();
        const shockwave = createCard({
            name: 'Shockwave',
            type: CARD_TYPE.ATTACK,
            power: 8,
            cost: 2,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
            archetype: 'NEUTRAL',
        });

        scene.showCardDetail(shockwave);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Deal 8 damage to the current enemy.'),
        );
    });

    it('shows current cost and condition status for cost-discount cards in the detail panel', () => {
        const scene = createScene();
        const lastStand = createCard({
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 40,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            keywords: [CARD_KEYWORD.EXHAUST],
            rarity: CARD_RARITY.RARE,
            archetype: 'BLOOD_OATH',
            condition: { type: 'HP_PERCENT_THRESHOLD', value: 25 },
            effectPayload: {
                costWhenConditionMet: 0,
                healOnKillPercent: 30,
            },
        });

        scene.playerState = { health: 60, maxHealth: 100, block: 0 };
        scene.showCardDetail(lastStand);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('ATTACK · RARE · Blood Oath · Cost 3'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Breakpoint locked: Desperation at 25%. HP 60% is above it.'),
        );

        scene.cardDetailBodyText?.setText.mockClear();
        scene.playerState = { health: 25, maxHealth: 100, block: 0 };
        scene.showCardDetail(lastStand);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('ATTACK · RARE · Blood Oath · Cost 0'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Breakpoint active: Desperation. HP 25% is at or below 25%.'),
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

    it('exhausts ETHEREAL cards that remain in hand at turn end', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        const dread = createCard({
            name: 'Dread',
            type: CARD_TYPE.CURSE,
            power: 0,
            cost: 0,
            keywords: [CARD_KEYWORD.UNPLAYABLE, CARD_KEYWORD.ETHEREAL],
            effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
        });
        scene.drawCycleState = {
            drawPile: [],
            hand: [dread],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onEndTurn();

        expect(scene.drawCycleState.hand).toHaveLength(0);
        expect(scene.drawCycleState.exhaustPile.map((card) => card.id)).toEqual([dread.id]);
        expect(scene.battleLogLines).toContain('Dread vanishes at turn end');
    });

    it('applies held curse self-damage at turn end and triggers Berserker Rage strength gain', () => {
        const scene = createScene();
        scene.enemyCardPool = [];
        scene.playerState = { health: 20, maxHealth: 20, block: 0 };
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };
        const hemorrhage = createCard({
            name: 'Hemorrhage',
            type: CARD_TYPE.CURSE,
            power: 0,
            cost: 0,
            keywords: [CARD_KEYWORD.UNPLAYABLE],
            effectType: CARD_EFFECT_TYPE.CONDITIONAL,
            selfDamage: 1,
        });
        scene.drawCycleState = {
            drawPile: [],
            hand: [hemorrhage],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onEndTurn();

        expect(scene.playerState.health).toBe(19);
        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.battleLogLines).toContain('Hemorrhage deals 1 self-damage in hand');
    });

    it('executes the revealed defend intent instead of choosing a random attack', () => {
        const scene = createScene();
        scene.playerState = { health: 20, maxHealth: 20, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
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
            undefined,
        );
    });

    it('renders the buff intent with the target stat and amount', () => {
        const scene = createScene();
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: 'attack',
            amount: 4,
            label: 'Battle Cry',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next RITUAL ⬆️ ATK +4');
        expect(scene.enemyIntentText?.setAlpha).toHaveBeenCalledWith(1);
    });

    it('annotates attack intent that would push the player into desperation', () => {
        const scene = createScene();
        scene.playerState = { health: 20, maxHealth: 40, block: 0 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 12,
            label: 'Enemy Strike 12',
            sourceCardId: 'enemy-strike-12',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next STRIKE ⚔️ 12 · Desperation');
    });

    it('renders defend intent as the next-turn block preview', () => {
        const scene = createScene();
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: 4,
            label: 'Enemy Guard 4',
            sourceCardId: 'enemy-guard-4',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next GUARD 🛡️ +4');
        expect(scene.enemyIntentText?.setAlpha).toHaveBeenCalledWith(1);
    });

    it('renders flurry intent with hit count and per-hit damage', () => {
        const scene = createScene();
        scene.playerState = { health: 40, maxHealth: 40, block: 0 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.FLURRY,
            damage: 9,
            hitCount: 3,
            damagePerHit: 3,
            label: 'Enemy Flurry 3',
            sourceCardId: 'enemy-flurry-3',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next FLURRY ⚔️ 3x3');
    });

    it('renders the active dread rule summary in the header', () => {
        const scene = new BattleScene() as unknown as {
            dreadRule?: TestScene['dreadRule'];
            dreadRuleText?: { setText: ReturnType<typeof vi.fn> };
        };
        scene.dreadRule = {
            id: DREAD_RULE_ID.BLOOD_MOON,
            name: 'Blood Moon',
            summary: 'First self-damage each turn grants +1 STR.',
            description: '매 턴 첫 self-damage 시 Strength +1.',
            effects: { firstSelfDamageStrength: 1 },
        };
        scene.dreadRuleText = { setText: vi.fn() };

        (BattleScene.prototype as unknown as {
            updateDreadRuleDisplay: () => void;
        }).updateDreadRuleDisplay.call(scene);

        expect(scene.dreadRuleText.setText).toHaveBeenCalledWith(
            'Rule: Blood Moon · First self-damage each turn grants +1 STR.',
        );
    });

    it('grants strength only on the first self-damage each turn through the battle action subscriber', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
        scene.turnNumber = 1;
        scene.dreadRule = {
            id: DREAD_RULE_ID.BLOOD_MOON,
            name: 'Blood Moon',
            summary: 'First self-damage each turn grants +1 STR.',
            description: '매 턴 첫 self-damage 시 Strength +1.',
            effects: { firstSelfDamageStrength: 1 },
        };
        scene.battleLogLines = [];
        scene.playPanelPulseMotion = vi.fn();

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: 'battle:local',
            turnNumber: 1,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 2,
            block: 0,
            statusDelta: [],
            queueIndex: 0,
        });
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: 'battle:local',
            turnNumber: 1,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 3,
            block: 0,
            statusDelta: [],
            queueIndex: 1,
        });

        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.battleLogLines).toContain('Blood Moon: +1 STR');
        expect(scene.playPanelPulseMotion).toHaveBeenCalledTimes(1);
    });

    it('ignores duplicate battle action events for the same queue index', () => {
        const scene = createScene();
        scene.turnNumber = 1;
        scene.playerState = { health: 48, maxHealth: 100, block: 0 };
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 1,
            poisonPerTurn: 0,
        };

        const duplicateEvent = {
            battleId: 'battle:local',
            turnNumber: 1,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 4,
            block: 0,
            statusDelta: [],
            queueIndex: 2,
        } as const;

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, duplicateEvent);
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, duplicateEvent);

        expect(scene.playerSelfDamageTotal).toBe(4);
        expect(scene.playerStatusEffects.strength).toBe(1);
        expect(scene.battleLogLines.filter((line) => line === 'Bloodied')).toHaveLength(1);
    });

    it('grants Berserker Rage strength from enemy damage through the battle action subscriber', () => {
        const scene = createScene();
        scene.turnNumber = 1;
        scene.playerState = { health: 40, maxHealth: 100, block: 0 };
        scene.playerOngoingBuffs = {
            blockPersist: false,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 2,
            poisonPerTurn: 0,
        };

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: 'battle:local',
            turnNumber: 1,
            actionType: CARD_EFFECT_TYPE.DAMAGE,
            sourceId: 'enemy-1',
            targetIds: ['player'],
            damage: 5,
            block: 0,
            statusDelta: [],
            queueIndex: 3,
        });

        expect(scene.playerStatusEffects.strength).toBe(2);
        expect(scene.battleLogLines).toContain('Bloodied');
    });

    it('hides even-turn intent previews under Blackout', () => {
        const scene = createScene();
        scene.turnNumber = 2;
        scene.dreadRule = {
            id: DREAD_RULE_ID.BLACKOUT,
            name: 'Blackout',
            summary: 'Even turns hide enemy intent.',
            description: '짝수 턴에는 적 intent가 숨겨진다.',
            effects: { hideEnemyIntentOnEvenTurns: true },
        };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 12,
            label: 'Enemy Strike',
            sourceCardId: 'enemy-strike',
        };

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next ???');
    });

    it('halves retained block under Thin Wall at turn start', () => {
        const scene = createScene();
        scene.playerState = { health: 40, maxHealth: 40, block: 11 };
        scene.dreadRule = {
            id: DREAD_RULE_ID.THIN_WALL,
            name: 'Thin Wall',
            summary: 'Retained Block is cut in half.',
            description: '턴 경계에 남는 Block은 절반만 유지된다.',
            effects: { blockRetainRatio: 0.5 },
        };
        scene.playerOngoingBuffs = {
            blockPersist: true,
            blockPersistCharges: 0,
            strengthOnSelfDamage: 0,
            poisonPerTurn: 0,
        };

        (BattleScene.prototype as unknown as {
            prepareTurnStartState: (actor: 'player' | 'enemy') => void;
        }).prepareTurnStartState.call(scene, 'player');

        expect(scene.playerState.block).toBe(5);
    });

    it('renders charge, curse, cleanse, and ambush previews in a multi-enemy encounter', () => {
        const scene = createScene();
        const chargeIntent: EnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            damage: 12,
            label: 'Charge Slam',
            warning: 'Next turn burst',
        };
        const curseIntent: EnemyIntent = {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.CURSE,
            label: 'Dread Hex',
            curseCardName: 'Dread',
            curseCount: 1,
        };
        const cleanseIntent: EnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.CLEANSE,
            block: 6,
            label: 'Purge Shell',
            cleansedStatuses: ['Poison'],
        };
        const ambushIntent: EnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            damage: 8,
            label: 'Shadow Lunge',
            warning: 'Hidden prep',
        };
        const enemies = [
            {
                ...scene.sceneData.enemy,
                id: 'enemy-1',
                label: 'Ash Crawler',
                archetypeId: 'ash-crawler' as const,
            },
            {
                ...scene.sceneData.enemy,
                id: 'enemy-2',
                label: 'Mire Broodling',
                archetypeId: 'mire-broodling' as const,
            },
            {
                ...scene.sceneData.enemy,
                id: 'enemy-3',
                label: 'Dread Sentinel',
                archetypeId: 'dread-sentinel' as const,
            },
            {
                ...scene.sceneData.enemy,
                id: 'enemy-4',
                label: 'Blade Raider',
                archetypeId: 'blade-raider' as const,
            },
        ];
        scene.sceneData = {
            ...scene.sceneData,
            enemy: enemies[0],
            enemyName: enemies[0].label,
            encounterEnemies: enemies,
        };
        scene.encounterEnemyStates = [
            {
                enemy: enemies[0],
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: chargeIntent,
                intentQueue: [chargeIntent],
            },
            {
                enemy: enemies[1],
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: curseIntent,
                intentQueue: [curseIntent],
            },
            {
                enemy: enemies[2],
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: cleanseIntent,
                intentQueue: [cleanseIntent],
            },
            {
                enemy: enemies[3],
                state: { health: 40, maxHealth: 40, block: 0 },
                currentIntent: ambushIntent,
                intentQueue: [ambushIntent],
            },
        ];

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith(
            'Ash Crawler: CHARGE ⏳ 12 · Next turn burst\n'
            + 'Mire Broodling: CURSE ☠️ Dread x1\n'
            + 'Dread Sentinel: CLEANSE ✨ +6 · clear Poison\n'
            + 'Blade Raider: AMBUSH 🕶️ 8 · Hidden prep',
        );
    });

    it('applies Panic Room self-damage from unspent energy at turn end', () => {
        const scene = createScene();
        scene.playerState = { health: 40, maxHealth: 40, block: 0 };
        scene.dreadRule = {
            id: DREAD_RULE_ID.PANIC_ROOM,
            name: 'Panic Room',
            summary: 'Unspent energy deals 1 self-damage each turn end.',
            description: '턴 종료 시 남은 에너지 1당 자해 1.',
            effects: { turnEndSelfDamagePerUnspentEnergy: 1 },
        };
        scene.battleLogLines = [];

        const applyDreadRuleTurnEndPenalty = (
            BattleScene.prototype as unknown as {
                applyDreadRuleTurnEndPenalty: (remainingEnergy: number) => boolean;
            }
        ).applyDreadRuleTurnEndPenalty;

        expect(applyDreadRuleTurnEndPenalty.call(scene, 2)).toBe(false);
        expect(scene.playerState.health).toBe(38);
        expect(scene.battleLogLines).toContain('Panic Room: 2 self-damage for 2 unspent energy');
    });

    it('keeps player poison stacks from decaying under Suffocating Fog', () => {
        const scene = createScene();
        scene.playerStatusEffects = {
            ...scene.playerStatusEffects,
            poison: 2,
        };
        scene.dreadRule = {
            id: DREAD_RULE_ID.SUFFOCATING_FOG,
            name: 'Suffocating Fog',
            summary: 'Poison does not decay at turn end.',
            description: 'Poison이 턴 종료에 감소하지 않는다.',
            effects: { poisonDoesNotDecay: true },
        };

        scene.resolveTurnEndStatusEffects('player');

        expect(scene.playerState.health).toBe(98);
        expect(scene.playerStatusEffects.poison).toBe(2);
    });

    it('does not reapply battle-start equipment when the first player turn begins', () => {
        const scene = createScene();
        const inventory = [
            { id: 'blood-treads', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
            { id: 'soulfire-brand', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentInventory = inventory;
        scene.equipmentConfig = getBattleEquipmentConfig(inventory as never);
        scene.drawCycleState = scene.drawCycleService.initialize([]);

        (BattleScene.prototype as unknown as {
            applyBattleStartEquipmentEffects: () => void;
        }).applyBattleStartEquipmentEffects.call(scene);
        (BattleScene.prototype as unknown as {
            startPlayerTurn: () => void;
        }).startPlayerTurn.call(scene);

        expect(scene.playerState.health).toBe(97);
        expect(scene.playerStatusEffects.strength).toBe(2);
    });

    it("limits Madman's Hood to cards captured in the opening hand snapshot on turn one only", () => {
        const scene = createScene();
        const openingStrike = createCard({
            name: 'Opening Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const laterStrike = createCard({
            name: 'Later Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const inventory = [
            { id: 'madmans-hood', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];

        scene.turnNumber = 1;
        scene.equipmentInventory = inventory;
        scene.equipmentConfig = getBattleEquipmentConfig(inventory as never);
        scene.openingHandCardIds = new Set([openingStrike.id]);

        const resolvePlayerCardModifier = (
            BattleScene.prototype as unknown as {
                resolvePlayerCardModifier: (card: ReturnType<typeof createCard>) => {
                    card: ReturnType<typeof createCard>;
                };
            }
        ).resolvePlayerCardModifier;

        expect(resolvePlayerCardModifier.call(scene, openingStrike).card.power).toBe(9);
        expect(resolvePlayerCardModifier.call(scene, laterStrike).card.power).toBe(6);

        scene.turnNumber = 2;

        expect(resolvePlayerCardModifier.call(scene, openingStrike).card.power).toBe(6);
    });

    it('applies equipped attack modifiers during card resolution', () => {
        const scene = createScene();
        scene.drawCycleState = scene.drawCycleService.initialize([
            createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 6,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ]);
        scene.drawCycleState = scene.drawCycleService.drawCards(scene.drawCycleState, 1);
        scene.equipmentInventory = [
            { id: 'blood-fang', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentConfig = getBattleEquipmentConfig(scene.equipmentInventory as never);

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(31);
        expect(scene.playerState.health).toBe(99);
    });

    it('keeps enemy poison stacks from decaying when the mask effect is active', () => {
        const scene = createScene();
        scene.enemyStatusEffects = {
            ...scene.enemyStatusEffects,
            poison: 3,
        };
        scene.equipmentInventory = [
            { id: 'plague-doctors-mask', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentConfig = getBattleEquipmentConfig(scene.equipmentInventory as never);

        scene.resolveTurnEndStatusEffects('enemy');

        expect(scene.enemyState.health).toBe(37);
        expect(scene.enemyStatusEffects.poison).toBe(3);
    });

    it('hides the enemy intent text when blindfold equipment is active', () => {
        const scene = createScene();
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            damage: 4,
            label: 'Enemy Strike',
            sourceCardId: 'enemy-strike',
        };
        scene.equipmentInventory = [
            { id: 'runic-blindfold', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentConfig = getBattleEquipmentConfig(scene.equipmentInventory as never);

        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('');
    });

    it('stores Soul Leech energy as a next-battle bonus instead of current-battle energy', () => {
        const scene = createScene();
        const inventory = [
            { id: 'soul-leech', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentInventory = inventory;
        scene.equipmentConfig = getBattleEquipmentConfig(inventory as never);
        scene.energyState = { current: 1, max: 3 };
        scene.enemyState = { health: 8, maxHealth: 40, block: 0 };
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

        expect(scene.energyState.current).toBe(0);
        expect(scene.nextBattleStartEnergyBonus).toBe(1);
        expect(scene.battleLogLines).toContain('Player stores 1 energy for the next battle');
        expect(scene.showBattleEnd).toHaveBeenCalledWith('player-win');
    });

    it('returns the battle result to MainScene and wakes it after battle end', () => {
        const scene = createScene();
        scene.turnNumber = 4;
        scene.totalPlayerDamage = 7;
        scene.totalEnemyDamage = 12;
        scene.battleResolution = 'victory';
        scene.nextBattleStartEnergyBonus = 1;

        BattleScene.prototype.endBattle.call(scene, 'player-win');

        expect(scene.onBattleEndCallback).toHaveBeenCalledWith({
            outcome: 'player-win',
            resolution: 'victory',
            totalRounds: 4,
            totalPlayerDamage: 7,
            totalEnemyDamage: 12,
            playerRemainingHealth: 100,
            enemyRemainingHealth: 40,
            nextBattleStartEnergyBonus: 1,
            enemy: scene.sceneData.enemy,
            enemies: [
                expect.objectContaining({
                    id: scene.sceneData.enemy.id,
                    stats: expect.objectContaining({
                        health: 40,
                        maxHealth: 40,
                    }),
                }),
            ],
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

    it('uses current-enemy wording for Shockwave action feedback', () => {
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
                    cardsDrawn: number;
                    energyGained: number;
                    healthRestored: number;
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
                        cardsDrawn: number;
                        energyGained: number;
                        healthRestored: number;
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
                    cardsDrawn: number;
                    energyGained: number;
                    healthRestored: number;
                },
            ) => void;
        }).showEffectText.call(
            scene,
            createCard({
                name: 'Shockwave',
                type: CARD_TYPE.ATTACK,
                power: 8,
                cost: 2,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
            {
                damageDealt: 8,
                damageBlocked: 0,
                blockGained: 0,
                fled: false,
                cardsDrawn: 0,
                energyGained: 0,
                healthRestored: 0,
            },
        );

        expect(scene.add.text).toHaveBeenCalledWith(
            292,
            188,
            'Shockwave: strike current enemy',
            expect.objectContaining({ fontSize: '14px' }),
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Shockwave: strike current enemy');
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

    it('keeps only the latest five battle history entries', () => {
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
        appendBattleLog.call(scene, 'Entry 5');
        appendBattleLog.call(scene, 'Entry 6');

        expect(scene.battleLogLines).toEqual(['Entry 2', 'Entry 3', 'Entry 4', 'Entry 5', 'Entry 6']);
    });

    it('queues breakpoint log updates until the battle log UI is recreated', () => {
        const staleBattleLogText = { setText: vi.fn() };
        const scene = new BattleScene() as unknown as {
            battleLogLines: string[];
            battleLogText?: { setText: ReturnType<typeof vi.fn> };
            isBattleLogReady: boolean;
            playerState: { health: number; maxHealth: number; block: number };
            playerStatusEffects: StatusEffectState;
            playerSelfDamageTotal: number;
            playerBreakpointState: 'stable' | 'bloodied' | 'desperation';
            activeBreakpointReactionKeys: Set<string>;
            playerStatusText?: { setText: ReturnType<typeof vi.fn> };
            playerBreakpointText?: {
                setText: ReturnType<typeof vi.fn>;
                setColor: ReturnType<typeof vi.fn>;
                setAlpha: ReturnType<typeof vi.fn>;
            };
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
            appendBreakpointCardReactions: ReturnType<typeof vi.fn>;
        };
        scene.battleLogLines = [];
        scene.battleLogText = staleBattleLogText;
        scene.isBattleLogReady = false;
        scene.playerState = { health: 40, maxHealth: 100, block: 0 };
        scene.playerStatusEffects = new StatusEffectService().createState();
        scene.playerSelfDamageTotal = 0;
        scene.playerBreakpointState = 'stable';
        scene.activeBreakpointReactionKeys = new Set();
        scene.playerStatusText = { setText: vi.fn() };
        scene.playerBreakpointText = {
            setText: vi.fn(),
            setColor: vi.fn(),
            setAlpha: vi.fn(),
        };
        scene.playPanelPulseMotion = vi.fn();
        scene.playPanelImpactMotion = vi.fn();
        scene.appendBreakpointCardReactions = vi.fn();

        (BattleScene.prototype as unknown as {
            syncPlayerBreakpointState: () => void;
        }).syncPlayerBreakpointState.call(scene);

        expect(scene.battleLogLines).toEqual(['Bloodied']);
        expect(staleBattleLogText.setText).not.toHaveBeenCalled();
    });

    it('repeats impact motion for multi-hit cards and mirrors self-damage on the player panel', () => {
        const scene = new BattleScene() as unknown as TestScene & {
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
        };
        scene.playPanelImpactMotion = vi.fn();
        const addEvent = vi.fn(({ callback }: { callback: () => void }) => {
            callback();
            return undefined;
        });
        scene.time = {
            addEvent,
            delayedCall(delayMs: number, callback: () => void) {
                return this.addEvent({ delay: delayMs, callback });
            },
        } as unknown as TestScene['time'];

        (BattleScene.prototype as unknown as {
            playResolvedActionMotion: (
                actor: 'player' | 'enemy',
                card: ReturnType<typeof createCard>,
                effect: {
                    damageDealt: number;
                    damageBlocked?: number;
                    blockGained: number;
                    fled: boolean;
                    selfDamageTaken?: number;
                    hitsResolved?: number;
                },
            ) => void;
        }).playResolvedActionMotion.call(
            scene,
            'player',
            createCard({
                name: 'Reckless Fury',
                type: CARD_TYPE.ATTACK,
                power: 3,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            }),
            {
                damageDealt: 12,
                damageBlocked: 0,
                blockGained: 0,
                fled: false,
                selfDamageTaken: 2,
                hitsResolved: 4,
            },
        );

        expect(scene.playPanelImpactMotion.mock.calls.map(([actor]) => actor)).toEqual([
            'player',
            'enemy',
            'enemy',
            'enemy',
            'enemy',
        ]);
        expect(addEvent).toHaveBeenCalledTimes(4);
        expect(addEvent.mock.calls.map(([config]) => config.delay)).toEqual([90, 180, 270, 360]);
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

    it('splits enemy flurry damage into repeated player-side popups', () => {
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
                hitDamages?: readonly number[],
            ) => void;
        }).showEnemyActionText.call(
            scene,
            createCard({
                name: 'Enemy Flurry',
                type: CARD_TYPE.ATTACK,
                power: 3,
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                hitCount: 3,
            }),
            9,
            0,
            0,
            [3, 3, 3],
        );

        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            1,
            { id: 'player-hp', x: 292, y: 248 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            2,
            { id: 'player-hp', x: 292, y: 248 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            3,
            { id: 'player-hp', x: 292, y: 248 },
            [{ type: 'damage', value: 3 }],
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Enemy Enemy Flurry: flurry');
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
