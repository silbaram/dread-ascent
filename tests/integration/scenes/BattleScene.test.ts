import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    CARD_EFFECT_TYPE,
    CARD_DISCARD_STRATEGY,
    CARD_INSCRIPTION_ID,
    CARD_INSCRIPTION_PAYOFF_TYPE,
    CARD_INSCRIPTION_PAYOFF_WINDOW,
    CARD_INSCRIPTION_TRIGGER,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TARGET_SCOPE,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../src/domain/entities/Card';
import { Enemy, type EnemyArchetypeId } from '../../../src/domain/entities/Enemy';
import {
    BATTLE_ACTION_SCRIPT_TYPE,
    CardEffectService,
} from '../../../src/domain/services/CardEffectService';
import { ITEM_ID } from '../../../src/domain/entities/Item';
import { CardBattleService } from '../../../src/domain/services/CardBattleService';
import { DrawCycleService } from '../../../src/domain/services/DrawCycleService';
import { EnergyService } from '../../../src/domain/services/EnergyService';
import { DREAD_RULE_ID } from '../../../src/domain/services/DreadRuleService';
import {
    ENEMY_INTENT_AMBUSH_REVEAL_RULE,
    ENEMY_INTENT_CHARGE_PHASE,
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
    type BattleHpChangedPayload,
    type BattleTargetKilledPayload,
} from '../../../src/scenes/events/BattleEventBus.ts';
import {
    CARD_CATALOG_ID,
    createCardFromCatalog,
} from '../../../src/domain/entities/CardCatalog';

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
    cardsDiscardedThisTurn?: number;
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
        scene.cardsDiscardedThisTurn = 0;
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

    function getActionResolvedPayloads(scene: TestScene): Array<{
        readonly actionType: string;
        readonly sourceId: string;
        readonly targetIds: readonly string[];
        readonly damage: number;
        readonly block: number;
    }> {
        return getBattleEvents(scene)
            .filter((event) => event.name === BATTLE_EVENT_NAME.ACTION_RESOLVED)
            .map((event) => event.payload as {
                readonly actionType: string;
                readonly sourceId: string;
                readonly targetIds: readonly string[];
                readonly damage: number;
                readonly block: number;
            });
    }

    function getHpChangesForActor(
        scene: TestScene,
        actorId: string,
    ): Array<Pick<BattleHpChangedPayload, 'previousHealth' | 'currentHealth'>> {
        return getBattleEvents(scene)
            .filter((event): event is BattleEventRecord<typeof BATTLE_EVENT_NAME.HP_CHANGED> =>
                event.name === BATTLE_EVENT_NAME.HP_CHANGED,
            )
            .map((event) => event.payload)
            .filter((payload) => payload.actorId === actorId)
            .map(({ previousHealth, currentHealth }) => ({
                previousHealth,
                currentHealth,
            }));
    }

    function getKillEventsForTarget(
        scene: TestScene,
        targetId: string,
    ): readonly BattleTargetKilledPayload[] {
        return getBattleEvents(scene)
            .filter((event): event is BattleEventRecord<typeof BATTLE_EVENT_NAME.TARGET_KILLED> =>
                event.name === BATTLE_EVENT_NAME.TARGET_KILLED,
            )
            .map((event) => event.payload)
            .filter((payload) => payload.targetId === targetId);
    }

    function createBladeRaiderCardPool(): ReturnType<typeof createCard>[] {
        return [
            createCard({
                id: 'blade-flurry',
                name: 'Blade Flurry 3',
                type: CARD_TYPE.ATTACK,
                power: 3,
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                hitCount: 3,
                effectPayload: { hitCount: 3 },
            }),
            createCard({
                id: 'blade-charge',
                name: 'Blade Charge 12',
                type: CARD_TYPE.ATTACK,
                power: 12,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
            createCard({
                id: 'blade-ambush',
                name: 'Blade Ambush 7',
                type: CARD_TYPE.ATTACK,
                power: 7,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            }),
        ];
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

        expect(getBattleEvents(scene).map((event) => event.name).slice(0, 3)).toEqual([
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
        expect(getBattleEvents(scene)).toEqual(expect.arrayContaining([
            {
                name: BATTLE_EVENT_NAME.DAMAGE_DEALT,
                payload: expect.objectContaining({
                    sourceId: 'player',
                    targetId: 'enemy-1',
                    amount: 7,
                }),
            },
            {
                name: BATTLE_EVENT_NAME.HP_CHANGED,
                payload: expect.objectContaining({
                    actorId: 'enemy-1',
                    previousHealth: 40,
                    currentHealth: 33,
                }),
            },
        ]));
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

    it('opens and consumes Exposed through a Shadow Arts inscription payoff', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
        };
        const weakStatus = {
            ...scene.statusEffectService.createState(),
            weak: 1,
        };
        const miasma = createCard({
            name: 'Miasma',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            statusEffect: { type: 'POISON', duration: 5 },
        });
        const exploitWeakness = createCard({
            id: 'exploit-weakness-test',
            name: 'Exploit Weakness',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.enemyState = { health: 30, maxHealth: 30, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 30, maxHealth: 30, block: 0 },
        }));
        scene.enemyStatusEffects = weakStatus;
        scene.drawCycleState = {
            drawPile: [],
            hand: [miasma, exploitWeakness],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playPanelPulseMotion = vi.fn();
        scene.playPanelImpactMotion = vi.fn();
        scene.showEffectText = (
            BattleScene.prototype as unknown as { showEffectText: TestScene['showEffectText'] }
        ).showEffectText;

        scene.onPlayCard(0);

        expect(scene.enemyStatusEffects).toMatchObject({ weak: 1, poison: 5 });
        expect(scene.battleLogLines).toContain('Enemy Exposed for Exploit Weakness');
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('enemy', 0xd6a3ff);
        const exposedStatusCalls = scene.enemyStatusText?.setText.mock.calls.map(([text]) => text) ?? [];
        expect(exposedStatusCalls.some((text) => String(text).includes('EXPOSED'))).toBe(true);

        scene.cardDetailBodyText?.setText.mockClear();
        scene.showCardDetail(exploitWeakness);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Exposed window: +8 finisher damage.'),
        );

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(14);
        expect(scene.battleLogLines).toContain('Exploit Weakness consumes Exposed +8');
        expect(scene.battleLogLines).toContain('Exploit Weakness: strike, Exposed +8');
        expect(scene.battleLogLines).toContain('Exploit Weakness finisher impact');
        expect(scene.playPanelImpactMotion).toHaveBeenCalledWith('enemy', 0xffd166);
        const finalStatusCall = scene.enemyStatusText?.setText.mock.calls.at(-1)?.[0] ?? '';
        expect(String(finalStatusCall)).not.toContain('EXPOSED');
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                actionType: CARD_EFFECT_TYPE.DAMAGE,
                sourceId: 'player',
                targetIds: ['enemy-1'],
                damage: 16,
            }),
        });
    });

    it('opens Exposed directly when Mark the Vein applies its debuff pair', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
        const markTheVein = createCard({
            name: 'Mark the Vein',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            statusEffects: [
                { type: 'VULNERABLE', duration: 1 },
                { type: 'WEAK', duration: 1 },
            ],
        });
        const exploitWeakness = createCard({
            id: 'mark-vein-exploit-test',
            name: 'Exploit Weakness',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [markTheVein, exploitWeakness],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playPanelPulseMotion = vi.fn();

        scene.onPlayCard(0);

        expect(scene.enemyStatusEffects).toMatchObject({ vulnerable: 1, weak: 1 });
        expect(scene.battleLogLines).toContain('Enemy Exposed for Exploit Weakness');
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('enemy', 0xd6a3ff);
    });

    it('does not apply Exposed to a target defeated by the exposing action', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
        const venomStrike = createCard({
            name: 'Venom Strike',
            type: CARD_TYPE.ATTACK,
            power: 4,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
            archetype: 'SHADOW_ARTS',
            statusEffect: { type: 'POISON', duration: 3 },
        });
        const exploitWeakness = createCard({
            id: 'dead-target-exploit-test',
            name: 'Exploit Weakness',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.enemyState = { health: 4, maxHealth: 4, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 4, maxHealth: 4, block: 0 },
        }));
        scene.enemyStatusEffects = {
            ...scene.statusEffectService.createState(),
            weak: 1,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [venomStrike, exploitWeakness],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playPanelPulseMotion = vi.fn();

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(0);
        expect(scene.battleLogLines).not.toContain('Enemy Exposed for Exploit Weakness');
        expect(scene.playPanelPulseMotion).not.toHaveBeenCalled();
        const statusCalls = scene.enemyStatusText?.setText.mock.calls.map(([text]) => String(text)) ?? [];
        expect(statusCalls.some((text) => text.includes('EXPOSED'))).toBe(false);
    });

    it('expires Exposed after the current turn elapses', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
        };
        const miasma = createCard({
            name: 'Miasma',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            statusEffect: { type: 'POISON', duration: 5 },
        });
        const exploitWeakness = createCard({
            id: 'expiring-exploit-test',
            name: 'Exploit Weakness',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        });
        scene.energyState = { current: 3, max: 3 };
        scene.enemyState = { health: 30, maxHealth: 30, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 30, maxHealth: 30, block: 0 },
        }));
        scene.enemyStatusEffects = {
            ...scene.statusEffectService.createState(),
            weak: 1,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [miasma, exploitWeakness],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playPanelPulseMotion = vi.fn();
        scene.playPanelImpactMotion = vi.fn();

        scene.onPlayCard(0);
        expect(scene.battleLogLines).toContain('Enemy Exposed for Exploit Weakness');

        scene.onEndTurn();
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [exploitWeakness],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        const exploitEffect = scene.showEffectText.mock.calls.at(-1)?.[1] as {
            damageDealt: number;
            inscriptionPayoff?: unknown;
        };
        expect(scene.battleLogLines).not.toContain('Exploit Weakness consumes Exposed +8');
        expect(exploitEffect.damageDealt).toBe(4);
        expect(exploitEffect.inscriptionPayoff).toBeUndefined();
        expect(scene.enemyState.health).toBe(21);
        expect(scene.playPanelImpactMotion).not.toHaveBeenCalledWith('enemy', 0xffd166);
    });

    it('opens and consumes an Iron Entrench block payoff through retained card reactions', () => {
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
        const brace = createCard({
            id: 'brace-entrench-test',
            name: 'Brace',
            type: CARD_TYPE.GUARD,
            power: 4,
            cost: 1,
            keywords: [CARD_KEYWORD.RETAIN],
            effectType: CARD_EFFECT_TYPE.BLOCK,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'IRON_WILL',
            inscription: {
                id: CARD_INSCRIPTION_ID.IRON_ENTRENCH,
                label: 'Iron Entrench',
                trigger: CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                    label: 'Entrenched',
                    amount: 3,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.NEXT_TURN,
                },
            },
        });
        scene.turnNumber = 1;
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [brace],
            discardPile: [],
            exhaustPile: [],
        };
        scene.playPanelPulseMotion = vi.fn();

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.RETAINED, {
            battleId: 'battle:test',
            turnNumber: 1,
            cardId: brace.id,
            cardName: brace.name,
            reason: 'turn-end',
        });

        expect(scene.battleLogLines).toContain('Brace opens Entrenched');
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('player', 0x6eb6ff);

        scene.cardDetailBodyText?.setText.mockClear();
        scene.showCardDetail(brace);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Entrenched window: +3 Block.'),
        );

        scene.onPlayCard(0);

        expect(scene.playerState.block).toBe(7);
        expect(scene.battleLogLines).toContain('Brace consumes Entrenched +3 Block');
        const braceEffect = scene.showEffectText.mock.calls.at(-1)?.[1] as {
            blockGained: number;
            inscriptionPayoff?: { readonly label: string; readonly amount: number };
        };
        expect(braceEffect.blockGained).toBe(7);
        expect(braceEffect.inscriptionPayoff).toMatchObject({
            label: 'Entrenched',
            amount: 3,
        });
    });

    it('expires retained block inscription payoffs after the next turn ends', () => {
        const scene = createScene();
        const brace = createCard({
            id: 'brace-expire-test',
            name: 'Brace',
            type: CARD_TYPE.GUARD,
            power: 4,
            cost: 1,
            keywords: [CARD_KEYWORD.RETAIN],
            effectType: CARD_EFFECT_TYPE.BLOCK,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'IRON_WILL',
            inscription: {
                id: CARD_INSCRIPTION_ID.IRON_ENTRENCH,
                label: 'Iron Entrench',
                trigger: CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                    label: 'Entrenched',
                    amount: 3,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.NEXT_TURN,
                },
            },
        });
        scene.turnNumber = 1;
        scene.drawCycleState = {
            drawPile: [],
            hand: [brace],
            discardPile: [],
            exhaustPile: [],
        };

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.RETAINED, {
            battleId: 'battle:test',
            turnNumber: 1,
            cardId: brace.id,
            cardName: brace.name,
            reason: 'turn-end',
        });

        scene.turnNumber = 2;
        scene.drawCycleState = {
            drawPile: [],
            hand: [],
            discardPile: [],
            exhaustPile: [],
        };
        scene.onEndTurn();
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [brace],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        const braceEffect = scene.showEffectText.mock.calls.at(-1)?.[1] as {
            blockGained: number;
            inscriptionPayoff?: unknown;
        };
        expect(braceEffect.blockGained).toBe(4);
        expect(braceEffect.inscriptionPayoff).toBeUndefined();
        expect(scene.playerState.block).toBe(4);
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

    it('resolves Shockwave across every living enemy in the encounter', () => {
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
        scene.energyState = { current: 3, max: 3 };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 6, maxHealth: 6, block: 0 };
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
                    targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.showBattleEnd).not.toHaveBeenCalled();
        expect(scene.sceneData.enemy.id).toBe('enemy-2');
        expect(scene.getEnemyActorId()).toBe('enemy-2');
        expect(scene.enemyState.health).toBe(4);
        expect(scene.totalEnemyDamage).toBe(14);
        expect(scene.energyState.current).toBe(1);
        expect(scene.getEncounterEnemyStateById('enemy-1')?.health).toBe(0);
        expect(scene.getEncounterEnemyStateById('enemy-2')?.health).toBe(4);

        const actionResolvedEvents = getBattleEvents(scene).filter((event) =>
            event.name === BATTLE_EVENT_NAME.ACTION_RESOLVED,
        );
        expect(actionResolvedEvents).toEqual([
            expect.objectContaining({
                name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
                payload: expect.objectContaining({
                    sourceId: 'player',
                    targetIds: ['enemy-1'],
                    damage: 6,
                }),
            }),
            expect.objectContaining({
                name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
                payload: expect.objectContaining({
                    sourceId: 'player',
                    targetIds: ['enemy-2'],
                    damage: 8,
                }),
            }),
        ]);
        expect(getBattleEvents(scene)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: BATTLE_EVENT_NAME.CARD_PLAYED,
                payload: expect.objectContaining({
                    targetIds: ['enemy-1', 'enemy-2'],
                }),
            }),
        ]));
    });

    it('emits Blood Price action script steps in self-damage then draw order', () => {
        const scene = createScene();
        const bloodPrice = createCard({
            name: 'Blood Price',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DRAW,
            effectPayload: {
                selfDamage: 4,
                drawCount: 2,
            },
        });
        scene.drawCycleState = {
            drawPile: [
                createCard({
                    name: 'Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
                createCard({
                    name: 'Fortify',
                    type: CARD_TYPE.GUARD,
                    power: 5,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                }),
            ],
            hand: [bloodPrice],
            discardPile: [],
            exhaustPile: [],
        };
        const stepSnapshots: Array<{
            readonly actionType: string;
            readonly playerHealth: number;
            readonly handCount: number;
        }> = [];
        scene.battleEventBus?.subscribe((event) => {
            if (event.name !== BATTLE_EVENT_NAME.ACTION_RESOLVED) {
                return;
            }

            stepSnapshots.push({
                actionType: event.payload.actionType,
                playerHealth: scene.playerState.health,
                handCount: scene.drawCycleState.hand.length,
            });
        });

        scene.onPlayCard(0);

        expect(getActionResolvedPayloads(scene).map((payload) => payload.actionType)).toEqual([
            'SELF_DAMAGE',
            BATTLE_ACTION_SCRIPT_TYPE.DRAW,
        ]);
        expect(getActionResolvedPayloads(scene).map((payload) => payload.damage)).toEqual([4, 0]);
        expect(getActionResolvedPayloads(scene).map((payload) => payload.targetIds)).toEqual([
            ['player'],
            ['player'],
        ]);
        expect(stepSnapshots).toEqual([
            { actionType: 'SELF_DAMAGE', playerHealth: 96, handCount: 0 },
            { actionType: BATTLE_ACTION_SCRIPT_TYPE.DRAW, playerHealth: 96, handCount: 2 },
        ]);
    });

    it('emits Reckless Fury damage once per resolved hit and stops after lethal damage', () => {
        const scene = createScene();
        const recklessFury = createCard({
            name: 'Reckless Fury',
            type: CARD_TYPE.ATTACK,
            power: 3,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            effectPayload: {
                selfDamage: 2,
                hitCount: 4,
            },
        });
        scene.enemyState = { health: 5, maxHealth: 5, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 5, maxHealth: 5, block: 0 },
        }));
        scene.drawCycleState = {
            drawPile: [],
            hand: [recklessFury],
            discardPile: [],
            exhaustPile: [],
        };
        const hitSnapshots: Array<{
            readonly damage: number;
            readonly enemyHealth: number;
        }> = [];
        scene.battleEventBus?.subscribe((event) => {
            if (
                event.name !== BATTLE_EVENT_NAME.ACTION_RESOLVED
                || event.payload.actionType !== CARD_EFFECT_TYPE.MULTI_HIT
            ) {
                return;
            }

            hitSnapshots.push({
                damage: event.payload.damage,
                enemyHealth: scene.enemyState.health,
            });
        });

        scene.onPlayCard(0);

        expect(getActionResolvedPayloads(scene).map((payload) => payload.actionType)).toEqual([
            'SELF_DAMAGE',
            CARD_EFFECT_TYPE.MULTI_HIT,
            CARD_EFFECT_TYPE.MULTI_HIT,
        ]);
        expect(getActionResolvedPayloads(scene).map((payload) => payload.damage)).toEqual([2, 3, 2]);
        expect(getHpChangesForActor(scene, 'enemy-1')).toEqual([
            { previousHealth: 5, currentHealth: 2 },
            { previousHealth: 2, currentHealth: 0 },
        ]);
        expect(getKillEventsForTarget(scene, 'enemy-1')).toHaveLength(1);
        expect(hitSnapshots).toEqual([
            { damage: 3, enemyHealth: 2 },
            { damage: 2, enemyHealth: 0 },
        ]);
    });

    it('emits Adrenaline Rush resource steps before its exhaust step', () => {
        const scene = createScene();
        const adrenalineRush = createCard({
            name: 'Adrenaline Rush',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 1,
            keywords: [CARD_KEYWORD.EXHAUST],
            effectType: CARD_EFFECT_TYPE.DRAW,
            effectPayload: {
                selfDamage: 5,
                drawCount: 3,
                energyChange: 3,
            },
        });
        scene.drawCycleState = {
            drawPile: [
                createCard({ name: 'Strike', type: CARD_TYPE.ATTACK, power: 6, effectType: CARD_EFFECT_TYPE.DAMAGE }),
                createCard({ name: 'Guard', type: CARD_TYPE.GUARD, power: 5, effectType: CARD_EFFECT_TYPE.BLOCK }),
                createCard({ name: 'Quick Draw', type: CARD_TYPE.SKILL, power: 0, effectType: CARD_EFFECT_TYPE.DRAW }),
            ],
            hand: [adrenalineRush],
            discardPile: [],
            exhaustPile: [],
        };
        const resourceSnapshots: Array<{
            readonly actionType: string;
            readonly playerHealth: number;
            readonly handCount: number;
            readonly energy: number;
            readonly exhaustCount: number;
        }> = [];
        scene.battleEventBus?.subscribe((event) => {
            if (event.name !== BATTLE_EVENT_NAME.ACTION_RESOLVED) {
                return;
            }

            resourceSnapshots.push({
                actionType: event.payload.actionType,
                playerHealth: scene.playerState.health,
                handCount: scene.drawCycleState.hand.length,
                energy: scene.energyState.current,
                exhaustCount: scene.drawCycleState.exhaustPile.length,
            });
        });

        scene.onPlayCard(0);

        expect(getActionResolvedPayloads(scene).map((payload) => payload.actionType)).toEqual([
            'SELF_DAMAGE',
            BATTLE_ACTION_SCRIPT_TYPE.DRAW,
            BATTLE_ACTION_SCRIPT_TYPE.GAIN_ENERGY,
            BATTLE_ACTION_SCRIPT_TYPE.EXHAUST,
        ]);
        expect(scene.energyState.current).toBe(5);
        expect(scene.drawCycleState.exhaustPile.map((card) => card.name)).toContain('Adrenaline Rush');
        expect(resourceSnapshots).toEqual([
            {
                actionType: 'SELF_DAMAGE',
                playerHealth: 95,
                handCount: 0,
                energy: 2,
                exhaustCount: 0,
            },
            {
                actionType: BATTLE_ACTION_SCRIPT_TYPE.DRAW,
                playerHealth: 95,
                handCount: 3,
                energy: 2,
                exhaustCount: 0,
            },
            {
                actionType: BATTLE_ACTION_SCRIPT_TYPE.GAIN_ENERGY,
                playerHealth: 95,
                handCount: 3,
                energy: 5,
                exhaustCount: 0,
            },
            {
                actionType: BATTLE_ACTION_SCRIPT_TYPE.EXHAUST,
                playerHealth: 95,
                handCount: 3,
                energy: 5,
                exhaustCount: 1,
            },
        ]);
    });

    it('safe-rejects unsupported action script steps without mutating combat state', () => {
        const scene = createScene();
        const signalJam = createCard({
            name: 'Signal Jam',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DRAW,
        });
        scene.drawCycleState = {
            drawPile: [
                createCard({
                    name: 'Strike',
                    type: CARD_TYPE.ATTACK,
                    power: 6,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                }),
            ],
            hand: [signalJam],
            discardPile: [],
            exhaustPile: [],
        };
        const playerBefore = { ...scene.playerState };
        const enemyBefore = { ...scene.enemyState };
        vi.spyOn(scene.cardEffectService, 'buildActionScript').mockReturnValue([
            { type: BATTLE_ACTION_SCRIPT_TYPE.DELAY, durationMs: 120 },
            { type: BATTLE_ACTION_SCRIPT_TYPE.VFX_CUE, cue: 'flash' },
            { type: BATTLE_ACTION_SCRIPT_TYPE.SFX_CUE, cue: 'strike' },
            { type: BATTLE_ACTION_SCRIPT_TYPE.DRAW, count: 1 },
        ]);

        scene.onPlayCard(0);

        expect(scene.playerState).toEqual(playerBefore);
        expect(scene.enemyState).toEqual(enemyBefore);
        expect(scene.showEffectText).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Signal Jam' }),
            expect.objectContaining({
                presentationLeadDelayMs: 120,
                presentationActions: [
                    { kind: 'freeze-frame', durationMs: 120, delayMs: 0 },
                    { kind: 'vfx-cue', cue: 'flash', delayMs: 120 },
                    { kind: 'sfx-cue', cue: 'strike', delayMs: 120 },
                ],
            }),
        );
        expect(getActionResolvedPayloads(scene)).toEqual([
            expect.objectContaining({
                actionType: BATTLE_ACTION_SCRIPT_TYPE.DRAW,
                sourceId: 'player',
                targetIds: ['player'],
                damage: 0,
            }),
        ]);
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                actionType: BATTLE_ACTION_SCRIPT_TYPE.DRAW,
                queueIndex: 0,
            }),
        });
        expect(scene.drawCycleState.hand.map((card) => card.name)).toEqual(['Strike']);
    });

    it('applies attached damage-card statuses to every AoE target in order', () => {
        const scene = createScene();
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 4,
                maxHealth: 4,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 9,
                maxHealth: 9,
            },
        };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 4, maxHealth: 4, block: 0 } },
            { enemy: supportEnemy, state: { health: 9, maxHealth: 9, block: 0 } },
        ];
        scene.enemyState = { health: 4, maxHealth: 4, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Venom Wave',
                    type: CARD_TYPE.ATTACK,
                    power: 4,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE,
                    statusEffect: { type: 'POISON', duration: 2 },
                    targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        const leadState = scene.encounterEnemyStates?.find((entry) => entry.enemy.id === 'enemy-1');
        const supportState = scene.encounterEnemyStates?.find((entry) => entry.enemy.id === 'enemy-2');
        expect(leadState?.state.health).toBe(0);
        expect(supportState?.state.health).toBe(5);
        expect(leadState?.statusEffects?.poison).toBe(2);
        expect(supportState?.statusEffects?.poison).toBe(2);
        expect(scene.enemyStatusEffects.poison).toBe(2);

        const actionResolvedEvents = getBattleEvents(scene).filter((event) =>
            event.name === BATTLE_EVENT_NAME.ACTION_RESOLVED,
        );
        expect(actionResolvedEvents).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetIds: ['enemy-1'],
                    damage: 4,
                    statusDelta: [],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetIds: ['enemy-2'],
                    damage: 4,
                    statusDelta: [],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetIds: ['enemy-1'],
                    damage: 0,
                    statusDelta: [{ targetId: 'enemy-1', statusType: 'POISON', value: 2 }],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetIds: ['enemy-2'],
                    damage: 0,
                    statusDelta: [{ targetId: 'enemy-2', statusType: 'POISON', value: 2 }],
                }),
            }),
        ]);
    });

    it('aggregates block gained and blocked damage across all AoE targets', () => {
        const scene = createScene();
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 20,
                maxHealth: 20,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 20,
                maxHealth: 20,
            },
        };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 20, maxHealth: 20, block: 3 } },
            { enemy: supportEnemy, state: { health: 20, maxHealth: 20, block: 2 } },
        ];
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 20, maxHealth: 20, block: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Guard Quake',
                    type: CARD_TYPE.ATTACK,
                    power: 8,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.DAMAGE_BLOCK,
                    targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
                    effectPayload: {
                        blockAmount: 3,
                    },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        const effectResult = scene.showEffectText.mock.calls[0]?.[1] as {
            damageBlocked: number;
            blockGained: number;
            targetResults?: readonly { damageBlocked: number }[];
        };
        expect(effectResult.damageBlocked).toBe(5);
        expect(effectResult.blockGained).toBe(6);
        expect(effectResult.targetResults?.map((result) => result.damageBlocked)).toEqual([3, 2]);
        expect(scene.playerState.block).toBe(6);
    });

    it('uses top-level targetScope when effectPayload contains a conflicting targetScope', () => {
        const scene = createScene();
        const leadEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-1',
            label: 'Ash Crawler',
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 20,
                maxHealth: 20,
            },
        };
        const supportEnemy = {
            ...scene.sceneData.enemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                health: 20,
                maxHealth: 20,
            },
        };
        const singleTargetCard = createCard({
            name: 'Focused Shock',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            targetScope: CARD_TARGET_SCOPE.CURRENT_ENEMY,
        });
        const conflictingCard = {
            ...singleTargetCard,
            effectPayload: {
                ...singleTargetCard.effectPayload,
                targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
            },
        } as ReturnType<typeof createCard>;
        scene.sceneData = {
            ...scene.sceneData,
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 20, maxHealth: 20, block: 0 } },
            { enemy: supportEnemy, state: { health: 20, maxHealth: 20, block: 0 } },
        ];
        scene.enemyState = { health: 20, maxHealth: 20, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [conflictingCard],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.getEncounterEnemyStateById('enemy-1')?.health).toBe(13);
        expect(scene.getEncounterEnemyStateById('enemy-2')?.health).toBe(20);
        expect(getBattleEvents(scene)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: BATTLE_EVENT_NAME.CARD_PLAYED,
                payload: expect.objectContaining({
                    targetIds: ['enemy-1'],
                }),
            }),
        ]));
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
        scene.energyState = { current: 2, max: 3 };
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
        expect(getActionResolvedPayloads(scene).map((payload) => payload.actionType)).toEqual([
            CARD_EFFECT_TYPE.DAMAGE,
            BATTLE_ACTION_SCRIPT_TYPE.EXHAUST,
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
        const scene = createScene() as TestScene & {
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
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
        scene.playPanelPulseMotion = vi.fn();

        scene.onPlayCard(0);

        expect(scene.battleLogLines).toContain('Bloodied');
        expect(scene.battleLogLines).toContain('Bloodrush cost 0');
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('player', 0xffb347);
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('player', 0x7ee787);
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
            [{ type: 'self_damage', value: 2 }],
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
        const scene = createScene() as TestScene & {
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
            playPanelPulseMotion: ReturnType<typeof vi.fn>;
        };
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
        scene.playPanelImpactMotion = vi.fn();
        scene.playPanelPulseMotion = vi.fn();

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(0);
        expect(scene.playerState.health).toBe(50);
        expect(scene.battleLogLines).toContain('Last Stand restores 30 HP on kill');
        expect(scene.battleLogLines).toContain('Last Stand finisher impact');
        expect(scene.playPanelImpactMotion).toHaveBeenCalledWith('enemy', 0xffd166);
        expect(scene.playPanelPulseMotion).toHaveBeenCalledWith('player', 0x66ffaa);
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

    it('uses Recycle selected discard strategy before drawing', () => {
        const scene = createScene() as TestScene & {
            queueDiscardSelection: (cardIds: readonly string[]) => void;
        };
        const recycle = createCard({
            name: 'Recycle',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DISCARD_EFFECT,
            effectPayload: {
                discardCount: 1,
                discardStrategy: CARD_DISCARD_STRATEGY.SELECTED,
            },
        });
        const cheapCard = createCard({
            name: 'Cheap Shot',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const expensiveCard = createCard({
            name: 'Heavy Strike',
            type: CARD_TYPE.ATTACK,
            power: 12,
            cost: 2,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });

        scene.drawCycleState = {
            drawPile: [],
            hand: [recycle, cheapCard, expensiveCard],
            discardPile: [],
            exhaustPile: [],
        };

        scene.queueDiscardSelection([cheapCard.id]);
        scene.onPlayCard(0);

        expect(scene.cardsDiscardedThisTurn).toBe(1);
        expect(scene.drawCycleState.hand.map((card) => card.name)).toEqual(['Heavy Strike']);
        expect(scene.drawCycleState.discardPile.map((card) => card.name)).toEqual(['Recycle', 'Cheap Shot']);
    });

    it('boosts Cheap Shot after a Smuggler discard setup this turn', () => {
        const scene = createScene();
        const cheapShot = createCard({
            name: 'Cheap Shot',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            condition: { type: 'TARGET_DEBUFF_COUNT_AT_LEAST', value: 1 },
            effectPayload: {
                costWhenConditionMet: 0,
                scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 3, baseValue: 7 },
            },
        });
        scene.energyState = { current: 0, max: 3 };
        scene.enemyStatusEffects = {
            ...scene.enemyStatusEffects,
            poison: 1,
        };
        scene.cardsDiscardedThisTurn = 1;
        scene.drawCycleState = {
            drawPile: [],
            hand: [cheapShot],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(29);
    });

    it('upgrades Shadow Step to Perfect Vanish after Recycle discards a card', () => {
        const scene = createScene() as TestScene & {
            perfectVanishRequested?: boolean;
            queueDiscardSelection: (cardIds: readonly string[]) => void;
        };
        const recycle = createCard({
            name: 'Recycle',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DISCARD_EFFECT,
            effectPayload: {
                discardCount: 1,
                discardStrategy: CARD_DISCARD_STRATEGY.SELECTED,
            },
        });
        const heavyStrike = createCard({
            name: 'Heavy Strike',
            type: CARD_TYPE.ATTACK,
            power: 12,
            cost: 2,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        const shadowStep = createCard({
            id: 'shadow-step-discard-test',
            name: 'Shadow Step',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.FLEE,
            keywords: [CARD_KEYWORD.EXHAUST],
            rarity: CARD_RARITY.RARE,
            effectPayload: { perfectVanishAfterDiscard: true },
        });
        scene.drawCycleState = {
            drawPile: [],
            hand: [recycle, heavyStrike, shadowStep],
            discardPile: [],
            exhaustPile: [],
        };

        scene.queueDiscardSelection([heavyStrike.id]);
        scene.onPlayCard(0);
        scene.onPlayCard(0);

        expect(scene.perfectVanishRequested).toBe(true);
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ESCAPE_ATTEMPT,
            payload: expect.objectContaining({
                cardId: 'shadow-step-discard-test',
                perfectVanish: true,
            }),
        });
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

    it('marks Backdoor Exit as a perfect vanish escape attempt', () => {
        const scene = createScene() as TestScene & {
            perfectVanishRequested?: boolean;
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    id: 'backdoor-exit-test',
                    name: 'Backdoor Exit',
                    type: CARD_TYPE.SKILL,
                    power: 0,
                    cost: 0,
                    effectType: CARD_EFFECT_TYPE.FLEE,
                    keywords: [CARD_KEYWORD.EXHAUST],
                    rarity: CARD_RARITY.RARE,
                    effectPayload: { perfectVanish: true },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.perfectVanishRequested).toBe(true);
        expect(getActionResolvedPayloads(scene).map((payload) => payload.actionType)).toEqual([
            CARD_EFFECT_TYPE.FLEE,
            BATTLE_ACTION_SCRIPT_TYPE.EXHAUST,
        ]);
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ESCAPE_ATTEMPT,
            payload: expect.objectContaining({
                cardId: 'backdoor-exit-test',
                perfectVanish: true,
            }),
        });
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
            'Ash Crawler: STRIKE ⚔️ 4 · -4 HP\nBlade Raider: GUARD 🛡️ +3',
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

    it('lets Counter Strike use prepared block against a revealed attack intent', () => {
        const scene = createScene();
        const counterStrike = createCard({
            name: 'Counter Strike',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.CONDITIONAL,
            condition: { type: 'COUNTER_WINDOW_READY', value: 1 },
            effectPayload: {
                scaling: { source: 'COUNTER_WINDOW', multiplier: 1 },
            },
        });
        scene.playerState = { health: 100, maxHealth: 100, block: 5 };
        scene.playerDamageTakenWindow = 0;
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 8,
            label: 'Heavy Strike',
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [counterStrike],
            discardPile: [],
            exhaustPile: [],
        };
        scene.showEffectText = (
            BattleScene.prototype as unknown as { showEffectText: TestScene['showEffectText'] }
        ).showEffectText;

        scene.showCardDetail(counterStrike);
        scene.onPlayCard(0);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Condition active: guard can counter 5 incoming damage.'),
        );
        expect(scene.enemyState.health).toBe(35);
        expect(scene.battleLogLines).toContain('Counter Strike: counter 5');
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                sourceId: 'player',
                targetIds: ['enemy-1'],
                damage: 5,
            }),
        });
    });

    it('lets Brace prepare Counter Strike for the next revealed attack intent', () => {
        const scene = createScene();
        const counterStrike = createCard({
            name: 'Counter Strike',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.CONDITIONAL,
            condition: { type: 'COUNTER_WINDOW_READY', value: 1 },
            effectPayload: {
                scaling: { source: 'COUNTER_WINDOW', multiplier: 1 },
            },
        });
        scene.enemyCardPool = [];
        scene.energyState = { current: 3, max: 3 };
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

        scene.energyState = { current: 3, max: 3 };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 7,
            label: 'Heavy Strike',
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [counterStrike],
            discardPile: [],
            exhaustPile: [],
        };
        scene.showEffectText = (
            BattleScene.prototype as unknown as { showEffectText: TestScene['showEffectText'] }
        ).showEffectText;

        scene.onPlayCard(0);

        expect(scene.playerState.block).toBe(4);
        expect(scene.enemyState.health).toBe(36);
        expect(scene.battleLogLines).toContain('Counter Strike: counter 4');
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                sourceId: 'player',
                targetIds: ['enemy-1'],
                damage: 4,
            }),
        });
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

    it('bursts Poison immediately and amplifies remaining Poison when Toxic Burst is played', () => {
        const scene = createScene();
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
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

        expect(scene.enemyState.health).toBe(37);
        expect(scene.enemyStatusEffects.poison).toBe(6);
        expect(scene.battleLogLines).toContain('Enemy Poison bursts for 3');
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                actionType: 'POISON_BURST',
                sourceId: 'player',
                targetIds: ['enemy-1'],
                damage: 3,
                healthChanges: [{
                    targetId: 'enemy-1',
                    previousHealth: 40,
                    currentHealth: 37,
                }],
            }),
        });
    });

    it('uses Plague Finale as a Shadow Arts poison-burst finisher', () => {
        const scene = createScene();
        const plagueFinale = createCardFromCatalog(CARD_CATALOG_ID.PLAGUE_FINALE);
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 40, maxHealth: 40, block: 0 },
        }));
        scene.enemyStatusEffects = {
            ...scene.enemyStatusEffects,
            poison: 4,
            vulnerable: 1,
        };
        scene.drawCycleState = {
            drawPile: [],
            hand: [plagueFinale],
            discardPile: [],
            exhaustPile: [],
        };

        scene.showCardDetail(plagueFinale);
        scene.onPlayCard(0);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Trigger target Poison now, then set Poison to 3x.'),
        );
        expect(scene.enemyState.health).toBe(36);
        expect(scene.enemyStatusEffects.poison).toBe(12);
        expect(scene.battleLogLines).toContain('Enemy Poison bursts for 4');
        expect(scene.battleLogLines).toContain('Enemy Poison rises to 12');
    });

    it('uses Citadel Crush as an Iron Will block-scaling finisher', () => {
        const scene = createScene();
        const citadelCrush = createCardFromCatalog(CARD_CATALOG_ID.CITADEL_CRUSH);
        scene.playerState = { health: 100, maxHealth: 100, block: 12 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 40, maxHealth: 40, block: 0 },
        }));
        scene.drawCycleState = {
            drawPile: [],
            hand: [citadelCrush],
            discardPile: [],
            exhaustPile: [],
        };

        scene.showCardDetail(citadelCrush);
        scene.onPlayCard(0);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Gains +1.5 damage per current Block.'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Current resolution: 26 damage.'),
        );
        expect(scene.enemyState.health).toBe(14);
        const citadelEffect = scene.showEffectText.mock.calls.at(-1)?.[1] as {
            damageDealt: number;
        };
        expect(citadelEffect.damageDealt).toBe(26);
    });

    it('uses Loaded Dice as a Smuggler discard-scaling finisher', () => {
        const scene = createScene();
        const loadedDice = createCardFromCatalog(CARD_CATALOG_ID.LOADED_DICE);
        scene.cardsDiscardedThisTurn = 2;
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 40, maxHealth: 40, block: 0 },
        }));
        scene.drawCycleState = {
            drawPile: [],
            hand: [loadedDice],
            discardPile: [],
            exhaustPile: [],
        };

        scene.showCardDetail(loadedDice);
        scene.onPlayCard(0);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Gains +5 damage per card discarded this turn.'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Current resolution: 20 damage.'),
        );
        expect(scene.enemyState.health).toBe(20);
        const loadedDiceEffect = scene.showEffectText.mock.calls.at(-1)?.[1] as {
            damageDealt: number;
        };
        expect(loadedDiceEffect.damageDealt).toBe(20);
    });

    it('routes Toxic Burst poison kills through enemy defeat rewards', () => {
        const scene = createScene();
        const inventory = [
            { id: 'soul-leech', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];
        scene.equipmentInventory = inventory;
        scene.equipmentConfig = getBattleEquipmentConfig(inventory as never);
        scene.enemyState = { health: 3, maxHealth: 40, block: 0 };
        scene.encounterEnemyStates = scene.encounterEnemyStates?.map((entry) => ({
            ...entry,
            state: { health: 3, maxHealth: 40, block: 0 },
        }));
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

        expect(scene.enemyState.health).toBe(0);
        expect(scene.nextBattleStartEnergyBonus).toBe(1);
        expect(scene.battleLogLines).toContain('Player stores 1 energy for the next battle');
        expect(scene.showBattleEnd).toHaveBeenCalledWith('player-win');
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

    it('lets Reinforce thorns retaliate when the enemy attacks', () => {
        const scene = createScene();
        const enemyStrike = createCard({
            id: 'enemy-heavy-strike-7',
            name: 'Enemy Heavy Strike',
            type: CARD_TYPE.ATTACK,
            power: 7,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        scene.enemyCardPool = [enemyStrike];
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 7,
            label: 'Enemy Heavy Strike',
            sourceCardId: enemyStrike.id,
        };
        scene.playerState = { health: 100, maxHealth: 100, block: 0 };
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [
                createCard({
                    name: 'Reinforce',
                    type: CARD_TYPE.GUARD,
                    power: 5,
                    cost: 1,
                    effectType: CARD_EFFECT_TYPE.BLOCK,
                    buff: { type: 'THORNS', value: 2, duration: 2, target: 'SELF' },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);
        scene.onEndTurn();

        expect(scene.playerState.health).toBe(98);
        expect(scene.enemyState.health).toBe(38);
        expect(scene.playerStatusEffects.thorns).toBe(2);
        expect(scene.battleLogLines).toContain('Enemy takes 2 thorns from Player');
        expect(getActionResolvedPayloads(scene)).toContainEqual(expect.objectContaining({
            actionType: 'STATUS_THORNS',
            sourceId: 'player',
            targetIds: ['enemy-1'],
            damage: 2,
        }));
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

    it('chains Blood Moon and Berserker Rage from the same self-damage event through the registry', () => {
        const scene = createScene();
        scene.turnNumber = 1;
        scene.energyState = { current: 3, max: 3 };
        scene.dreadRule = {
            id: DREAD_RULE_ID.BLOOD_MOON,
            name: 'Blood Moon',
            summary: 'First self-damage each turn grants +1 STR.',
            description: '매 턴 첫 self-damage 시 Strength +1.',
            effects: { firstSelfDamageStrength: 1 },
        };
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
                    effectPayload: { drawCount: 2, selfDamage: 4 },
                }),
            ],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.playerState.health).toBe(96);
        expect(scene.playerSelfDamageTotal).toBe(4);
        expect(scene.playerStatusEffects.strength).toBe(2);
        expect(scene.battleLogLines).toContain('Blood Moon: +1 STR');
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
            expect.arrayContaining([expect.objectContaining({ type: 'self_damage', value: 4 })]),
        );
        expect(
            scene.damagePopupController.showBatch.mock.calls.filter(
                ([anchor, requests]) => anchor.id === 'player-hp'
                    && requests.some((request: { type: string; value: number }) => (
                        request.type === 'self_damage'
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
            playCrisisOverlayMotion: ReturnType<typeof vi.fn>;
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
        scene.playCrisisOverlayMotion = vi.fn();

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
        expect(scene.playCrisisOverlayMotion).toHaveBeenCalledWith('bloodied');
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

    it('keeps Toxic Burst poison payoff visible in the battle log', () => {
        const scene = createScene();
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
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

        expect(scene.enemyState.health).toBe(37);
        expect(scene.enemyStatusEffects.poison).toBe(6);
        expect(scene.battleLogLines).toContain('Enemy Poison bursts for 3');
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
        expect(scene.enemyState.health).toBe(27);
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
            expect.stringContaining('Trigger target Poison now, then set Poison to 2x.'),
        );
    });

    it('explains Shadow Arts target debuff scaling in the card detail panel', () => {
        const scene = createScene();
        const exploitWeakness = createCard({
            name: 'Exploit Weakness',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        });

        scene.showCardDetail(exploitWeakness);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Gains +4 damage per target debuff.'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Inscription: opens Exposed at 2 target debuffs.'),
        );
    });

    it('explains Smuggler selected discard and discard-scaling payoff in the card detail panel', () => {
        const scene = createScene();
        const recycle = createCard({
            name: 'Recycle',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DISCARD_EFFECT,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SMUGGLER',
            effectPayload: {
                discardCount: 1,
                discardStrategy: CARD_DISCARD_STRATEGY.SELECTED,
                drawCount: 2,
            },
        });
        const cheapShot = createCard({
            name: 'Cheap Shot',
            type: CARD_TYPE.ATTACK,
            power: 7,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'SMUGGLER',
            effectPayload: {
                scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 3, baseValue: 7 },
            },
        });

        scene.showCardDetail(recycle);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Choose a card in hand to discard'),
        );

        scene.cardDetailBodyText?.setText.mockClear();
        scene.showCardDetail(cheapShot);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Gains +3 damage per card discarded this turn.'),
        );
    });

    it('describes Brace and Barricade block persistence separately in the card detail panel', () => {
        const scene = createScene();
        const brace = createCard({
            name: 'Brace',
            type: CARD_TYPE.GUARD,
            power: 4,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.BLOCK,
            rarity: CARD_RARITY.UNCOMMON,
            archetype: 'IRON_WILL',
            buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
        });
        const barricade = createCard({
            name: 'Barricade',
            type: CARD_TYPE.POWER,
            power: 0,
            cost: 3,
            effectType: CARD_EFFECT_TYPE.BUFF,
            rarity: CARD_RARITY.RARE,
            archetype: 'IRON_WILL',
            buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
        });

        scene.showCardDetail(brace);
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Gain 4 block. Keep Block through the next turn once.'),
        );

        scene.showCardDetail(barricade);
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Retain Block between turns for the rest of combat.'),
        );
    });

    it('describes Shockwave as AoE damage in the card detail panel', () => {
        const scene = createScene();
        const shockwave = createCard({
            name: 'Shockwave',
            type: CARD_TYPE.ATTACK,
            power: 8,
            cost: 2,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
            archetype: 'NEUTRAL',
            targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
        });

        scene.showCardDetail(shockwave);

        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Deal 8 damage to all living enemies.'),
        );
        expect(scene.cardDetailBodyText?.setText).toHaveBeenCalledWith(
            expect.stringContaining('Current resolution: 8 total damage across 1 living enemies.'),
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

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next STRIKE ⚔️ 12 · -12 HP · Desperation');
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

        expect(scene.enemyIntentText?.setText).toHaveBeenCalledWith('Next FLURRY ⚔️ 3x3 · -9 HP');
    });

    it('renders a two-turn timeline preview without consuming the queued future intent', () => {
        const scene = createScene();
        const bladeEnemy = {
            ...scene.sceneData.enemy,
            id: 'blade-1',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
            stats: {
                ...scene.sceneData.enemy.stats,
                attack: 7,
            },
        };
        const cardPool = createBladeRaiderCardPool();
        scene.sceneData = {
            ...scene.sceneData,
            enemy: bladeEnemy,
            enemyName: bladeEnemy.label,
            encounterEnemies: [bladeEnemy],
        };
        scene.encounterEnemyStates = [
            {
                enemy: bladeEnemy,
                state: { health: 40, maxHealth: 40, block: 0 },
                statusEffects: scene.statusEffectService.createState(),
                cardPool,
                intentQueue: [],
                currentIntent: undefined,
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
        scene.enemyCardPool = cardPool;
        scene.equipmentConfig = {
            ...getBattleEquipmentConfig([]),
            previewEnemyIntentCount: 2,
        };

        (scene as TestScene & {
            revealNextEnemyIntent: () => EnemyIntent | undefined;
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).revealNextEnemyIntent();
        (scene as TestScene & {
            updateEnemyIntentDisplay: (animated: boolean) => void;
        }).updateEnemyIntentDisplay(false);

        expect(scene.enemyIntentText?.setText).toHaveBeenLastCalledWith(
            'Next AMBUSH 🕶️ ~4 · Partial read\n'
            + 'Then CHARGE ⏳ 12 next turn · Burst next turn',
        );
        expect(scene.currentEnemyIntent).toMatchObject({
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            revealRule: ENEMY_INTENT_AMBUSH_REVEAL_RULE.PARTIAL,
            sourceCardId: 'blade-ambush',
        });
        expect((scene as TestScene & { enemyIntentQueue: EnemyIntent[] }).enemyIntentQueue[1]).toMatchObject({
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
            burstDamage: 12,
        });
    });

    it('executes a charge warning turn without damage before advancing to the burst intent', () => {
        const scene = createScene();
        const cardPool = createBladeRaiderCardPool();
        const enemy = {
            ...scene.sceneData.enemy,
            id: 'blade-1',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
        };
        const timelineEnemy = new Enemy(
            enemy.id,
            enemy.label,
            { ...enemy.position },
            { ...enemy.stats },
            enemy.experienceReward,
            enemy.kind,
            enemy.archetypeId,
            enemy.elite,
        );
        const service = new EnemyIntentService();
        service.decideNextIntent({ enemy: timelineEnemy, enemyCardPool: cardPool });
        const warningIntent = service.decideNextIntent({ enemy: timelineEnemy, enemyCardPool: cardPool });
        const burstIntent = service.decideNextIntent({ enemy: timelineEnemy, enemyCardPool: cardPool });
        scene.sceneData = {
            ...scene.sceneData,
            enemy,
            enemyName: enemy.label,
            encounterEnemies: [enemy],
        };
        scene.encounterEnemyStates = [
            {
                enemy,
                state: { health: 40, maxHealth: 40, block: 0 },
                statusEffects: scene.statusEffectService.createState(),
                cardPool,
                intentQueue: [warningIntent, burstIntent],
                currentIntent: warningIntent,
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
        scene.playerState = { health: 30, maxHealth: 30, block: 0 };
        scene.enemyCardPool = cardPool;
        scene.currentEnemyIntent = warningIntent;
        (scene as TestScene & { enemyIntentQueue: EnemyIntent[] }).enemyIntentQueue = [
            warningIntent,
            burstIntent,
        ];

        (scene as TestScene & {
            executeEnemyTurn: (onComplete?: () => void) => void;
        }).executeEnemyTurn(vi.fn());

        expect(scene.playerState.health).toBe(30);
        expect(getActionResolvedPayloads(scene)).toContainEqual(expect.objectContaining({
            actionType: ENEMY_INTENT_TYPE.ATTACK,
            sourceId: 'blade-1',
            targetIds: ['player'],
            damage: 0,
        }));
        expect(scene.showEnemyActionText).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Blade Charge 12' }),
            0,
            0,
            0,
        );
        expect(scene.currentEnemyIntent).toMatchObject({
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
            damage: 12,
            sourceCardId: 'blade-charge',
        });
    });

    it('makes Ash Cult ritual scaling visible in the reaction feed', () => {
        const scene = createScene();
        const ashEnemy = {
            ...scene.sceneData.enemy,
            label: 'Ash Crawler',
            archetypeId: 'ash-crawler' as const,
        };
        scene.sceneData = {
            ...scene.sceneData,
            enemy: ashEnemy,
            enemyName: ashEnemy.label,
            encounterEnemies: [ashEnemy],
        };
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: 'attack',
            amount: 2,
            label: 'Ash Ritual',
        };

        (scene as TestScene & {
            executeEnemyTurn: (onComplete?: () => void) => void;
        }).executeEnemyTurn(vi.fn());

        expect(scene.enemyAttackBuff).toBe(2);
        expect(scene.battleLogLines).toContain('Ash Ritual intensifies: +2 ATK');
    });

    it('applies Mire Brood poison and frail pressure from its venom strike', () => {
        const scene = createScene();
        const mireEnemy = {
            ...scene.sceneData.enemy,
            label: 'Mire Broodling',
            archetypeId: 'mire-broodling' as const,
        };
        const mireVenom = createCard({
            id: 'mire-venom',
            name: 'Mire Venom',
            type: CARD_TYPE.ATTACK,
            power: 4,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            statusEffects: [
                { type: 'POISON', duration: 3 },
                { type: 'FRAIL', duration: 1 },
            ],
        });
        scene.sceneData = {
            ...scene.sceneData,
            enemy: mireEnemy,
            enemyName: mireEnemy.label,
            encounterEnemies: [mireEnemy],
        };
        scene.playerState = { health: 30, maxHealth: 30, block: 0 };
        scene.enemyCardPool = [mireVenom];
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: 4,
            label: 'Mire Venom',
            sourceCardId: 'mire-venom',
        };

        (scene as TestScene & {
            executeEnemyTurn: (onComplete?: () => void) => void;
        }).executeEnemyTurn(vi.fn());

        expect(scene.playerState.health).toBe(26);
        expect(scene.playerStatusEffects.poison).toBe(3);
        expect(scene.playerStatusEffects.frail).toBe(1);
        expect(scene.battleLogLines).toEqual(expect.arrayContaining([
            'Player gains Poison 3',
            'Player gains Frail 1',
        ]));
    });

    it('lets Iron Warden thorn guard punish careless multi-hit attacks', () => {
        const scene = createScene();
        const sentinelEnemy = {
            ...scene.sceneData.enemy,
            label: 'Dread Sentinel',
            archetypeId: 'dread-sentinel' as const,
        };
        const thornGuard = createCard({
            id: 'sentinel-thorn-guard',
            name: 'Sentinel Thorn Guard',
            type: CARD_TYPE.GUARD,
            power: 5,
            effectType: CARD_EFFECT_TYPE.BLOCK,
            effectPayload: {
                buff: { type: 'THORNS', value: 2, duration: 2, target: 'SELF' },
            },
        });
        scene.sceneData = {
            ...scene.sceneData,
            enemy: sentinelEnemy,
            enemyName: sentinelEnemy.label,
            encounterEnemies: [sentinelEnemy],
        };
        scene.enemyCardPool = [thornGuard];
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: 5,
            label: 'Sentinel Thorn Guard',
            sourceCardId: 'sentinel-thorn-guard',
        };
        scene.encounterEnemyStates = [
            {
                enemy: sentinelEnemy,
                state: { health: 40, maxHealth: 40, block: 0 },
                statusEffects: scene.enemyStatusEffects,
                cardPool: [thornGuard],
                intentQueue: [scene.currentEnemyIntent],
                currentIntent: scene.currentEnemyIntent,
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

        (scene as TestScene & {
            executeEnemyTurn: (onComplete?: () => void) => void;
        }).executeEnemyTurn(vi.fn());

        expect(scene.enemyState.block).toBe(5);
        expect(scene.enemyStatusEffects.thorns).toBe(2);
        expect(scene.battleLogLines).toContain('Dread Sentinel gains Thorns 2');

        const recklessFlurry = createCard({
            id: 'reckless-flurry',
            name: 'Reckless Flurry',
            type: CARD_TYPE.ATTACK,
            power: 2,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            hitCount: 3,
            effectPayload: { hitCount: 3 },
        });
        scene.enemyState = { health: 40, maxHealth: 40, block: 0 };
        scene.playerState = { health: 30, maxHealth: 30, block: 0 };
        scene.drawCycleState = scene.drawCycleService.initialize([recklessFlurry]);
        scene.drawCycleState = scene.drawCycleService.drawCards(scene.drawCycleState, 1);

        scene.onPlayCard(0);

        expect(scene.playerState.health).toBe(24);
        expect(scene.battleLogLines).toContain('Player takes 2 thorns from Dread Sentinel');
        expect(getActionResolvedPayloads(scene)
            .filter((payload) => payload.actionType === 'STATUS_THORNS')
            .map((payload) => payload.damage)).toEqual([2, 2, 2]);
    });

    it('emits enemy flurry action script steps once per resolved hit', () => {
        const scene = createScene();
        const flurryCard = createCard({
            id: 'enemy-flurry-action-script',
            name: 'Enemy Flurry',
            type: CARD_TYPE.ATTACK,
            power: 2,
            effectType: CARD_EFFECT_TYPE.MULTI_HIT,
            effectPayload: { hitCount: 3 },
        });
        scene.playerState = { health: 5, maxHealth: 40, block: 0 };
        scene.enemyCardPool = [flurryCard];
        scene.currentEnemyIntent = {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.FLURRY,
            damage: 6,
            hitCount: 3,
            damagePerHit: 2,
            label: 'Enemy Flurry',
            sourceCardId: 'enemy-flurry-action-script',
        };

        scene.executeEnemyTurn();

        const enemyActions = getActionResolvedPayloads(scene)
            .filter((payload) => payload.sourceId === 'enemy-1');
        expect(enemyActions.map((payload) => payload.actionType)).toEqual([
            CARD_EFFECT_TYPE.MULTI_HIT,
            CARD_EFFECT_TYPE.MULTI_HIT,
            CARD_EFFECT_TYPE.MULTI_HIT,
        ]);
        expect(enemyActions.map((payload) => payload.damage)).toEqual([2, 2, 1]);
        expect(enemyActions.map((payload) => payload.targetIds)).toEqual([
            ['player'],
            ['player'],
            ['player'],
        ]);
        expect(getHpChangesForActor(scene, 'player')).toEqual([
            { previousHealth: 5, currentHealth: 3 },
            { previousHealth: 3, currentHealth: 1 },
            { previousHealth: 1, currentHealth: 0 },
        ]);
        expect(getKillEventsForTarget(scene, 'player')).toHaveLength(1);
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
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: player-self-damage (already resolved for this action)',
        );
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: player-health-loss (already resolved for this action)',
        );
    });

    it('resets once-per-turn reaction safety after a turn-start event', () => {
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
            damage: 2,
            block: 0,
            statusDelta: [],
            queueIndex: 1,
        });

        scene.turnNumber = 2;
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.TURN_STARTED, {
            battleId: 'battle:local',
            turnNumber: 2,
            energy: 3,
            drawCount: 0,
            handCount: 0,
            dreadRuleId: DREAD_RULE_ID.BLOOD_MOON,
        });
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: 'battle:local',
            turnNumber: 2,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 2,
            block: 0,
            statusDelta: [],
            queueIndex: 0,
        });

        expect(scene.playerStatusEffects.strength).toBe(2);
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: blood-moon:first-self-damage-strength (already resolved this turn)',
        );
        expect(scene.battleLogLines.filter((line) => line === 'Blood Moon: +1 STR')).toHaveLength(2);
    });

    it('resets once-per-turn reaction safety before turn-start self-damage resolves', () => {
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
        scene.equipmentConfig = {
            ...getBattleEquipmentConfig([]),
            turnStartSelfDamage: 2,
        };
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

        (BattleScene.prototype as unknown as {
            startPlayerTurn: () => void;
        }).startPlayerTurn.call(scene);
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: 'battle:local',
            turnNumber: 2,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 2,
            block: 0,
            statusDelta: [],
            queueIndex: 1,
        });

        expect(scene.playerStatusEffects.strength).toBe(2);
        expect(scene.battleLogLines).toContain('Blood Moon: +1 STR');
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: blood-moon:first-self-damage-strength (already resolved this turn)',
        );
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

    it('reflects Thorn Mail damage through the reaction registry and blocks duplicate queue events', () => {
        const scene = createScene();
        scene.turnNumber = 1;
        scene.equipmentInventory = [
            { id: 'thorn-mail', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];

        const damageTaken = {
            battleId: 'battle:local',
            turnNumber: 1,
            sourceId: 'enemy-1',
            targetId: 'player',
            amount: 5,
            actionType: CARD_EFFECT_TYPE.DAMAGE,
            queueIndex: 6,
        } as const;

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.DAMAGE_TAKEN, damageTaken);
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.DAMAGE_TAKEN, damageTaken);

        expect(scene.enemyState.health).toBe(38);
        expect(scene.battleLogLines).toContain('Enemy takes 2 thorns');
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: thorn-mail:reflect-damage (already resolved for this action)',
        );
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
            payload: expect.objectContaining({
                actionType: 'REACTION_THORNS',
                sourceId: 'thorn-mail',
                targetIds: ['enemy-1'],
                damage: 2,
                lineageId: expect.stringContaining('->reaction:thorn-mail:reflect-damage'),
            }),
        });
    });

    it('blocks reaction self-recursion when an incoming lineage already contains the same reaction id', () => {
        const scene = createScene();
        scene.turnNumber = 1;
        scene.equipmentInventory = [
            { id: 'thorn-mail', isEquipped: true, type: 'EQUIPMENT', equipment: {} },
        ];

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.DAMAGE_TAKEN, {
            battleId: 'battle:local',
            turnNumber: 1,
            sourceId: 'enemy-1',
            targetId: 'player',
            amount: 5,
            actionType: CARD_EFFECT_TYPE.DAMAGE,
            queueIndex: 7,
            lineageId: 'battle:local:1:7:DAMAGE:enemy-1:player->reaction:thorn-mail:reflect-damage',
        });

        expect(scene.enemyState.health).toBe(40);
        expect(scene.battleLogLines).toContain(
            'Reaction skipped: thorn-mail:reflect-damage (blocked self-recursion)',
        );
    });

    it('records Retain and Exhaust zone reactions in the safety lineage', () => {
        const scene = createScene() as TestScene & {
            reactionSafetyPolicy: {
                snapshotLineages: () => readonly Array<{ readonly reactionId: string; readonly sourceId: string }>;
            };
        };
        scene.turnNumber = 1;

        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.RETAINED, {
            battleId: 'battle:local',
            turnNumber: 1,
            cardId: 'retain-card',
            cardName: 'Hold Fast',
            reason: 'turn-end',
        });
        scene.battleEventBus?.emit(BATTLE_EVENT_NAME.EXHAUSTED, {
            battleId: 'battle:local',
            turnNumber: 1,
            cardId: 'exhaust-card',
            cardName: 'Quick Draw',
            reason: 'card-played',
        });

        expect(scene.reactionSafetyPolicy.snapshotLineages()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    reactionId: 'card-zone:retained',
                    sourceId: 'retain-card',
                }),
                expect.objectContaining({
                    reactionId: 'card-zone:exhausted',
                    sourceId: 'exhaust-card',
                }),
            ]),
        );
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

    it('boosts the final card in hand under Last Lantern', () => {
        const scene = createScene();
        const strike = createCard({
            id: 'last-lantern-strike',
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
        scene.turnNumber = 1;
        scene.dreadRule = {
            id: DREAD_RULE_ID.LAST_LANTERN,
            name: 'Last Lantern',
            summary: 'The last card each turn gains +4 power; Skills Exhaust.',
            description: '이번 턴 마지막 카드의 위력 +4. Skill이면 Exhaust.',
            effects: { lastCardPowerBonus: 4, lastSkillExhausts: true },
        };
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [strike],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.enemyState.health).toBe(30);
        expect(scene.battleLogLines).toContain('Last Lantern: Strike +4 power');
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.DREAD_RULE_TRIGGERED,
            payload: expect.objectContaining({
                ruleId: DREAD_RULE_ID.LAST_LANTERN,
                trigger: 'last-card-power',
                value: 4,
            }),
        });
    });

    it('exhausts final Skill cards under Last Lantern', () => {
        const scene = createScene();
        const quickDraw = createCard({
            id: 'last-lantern-skill',
            name: 'Quick Draw',
            type: CARD_TYPE.SKILL,
            power: 0,
            cost: 0,
            effectType: CARD_EFFECT_TYPE.DRAW,
            effectPayload: { drawCount: 1 },
        });
        scene.turnNumber = 1;
        scene.dreadRule = {
            id: DREAD_RULE_ID.LAST_LANTERN,
            name: 'Last Lantern',
            summary: 'The last card each turn gains +4 power; Skills Exhaust.',
            description: '이번 턴 마지막 카드의 위력 +4. Skill이면 Exhaust.',
            effects: { lastCardPowerBonus: 4, lastSkillExhausts: true },
        };
        scene.energyState = { current: 3, max: 3 };
        scene.drawCycleState = {
            drawPile: [],
            hand: [quickDraw],
            discardPile: [],
            exhaustPile: [],
        };

        scene.onPlayCard(0);

        expect(scene.drawCycleState.exhaustPile.map((card) => card.name)).toEqual(['Quick Draw']);
        expect(getBattleEvents(scene)).toContainEqual({
            name: BATTLE_EVENT_NAME.EXHAUSTED,
            payload: expect.objectContaining({
                cardId: 'last-lantern-skill',
                reason: 'card-played',
            }),
        });
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
            perfectVanish: false,
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

    it('uses AoE wording for Shockwave action feedback', () => {
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
                targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
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
            'Shockwave: strike all living enemies',
            expect.objectContaining({ fontSize: '14px' }),
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Shockwave: strike all living enemies');
    });

    it('uses Perfect Vanish wording for primed flee action feedback', () => {
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
                    selfDamageTaken: number;
                    hitsResolved: number;
                    perfectVanish: boolean;
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
                        selfDamageTaken: number;
                        hitsResolved: number;
                        perfectVanish: boolean;
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
                    selfDamageTaken: number;
                    hitsResolved: number;
                    perfectVanish: boolean;
                },
            ) => void;
        }).showEffectText.call(
            scene,
            createCard({
                name: 'Shadow Step',
                type: CARD_TYPE.SKILL,
                power: 0,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.FLEE,
            }),
            {
                damageDealt: 0,
                damageBlocked: 0,
                blockGained: 0,
                fled: true,
                cardsDrawn: 0,
                energyGained: 0,
                healthRestored: 0,
                selfDamageTaken: 0,
                hitsResolved: 0,
                perfectVanish: true,
            },
        );

        expect(scene.add.text).toHaveBeenCalledWith(
            292,
            188,
            'Shadow Step: perfect vanish',
            expect.objectContaining({ fontSize: '14px' }),
        );
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Shadow Step: perfect vanish');
    });

    it('queues multi-target Shockwave logs, popups, and impacts in target order', () => {
        const scene = new BattleScene() as unknown as {
            sceneData: TestScene['sceneData'];
            encounterEnemyStates: NonNullable<TestScene['encounterEnemyStates']>;
            damagePopupController: { showBatch: ReturnType<typeof vi.fn> };
            time: TestScene['time'];
            appendBattleLog: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
        };
        const baseEnemy = {
            id: 'enemy-1',
            label: 'Enemy',
            position: { x: 0, y: 0 },
            stats: {
                health: 12,
                maxHealth: 12,
                attack: 4,
                defense: 2,
            },
            experienceReward: 10,
            kind: 'normal' as const,
            archetypeId: 'ash-crawler' as const,
            elite: false,
        };
        const leadEnemy = {
            ...baseEnemy,
            label: 'Ash Crawler',
        };
        const supportEnemy = {
            ...baseEnemy,
            id: 'enemy-2',
            label: 'Blade Raider',
            archetypeId: 'blade-raider' as const,
        };
        const shockwave = createCard({
            name: 'Shockwave',
            type: CARD_TYPE.ATTACK,
            power: 8,
            cost: 2,
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
        });
        const effect = {
            damageDealt: 14,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            selfDamageTaken: 0,
            hitsResolved: 2,
            targetResults: [
                {
                    targetId: 'enemy-1',
                    targetLabel: 'Ash Crawler',
                    damageDealt: 6,
                    damageBlocked: 0,
                    hitDamages: [6],
                },
                {
                    targetId: 'enemy-2',
                    targetLabel: 'Blade Raider',
                    damageDealt: 8,
                    damageBlocked: 0,
                    hitDamages: [8],
                },
            ],
        };

        scene.sceneData = {
            enemy: leadEnemy,
            enemyName: leadEnemy.label,
            encounterEnemies: [leadEnemy, supportEnemy],
        };
        scene.encounterEnemyStates = [
            { enemy: leadEnemy, state: { health: 6, maxHealth: 6, block: 0 } },
            { enemy: supportEnemy, state: { health: 12, maxHealth: 12, block: 0 } },
        ];
        scene.damagePopupController = { showBatch: vi.fn() };
        scene.time = {
            delayedCall: vi.fn((_delayMs: number, callback: () => void) => {
                callback();
                return undefined;
            }),
        };
        scene.appendBattleLog = vi.fn();
        scene.playPanelImpactMotion = vi.fn();

        const feedbackDelayMs = (
            BattleScene.prototype as unknown as {
                showEffectText: (
                    card: ReturnType<typeof createCard>,
                    nextEffect: typeof effect,
                ) => number;
            }
        ).showEffectText.call(scene, shockwave, effect);

        expect(feedbackDelayMs).toBe(90);
        expect(scene.appendBattleLog.mock.calls.map(([message]) => message)).toEqual([
            'Shockwave: strike all living enemies',
            'Shockwave -> Ash Crawler: 6 damage',
            'Shockwave -> Blade Raider: 8 damage',
        ]);
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ id: 'enemy-hp:enemy-1' }),
            [{ type: 'damage', value: 6, label: 'Ash Crawler' }],
        );
        expect(scene.damagePopupController.showBatch).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ id: 'enemy-hp:enemy-2' }),
            [{ type: 'damage', value: 8, label: 'Blade Raider' }],
        );
        expect(scene.appendBattleLog.mock.invocationCallOrder[1])
            .toBeLessThan(scene.damagePopupController.showBatch.mock.invocationCallOrder[0]);
        expect(scene.damagePopupController.showBatch.mock.invocationCallOrder[0])
            .toBeLessThan(scene.appendBattleLog.mock.invocationCallOrder[2]);
        expect(scene.appendBattleLog.mock.invocationCallOrder[2])
            .toBeLessThan(scene.damagePopupController.showBatch.mock.invocationCallOrder[1]);
        expect(scene.time.delayedCall.mock.calls.map(([delayMs]) => delayMs)).toEqual([90, 90]);

        scene.time.delayedCall.mockClear();

        const motionDelayMs = (
            BattleScene.prototype as unknown as {
                playResolvedActionMotion: (
                    actor: 'player' | 'enemy',
                    card: ReturnType<typeof createCard>,
                    nextEffect: typeof effect,
                ) => number;
            }
        ).playResolvedActionMotion.call(scene, 'player', shockwave, effect);

        expect(motionDelayMs).toBe(90);
        expect(scene.playPanelImpactMotion).toHaveBeenCalledTimes(2);
        expect(scene.playPanelImpactMotion.mock.calls.map(([actor, color]) => [actor, color])).toEqual([
            ['enemy', 0xff8f8f],
            ['enemy', 0xff8f8f],
        ]);
        expect(scene.time.delayedCall.mock.calls.map(([delayMs]) => delayMs)).toEqual([90, 90, 90]);
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

    it('keeps only the latest eight battle history entries', () => {
        const scene = new BattleScene() as unknown as {
            battleLogLines: string[];
            battleLogText?: { setText: ReturnType<typeof vi.fn> };
            battleLogTitleText?: { setText: ReturnType<typeof vi.fn> };
            isBattleLogReady: boolean;
        };
        scene.battleLogLines = [];
        scene.battleLogText = { setText: vi.fn() };
        scene.battleLogTitleText = { setText: vi.fn() };
        scene.isBattleLogReady = true;

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
        appendBattleLog.call(scene, 'Entry 7');
        appendBattleLog.call(scene, 'Entry 8');
        appendBattleLog.call(scene, 'Entry 9');

        expect(scene.battleLogLines).toEqual([
            'Entry 2',
            'Entry 3',
            'Entry 4',
            'Entry 5',
            'Entry 6',
            'Entry 7',
            'Entry 8',
            'Entry 9',
        ]);
        expect(scene.battleLogText.setText).toHaveBeenLastCalledWith([
            'Entry 2',
            'Entry 3',
            'Entry 4',
            'Entry 5',
            'Entry 6',
            'Entry 7',
            'Entry 8',
            'Entry 9',
        ].join('\n'));
        expect(scene.battleLogTitleText.setText).toHaveBeenLastCalledWith('Reaction Feed · last 8');
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
            playFreezeFrame: ReturnType<typeof vi.fn>;
            playPanelFlashMotion: ReturnType<typeof vi.fn>;
            playPanelTwistMotion: ReturnType<typeof vi.fn>;
            playPanelStaggerMotion: ReturnType<typeof vi.fn>;
            playFinisherSlashOverlay: ReturnType<typeof vi.fn>;
        };
        scene.playPanelImpactMotion = vi.fn();
        scene.playFreezeFrame = vi.fn();
        scene.playPanelFlashMotion = vi.fn();
        scene.playPanelTwistMotion = vi.fn();
        scene.playPanelStaggerMotion = vi.fn();
        scene.playFinisherSlashOverlay = vi.fn();
        const delayedCall = vi.fn((_delayMs: number, callback: () => void) => {
            callback();
            return undefined;
        });
        scene.time = {
            delayedCall,
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
        expect(scene.playPanelTwistMotion).toHaveBeenCalledWith('player', 0xff8f8f);
        expect(scene.playFinisherSlashOverlay).toHaveBeenCalledWith('player', 0xff8f8f);
        expect(scene.playPanelFlashMotion.mock.calls.map(([actor]) => actor)).toEqual([
            'enemy',
            'enemy',
            'enemy',
            'enemy',
        ]);
        expect(scene.playPanelStaggerMotion.mock.calls.map(([actor]) => actor)).toEqual([
            'enemy',
            'enemy',
            'enemy',
            'enemy',
        ]);
        expect(scene.playFreezeFrame).toHaveBeenCalledTimes(4);
        expect(scene.playFreezeFrame.mock.calls.map(([durationMs]) => durationMs)).toEqual([45, 45, 45, 60]);
        expect(delayedCall).toHaveBeenCalledTimes(16);
        expect(delayedCall.mock.calls.map(([delayMs]) => delayMs)).toEqual([
            90, 90, 90, 90,
            180, 180, 180, 180,
            270, 270, 270, 270,
            360, 360, 360, 360,
        ]);
    });

    it('applies a freeze-frame and flash treatment to finisher impacts', () => {
        const scene = new BattleScene() as unknown as TestScene & {
            appendBattleLog: ReturnType<typeof vi.fn>;
            playFreezeFrame: ReturnType<typeof vi.fn>;
            playPanelFlashMotion: ReturnType<typeof vi.fn>;
            playPanelImpactMotion: ReturnType<typeof vi.fn>;
            playPanelStaggerMotion: ReturnType<typeof vi.fn>;
            playFinisherSlashOverlay: ReturnType<typeof vi.fn>;
            getPlayerBreakpointState: () => 'stable' | 'bloodied' | 'desperation';
        };
        scene.appendBattleLog = vi.fn();
        scene.playFreezeFrame = vi.fn();
        scene.playPanelFlashMotion = vi.fn();
        scene.playPanelImpactMotion = vi.fn();
        scene.playPanelStaggerMotion = vi.fn();
        scene.playFinisherSlashOverlay = vi.fn();
        scene.time = {
            delayedCall: vi.fn((_delayMs: number, callback: () => void) => {
                callback();
                return undefined;
            }),
        } as unknown as TestScene['time'];
        scene.getPlayerBreakpointState = () => 'desperation';

        const presentationDelayMs = (
            BattleScene.prototype as unknown as {
                playFinisherImpactTreatment: (
                    card: ReturnType<typeof createCard>,
                    effect: {
                        damageDealt: number;
                        inscriptionPayoff?: { type: typeof CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS };
                    },
                    defeatedEnemyIds: readonly string[],
                ) => number;
            }
        ).playFinisherImpactTreatment.call(
            scene,
            createCard({
                name: 'Last Stand',
                type: CARD_TYPE.ATTACK,
                power: 40,
                cost: 3,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                effectPayload: {
                    scaling: {
                        source: 'MISSING_HEALTH',
                        multiplier: 1,
                        baseValue: 0,
                    },
                },
            }),
            {
                damageDealt: 40,
            },
            ['enemy-1'],
        );

        expect(presentationDelayMs).toBe(140);
        expect(scene.appendBattleLog).toHaveBeenCalledWith('Last Stand finisher impact');
        expect(scene.playFreezeFrame).toHaveBeenCalledWith(140);
        expect(scene.playFinisherSlashOverlay).toHaveBeenCalledWith('enemy', 0xffd166);
        expect(scene.playPanelFlashMotion).toHaveBeenCalledWith('enemy', 0xffd166);
        expect(scene.playPanelImpactMotion).toHaveBeenCalledWith('enemy', 0xffd166);
        expect(scene.playPanelStaggerMotion).toHaveBeenCalledWith('enemy', 0xffd166);
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
            cardEffectService: CardEffectService;
            playerState: TestScene['playerState'];
            enemyState: TestScene['enemyState'];
            cardDetailTitleText: typeof titleText;
            cardDetailBodyText: typeof bodyText;
        };
        scene.playerPowerText = playerPowerText;
        scene.enemyPowerText = enemyPowerText;
        scene.cardEffectService = new CardEffectService();
        scene.playerState = { health: 40, maxHealth: 40, block: 0 };
        scene.enemyState = { health: 30, maxHealth: 30, block: 0 };
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
