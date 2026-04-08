// ---------------------------------------------------------------------------
// BattleScene — Cycle 3 카드 배틀 전용 Phaser Scene (TASK-031, TASK-033)
// ---------------------------------------------------------------------------

import 'phaser';
import type { Card, CardStatusEffect } from '../domain/entities/Card';
import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
} from '../domain/entities/Card';
import { checkCardCondition, resolveCardCost } from '../domain/entities/CardCatalog';
import { Enemy, type Enemy as EnemyEntity } from '../domain/entities/Enemy';
import { DEFAULT_MOVEMENT_SPEED } from '../domain/entities/CombatStats';
import type { InventoryItem } from '../domain/entities/Item';
import type { Player } from '../domain/entities/Player';
import { CardBattleService } from '../domain/services/CardBattleService';
import type { BattleOutcomeType } from '../domain/services/CardBattleLoopService';
import {
    applyEquipmentBonusToHand,
    getEquipmentCardBonus,
} from '../domain/services/EquipmentCardBonusService';
import {
    getBattleEquipmentConfig,
    getDamageTakenEquipmentBonus,
    getEnemyDefeatEquipmentReward,
    getHealthLossEquipmentBonus,
    getPlayerCardModifier,
    getTurnEndEquipmentBonus,
    rollTurnStartBonusEnergy,
    transformDeckForBattle,
    type EquipmentBattleConfig,
} from '../domain/services/EquipmentEffectService';
import type { ItemService } from '../domain/services/ItemService';
import type { DeckService } from '../domain/services/DeckService';
import {
    DrawCycleService,
    DEFAULT_HAND_SIZE,
    HAND_END_TURN_EFFECT_TYPE,
    type DrawCycleState,
    type HandEndTurnEffect,
} from '../domain/services/DrawCycleService';
import {
    CardEffectService,
    type CardEffectResult,
    type CombatantState,
} from '../domain/services/CardEffectService';
import { EnergyService, type EnergyState } from '../domain/services/EnergyService';
import {
    ENEMY_INTENT_PATTERN,
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
    type AttackIntent,
    type BuffIntent,
    type EnemyIntent,
    type EnemyIntentBuffStat,
    type EnemyIntentType,
} from '../domain/services/EnemyIntentService';
import {
    DreadRuleService,
    type DreadRuleDefinition,
} from '../domain/services/DreadRuleService';
import {
    STATUS_EFFECT_TYPE,
    STATUS_EVENT_TYPE,
    StatusEffectService,
    type StatusApplyEvent,
    type StatusEffectApplication,
    type StatusEffectEvent,
    type StatusEffectState,
} from '../domain/services/StatusEffectService';
import {
    DamagePopupController,
    type DamagePopupAnchor,
    type DamagePopupAnchorId,
    type DamagePopupRequest,
} from './effects/DamagePopup';
import {
    BattlePresentationFacade,
    type BattlePresentationAction,
} from './effects/BattlePresentationFacade';
import {
    BATTLE_EVENT_NAME,
    LEGACY_BATTLE_EVENT_NAME,
    createBattleEventBus,
    type BattleActionResolvedPayload,
    type BattleActionStatusDelta,
    type BattleEventBus,
} from './events/BattleEventBus.ts';
import { BATTLE_SCENE_LAYOUT } from './battleSceneLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** BattleScene에 전달되는 초기 데이터. */
export interface BattleSceneData {
    readonly player: Player;
    readonly enemy: EnemyEntity;
    readonly encounterEnemies?: readonly EnemyEntity[];
    readonly deckService: DeckService;
    readonly cardBattleService: CardBattleService;
    readonly itemService: ItemService;
    readonly enemyName: string;
    readonly floorNumber?: number;
    readonly startEnergyBonus?: number;
}

/** 배틀 종료 시 MainScene에 반환하는 결과. */
export type BattleSceneResolution = 'victory' | 'defeat' | 'escape';

export interface BattleSceneResult {
    readonly outcome: BattleOutcomeType;
    readonly resolution: BattleSceneResolution;
    readonly totalRounds: number;
    readonly totalPlayerDamage: number;
    readonly totalEnemyDamage: number;
    readonly playerRemainingHealth: number;
    readonly enemyRemainingHealth: number;
    readonly nextBattleStartEnergyBonus: number;
    readonly enemy: EnemyEntity;
    readonly enemies: readonly EnemyEntity[];
}

interface OngoingBattleBuffState {
    readonly blockPersist: boolean;
    readonly blockPersistCharges: number;
    readonly strengthOnSelfDamage: number;
    readonly poisonPerTurn: number;
}

interface HandLayoutMetrics {
    readonly startX: number;
    readonly stride: number;
    readonly scale: number;
}

interface QueuedPresentationSequence {
    readonly actions: readonly BattlePresentationAction[];
    readonly nextDelayMs: number;
}

interface EncounterEnemyState {
    readonly enemy: EnemyEntity;
    readonly state: CombatantState;
    readonly statusEffects?: StatusEffectState;
    readonly cardPool?: readonly Card[];
    readonly intentQueue?: readonly EnemyIntent[];
    readonly currentIntent?: EnemyIntent;
    readonly ongoingBuffs?: OngoingBattleBuffState;
    readonly attackBuff?: number;
    readonly attackDebuff?: number;
    readonly attackDebuffDuration?: number;
}

type PlayerBreakpointState = 'stable' | 'bloodied' | 'desperation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCENE_KEY = 'BattleScene';
const SCENE_WIDTH = 800;
const SCENE_HEIGHT = 600;
const SCENE_CENTER_X = SCENE_WIDTH / 2;
const MAIN_PANEL_PADDING_X = 32;
const SIDEBAR_GAP = 16;
const SIDEBAR_WIDTH = 200;
const MAIN_PANEL_WIDTH = SCENE_WIDTH - (MAIN_PANEL_PADDING_X * 2) - SIDEBAR_GAP - SIDEBAR_WIDTH;
const MAIN_PANEL_LEFT = MAIN_PANEL_PADDING_X;
const MAIN_PANEL_CENTER_X = MAIN_PANEL_LEFT + (MAIN_PANEL_WIDTH / 2);
const PANEL_CONTENT_PADDING = 16;
const CARD_WIDTH = 80;
const CARD_HEIGHT = 122;
const CARD_GAP = 10;
const CARD_MIN_GAP = 4;
const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 20;
const ENEMY_HP_BAR_Y = 78;
const PLAYER_HP_BAR_Y = 258;
const EFFECT_TEXT_Y = 188;
const HP_LOW_THRESHOLD = 0.3;
const CARD_PLAY_ANIM_MS = 300;
const CARD_SELECTION_MOTION_MS = 220;
const ACTION_QUEUE_STEP_MS = 90;
const ENEMY_TURN_DELAY_MS = 800;
const PANEL_IMPACT_MOTION_MS = 220;
const PANEL_PULSE_MOTION_MS = 260;
const CAMERA_IMPACT_SHAKE_DURATION_MS = 120;
const CAMERA_IMPACT_SHAKE_INTENSITY = 0.0025;
const ENEMY_PANEL_X = BATTLE_SCENE_LAYOUT.enemyPanel.x;
const ENEMY_PANEL_Y = BATTLE_SCENE_LAYOUT.enemyPanel.y;
const ENEMY_PANEL_WIDTH = BATTLE_SCENE_LAYOUT.enemyPanel.width;
const ENEMY_PANEL_HEIGHT = BATTLE_SCENE_LAYOUT.enemyPanel.height;
const ENEMY_POWER_PANEL_WIDTH = MAIN_PANEL_WIDTH - 116;
const PLAYER_PANEL_X = BATTLE_SCENE_LAYOUT.playerPanel.x;
const PLAYER_PANEL_Y = BATTLE_SCENE_LAYOUT.playerPanel.y;
const PLAYER_PANEL_WIDTH = BATTLE_SCENE_LAYOUT.playerPanel.width;
const PLAYER_PANEL_HEIGHT = BATTLE_SCENE_LAYOUT.playerPanel.height;
const PLAYER_POWER_PANEL_WIDTH = MAIN_PANEL_WIDTH - 116;
const HAND_PANEL_X = BATTLE_SCENE_LAYOUT.handPanel.x;
const HAND_PANEL_Y = BATTLE_SCENE_LAYOUT.handPanel.y;
const HAND_PANEL_WIDTH = BATTLE_SCENE_LAYOUT.handPanel.width;
const HAND_PANEL_HEIGHT = BATTLE_SCENE_LAYOUT.handPanel.height;
const HAND_CARD_LAYOUT_WIDTH = HAND_PANEL_WIDTH - 40;
const CARD_Y = BATTLE_SCENE_LAYOUT.cardRow.y;
const END_TURN_BUTTON_X = BATTLE_SCENE_LAYOUT.endTurnButton.x;
const END_TURN_BUTTON_Y = BATTLE_SCENE_LAYOUT.endTurnButton.y;
const LOG_PANEL_X = BATTLE_SCENE_LAYOUT.logPanel.x;
const LOG_PANEL_Y = BATTLE_SCENE_LAYOUT.logPanel.y;
const LOG_PANEL_WIDTH = BATTLE_SCENE_LAYOUT.logPanel.width;
const LOG_PANEL_HEIGHT = BATTLE_SCENE_LAYOUT.logPanel.height;
const LOG_PANEL_CONTENT_X = LOG_PANEL_X - (LOG_PANEL_WIDTH / 2) + PANEL_CONTENT_PADDING;
const LOG_PANEL_CONTENT_Y = LOG_PANEL_Y - (LOG_PANEL_HEIGHT / 2) + 34;
const LOG_PANEL_CONTENT_WIDTH = LOG_PANEL_WIDTH - (PANEL_CONTENT_PADDING * 2);
const LOG_PANEL_CONTENT_HEIGHT = LOG_PANEL_HEIGHT - 50;
const BATTLE_LOG_MAX_ENTRIES = 5;
const BLOODIED_HP_THRESHOLD = 0.5;
const DESPERATION_HP_THRESHOLD = 0.25;
const DESPERATION_SELF_DAMAGE_THRESHOLD = 6;
const CARD_DETAIL_PANEL_X = BATTLE_SCENE_LAYOUT.cardDetailPanel.x;
const CARD_DETAIL_PANEL_Y = BATTLE_SCENE_LAYOUT.cardDetailPanel.y;
const CARD_DETAIL_PANEL_WIDTH = BATTLE_SCENE_LAYOUT.cardDetailPanel.width;
const CARD_DETAIL_PANEL_HEIGHT = BATTLE_SCENE_LAYOUT.cardDetailPanel.height;
const CARD_DETAIL_CONTENT_X = CARD_DETAIL_PANEL_X - (CARD_DETAIL_PANEL_WIDTH / 2) + PANEL_CONTENT_PADDING;
const CARD_DETAIL_CONTENT_WIDTH = CARD_DETAIL_PANEL_WIDTH - (PANEL_CONTENT_PADDING * 2);
const DECK_COUNT_X = BATTLE_SCENE_LAYOUT.deckCount.x;
const DECK_COUNT_Y = BATTLE_SCENE_LAYOUT.deckCount.y;
const HAND_COUNT_X = BATTLE_SCENE_LAYOUT.handCount.x;
const HAND_COUNT_Y = BATTLE_SCENE_LAYOUT.handCount.y;
const DISCARD_COUNT_X = BATTLE_SCENE_LAYOUT.discardCount.x;
const DISCARD_COUNT_Y = BATTLE_SCENE_LAYOUT.discardCount.y;
const ENEMY_HP_POPUP_Y = ENEMY_HP_BAR_Y - 10;
const PLAYER_HP_POPUP_Y = PLAYER_HP_BAR_Y - 10;
const ENEMY_PANEL_POPUP_X = ENEMY_PANEL_X + 140;
const ENEMY_PANEL_POPUP_Y = ENEMY_PANEL_Y + 20;
const PLAYER_PANEL_POPUP_X = PLAYER_PANEL_X + 140;
const PLAYER_PANEL_POPUP_Y = PLAYER_PANEL_Y + 20;
const DREAD_RULE_TEXT_X = MAIN_PANEL_CENTER_X + 118;
const DREAD_RULE_TEXT_Y = 92;

// Colors
const COLOR_BG = 0x1a1a2e;
const COLOR_HP_BAR_BG = 0x333333;
const COLOR_ENEMY_HP_HEALTHY = 0xff4444;
const COLOR_ENEMY_HP_LOW = 0xff0000;
const COLOR_PLAYER_HP_HEALTHY = 0x44ff44;
const COLOR_PLAYER_HP_LOW = 0xff6600;
const COLOR_CARD_ATTACK = 0xcc3333;
const COLOR_CARD_GUARD = 0x3366cc;
const COLOR_CARD_STATUS = 0x9933cc;
const COLOR_CARD_SKILL = 0x2f8b7b;
const COLOR_CARD_POWER = 0xd4982a;
const COLOR_CARD_CURSE = 0x5c4672;
const COLOR_CARD_DIM = 0x555555;
const COLOR_END_TURN_BG = 0x446644;
const COLOR_END_TURN_HOVER = 0x558855;
const COLOR_PANEL_BG = 0x122033;
const COLOR_PANEL_BORDER = 0x32506f;
const COLOR_ACTION_ATTACK = 0xff8f8f;
const COLOR_ACTION_DEFEND = 0x6eb6ff;
const COLOR_ACTION_STATUS = 0xc483ff;
const COLOR_ACTION_FLEE = 0x66ffaa;
const COLOR_ACTION_BUFF = 0xffb05e;
const COLOR_RARITY_COMMON = 0xd9dfeb;
const COLOR_RARITY_UNCOMMON = 0x67b7ff;
const COLOR_RARITY_RARE = 0xf5ca62;
const COLOR_CARD_DETAIL_BG = 0x0d1623;
const COLOR_CARD_DETAIL_BORDER = 0x4e6d8e;
const COLOR_BREAKPOINT_BLOODIED = 0xffb347;
const COLOR_BREAKPOINT_DESPERATION = 0xff5d73;
const COLOR_BREAKPOINT_ACTIVE = 0x7ee787;
const COLOR_BREAKPOINT_FINISHER = 0xffd166;
const EMPTY_ONGOING_BATTLE_BUFFS: OngoingBattleBuffState = {
    blockPersist: false,
    blockPersistCharges: 0,
    strengthOnSelfDamage: 0,
    poisonPerTurn: 0,
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class BattleScene extends Phaser.Scene {
    // Domain services
    private drawCycleService!: DrawCycleService;
    private cardEffectService!: CardEffectService;
    private energyService!: EnergyService;
    private statusEffectService!: StatusEffectService;
    private enemyIntentService!: EnemyIntentService;
    private readonly dreadRuleService = new DreadRuleService();

    // Battle state
    private drawCycleState!: DrawCycleState;
    private playerState!: CombatantState;
    private enemyState!: CombatantState;
    private encounterEnemyStates: EncounterEnemyState[] = [];
    private energyState!: EnergyState;
    private playerStatusEffects!: StatusEffectState;
    private enemyStatusEffects!: StatusEffectState;
    private enemyCardPool!: readonly Card[];
    private sceneData!: BattleSceneData;
    private turnNumber = 0;
    private totalPlayerDamage = 0;
    private totalEnemyDamage = 0;
    private enemyAttackBuff = 0;
    private battleLogLines: string[] = [];
    private currentEnemyIntent?: EnemyIntent;
    private enemyIntentQueue: EnemyIntent[] = [];
    private battleResolution: BattleSceneResolution = 'victory';
    private activePowerCards: Card[] = [];
    private playerDamageTakenWindow = 0;
    private playerOngoingBuffs: OngoingBattleBuffState = EMPTY_ONGOING_BATTLE_BUFFS;
    private enemyOngoingBuffs: OngoingBattleBuffState = EMPTY_ONGOING_BATTLE_BUFFS;
    private enemyAttackDebuff = 0;
    private enemyAttackDebuffDuration = 0;
    private equipmentInventory: readonly InventoryItem[] = [];
    private equipmentConfig: EquipmentBattleConfig = getBattleEquipmentConfig([]);
    private queuedAttackPowerBonus = 0;
    private pendingNextTurnDrawBonus = 0;
    private martyrStrengthGainedThisTurn = 0;
    private openingHandCardIds = new Set<string>();
    private battleStartEnergyBonus = 0;
    private nextBattleStartEnergyBonus = 0;
    private playerSelfDamageTotal = 0;
    private playerBreakpointState: PlayerBreakpointState = 'stable';
    private activeBreakpointReactionKeys = new Set<string>();
    private dreadRule?: DreadRuleDefinition;
    private dreadRuleSelfDamageTriggeredThisTurn = false;
    private readonly battleEventBus: BattleEventBus = createBattleEventBus((name, payload) => {
        const sceneEvents = (this as Phaser.Scene & {
            events?: { emit?: (eventName: string, nextPayload: unknown) => void };
        }).events;
        sceneEvents?.emit?.(name, payload);
    });
    private battleId = 'battle:local';
    private actionQueueIndex = 0;
    private processedReactionActionKeys = new Set<string>();

    // UI elements
    private cardSprites: Phaser.GameObjects.Container[] = [];
    private playerHpBar!: Phaser.GameObjects.Graphics;
    private enemyHpBar!: Phaser.GameObjects.Graphics;
    private playerHpText!: Phaser.GameObjects.Text;
    private enemyHpText!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;
    private dreadRuleText?: Phaser.GameObjects.Text;
    private resultText!: Phaser.GameObjects.Text;
    private effectText?: Phaser.GameObjects.Text;
    private endTurnButton?: Phaser.GameObjects.Container;
    private handCountText!: Phaser.GameObjects.Text;
    private deckCountText!: Phaser.GameObjects.Text;
    private discardCountText!: Phaser.GameObjects.Text;
    private energyText!: Phaser.GameObjects.Text;
    private playerBlockText!: Phaser.GameObjects.Text;
    private enemyBlockText!: Phaser.GameObjects.Text;
    private playerStatusText?: Phaser.GameObjects.Text;
    private enemyStatusText?: Phaser.GameObjects.Text;
    private playerBreakpointText?: Phaser.GameObjects.Text;
    private playerPowerText?: Phaser.GameObjects.Text;
    private enemyPowerText?: Phaser.GameObjects.Text;
    private battleLogText?: Phaser.GameObjects.Text;
    private battleLogMaskGraphics?: Phaser.GameObjects.Graphics;
    private isBattleLogReady = false;
    private enemyNameText?: Phaser.GameObjects.Text;
    private enemyIntentText?: Phaser.GameObjects.Text;
    private cardDetailTitleText?: Phaser.GameObjects.Text;
    private cardDetailBodyText?: Phaser.GameObjects.Text;
    private damagePopupController!: DamagePopupController;
    private battlePresentationFacade!: BattlePresentationFacade;
    private enemyPanelMotionOverlay?: Phaser.GameObjects.Rectangle;
    private playerPanelMotionOverlay?: Phaser.GameObjects.Rectangle;

    private isInputLocked = false;

    // Callback for when battle ends
    private onBattleEndCallback?: (result: BattleSceneResult) => void;

    constructor() {
        super({ key: SCENE_KEY });
        this.registerBattleEventSubscribers();
    }

    init(data: BattleSceneData): void {
        // 서비스 초기화
        this.drawCycleService = new DrawCycleService();
        this.cardEffectService = new CardEffectService();
        this.energyService = new EnergyService();
        this.statusEffectService = new StatusEffectService();
        this.enemyIntentService = new EnemyIntentService();

        this.encounterEnemyStates = this.buildEncounterEnemyStates(data);
        const leadEnemyState = this.encounterEnemyStates[0];
        const leadEnemy = leadEnemyState?.enemy ?? data.enemy;
        this.sceneData = {
            ...data,
            enemy: leadEnemy,
            enemyName: leadEnemy.id === data.enemy.id ? data.enemyName : leadEnemy.label,
        };
        this.battleId = this.createBattleId(data);
        this.actionQueueIndex = 0;
        this.battleEventBus.clear();
        this.processedReactionActionKeys.clear();
        this.battleLogText = undefined;
        this.battleLogMaskGraphics = undefined;

        // 장비 보너스 적용
        this.equipmentInventory = data.itemService.getInventory();
        const equipmentBonus = getEquipmentCardBonus(this.equipmentInventory);
        this.equipmentConfig = getBattleEquipmentConfig(this.equipmentInventory);
        const deckCards = data.deckService.getCards();
        const boostedDeck = [
            ...transformDeckForBattle(
                applyEquipmentBonusToHand(deckCards, equipmentBonus),
                this.equipmentInventory,
            ),
            ...this.equipmentConfig.battleStartCurseCards,
        ];

        // 전투 상태 초기화
        this.drawCycleState = this.drawCycleService.initialize(boostedDeck);
        this.playerState = {
            health: data.player.stats.health,
            maxHealth: data.player.stats.maxHealth,
            block: 0,
        };
        this.energyState = this.energyService.initialize();
        this.playerStatusEffects = this.statusEffectService.createState();
        this.enemyState = {
            health: leadEnemyState?.state.health ?? leadEnemy.stats.health,
            maxHealth: leadEnemyState?.state.maxHealth ?? leadEnemy.stats.maxHealth,
            block: leadEnemyState?.state.block ?? 0,
        };
        this.enemyStatusEffects = this.cloneStatusEffects(
            leadEnemyState?.statusEffects ?? this.statusEffectService.createState(),
        );
        this.enemyCardPool = [
            ...(leadEnemyState?.cardPool
                ?? data.cardBattleService.generateEnemyCardPool(leadEnemy.kind, leadEnemy.elite)),
        ];
        this.dreadRule = this.dreadRuleService.decideRule(leadEnemy);

        // 초기화
        this.turnNumber = 0;
        this.totalPlayerDamage = 0;
        this.totalEnemyDamage = 0;
        this.enemyAttackBuff = leadEnemyState?.attackBuff ?? 0;
        this.isInputLocked = false;
        this.battleLogLines = [];
        this.currentEnemyIntent = leadEnemyState?.currentIntent;
        this.enemyIntentQueue = [...(leadEnemyState?.intentQueue ?? [])];
        this.battleResolution = 'victory';
        this.activePowerCards = [];
        this.playerDamageTakenWindow = 0;
        this.playerOngoingBuffs = EMPTY_ONGOING_BATTLE_BUFFS;
        this.enemyOngoingBuffs = leadEnemyState?.ongoingBuffs ?? EMPTY_ONGOING_BATTLE_BUFFS;
        this.enemyAttackDebuff = leadEnemyState?.attackDebuff ?? 0;
        this.enemyAttackDebuffDuration = leadEnemyState?.attackDebuffDuration ?? 0;
        this.queuedAttackPowerBonus = 0;
        this.pendingNextTurnDrawBonus = 0;
        this.martyrStrengthGainedThisTurn = 0;
        this.openingHandCardIds = new Set();
        this.battleStartEnergyBonus = Math.max(0, data.startEnergyBonus ?? 0);
        this.nextBattleStartEnergyBonus = 0;
        this.playerSelfDamageTotal = 0;
        this.playerBreakpointState = 'stable';
        this.activeBreakpointReactionKeys = new Set();
        this.dreadRuleSelfDamageTriggeredThisTurn = false;
        this.battleLogText = undefined;
        this.battleLogMaskGraphics = undefined;
        this.isBattleLogReady = false;
        this.dreadRuleText = undefined;
    }

    create(): void {
        this.damagePopupController = new DamagePopupController(this);
        this.battlePresentationFacade = this.createBattlePresentationFacade();
        this.createBackground();
        this.createActionMotionLayers();
        this.createHpBars();
        this.createTurnDisplay();
        this.createDreadRuleDisplay();
        this.createResultText();
        this.createZoneCountDisplays();
        this.createEnergyDisplay();
        this.createBlockDisplays();
        this.createEnemyIntentDisplay();
        this.createStatusDisplays();
        this.createPowerDisplays();
        this.createBattleLog();
        if (this.dreadRule) {
            this.appendBattleLog(`Dread Rule: ${this.dreadRule.name}`);
        }
        this.createCardDetailPanel();
        this.createEndTurnButton();
        this.applyBattleStartEquipmentEffects();
        if (this.playerState.health <= 0) {
            this.showBattleEnd('player-lose');
            return;
        }
        this.revealNextEnemyIntent();
        this.startPlayerTurn();
    }

    /** 배틀 종료 콜백을 등록한다. */
    public setOnBattleEnd(callback: (result: BattleSceneResult) => void): void {
        this.onBattleEndCallback = callback;
    }

    private createBattlePresentationFacade(): BattlePresentationFacade {
        return new BattlePresentationFacade({
            scheduler: {
                delayedCall: (delayMs: number, callback: () => void) => {
                    const sceneTime = (this as Phaser.Scene & {
                        time?: { delayedCall?: (delay: number, next: () => void) => void };
                    }).time;
                    if (!sceneTime?.delayedCall) {
                        callback();
                        return;
                    }

                    sceneTime.delayedCall(delayMs, callback);
                },
            },
            appendBattleLog: (message: string) => {
                this.appendBattleLog(message);
            },
            showPopupBatch: (anchorId: DamagePopupAnchorId, requests: readonly DamagePopupRequest[]) => {
                this.showPopupBatch(anchorId, requests);
            },
            createFallbackEffectText: (text: string, color: string) => {
                this.createFallbackEffectText(text, color);
            },
            clearEffectText: () => {
                this.clearEffectText();
            },
            playPanelImpactMotion: (actor: 'player' | 'enemy', color: number) => {
                this.playPanelImpactMotion(actor, color);
            },
            playPanelPulseMotion: (actor: 'player' | 'enemy', color: number) => {
                this.playPanelPulseMotion(actor, color);
            },
        });
    }

    private createBattleId(data: BattleSceneData): string {
        const enemyId = data.enemy.id || 'enemy';
        const floorNumber = data.floorNumber ?? 0;
        return `battle:${enemyId}:${floorNumber}`;
    }

    private cloneStatusEffects(state: StatusEffectState): StatusEffectState {
        return { ...state };
    }

    private cloneOngoingBuffState(state: OngoingBattleBuffState): OngoingBattleBuffState {
        return { ...state };
    }

    private buildEncounterEnemyStates(data: BattleSceneData): EncounterEnemyState[] {
        const encounterEnemies = data.encounterEnemies?.length
            ? data.encounterEnemies
            : [data.enemy];

        return encounterEnemies.map((enemy) => ({
            enemy,
            state: {
                health: enemy.stats.health,
                maxHealth: enemy.stats.maxHealth,
                block: 0,
            },
            statusEffects: this.statusEffectService.createState(),
            cardPool: data.cardBattleService.generateEnemyCardPool(enemy.kind, enemy.elite),
            intentQueue: [],
            currentIntent: undefined,
            ongoingBuffs: EMPTY_ONGOING_BATTLE_BUFFS,
            attackBuff: 0,
            attackDebuff: 0,
            attackDebuffDuration: 0,
        }));
    }

    private getEncounterEnemyEntryById(enemyId: string): EncounterEnemyState | undefined {
        return this.encounterEnemyStates.find((entry) => entry.enemy.id === enemyId);
    }

    private updateEncounterEnemyEntry(
        enemyId: string,
        updater: (entry: EncounterEnemyState) => EncounterEnemyState,
    ): EncounterEnemyState | undefined {
        let updatedEntry: EncounterEnemyState | undefined;
        this.encounterEnemyStates = this.encounterEnemyStates.map((entry) => {
            if (entry.enemy.id !== enemyId) {
                return entry;
            }

            updatedEntry = updater(entry);
            return updatedEntry;
        });

        return updatedEntry;
    }

    private getCurrentEncounterEnemyState(): EncounterEnemyState | undefined {
        const currentEnemyId = this.sceneData?.enemy?.id;
        if (!currentEnemyId) {
            return this.encounterEnemyStates[0];
        }

        return this.getEncounterEnemyEntryById(currentEnemyId);
    }

    private syncEncounterEnemyRuntime(enemyId: string): void {
        this.encounterEnemyStates = this.encounterEnemyStates.map((entry) =>
            entry.enemy.id === enemyId
                ? {
                    ...entry,
                    state: { ...this.enemyState },
                    statusEffects: this.cloneStatusEffects(this.enemyStatusEffects),
                    cardPool: [...this.enemyCardPool],
                    intentQueue: [...this.enemyIntentQueue],
                    currentIntent: this.currentEnemyIntent,
                    ongoingBuffs: this.cloneOngoingBuffState(this.enemyOngoingBuffs),
                    attackBuff: this.enemyAttackBuff,
                    attackDebuff: this.enemyAttackDebuff,
                    attackDebuffDuration: this.enemyAttackDebuffDuration,
                }
                : entry,
        );
    }

    private syncCurrentEncounterEnemyRuntime(): void {
        const currentEnemyId = this.sceneData?.enemy?.id;
        if (!currentEnemyId) {
            return;
        }

        this.syncEncounterEnemyRuntime(currentEnemyId);
    }

    private activateEncounterEnemy(enemyId: string): boolean {
        const encounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (!encounterEnemy) {
            return false;
        }

        const cardBattleService = (this.sceneData as Partial<BattleSceneData>).cardBattleService;
        const nextCardPool = encounterEnemy.cardPool
            ?? cardBattleService?.generateEnemyCardPool(encounterEnemy.enemy.kind, encounterEnemy.enemy.elite)
            ?? [];
        const nextStatusEffects = encounterEnemy.statusEffects
            ?? this.statusEffectService.createState();

        this.sceneData = {
            ...this.sceneData,
            enemy: encounterEnemy.enemy,
            enemyName: encounterEnemy.enemy.label,
        };
        this.enemyNameText?.setText(encounterEnemy.enemy.label);
        this.enemyState = {
            ...encounterEnemy.state,
        };
        this.enemyStatusEffects = this.cloneStatusEffects(nextStatusEffects);
        this.enemyCardPool = [...nextCardPool];
        this.enemyIntentQueue = [...(encounterEnemy.intentQueue ?? [])];
        this.currentEnemyIntent = encounterEnemy.currentIntent;
        this.enemyOngoingBuffs = encounterEnemy.ongoingBuffs
            ?? EMPTY_ONGOING_BATTLE_BUFFS;
        this.enemyAttackBuff = encounterEnemy.attackBuff ?? 0;
        this.enemyAttackDebuff = encounterEnemy.attackDebuff ?? 0;
        this.enemyAttackDebuffDuration = encounterEnemy.attackDebuffDuration ?? 0;

        return true;
    }

    private setCurrentEncounterEnemyState(nextState: CombatantState): void {
        const currentEnemy = this.getCurrentEncounterEnemyState();
        if (currentEnemy) {
            this.encounterEnemyStates = this.encounterEnemyStates.map((entry) =>
                entry.enemy.id === currentEnemy.enemy.id
                    ? {
                        ...entry,
                        state: { ...nextState },
                    }
                    : entry,
            );
        }

        this.enemyState = nextState;
    }

    public getEncounterEnemyStateById(enemyId: string): CombatantState | undefined {
        return this.getEncounterEnemyEntryById(enemyId)?.state;
    }

    private hasRemainingEncounterEnemies(): boolean {
        return this.encounterEnemyStates.some((entry) => entry.state.health > 0);
    }

    private getLivingEncounterEnemyStates(): EncounterEnemyState[] {
        return this.encounterEnemyStates.filter((entry) => entry.state.health > 0);
    }

    private restoreEncounterTargetEnemy(preferredEnemyId?: string): void {
        const preferredEnemy = preferredEnemyId
            ? this.getEncounterEnemyEntryById(preferredEnemyId)
            : undefined;
        if (preferredEnemy && preferredEnemy.state.health > 0) {
            this.activateEncounterEnemy(preferredEnemy.enemy.id);
            return;
        }

        const fallbackEnemy = this.getLivingEncounterEnemyStates()[0];
        if (fallbackEnemy) {
            this.activateEncounterEnemy(fallbackEnemy.enemy.id);
        }
    }

    private switchToNextLivingEnemy(): boolean {
        this.syncCurrentEncounterEnemyRuntime();
        const currentEnemyId = this.sceneData?.enemy.id;
        const nextEnemy = this.encounterEnemyStates.find((entry) =>
            entry.enemy.id !== currentEnemyId && entry.state.health > 0,
        );

        if (!nextEnemy) {
            return false;
        }

        this.activateEncounterEnemy(nextEnemy.enemy.id);
        this.appendBattleLog(`${nextEnemy.enemy.label} steps forward`);
        this.revealNextEnemyIntent(nextEnemy.enemy.id);

        return true;
    }

    private getPlayerActorId(): string {
        return 'player';
    }

    private getEnemyActorId(): string {
        return this.sceneData?.enemy.id ?? 'enemy';
    }

    private emitBattleTurnStarted(drawCount: number): void {
        const payload = {
            battleId: this.battleId,
            turnNumber: this.turnNumber,
            energy: this.energyState.current,
            drawCount,
            handCount: this.drawCycleState.hand.length,
            dreadRuleId: this.dreadRule?.id ?? null,
        } as const;

        this.battleEventBus.emit(BATTLE_EVENT_NAME.TURN_STARTED, payload);
        this.battleEventBus.emit(LEGACY_BATTLE_EVENT_NAME.TURN_STARTED, {
            turnNumber: payload.turnNumber,
            energy: payload.energy,
            drawCount: payload.drawCount,
            handCount: payload.handCount,
        });
    }

    private emitBattleCardPlayed(card: Card, targetIds: readonly string[]): void {
        const normalizedTargetIds = targetIds.length > 0 ? targetIds : [this.getEnemyActorId()];
        const payload = {
            battleId: this.battleId,
            turnNumber: this.turnNumber,
            cardId: card.id,
            effectType: card.effectType,
            cost: card.cost,
            remainingEnergy: this.energyState.current,
            targetIds: normalizedTargetIds,
        } as const;

        this.battleEventBus.emit(BATTLE_EVENT_NAME.CARD_PLAYED, payload);
        this.battleEventBus.emit(LEGACY_BATTLE_EVENT_NAME.CARD_PLAYED, {
            cardId: payload.cardId,
            effectType: payload.effectType,
            cost: payload.cost,
            remainingEnergy: payload.remainingEnergy,
            targetId: payload.targetIds[0],
        });
    }

    private emitBattleActionResolved(payload: Omit<BattleActionResolvedPayload, 'battleId' | 'turnNumber' | 'queueIndex'>): void {
        this.battleEventBus.emit(BATTLE_EVENT_NAME.ACTION_RESOLVED, {
            battleId: this.battleId,
            turnNumber: this.turnNumber,
            queueIndex: this.actionQueueIndex,
            ...payload,
        });
        this.actionQueueIndex += 1;
    }

    private emitBattleTurnEnded(
        remainingEnergy: number,
        retainedCount: number,
        exhaustedCount: number,
    ): void {
        const payload = {
            battleId: this.battleId,
            turnNumber: this.turnNumber,
            remainingEnergy,
            handCount: this.drawCycleState.hand.length,
            retainedCount,
            exhaustedCount,
        } as const;

        this.battleEventBus.emit(BATTLE_EVENT_NAME.TURN_ENDED, payload);
        this.battleEventBus.emit(LEGACY_BATTLE_EVENT_NAME.TURN_ENDED, {
            turnNumber: payload.turnNumber,
            remainingEnergy: payload.remainingEnergy,
            handCount: payload.handCount,
        });
    }

    private emitLegacyStatusApplied(events: readonly StatusEffectEvent[]): void {
        events.forEach((event) => {
            if (event.type !== STATUS_EVENT_TYPE.APPLY) {
                return;
            }

            const applyEvent = event as StatusApplyEvent;
            this.battleEventBus.emit(LEGACY_BATTLE_EVENT_NAME.STATUS_APPLIED, {
                targetId: this.resolveStatusTargetId(applyEvent.target),
                statusType: applyEvent.status,
                value: applyEvent.value,
                expiresAtTurn: typeof applyEvent.duration === 'number'
                    ? this.turnNumber + applyEvent.duration
                    : 0,
            });
        });
    }

    private resolveStatusTargetId(target: string): string {
        return target === 'Player' ? this.getPlayerActorId() : this.getEnemyActorId();
    }

    private resolvePlayerCardTargetIds(card: Card, effectResult: CardEffectResult): readonly string[] {
        if (
            effectResult.damageDealt > 0
            || (effectResult.damageBlocked ?? 0) > 0
            || card.effectType === CARD_EFFECT_TYPE.STATUS_EFFECT
            || effectResult.buffApplied?.target === 'TARGET'
            || card.effectType === CARD_EFFECT_TYPE.FLEE
        ) {
            return [this.getEnemyActorId()];
        }

        return [this.getPlayerActorId()];
    }

    private buildStatusDelta(
        targetId: string,
        effectResult: CardEffectResult,
    ): readonly BattleActionStatusDelta[] {
        const appliedStatuses = effectResult.statusEffectsApplied
            ?? (effectResult.statusApplied ? [effectResult.statusApplied] : []);

        return appliedStatuses.map((status) => ({
            targetId,
            statusType: status.type,
            value: typeof status.stacks === 'number'
                ? status.stacks
                : typeof status.duration === 'number'
                    ? status.duration
                    : typeof status.amount === 'number'
                        ? status.amount
                        : 0,
        }));
    }

    private registerBattleEventSubscribers(): void {
        this.battleEventBus.subscribe((event) => {
            switch (event.name) {
                case BATTLE_EVENT_NAME.TURN_STARTED:
                    this.processedReactionActionKeys.clear();
                    break;
                case BATTLE_EVENT_NAME.ACTION_RESOLVED:
                    this.handleBattleActionResolvedSubscribers(event.payload as BattleActionResolvedPayload);
                    break;
                default:
                    break;
            }
        });
    }

    private handleBattleActionResolvedSubscribers(payload: BattleActionResolvedPayload): void {
        if (payload.damage <= 0) {
            return;
        }

        if (
            payload.sourceId === this.getPlayerActorId()
            && payload.targetIds.includes(this.getPlayerActorId())
            && this.markReactionActionHandled(`self-damage:${payload.turnNumber}:${payload.queueIndex}`)
        ) {
            this.trackPlayerSelfDamage(payload.damage);
            this.applyDreadRuleSelfDamageReaction(payload.damage);
        }

        if (
            payload.targetIds.includes(this.getPlayerActorId())
            && this.markReactionActionHandled(`player-health-loss:${payload.turnNumber}:${payload.queueIndex}`)
        ) {
            this.resolveHealthLossStrengthTriggers('player', payload.damage);
            this.syncPlayerBreakpointState();
            this.appendBreakpointCardReactions();
        }
    }

    private markReactionActionHandled(key: string): boolean {
        if (this.processedReactionActionKeys.has(key)) {
            return false;
        }

        this.processedReactionActionKeys.add(key);
        return true;
    }

    // -----------------------------------------------------------------------
    // Background & Layout
    // -----------------------------------------------------------------------

    private createBackground(): void {
        this.add.rectangle(SCENE_CENTER_X, SCENE_HEIGHT / 2, SCENE_WIDTH, SCENE_HEIGHT, COLOR_BG);
        this.createSectionPanel(ENEMY_PANEL_X, ENEMY_PANEL_Y, ENEMY_PANEL_WIDTH, ENEMY_PANEL_HEIGHT, 'Enemy');
        this.createSectionPanel(PLAYER_PANEL_X, PLAYER_PANEL_Y, PLAYER_PANEL_WIDTH, PLAYER_PANEL_HEIGHT, 'Player');
        this.createSectionPanel(HAND_PANEL_X, HAND_PANEL_Y, HAND_PANEL_WIDTH, HAND_PANEL_HEIGHT, 'Hand');
        this.createSectionPanel(LOG_PANEL_X, LOG_PANEL_Y, LOG_PANEL_WIDTH, LOG_PANEL_HEIGHT, 'Activity');

        // 적 이름 표시
        this.enemyNameText = this.add.text(MAIN_PANEL_CENTER_X, 42, this.sceneData.enemyName, {
            fontSize: '20px',
            color: '#ff6666',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    private createSectionPanel(
        x: number,
        y: number,
        width: number,
        height: number,
        title: string,
    ): void {
        const panel = this.add.rectangle(x, y, width, height, COLOR_PANEL_BG, 0.9);
        panel.setStrokeStyle(2, COLOR_PANEL_BORDER, 0.95);

        this.add.text(x - (width / 2) + 16, y - (height / 2) + 16, title, {
            fontSize: '11px',
            color: '#8fb1d5',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);
    }

    private createActionMotionLayers(): void {
        this.enemyPanelMotionOverlay = this.createMotionOverlay(
            ENEMY_PANEL_X,
            ENEMY_PANEL_Y,
            ENEMY_PANEL_WIDTH - 16,
            ENEMY_PANEL_HEIGHT - 16,
        );
        this.playerPanelMotionOverlay = this.createMotionOverlay(
            PLAYER_PANEL_X,
            PLAYER_PANEL_Y,
            PLAYER_PANEL_WIDTH - 16,
            PLAYER_PANEL_HEIGHT - 16,
        );
    }

    private createMotionOverlay(
        x: number,
        y: number,
        width: number,
        height: number,
    ): Phaser.GameObjects.Rectangle {
        return this.add.rectangle(x, y, width, height, 0xffffff, 0)
            .setStrokeStyle(2, 0xffffff, 0)
            .setVisible(false);
    }

    // -----------------------------------------------------------------------
    // HP Bars
    // -----------------------------------------------------------------------

    private createHpBars(): void {
        this.add.text(MAIN_PANEL_CENTER_X, 65, 'Enemy HP', {
            fontSize: '12px',
            color: '#ff8888',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.enemyHpBar = this.add.graphics();
        this.enemyHpText = this.add.text(MAIN_PANEL_CENTER_X, 85, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(MAIN_PANEL_CENTER_X, 245, 'Player HP', {
            fontSize: '12px',
            color: '#88ff88',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.playerHpBar = this.add.graphics();
        this.playerHpText = this.add.text(MAIN_PANEL_CENTER_X, 281, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.playerBreakpointText = this.add.text(MAIN_PANEL_CENTER_X - 134, 281, '', {
            fontSize: '11px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.updateHpBars();
    }

    private updateHpBars(): void {
        const barX = MAIN_PANEL_CENTER_X - HP_BAR_WIDTH / 2;

        this.renderHpBar(
            this.enemyHpBar, this.enemyHpText,
            barX, ENEMY_HP_BAR_Y,
            this.enemyState.health, this.enemyState.maxHealth,
            COLOR_ENEMY_HP_HEALTHY, COLOR_ENEMY_HP_LOW,
        );

        this.renderHpBar(
            this.playerHpBar, this.playerHpText,
            barX, PLAYER_HP_BAR_Y,
            this.playerState.health, this.playerState.maxHealth,
            COLOR_PLAYER_HP_HEALTHY, COLOR_PLAYER_HP_LOW,
        );
    }

    private renderHpBar(
        bar: Phaser.GameObjects.Graphics,
        text: Phaser.GameObjects.Text,
        x: number, y: number,
        hp: number, maxHp: number,
        healthyColor: number, lowColor: number,
    ): void {
        bar.clear();
        bar.fillStyle(COLOR_HP_BAR_BG);
        bar.fillRect(x, y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
        const ratio = Math.max(0, hp / maxHp);
        bar.fillStyle(ratio > HP_LOW_THRESHOLD ? healthyColor : lowColor);
        bar.fillRect(x, y, HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT);
        text.setText(`${hp} / ${maxHp}`);
    }

    // -----------------------------------------------------------------------
    // Turn Display
    // -----------------------------------------------------------------------

    private createTurnDisplay(): void {
        this.turnText = this.add.text(MAIN_PANEL_CENTER_X, 15, '', {
            fontSize: '18px',
            color: '#ffcc00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
    }

    private createDreadRuleDisplay(): void {
        this.dreadRuleText = this.add.text(DREAD_RULE_TEXT_X, DREAD_RULE_TEXT_Y, '', {
            fontSize: '10px',
            color: '#ff9f7a',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 176 },
        }).setOrigin(0.5);
        this.updateDreadRuleDisplay();
    }

    private updateTurnDisplay(): void {
        this.turnText.setText(`Turn ${this.turnNumber}`);
    }

    private updateDreadRuleDisplay(): void {
        if (!this.dreadRuleText || !this.dreadRule) {
            return;
        }

        if (this.dreadRule.effects.hideEnemyIntentOnEvenTurns) {
            this.dreadRuleText.setText(
                this.dreadRuleService.isBlackoutTurn(this.dreadRule, this.turnNumber)
                    ? `Rule: ${this.dreadRule.name} · intent hidden now`
                    : `Rule: ${this.dreadRule.name} · ${this.dreadRule.summary}`,
            );
            return;
        }

        if (this.dreadRule.effects.firstSelfDamageStrength && this.dreadRuleSelfDamageTriggeredThisTurn) {
            this.dreadRuleText.setText(`Rule: ${this.dreadRule.name} · spent this turn`);
            return;
        }

        this.dreadRuleText.setText(`Rule: ${this.dreadRule.name} · ${this.dreadRule.summary}`);
    }

    // -----------------------------------------------------------------------
    // Zone Count Displays (Deck / Discard)
    // -----------------------------------------------------------------------

    private createZoneCountDisplays(): void {
        this.deckCountText = this.add.text(DECK_COUNT_X, DECK_COUNT_Y, 'Deck: 0', {
            fontSize: '14px',
            color: '#88aaff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.handCountText = this.add.text(HAND_COUNT_X, HAND_COUNT_Y, 'Hand: 0', {
            fontSize: '14px',
            color: '#f5ca62',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);

        this.discardCountText = this.add.text(DISCARD_COUNT_X, DISCARD_COUNT_Y, 'Discard: 0', {
            fontSize: '14px',
            color: '#ffaa88',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(1, 0.5);

        this.updateZoneCountDisplays();
    }

    private updateZoneCountDisplays(): void {
        const counts = this.drawCycleService.getZoneCounts(this.drawCycleState);
        this.deckCountText.setText(`Deck: ${counts.drawPile}`);
        this.handCountText.setText(`Hand: ${this.drawCycleState.hand.length}`);
        this.discardCountText.setText(`Discard: ${counts.discardPile}`);
    }

    // -----------------------------------------------------------------------
    // Energy Display
    // -----------------------------------------------------------------------

    private createEnergyDisplay(): void {
        this.add.text(MAIN_PANEL_LEFT + 20, 374, 'Energy', {
            fontSize: '11px',
            color: '#ffdd44',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.energyText = this.add.text(MAIN_PANEL_LEFT + 20, 398, '', {
            fontSize: '22px',
            color: '#ffdd44',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.updateEnergyDisplay();
    }

    private updateEnergyDisplay(): void {
        this.energyText.setText(`${this.energyState.current} / ${this.energyState.max}`);
    }

    // -----------------------------------------------------------------------
    // Block Displays
    // -----------------------------------------------------------------------

    private createBlockDisplays(): void {
        this.playerBlockText = this.add.text(MAIN_PANEL_CENTER_X + 136, 281, '', {
            fontSize: '14px',
            color: '#6699ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.enemyBlockText = this.add.text(MAIN_PANEL_CENTER_X + 136, 85, '', {
            fontSize: '14px',
            color: '#6699ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.updateBlockDisplays();
    }

    // -----------------------------------------------------------------------
    // Enemy Intent Display
    // -----------------------------------------------------------------------

    private createEnemyIntentDisplay(): void {
        this.enemyIntentText = this.add.text(MAIN_PANEL_CENTER_X - 146, 85, '', {
            fontSize: '16px',
            color: '#ffdd88',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
    }

    private updateBlockDisplays(): void {
        this.playerBlockText.setText(this.playerState.block > 0 ? `Block: ${this.playerState.block}` : '');
        this.enemyBlockText.setText(this.enemyState.block > 0 ? `Block: ${this.enemyState.block}` : '');
    }

    // -----------------------------------------------------------------------
    // Status Displays
    // -----------------------------------------------------------------------

    private createStatusDisplays(): void {
        this.enemyStatusText = this.add.text(MAIN_PANEL_CENTER_X, 109, '', {
            fontSize: '13px',
            color: '#ffddaa',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.playerStatusText = this.add.text(MAIN_PANEL_CENTER_X, 305, '', {
            fontSize: '13px',
            color: '#ffddaa',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.updateStatusDisplays();
    }

    private updateStatusDisplays(): void {
        this.syncPlayerBreakpointState();
        this.playerStatusText?.setText(this.formatPlayerStatusSummary());
        this.enemyStatusText?.setText(this.formatStatusSummary(this.enemyStatusEffects));
        this.updatePlayerBreakpointDisplay();
    }

    private formatPlayerStatusSummary(): string {
        const parts: string[] = [];
        const breakpointState = this.getPlayerBreakpointState();

        if (breakpointState === 'bloodied') {
            parts.push('BLOODIED');
        } else if (breakpointState === 'desperation') {
            parts.push('DESPERATION');
        }

        const statusSummary = this.formatStatusSummary(this.playerStatusEffects);
        if (statusSummary.length > 0) {
            parts.push(statusSummary);
        }

        return parts.join(' · ');
    }

    private updatePlayerBreakpointDisplay(): void {
        if (!this.playerBreakpointText) {
            return;
        }

        const breakpointState = this.getPlayerBreakpointState();
        if (breakpointState === 'bloodied') {
            this.playerBreakpointText.setText('BLOODIED');
            this.playerBreakpointText.setColor('#ffb347');
            this.playerBreakpointText.setAlpha(0.95);
            return;
        }

        if (breakpointState === 'desperation') {
            this.playerBreakpointText.setText('DESPERATION');
            this.playerBreakpointText.setColor('#ff5d73');
            this.playerBreakpointText.setAlpha(0.98);
            return;
        }

        this.playerBreakpointText.setText('');
        this.playerBreakpointText.setAlpha(0);
    }

    private formatStatusSummary(statusEffects: StatusEffectState): string {
        const parts: string[] = [];

        if (statusEffects.vulnerable > 0) {
            parts.push(`💥${statusEffects.vulnerable}`);
        }
        if (statusEffects.weak > 0) {
            parts.push(`🪶${statusEffects.weak}`);
        }
        if (statusEffects.poison > 0) {
            parts.push(`☠${statusEffects.poison}`);
        }
        if (statusEffects.frail > 0) {
            parts.push(`🧱${statusEffects.frail}`);
        }

        return parts.join(' ');
    }

    private createPowerDisplays(): void {
        this.add.text(MAIN_PANEL_LEFT + 20, 117, 'Enemy Effects', {
            fontSize: '11px',
            color: '#f5ca62',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.enemyPowerText = this.add.text(MAIN_PANEL_CENTER_X, 132, '', {
            fontSize: '10px',
            color: '#f5ca62',
            fontFamily: 'monospace',
            wordWrap: { width: ENEMY_POWER_PANEL_WIDTH },
        }).setOrigin(0.5);

        this.add.text(MAIN_PANEL_LEFT + 20, 318, 'Ongoing Effects', {
            fontSize: '11px',
            color: '#f5ca62',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.playerPowerText = this.add.text(MAIN_PANEL_CENTER_X, 331, '', {
            fontSize: '10px',
            color: '#f5ca62',
            fontFamily: 'monospace',
            wordWrap: { width: PLAYER_POWER_PANEL_WIDTH },
        }).setOrigin(0.5);

        this.updatePowerDisplays();
    }

    private updatePowerDisplays(): void {
        this.enemyPowerText?.setText(this.formatPowerSummary(
            this.enemyStatusEffects,
            [
                ...this.getOngoingBuffSummary(this.enemyOngoingBuffs),
                ...this.getEnemyAttackModifierSummary(),
            ],
        ));
        this.playerPowerText?.setText(this.formatPowerSummary(
            this.playerStatusEffects,
            [
                ...this.getPlayerBreakpointSummary(),
                ...this.getOngoingBuffSummary(this.playerOngoingBuffs),
                ...this.activePowerCards.map((card) => card.name),
            ],
        ));
    }

    private formatPowerSummary(statusEffects: StatusEffectState, extras: readonly string[] = []): string {
        const parts: string[] = [];

        if (statusEffects.strength > 0) {
            parts.push(`STR +${statusEffects.strength}`);
        }
        if (statusEffects.thorns > 0) {
            parts.push(`THR ${statusEffects.thorns}`);
        }
        if (statusEffects.regeneration > 0) {
            parts.push(`REG ${statusEffects.regeneration}`);
        }

        parts.push(...extras);

        return parts.length > 0 ? parts.join(' · ') : 'None';
    }

    private getOngoingBuffSummary(buffState: OngoingBattleBuffState): string[] {
        const labels: string[] = [];

        if (buffState.blockPersist || buffState.blockPersistCharges > 0) {
            labels.push('BLK HOLD');
        }
        if (buffState.strengthOnSelfDamage > 0) {
            labels.push(`RAGE +${buffState.strengthOnSelfDamage}`);
        }
        if (buffState.poisonPerTurn > 0) {
            labels.push(`POISON/T ${buffState.poisonPerTurn}`);
        }

        return labels;
    }

    private getEnemyAttackModifierSummary(): string[] {
        const totalModifier = this.enemyAttackBuff - this.enemyAttackDebuff;
        if (totalModifier === 0) {
            return [];
        }

        return [totalModifier > 0 ? `ATK +${totalModifier}` : `ATK ${totalModifier}`];
    }

    private getPlayerBreakpointSummary(): string[] {
        if (!this.playerState) {
            return [];
        }

        const labels: string[] = [];
        const breakpointState = this.getPlayerBreakpointState();

        if (breakpointState === 'bloodied') {
            labels.push('BLOODIED');
        } else if (breakpointState === 'desperation') {
            labels.push('DESPERATION');
        }

        if ((this.playerSelfDamageTotal ?? 0) >= DESPERATION_SELF_DAMAGE_THRESHOLD) {
            labels.push(`SCARS ${this.playerSelfDamageTotal}`);
        }

        return labels;
    }

    // -----------------------------------------------------------------------
    // Battle Log
    // -----------------------------------------------------------------------

    private createBattleLog(): void {
        this.add.text(LOG_PANEL_CONTENT_X, LOG_PANEL_CONTENT_Y - 18, 'Reaction Feed', {
            fontSize: '12px',
            color: '#cccccc',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.battleLogText = this.add.text(LOG_PANEL_CONTENT_X, LOG_PANEL_CONTENT_Y, '', {
            fontSize: '11px',
            color: '#dddddd',
            fontFamily: 'monospace',
            lineSpacing: 4,
            wordWrap: { width: LOG_PANEL_CONTENT_WIDTH },
        }).setOrigin(0, 0);
        this.applyBattleLogMask();

        this.isBattleLogReady = true;
        this.updateBattleLog();
    }

    private createCardDetailPanel(): void {
        const panel = this.add.rectangle(
            CARD_DETAIL_PANEL_X,
            CARD_DETAIL_PANEL_Y,
            CARD_DETAIL_PANEL_WIDTH,
            CARD_DETAIL_PANEL_HEIGHT,
            COLOR_CARD_DETAIL_BG,
            0.92,
        );
        panel.setStrokeStyle(2, COLOR_CARD_DETAIL_BORDER, 0.85);

        this.add.text(CARD_DETAIL_CONTENT_X, CARD_DETAIL_PANEL_Y - 20, 'Card Intel', {
            fontSize: '11px',
            color: '#c9d8ea',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.cardDetailTitleText = this.add.text(CARD_DETAIL_CONTENT_X, CARD_DETAIL_PANEL_Y - 8, '', {
            fontSize: '13px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            wordWrap: { width: CARD_DETAIL_CONTENT_WIDTH },
        }).setOrigin(0, 0);

        this.cardDetailBodyText = this.add.text(CARD_DETAIL_CONTENT_X, CARD_DETAIL_PANEL_Y + 10, 'Hover a card to inspect its effect and role.', {
            fontSize: '11px',
            color: '#a8bbd1',
            fontFamily: 'monospace',
            lineSpacing: 4,
            wordWrap: { width: CARD_DETAIL_CONTENT_WIDTH },
        }).setOrigin(0, 0);
    }

    private showCardDetail(card: Card): void {
        const resolvedCost = this.resolveCardDetailCost(card);
        const breakpointDetail = this.describeCardBreakpoint(card);
        this.cardDetailTitleText?.setText(card.name);
        this.cardDetailBodyText?.setText([
            `${this.getCardTypeLabel(card)} · ${this.getCardRarityLabel(card)} · ${this.getCardArchetypeLabel(card)} · Cost ${resolvedCost}`,
            `${this.describeCardEffect(card)} ${card.keywords.length > 0 ? `Keywords: ${card.keywords.join(', ')}` : 'Keywords: none'}`,
            this.describeCardCondition(card),
            breakpointDetail,
        ].filter(Boolean).join('\n'));
    }

    private clearCardDetail(): void {
        this.cardDetailTitleText?.setText('');
        this.cardDetailBodyText?.setText('Hover a card to inspect its effect and role.');
    }

    private updateBattleLog(): void {
        if (!this.isBattleLogReady || !this.battleLogText) {
            return;
        }
        this.battleLogText?.setText(this.battleLogLines.join('\n'));
    }

    private appendBattleLog(message: string): void {
        this.battleLogLines = [
            ...this.battleLogLines.slice(-(BATTLE_LOG_MAX_ENTRIES - 1)),
            message,
        ];
        this.updateBattleLog();
    }

    private applyBattleLogMask(): void {
        if (!this.battleLogText) {
            return;
        }

        this.battleLogMaskGraphics?.destroy();
        this.battleLogMaskGraphics = this.make.graphics({ x: 0, y: 0 });
        this.battleLogMaskGraphics.setVisible(false);
        this.battleLogMaskGraphics.fillStyle(0xffffff);
        this.battleLogMaskGraphics.fillRect(
            LOG_PANEL_CONTENT_X,
            LOG_PANEL_CONTENT_Y,
            LOG_PANEL_CONTENT_WIDTH,
            LOG_PANEL_CONTENT_HEIGHT,
        );
        this.battleLogText.setMask(this.battleLogMaskGraphics.createGeometryMask());
    }

    private formatPlayerActionLog(card: Card, effect: {
        damageDealt: number;
        damageBlocked?: number;
        blockGained: number;
        fled: boolean;
        cardsDrawn: number;
        energyGained: number;
        healthRestored: number;
        selfDamageTaken: number;
        hitsResolved: number;
        hitDamages?: readonly number[];
        buffApplied?: CardEffectResult['buffApplied'];
        statusApplied?: CardStatusEffect;
    }): string {
        const selfDamageTaken = effect.selfDamageTaken ?? 0;
        const hitsResolved = effect.hitsResolved ?? (effect.damageDealt > 0 ? 1 : 0);

        if (effect.fled) {
            return `${card.name}: retreat`;
        }

        const parts: string[] = [];

        if (selfDamageTaken > 0) {
            parts.push(`pay ${selfDamageTaken} HP`);
        }

        if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0) {
            if (card.name === 'Shockwave') {
                parts.push('strike current enemy');
            } else if (hitsResolved > 1) {
                parts.push(`hit ${hitsResolved}x`);
            } else {
                parts.push('strike');
            }
        }

        if (effect.blockGained > 0) {
            parts.push(`+${effect.blockGained} Block`);
        }

        if (effect.healthRestored > 0) {
            parts.push(`+${effect.healthRestored} HP`);
        }

        if (effect.statusApplied) {
            parts.push(this.getStatusLabel(effect.statusApplied.type));
        }

        if (effect.buffApplied) {
            parts.push(`${effect.buffApplied.type} +${effect.buffApplied.value}`);
        }

        if (effect.cardsDrawn > 0) {
            parts.push(`draw ${effect.cardsDrawn}`);
        }

        if (effect.energyGained > 0) {
            parts.push(`+${effect.energyGained} energy`);
        }

        return parts.length > 0
            ? `${card.name}: ${parts.join(', ')}`
            : `${card.name} used`;
    }

    private formatEnemyActionLog(card: Card, damage: number, blockGained: number, damageBlocked = 0): string {
        const enemyLabel = this.getEnemyLabel();
        if (damage > 0 || damageBlocked > 0) {
            const hitCount = card.hitCount ?? card.effectPayload?.hitCount ?? 1;
            return hitCount > 1
                ? `${enemyLabel} ${card.name}: flurry`
                : `${enemyLabel} ${card.name}: attack`;
        }

        if (blockGained > 0) {
            return `${enemyLabel} ${card.name}: +${blockGained} Block`;
        }

        return `${enemyLabel} ${card.name}`;
    }

    // -----------------------------------------------------------------------
    // Result Text
    // -----------------------------------------------------------------------

    private createResultText(): void {
        this.resultText = this.add.text(MAIN_PANEL_CENTER_X, 200, '', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
    }

    // -----------------------------------------------------------------------
    // End Turn Button
    // -----------------------------------------------------------------------

    private createEndTurnButton(): void {
        const container = this.add.container(END_TURN_BUTTON_X, END_TURN_BUTTON_Y);

        const bg = this.add.rectangle(0, 0, 110, 40, COLOR_END_TURN_BG, 0.9);
        bg.setStrokeStyle(2, 0x88aa88, 0.8);
        container.add(bg);

        const label = this.add.text(0, 0, 'End Turn', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(label);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
            if (!this.isInputLocked) {
                bg.setFillStyle(COLOR_END_TURN_HOVER);
            }
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(COLOR_END_TURN_BG);
        });
        bg.on('pointerdown', () => {
            if (!this.isInputLocked) {
                this.onEndTurn();
            }
        });

        this.endTurnButton = container;
    }

    // -----------------------------------------------------------------------
    // Card Display
    // -----------------------------------------------------------------------

    private displayHandCards(): void {
        this.clearCardSprites();
        const hand = this.drawCycleState.hand.map((card) => this.getEffectivePlayerCard(card));

        if (hand.length === 0) {
            return;
        }

        const layout = this.getHandLayoutMetrics(hand.length);

        hand.forEach((card, index) => {
            const x = layout.startX + index * layout.stride;
            const isPlayable = this.canPlayCard(card);
            const container = this.createCardVisual(card, x, CARD_Y, index, isPlayable, layout.scale);
            this.cardSprites.push(container);
        });
    }

    private getEffectivePlayerCard(card: Card): Card {
        return this.applyRuntimeCardAdjustments(this.resolvePlayerCardModifier(card).card);
    }

    private resolvePlayerCardModifier(card: Card): {
        card: Card;
        extraEnemyStatusEffects: readonly StatusEffectApplication[];
        consumesNextAttackBonus: boolean;
    } {
        const modifier = getPlayerCardModifier(
            card,
            this.equipmentInventory,
            {
                turnNumber: this.turnNumber,
                isOpeningHandCard: this.openingHandCardIds.has(card.id),
                playerHealth: this.playerState.health,
                playerMaxHealth: this.playerState.maxHealth,
                playerBlock: this.playerState.block,
                enemyIntentType: this.currentEnemyIntent?.type,
                nextAttackPowerBonus: this.queuedAttackPowerBonus,
            },
        );
        const combinedSelfDamage = (modifier.card.selfDamage ?? modifier.card.effectPayload?.selfDamage ?? 0)
            + modifier.extraSelfDamage;

        return {
            card: modifier.extraSelfDamage > 0
                ? {
                    ...modifier.card,
                    selfDamage: combinedSelfDamage,
                    effectPayload: modifier.card.effectPayload
                        ? {
                            ...modifier.card.effectPayload,
                            selfDamage: combinedSelfDamage,
                        }
                        : modifier.card.effectPayload,
                }
                : modifier.card,
            extraEnemyStatusEffects: modifier.extraEnemyStatusEffects,
            consumesNextAttackBonus: modifier.consumesNextAttackBonus,
        };
    }

    private applyRuntimeCardAdjustments(card: Card): Card {
        const resolvedCost = resolveCardCost(card, this.playerState.health, {
            playerMaxHealth: this.playerState.maxHealth,
            turnDamageTaken: this.playerDamageTakenWindow,
        });

        if (resolvedCost === card.cost) {
            return card;
        }

        return {
            ...card,
            cost: resolvedCost,
        };
    }

    private applyBattleStartEquipmentEffects(): void {
        for (const status of this.equipmentConfig.battleStartPlayerStatuses) {
            this.playerStatusEffects = this.applyStatusEffectToActor(this.playerStatusEffects, status);
        }

        for (const status of this.equipmentConfig.battleStartEnemyStatuses) {
            this.enemyStatusEffects = this.applyStatusEffectToActor(this.enemyStatusEffects, status);
        }

        if (this.equipmentConfig.battleStartSelfDamage > 0) {
            this.playerState = {
                ...this.playerState,
                health: Math.max(0, this.playerState.health - this.equipmentConfig.battleStartSelfDamage),
            };
            this.handlePlayerHealthLost(this.equipmentConfig.battleStartSelfDamage);
            this.showPopupBatch('player-hp', [{ type: 'damage', value: this.equipmentConfig.battleStartSelfDamage }]);
            this.appendBattleLog(`Player sacrifices ${this.equipmentConfig.battleStartSelfDamage} HP`);
            this.emitBattleActionResolved({
                actionType: 'BATTLE_START_SELF_DAMAGE',
                sourceId: this.getPlayerActorId(),
                targetIds: [this.getPlayerActorId()],
                damage: this.equipmentConfig.battleStartSelfDamage,
                block: 0,
                statusDelta: [],
            });
        }
    }

    private applyStatusEffectToActor(
        currentState: StatusEffectState,
        application: StatusEffectApplication,
    ): StatusEffectState {
        const updateResult = this.statusEffectService.applyStatusEffect(currentState, application);
        this.appendStatusEventLogs(updateResult.events);
        return updateResult.statusEffects;
    }

    private shouldHideEnemyIntent(): boolean {
        if (this.equipmentConfig.hideEnemyIntent) {
            return true;
        }

        return Boolean(
            this.dreadRule?.effects.hideEnemyIntentOnEvenTurns
            && this.turnNumber > 0
            && this.turnNumber % 2 === 0,
        );
    }

    private shouldPreventPoisonDecay(actor: 'player' | 'enemy', statusBeforeTurnEnd: StatusEffectState): boolean {
        if (statusBeforeTurnEnd.poison <= 0) {
            return false;
        }

        if (this.dreadRule?.effects.poisonDoesNotDecay) {
            return true;
        }

        return actor === 'enemy' && this.equipmentConfig.poisonDoesNotDecay;
    }

    private applyDreadRuleSelfDamageReaction(selfDamageTaken: number): void {
        const strengthGain = this.dreadRule?.effects.firstSelfDamageStrength ?? 0;
        if (
            selfDamageTaken <= 0
            || strengthGain <= 0
            || this.dreadRuleSelfDamageTriggeredThisTurn
            || this.turnNumber <= 0
        ) {
            return;
        }

        this.dreadRuleSelfDamageTriggeredThisTurn = true;
        const statusUpdate = this.statusEffectService.applyStatusEffect(
            this.playerStatusEffects,
            {
                type: STATUS_EFFECT_TYPE.STRENGTH,
                stacks: strengthGain,
                target: 'Player',
            },
        );
        this.playerStatusEffects = statusUpdate.statusEffects;
        this.appendStatusEventLogs(statusUpdate.events);
        this.ensureBattlePresentationFacade().present([
            { kind: 'popups', anchorId: 'player-panel', requests: [{ type: 'buff', value: strengthGain }] },
            { kind: 'pulse', actor: 'player', color: COLOR_ACTION_BUFF },
        ]);
        this.appendBattleLog(`${this.dreadRule?.name}: +${strengthGain} STR`);
    }

    private applyDreadRuleTurnEndPenalty(remainingEnergy: number): boolean {
        const selfDamagePerEnergy = this.dreadRule?.effects.turnEndSelfDamagePerUnspentEnergy ?? 0;
        if (remainingEnergy <= 0 || selfDamagePerEnergy <= 0) {
            return false;
        }

        const selfDamage = remainingEnergy * selfDamagePerEnergy;
        this.playerState = {
            ...this.playerState,
            health: Math.max(0, this.playerState.health - selfDamage),
        };
        this.playerDamageTakenWindow += selfDamage;
        this.handlePlayerHealthLost(selfDamage);
        this.ensureBattlePresentationFacade().present([
            { kind: 'popups', anchorId: 'player-hp', requests: [{ type: 'damage', value: selfDamage }] },
        ]);
        this.appendBattleLog(`${this.dreadRule?.name}: ${selfDamage} self-damage for ${remainingEnergy} unspent energy`);
        this.emitBattleActionResolved({
            actionType: 'DREAD_RULE_SELF_DAMAGE',
            sourceId: this.getPlayerActorId(),
            targetIds: [this.getPlayerActorId()],
            damage: selfDamage,
            block: 0,
            statusDelta: [],
        });

        if (this.playerState.health > 0) {
            return false;
        }

        this.showBattleEnd('player-lose');
        return true;
    }

    private getTurnStartDrawBonus(): number {
        return this.pendingNextTurnDrawBonus
            + this.equipmentConfig.extraDrawPerTurn
            + (this.turnNumber === 1 ? this.equipmentConfig.extraDrawOnFirstTurn : 0);
    }

    private getTurnStartEnergyBonus(): number {
        const randomBonus = rollTurnStartBonusEnergy(this.equipmentConfig, Math.random());
        return this.equipmentConfig.turnStartEnergy
            + randomBonus
            + (this.turnNumber === 1 ? this.equipmentConfig.firstTurnExtraEnergy : 0)
            + (this.turnNumber === 1 ? this.battleStartEnergyBonus : 0);
    }

    private captureOpeningHandCardIds(): void {
        if (this.turnNumber !== 1) {
            return;
        }

        this.openingHandCardIds = new Set(
            this.drawCycleState.hand.map((card) => card.id),
        );
    }

    private calculateDeferredDrawBonus(): number {
        return getTurnEndEquipmentBonus(
            this.equipmentInventory,
            {
                handCount: this.drawCycleState.hand.length,
                remainingEnergy: this.energyState.current,
            },
        ).nextTurnDrawBonus;
    }

    private applyEquipmentAttackAftermath(card: Card): void {
        if (card.type !== CARD_TYPE.ATTACK) {
            return;
        }
    }

    private applyReactiveDefenseEffects(damageDealt: number): void {
        if (damageDealt <= 0) {
            return;
        }
        const bonus = getDamageTakenEquipmentBonus(
            this.equipmentInventory,
            damageDealt,
            this.martyrStrengthGainedThisTurn,
        );
        this.martyrStrengthGainedThisTurn = bonus.strengthGainConsumedThisTurn;

        if (bonus.reflectedDamage > 0) {
            this.setCurrentEncounterEnemyState({
                ...this.enemyState,
                health: Math.max(0, this.enemyState.health - bonus.reflectedDamage),
            });
            this.appendBattleLog(`${this.getEnemyLabel()} takes ${bonus.reflectedDamage} thorns`);
            this.showPopupBatch('enemy-hp', [{ type: 'damage', value: bonus.reflectedDamage }]);
        }

        if (bonus.strengthGained > 0) {
            this.playerStatusEffects = this.applyStatusEffectToActor(
                this.playerStatusEffects,
                {
                    type: STATUS_EFFECT_TYPE.STRENGTH,
                    stacks: bonus.strengthGained,
                    target: 'Player',
                },
            );
        }
    }

    private applyKillRewards(): void {
        const reward = getEnemyDefeatEquipmentReward(this.equipmentInventory);
        if (reward.heal > 0) {
            this.playerState = {
                ...this.playerState,
                health: Math.min(this.playerState.maxHealth, this.playerState.health + reward.heal),
            };
            this.appendBattleLog(`Player harvests ${reward.heal} HP`);
            this.syncPlayerBreakpointState();
        }

        if (reward.extraEnergy > 0) {
            this.nextBattleStartEnergyBonus += reward.extraEnergy;
            this.appendBattleLog(`Player stores ${reward.extraEnergy} energy for the next battle`);
        }
    }

    private handlePlayerHealthLost(amount: number): void {
        if (amount <= 0) {
            return;
        }
        this.queuedAttackPowerBonus += getHealthLossEquipmentBonus(
            this.equipmentInventory,
            amount,
        ).nextAttackPowerBonus;
    }

    private getPlayerHealthRatio(): number {
        if (!this.playerState || this.playerState.maxHealth <= 0) {
            return 1;
        }

        return this.playerState.health / this.playerState.maxHealth;
    }

    private getPlayerBreakpointState(): PlayerBreakpointState {
        if (
            this.getPlayerHealthRatio() <= DESPERATION_HP_THRESHOLD
            || this.playerSelfDamageTotal >= DESPERATION_SELF_DAMAGE_THRESHOLD
        ) {
            return 'desperation';
        }

        if (this.getPlayerHealthRatio() <= BLOODIED_HP_THRESHOLD) {
            return 'bloodied';
        }

        return 'stable';
    }

    private syncPlayerBreakpointState(): void {
        const nextState = this.getPlayerBreakpointState();
        if (nextState === this.playerBreakpointState) {
            return;
        }

        this.playerBreakpointState = nextState;

        if (nextState === 'bloodied') {
            this.appendBattleLog('Bloodied');
            this.playPanelPulseMotion('player', COLOR_BREAKPOINT_BLOODIED);
        } else if (nextState === 'desperation') {
            this.appendBattleLog('Desperation');
            this.playPanelImpactMotion('player', COLOR_BREAKPOINT_DESPERATION);
        } else {
            this.appendBattleLog('Player steadies');
        }

        this.appendBreakpointCardReactions();
        this.playerStatusText?.setText(this.formatPlayerStatusSummary());
        this.updatePlayerBreakpointDisplay();
    }

    private trackPlayerSelfDamage(amount: number): void {
        if (amount <= 0) {
            return;
        }

        this.playerSelfDamageTotal += amount;
    }

    private appendBreakpointCardReactions(): void {
        if (!this.drawCycleState || !this.playerState) {
            this.activeBreakpointReactionKeys.clear();
            return;
        }

        const nextActiveKeys = new Set<string>();
        const seen = new Set<string>();
        for (const card of this.drawCycleState.hand) {
            const activeCost = resolveCardCost(card, this.playerState.health, {
                playerMaxHealth: this.playerState.maxHealth,
                turnDamageTaken: this.playerDamageTakenWindow,
            });

            if (
                card.effectPayload?.costWhenConditionMet !== undefined
                && checkCardCondition(card, this.playerState.health, {
                    playerMaxHealth: this.playerState.maxHealth,
                    turnDamageTaken: this.playerDamageTakenWindow,
                })
            ) {
                const reactionKey = `cost:${card.name}`;
                nextActiveKeys.add(reactionKey);
                if (!seen.has(reactionKey) && !this.activeBreakpointReactionKeys.has(reactionKey)) {
                    seen.add(reactionKey);
                    this.appendBattleLog(`${card.name} cost ${activeCost}`);
                }
            }

            if (
                this.getPlayerBreakpointState() === 'desperation'
                && card.effectPayload?.scaling?.source === 'MISSING_HEALTH'
            ) {
                const reactionKey = `finisher:${card.name}`;
                nextActiveKeys.add(reactionKey);
                if (!seen.has(reactionKey) && !this.activeBreakpointReactionKeys.has(reactionKey)) {
                    seen.add(reactionKey);
                    this.appendBattleLog(`${card.name} surges with missing HP`);
                }
            }
        }

        this.activeBreakpointReactionKeys = nextActiveKeys;
    }

    private getHandLayoutMetrics(handCount: number): HandLayoutMetrics {
        if (handCount <= 1) {
            return {
                startX: MAIN_PANEL_CENTER_X,
                stride: CARD_WIDTH + CARD_GAP,
                scale: 1,
            };
        }

        const widthAtDefaultGap = handCount * CARD_WIDTH + (handCount - 1) * CARD_GAP;
        if (widthAtDefaultGap <= HAND_CARD_LAYOUT_WIDTH) {
            return {
                startX: MAIN_PANEL_CENTER_X - (widthAtDefaultGap / 2) + (CARD_WIDTH / 2),
                stride: CARD_WIDTH + CARD_GAP,
                scale: 1,
            };
        }

        const widthAtCompactGap = handCount * CARD_WIDTH + (handCount - 1) * CARD_MIN_GAP;
        const scale = Math.min(1, HAND_CARD_LAYOUT_WIDTH / widthAtCompactGap);
        const scaledCardWidth = CARD_WIDTH * scale;
        const scaledStride = (CARD_WIDTH + CARD_MIN_GAP) * scale;
        const totalWidth = widthAtCompactGap * scale;

        return {
            startX: MAIN_PANEL_CENTER_X - (totalWidth / 2) + (scaledCardWidth / 2),
            stride: scaledStride,
            scale,
        };
    }

    private canPlayCard(card: Card): boolean {
        if (card.keywords.includes(CARD_KEYWORD.UNPLAYABLE)) {
            return false;
        }

        return this.energyService.canAfford(this.energyState, card.cost)
            && checkCardCondition(card, this.playerState.health, {
                playerMaxHealth: this.playerState.maxHealth,
                turnDamageTaken: this.playerDamageTakenWindow,
            });
    }

    private getCardColor(card: Card): number {
        switch (card.type) {
            case CARD_TYPE.ATTACK:
                return COLOR_CARD_ATTACK;
            case CARD_TYPE.GUARD:
                return COLOR_CARD_GUARD;
            case CARD_TYPE.SKILL:
                return COLOR_CARD_SKILL;
            case CARD_TYPE.POWER:
                return COLOR_CARD_POWER;
            case CARD_TYPE.CURSE:
                return COLOR_CARD_CURSE;
            default:
                return COLOR_CARD_STATUS;
        }
    }

    private getCardIcon(card: Card): string {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE: return '⚔️';
            case CARD_EFFECT_TYPE.BLOCK: return '🛡️';
            case CARD_EFFECT_TYPE.STATUS_EFFECT: return '💫';
            case CARD_EFFECT_TYPE.FLEE: return '💨';
            case CARD_EFFECT_TYPE.HEAL: return '✚';
            case CARD_EFFECT_TYPE.DRAW: return '✧';
            case CARD_EFFECT_TYPE.MULTI_HIT: return '⟡';
            case CARD_EFFECT_TYPE.DAMAGE_BLOCK: return '⬢';
            case CARD_EFFECT_TYPE.BUFF: return '✦';
            case CARD_EFFECT_TYPE.DISCARD_EFFECT: return '⇄';
            case CARD_EFFECT_TYPE.CONDITIONAL: return '!?';
            default: return card.type === CARD_TYPE.POWER ? '✦' : '⚔️';
        }
    }

    private getCardBorderColor(card: Card): number {
        const breakpointHighlight = this.getCardBreakpointHighlight(card);
        if (breakpointHighlight) {
            return breakpointHighlight.borderColor;
        }

        switch (card.rarity) {
            case CARD_RARITY.UNCOMMON:
                return COLOR_RARITY_UNCOMMON;
            case CARD_RARITY.RARE:
                return COLOR_RARITY_RARE;
            default:
                return COLOR_RARITY_COMMON;
        }
    }

    private getCardBreakpointHighlight(card: Card): { borderColor: number; badgeColor: number; textColor: string } | undefined {
        if (!this.playerState) {
            return undefined;
        }

        const breakpointState = this.getPlayerBreakpointState();

        if (
            card.effectPayload?.costWhenConditionMet !== undefined
            && card.condition
            && checkCardCondition(card, this.playerState.health, {
                playerMaxHealth: this.playerState.maxHealth,
                turnDamageTaken: this.playerDamageTakenWindow,
            })
        ) {
            return {
                borderColor: breakpointState === 'desperation'
                    ? COLOR_BREAKPOINT_FINISHER
                    : COLOR_BREAKPOINT_ACTIVE,
                badgeColor: breakpointState === 'desperation'
                    ? COLOR_BREAKPOINT_FINISHER
                    : COLOR_BREAKPOINT_ACTIVE,
                textColor: '#102414',
            };
        }

        if (
            breakpointState === 'desperation'
            && card.effectPayload?.scaling?.source === 'MISSING_HEALTH'
        ) {
            return {
                borderColor: COLOR_BREAKPOINT_FINISHER,
                badgeColor: COLOR_BREAKPOINT_FINISHER,
                textColor: '#2b1700',
            };
        }

        return undefined;
    }

    private describeCardBreakpoint(card: Card): string | undefined {
        if (!this.playerState) {
            return undefined;
        }

        if (card.effectPayload?.scaling?.source === 'MISSING_HEALTH') {
            const missingHealth = Math.max(0, this.playerState.maxHealth - this.playerState.health);
            const currentDamage = Math.max(
                0,
                Math.floor(missingHealth * card.effectPayload.scaling.multiplier),
            );

            return this.getPlayerBreakpointState() === 'desperation'
                ? `Finisher online: ${currentDamage} current damage from ${missingHealth} missing HP.`
                : `Current payoff: ${currentDamage} damage from ${missingHealth} missing HP.`;
        }

        const breakpointHighlight = this.getCardBreakpointHighlight(card);
        if (!breakpointHighlight) {
            return undefined;
        }

        return this.getPlayerBreakpointState() === 'desperation'
            ? 'Finisher online: Desperation window is active.'
            : 'Breakpoint online: this card is primed.';
    }

    private getCardTypeLabel(card: Card): string {
        switch (card.type) {
            case CARD_TYPE.ATTACK:
                return 'ATTACK';
            case CARD_TYPE.GUARD:
                return 'GUARD';
            case CARD_TYPE.SKILL:
                return 'SKILL';
            case CARD_TYPE.POWER:
                return 'POWER';
            case CARD_TYPE.CURSE:
                return 'CURSE';
            default:
                return card.type;
        }
    }

    private getCardRarityLabel(card: Card): string {
        switch (card.rarity) {
            case CARD_RARITY.UNCOMMON:
                return 'UNCOMMON';
            case CARD_RARITY.RARE:
                return 'RARE';
            default:
                return 'COMMON';
        }
    }

    private getCardArchetypeLabel(card: Card): string {
        switch (card.archetype) {
            case CARD_ARCHETYPE.BLOOD_OATH:
                return 'Blood Oath';
            case CARD_ARCHETYPE.SHADOW_ARTS:
                return 'Shadow Arts';
            case CARD_ARCHETYPE.IRON_WILL:
                return 'Iron Will';
            case CARD_ARCHETYPE.CURSE:
                return 'Curse';
            default:
                return 'Neutral';
        }
    }

    private getCardEffectTag(card: Card): string {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                return `DMG ${card.power}`;
            case CARD_EFFECT_TYPE.BLOCK:
                return `BLK ${card.secondaryPower ?? card.power}`;
            case CARD_EFFECT_TYPE.DRAW:
                return `DRAW ${card.drawCount ?? card.effectPayload?.drawCount ?? 0}`;
            case CARD_EFFECT_TYPE.HEAL:
                return `HEAL ${card.healAmount ?? card.effectPayload?.healAmount ?? 0}`;
            case CARD_EFFECT_TYPE.MULTI_HIT:
                return `HITS ${card.hitCount ?? card.effectPayload?.hitCount ?? 1}`;
            case CARD_EFFECT_TYPE.DAMAGE_BLOCK:
                return 'DMG+BLK';
            case CARD_EFFECT_TYPE.BUFF:
                return card.buff?.type ?? card.effectPayload?.buff?.type ?? 'BUFF';
            case CARD_EFFECT_TYPE.DISCARD_EFFECT:
                return `DISC ${card.discardCount ?? card.effectPayload?.discardCount ?? 1}`;
            case CARD_EFFECT_TYPE.CONDITIONAL:
                return 'COND';
            case CARD_EFFECT_TYPE.FLEE:
                return 'FLEE';
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                return card.statusEffect?.type ?? card.statusEffects?.[0]?.type ?? 'STATUS';
            default:
                return card.effectType;
        }
    }

    private describeCardEffect(card: Card): string {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                return [
                    card.name === 'Shockwave'
                        ? `Deal ${card.power} damage to the current enemy.`
                        : `Deal ${card.power} damage.`,
                    card.effectPayload?.costWhenConditionMet !== undefined && card.condition?.type === 'HP_PERCENT_THRESHOLD'
                        ? `Costs ${card.effectPayload.costWhenConditionMet} at ${card.condition.value}% HP or lower.`
                        : undefined,
                    (card.effectPayload?.healOnKillPercent ?? 0) > 0
                        ? `Restore ${card.effectPayload?.healOnKillPercent ?? 0}% max health on kill.`
                        : undefined,
                ].filter(Boolean).join(' ');
            case CARD_EFFECT_TYPE.BLOCK:
                return `Gain ${card.secondaryPower ?? card.power} block.`;
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                return `Apply ${card.statusEffect?.type ?? card.statusEffects?.[0]?.type ?? 'status'} effect.`;
            case CARD_EFFECT_TYPE.FLEE:
                return 'Escape the battle.';
            case CARD_EFFECT_TYPE.DRAW:
                return [
                    `Draw ${card.drawCount ?? card.effectPayload?.drawCount ?? 0} card(s).`,
                    (card.effectPayload?.energyChange ?? 0) > 0
                        ? `Gain ${card.effectPayload?.energyChange ?? 0} energy.`
                        : undefined,
                ].filter(Boolean).join(' ');
            case CARD_EFFECT_TYPE.HEAL:
                return `Restore ${card.healAmount ?? card.effectPayload?.healAmount ?? 0} health.`;
            case CARD_EFFECT_TYPE.MULTI_HIT:
                return [
                    `Hit ${card.hitCount ?? card.effectPayload?.hitCount ?? 1} time(s) for ${card.power}.`,
                    (card.selfDamage ?? card.effectPayload?.selfDamage ?? 0) > 0
                        ? `Lose ${card.selfDamage ?? card.effectPayload?.selfDamage ?? 0} health.`
                        : undefined,
                ].filter(Boolean).join(' ');
            case CARD_EFFECT_TYPE.DAMAGE_BLOCK:
                return `Deal ${card.power} and gain ${card.secondaryPower ?? card.effectPayload?.blockAmount ?? 0} block.`;
            case CARD_EFFECT_TYPE.BUFF:
                return `${card.buff?.type ?? card.effectPayload?.buff?.type ?? 'Buff'} ${card.buff?.value ?? card.effectPayload?.buff?.value ?? 0}.`;
            case CARD_EFFECT_TYPE.DISCARD_EFFECT:
                return `Discard ${card.discardCount ?? card.effectPayload?.discardCount ?? 1} and draw ${card.drawCount ?? card.effectPayload?.drawCount ?? 0}.`;
            case CARD_EFFECT_TYPE.CONDITIONAL:
                return 'Conditional payoff card.';
            default:
                return 'Resolve card effect.';
        }
    }

    private resolveCardDetailCost(card: Card): number {
        if (card.effectPayload?.costWhenConditionMet === undefined || !card.condition) {
            return card.cost;
        }

        if (!this.playerState) {
            return card.cost;
        }

        return resolveCardCost(card, this.playerState.health, {
            playerMaxHealth: this.playerState.maxHealth,
            turnDamageTaken: this.playerDamageTakenWindow,
        });
    }

    private describeCardCondition(card: Card): string | undefined {
        if (!card.condition) {
            return undefined;
        }

        const playerHealth = this.playerState?.health;
        const playerMaxHealth = this.playerState?.maxHealth;

        switch (card.condition.type) {
            case 'HP_THRESHOLD': {
                if (playerHealth === undefined) {
                    return `Condition: HP ${card.condition.value} or lower.`;
                }

                return playerHealth <= card.condition.value
                    ? `Condition active: HP ${playerHealth} is at or below ${card.condition.value}.`
                    : `Condition unmet: HP ${playerHealth} is above ${card.condition.value}.`;
            }
            case 'HP_PERCENT_THRESHOLD': {
                if (playerHealth === undefined || playerMaxHealth === undefined || playerMaxHealth <= 0) {
                    return `Condition: HP ${card.condition.value}% or lower.`;
                }

                const currentPercent = (playerHealth / playerMaxHealth) * 100;
                const normalizedPercent = Number.isInteger(currentPercent)
                    ? `${currentPercent}`
                    : currentPercent.toFixed(1);
                const breakpointLabel = card.condition.value <= 25 ? 'Desperation' : 'Bloodied';

                return currentPercent <= card.condition.value
                    ? `Breakpoint active: ${breakpointLabel}. HP ${normalizedPercent}% is at or below ${card.condition.value}%.`
                    : `Breakpoint locked: ${breakpointLabel} at ${card.condition.value}%. HP ${normalizedPercent}% is above it.`;
            }
            case 'TURN_DAMAGE_TAKEN_AT_LEAST': {
                const turnDamageTaken = this.playerDamageTakenWindow ?? 0;
                return turnDamageTaken >= card.condition.value
                    ? `Condition active: took ${turnDamageTaken} damage this turn.`
                    : `Condition unmet: took ${turnDamageTaken} damage this turn, need ${card.condition.value}.`;
            }
            case 'MISSING_HEALTH_DAMAGE':
                return 'Condition: scales with missing health.';
            default:
                return undefined;
        }
    }

    private createCardVisual(
        card: Card,
        x: number,
        y: number,
        index: number,
        canAfford: boolean,
        baseScale: number = 1,
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const breakpointHighlight = this.getCardBreakpointHighlight(card);
        const bgColor = canAfford ? this.getCardColor(card) : COLOR_CARD_DIM;
        const alpha = canAfford ? 0.85 : 0.45;
        const borderColor = breakpointHighlight?.borderColor ?? this.getCardBorderColor(card);

        const bg = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, bgColor, alpha);
        bg.setStrokeStyle(2, borderColor, canAfford ? 0.8 : 0.35);
        container.add(bg);

        // 에너지 비용 뱃지 (좌상단)
        const costBadge = this.add.circle(
            -CARD_WIDTH / 2 + 14,
            -CARD_HEIGHT / 2 + 14,
            12,
            breakpointHighlight?.badgeColor ?? 0x222266,
            0.9,
        );
        container.add(costBadge);
        const costText = this.add.text(-CARD_WIDTH / 2 + 14, -CARD_HEIGHT / 2 + 14, `${card.cost}`, {
            fontSize: '14px',
            color: canAfford
                ? breakpointHighlight?.textColor ?? '#ffdd44'
                : '#888888',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(costText);

        const typeText = this.add.text(0, -54, this.getCardTypeLabel(card), {
            fontSize: '7px',
            color: '#eef4ff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(typeText);

        const rarityText = this.add.text(CARD_WIDTH / 2 - 12, -CARD_HEIGHT / 2 + 10, this.getCardRarityLabel(card).charAt(0), {
            fontSize: '9px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(rarityText);

        // 타입 아이콘
        const iconText = this.add.text(0, -30, this.getCardIcon(card), {
            fontSize: '26px',
        }).setOrigin(0.5);
        container.add(iconText);

        // 파워 수치 (damage/block 카드만)
        if (card.power > 0) {
            const powerText = this.add.text(0, 10, `${card.power}`, {
                fontSize: '28px',
                color: canAfford ? '#ffffff' : '#888888',
                fontFamily: 'monospace',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            container.add(powerText);
        }

        // 카드 이름
        const nameText = this.add.text(0, 45, card.name, {
            fontSize: '9px',
            color: canAfford ? '#cccccc' : '#666666',
            fontFamily: 'monospace',
            wordWrap: { width: 84 },
            align: 'center',
        }).setOrigin(0.5);
        container.add(nameText);

        const effectText = this.add.text(0, 58, this.getCardEffectTag(card), {
            fontSize: '7px',
            color: breakpointHighlight ? '#fff2b3' : '#ffaa44',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(effectText);

        const archetypeText = this.add.text(0, 69, this.getCardArchetypeLabel(card), {
            fontSize: '7px',
            color: '#b8d0ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(archetypeText);

        bg.setInteractive({ useHandCursor: canAfford });
        bg.on('pointerover', () => {
            container.setScale(baseScale * 1.08);
            bg.setStrokeStyle(3, 0xffffaa, 1);
            this.showCardDetail(card);
        });
        bg.on('pointerout', () => {
            if (!this.isInputLocked) {
                container.setScale(baseScale);
            }
            bg.setStrokeStyle(2, borderColor, canAfford ? 0.8 : 0.35);
            this.clearCardDetail();
        });
        bg.on('pointerdown', () => {
            if (!this.isInputLocked && canAfford) {
                this.onPlayCard(index);
            }
        });

        container.setScale(baseScale);
        return container;
    }

    private clearCardSprites(): void {
        this.cardSprites.forEach((sprite) => sprite.destroy());
        this.cardSprites = [];
        this.clearCardDetail();
    }

    // -----------------------------------------------------------------------
    // Player Turn Flow
    // -----------------------------------------------------------------------

    private startPlayerTurn(): void {
        this.turnNumber++;
        this.actionQueueIndex = 0;
        this.martyrStrengthGainedThisTurn = 0;
        this.dreadRuleSelfDamageTriggeredThisTurn = false;
        if (this.turnNumber > 1) {
            this.openingHandCardIds.clear();
        }

        if (this.applyPlayerTurnStartOngoingEffects()) {
            return;
        }

        // 에너지 리필
        this.energyState = this.energyService.refill(this.energyState);
        this.energyState = {
            ...this.energyState,
            current: this.energyState.current + this.getTurnStartEnergyBonus(),
        };
        if (this.turnNumber === 1) {
            this.battleStartEnergyBonus = 0;
        }

        // 드로우
        const handCountBeforeDraw = this.drawCycleState.hand.length;
        this.drawCycleState = this.drawCycleService.drawCards(
            this.drawCycleState,
            DEFAULT_HAND_SIZE + this.getTurnStartDrawBonus(),
        );
        const drawCount = Math.max(0, this.drawCycleState.hand.length - handCountBeforeDraw);
        this.pendingNextTurnDrawBonus = 0;
        this.captureOpeningHandCardIds();
        this.syncPlayerBreakpointState();
        this.appendBreakpointCardReactions();
        if (this.dreadRuleService.isBlackoutTurn(this.dreadRule, this.turnNumber)) {
            this.appendBattleLog('Blackout: intent hidden');
        }
        this.emitBattleTurnStarted(drawCount);

        // UI 갱신
        this.isInputLocked = false;
        this.updateTurnDisplay();
        this.updateDreadRuleDisplay();
        this.updateEnemyIntentDisplay(false);
        this.updateAllDisplays();
        this.displayHandCards();
    }

    private onPlayCard(handIndex: number): void {
        const baseCard = this.drawCycleState.hand[handIndex];
        if (!baseCard) return;
        const modifier = this.resolvePlayerCardModifier(baseCard);
        const card = this.applyRuntimeCardAdjustments(modifier.card);

        if (!this.canPlayCard(card)) {
            return;
        }

        // 에너지 비용 체크
        const spendResult = this.energyService.spendEnergy(this.energyState, card.cost);
        if (!spendResult.playable) return;

        this.isInputLocked = true;
        this.energyState = spendResult.energyState;
        this.playCardSelectionMotion(handIndex, card);

        // 카드 효과 적용
        const effectResult = this.cardEffectService.applyEffect(
            card,
            this.playerState,
            this.enemyState,
            {
                userStatusEffects: this.playerStatusEffects,
                targetStatusEffects: this.enemyStatusEffects,
                turnDamageTaken: this.playerDamageTakenWindow,
            },
        );
        this.playerState = effectResult.userState;
        this.setCurrentEncounterEnemyState(effectResult.targetState);
        if (effectResult.energyGained > 0) {
            this.energyState = {
                ...this.energyState,
                current: this.energyState.current + effectResult.energyGained,
            };
        }
        if (effectResult.selfDamageTaken > 0) {
            this.appendBattleLog(`Self-Damage ${effectResult.selfDamageTaken}`);
        }
        this.playerDamageTakenWindow += effectResult.selfDamageTaken;

        this.applyPlayerCardStatusEffects(effectResult);
        this.applyPlayerCardBuff(card, effectResult);
        this.trackActivePower(card);
        this.resolveHealthLossStrengthTriggers('enemy', effectResult.damageDealt);
        if (modifier.consumesNextAttackBonus && this.queuedAttackPowerBonus > 0) {
            this.queuedAttackPowerBonus = 0;
        }
        this.handlePlayerHealthLost(effectResult.selfDamageTaken);
        this.applyEquipmentAttackAftermath(card);
        if (effectResult.damageDealt > 0 && modifier.extraEnemyStatusEffects.length > 0) {
            this.enemyStatusEffects = this.applyStatusEffectsToState(
                this.enemyStatusEffects,
                modifier.extraEnemyStatusEffects.map((status) => ({
                    type: status.type,
                    duration: 'duration' in status ? status.duration : undefined,
                    stacks: 'stacks' in status ? status.stacks : undefined,
                })),
                this.getEnemyLabel(),
            );
        }

        // 데미지 추적
        this.totalEnemyDamage += effectResult.damageDealt;

        // 드로우 사이클에서 카드 사용 처리 (Exhaust/Discard)
        this.drawCycleState = this.drawCycleService.playCard(this.drawCycleState, card.id, card);
        this.drawCycleState = this.resolvePostPlayDrawCycle(this.drawCycleState, effectResult);
        const targetIds = this.resolvePlayerCardTargetIds(card, effectResult);
        this.emitBattleCardPlayed(card, targetIds);
        if (effectResult.selfDamageTaken > 0) {
            this.emitBattleActionResolved({
                actionType: 'SELF_DAMAGE',
                sourceId: this.getPlayerActorId(),
                targetIds: [this.getPlayerActorId()],
                damage: effectResult.selfDamageTaken,
                block: 0,
                statusDelta: [],
            });
        }
        this.emitBattleActionResolved({
            actionType: card.effectType,
            sourceId: this.getPlayerActorId(),
            targetIds,
            damage: effectResult.damageDealt,
            block: effectResult.blockGained,
            statusDelta: this.buildStatusDelta(targetIds[0], effectResult),
        });

        // 효과 텍스트 표시
        const effectPresentationDelayMs = this.showEffectText(card, effectResult);
        const motionPresentationDelayMs = this.playResolvedActionMotion('player', card, effectResult);
        this.appendBreakpointCardReactions();
        const queuedPresentationDelayMs = Math.max(
            CARD_PLAY_ANIM_MS,
            effectPresentationDelayMs,
            motionPresentationDelayMs,
        ) + ACTION_QUEUE_STEP_MS;

        // 카드 사용 애니메이션 후 상태 갱신
        this.time.delayedCall(queuedPresentationDelayMs, () => {
            this.clearEffectText();
            this.updateAllDisplays();

            if (this.playerState.health <= 0) {
                this.showBattleEnd('player-lose');
                return;
            }

            // 전투 이탈 체크
            if (effectResult.fled) {
                this.showBattleEnd('player-win', 'escape');
                return;
            }

            // 적 사망 체크
            if (this.enemyState.health <= 0) {
                this.applyCardKillReward(card);
                this.applyKillRewards();
                this.syncPlayerBreakpointState();
                if (this.hasRemainingEncounterEnemies() && this.switchToNextLivingEnemy()) {
                    this.updateAllDisplays();
                    this.isInputLocked = false;
                    this.displayHandCards();
                    return;
                }

                this.showBattleEnd('player-win');
                return;
            }

            // 에너지 0 자동 턴 종료
            if (spendResult.autoEndTurn && this.energyState.current === 0) {
                this.onEndTurn();
                return;
            }

            // 입력 잠금 해제 및 카드 재표시
            this.isInputLocked = false;
            this.displayHandCards();
        });
    }

    private onEndTurn(): void {
        this.isInputLocked = true;
        this.pendingNextTurnDrawBonus = this.calculateDeferredDrawBonus();
        const remainingEnergy = this.energyState.current;

        // 손패 정리 (Retain 카드 유지, 나머지 버림패)
        const turnEndResult = this.drawCycleService.endTurn(this.drawCycleState);
        this.drawCycleState = turnEndResult.state;
        this.applyPlayerHandEndTurnEffects(turnEndResult.effects);
        this.resolveTurnEndStatusEffects('player');
        this.emitBattleTurnEnded(
            remainingEnergy,
            turnEndResult.state.hand.length,
            turnEndResult.effects.filter(
                (effect) => effect.type === HAND_END_TURN_EFFECT_TYPE.ETHEREAL_EXHAUSTED,
            ).length,
        );
        if (this.applyDreadRuleTurnEndPenalty(remainingEnergy)) {
            return;
        }
        this.playerDamageTakenWindow = 0;
        this.clearCardSprites();
        this.updateAllDisplays();

        if (this.playerState.health <= 0) {
            this.showBattleEnd('player-lose');
            return;
        }

        // 적 턴 실행
        this.time.delayedCall(ENEMY_TURN_DELAY_MS / 2, () => {
            this.startEncounterEnemyTurnCycle(this.sceneData?.enemy.id);
        });
    }

    // -----------------------------------------------------------------------
    // Enemy Turn
    // -----------------------------------------------------------------------

    private startEncounterEnemyTurnCycle(preferredTargetEnemyId?: string): void {
        const actingEnemyIds = this.getLivingEncounterEnemyStates()
            .map((entry) => entry.enemy.id);

        if (actingEnemyIds.length === 0) {
            this.showBattleEnd('player-win');
            return;
        }

        this.executeEncounterEnemyTurnAtIndex(actingEnemyIds, preferredTargetEnemyId, 0);
    }

    private executeEncounterEnemyTurnAtIndex(
        actingEnemyIds: readonly string[],
        preferredTargetEnemyId: string | undefined,
        index: number,
    ): void {
        if (index >= actingEnemyIds.length) {
            this.finishEncounterEnemyTurnCycle(preferredTargetEnemyId);
            return;
        }

        const enemyId = actingEnemyIds[index];
        const encounterEnemy = enemyId ? this.getEncounterEnemyEntryById(enemyId) : undefined;
        if (!encounterEnemy || encounterEnemy.state.health <= 0) {
            this.executeEncounterEnemyTurnAtIndex(actingEnemyIds, preferredTargetEnemyId, index + 1);
            return;
        }

        this.syncCurrentEncounterEnemyRuntime();
        this.activateEncounterEnemy(enemyId);
        this.executeEnemyTurn(() => {
            this.executeEncounterEnemyTurnAtIndex(actingEnemyIds, preferredTargetEnemyId, index + 1);
        });
    }

    private finishEncounterEnemyTurnCycle(preferredTargetEnemyId?: string): void {
        if (!this.hasRemainingEncounterEnemies()) {
            this.showBattleEnd('player-win');
            return;
        }

        this.restoreEncounterTargetEnemy(preferredTargetEnemyId);
        this.prepareTurnStartState('player');
        this.revealNextEnemyIntent(this.getEnemyActorId());
        this.startPlayerTurn();
    }

    private executeEnemyTurn(onComplete?: () => void): void {
        this.prepareTurnStartState('enemy');

        if (this.enemyCardPool.length === 0) {
            this.afterEnemyTurn(onComplete);
            return;
        }

        this.applyPerTurnPoison('enemy');

        const intent = this.currentEnemyIntent ?? this.revealNextEnemyIntent();
        if (!intent) {
            this.afterEnemyTurn(onComplete);
            return;
        }

        if (intent.type === ENEMY_INTENT_TYPE.BUFF) {
            if (intent.pattern === ENEMY_INTENT_PATTERN.RITUAL) {
                this.enemyAttackBuff += intent.amount;
            }
            this.emitBattleActionResolved({
                actionType: intent.type,
                sourceId: this.getEnemyActorId(),
                targetIds: [this.getEnemyActorId()],
                damage: 0,
                block: 0,
                statusDelta: [],
            });
            const motionDelayMs = this.playResolvedActionMotion('enemy', this.resolveEnemyCardFromIntent(intent), {
                damageDealt: 0,
                damageBlocked: 0,
                blockGained: 0,
                fled: false,
                buffApplied: intent.pattern === ENEMY_INTENT_PATTERN.RITUAL
                    ? { type: 'ATTACK', value: intent.amount }
                    : undefined,
            });
            const buffPresentationDelayMs = this.showEnemyBuffText(intent);

            this.time.delayedCall(Math.max(ENEMY_TURN_DELAY_MS, motionDelayMs, buffPresentationDelayMs) + ACTION_QUEUE_STEP_MS, () => {
                this.clearEffectText();
                this.updateAllDisplays();
                this.afterEnemyTurn(onComplete);
            });
            return;
        }

        const enemyCard = this.resolveEnemyCardFromIntent(intent);
        // 적 카드 효과를 플레이어에게 적용 (적이 attacker, 플레이어가 target)
        const effectResult = this.cardEffectService.applyEffect(
            enemyCard,
            this.enemyState,
            this.playerState,
            {
                userStatusEffects: this.enemyStatusEffects,
                targetStatusEffects: this.playerStatusEffects,
            },
        );
        this.setCurrentEncounterEnemyState(effectResult.userState);
        this.playerState = effectResult.targetState;
        this.totalPlayerDamage += effectResult.damageDealt;
        this.playerDamageTakenWindow += effectResult.damageDealt;

        this.applyEnemyCardStatusEffects(effectResult);
        this.applyEnemyCardBuff(enemyCard, effectResult);
        this.resolveSelfDamageStrengthTriggers('enemy', effectResult.selfDamageTaken);
        this.handlePlayerHealthLost(effectResult.damageDealt);
        this.applyReactiveDefenseEffects(effectResult.damageDealt);
        const enemyTargetIds = effectResult.damageDealt > 0
            || (effectResult.damageBlocked ?? 0) > 0
            || enemyCard.effectType === CARD_EFFECT_TYPE.STATUS_EFFECT
            ? [this.getPlayerActorId()]
            : [this.getEnemyActorId()];
        this.emitBattleActionResolved({
            actionType: enemyCard.effectType,
            sourceId: this.getEnemyActorId(),
            targetIds: enemyTargetIds,
            damage: effectResult.damageDealt,
            block: effectResult.blockGained,
            statusDelta: this.buildStatusDelta(enemyTargetIds[0], effectResult),
        });

        // 적 행동 텍스트
        const enemyMotionDelayMs = this.playResolvedActionMotion('enemy', enemyCard, effectResult);
        const enemyEffectDelayMs = this.showEnemyActionText(
            enemyCard,
            effectResult.damageDealt,
            effectResult.blockGained,
            effectResult.damageBlocked,
            effectResult.hitDamages,
        );

        this.time.delayedCall(
            Math.max(ENEMY_TURN_DELAY_MS, enemyMotionDelayMs, enemyEffectDelayMs) + ACTION_QUEUE_STEP_MS,
            () => {
            this.clearEffectText();
            this.updateAllDisplays();
            this.afterEnemyTurn(onComplete);
            },
        );
    }

    private afterEnemyTurn(onComplete?: () => void): void {
        // 플레이어 사망 체크
        if (this.playerState.health <= 0) {
            this.showBattleEnd('player-lose');
            return;
        }

        this.resolveTurnEndStatusEffects('enemy');
        this.tickEnemyAttackDebuff();
        this.consumeCurrentEnemyIntent(this.getEnemyActorId());
        this.syncCurrentEncounterEnemyRuntime();

        if (this.enemyState.health <= 0) {
            this.applyKillRewards();
            if (!this.hasRemainingEncounterEnemies()) {
                this.showBattleEnd('player-win');
                return;
            }
        }

        if (onComplete) {
            onComplete();
            return;
        }

        this.finishEncounterEnemyTurnCycle(this.sceneData?.enemy.id);
    }

    private applyPlayerHandEndTurnEffects(effects: readonly HandEndTurnEffect[]): void {
        for (const effect of effects) {
            switch (effect.type) {
                case HAND_END_TURN_EFFECT_TYPE.ETHEREAL_EXHAUSTED:
                    this.appendBattleLog(`${effect.cardName} vanishes at turn end`);
                    break;
                case HAND_END_TURN_EFFECT_TYPE.HELD_CURSE_SELF_DAMAGE:
                    this.applyHeldCurseSelfDamage(effect);
                    break;
                default:
                    break;
            }
        }
    }

    private applyHeldCurseSelfDamage(effect: HandEndTurnEffect): void {
        const damage = effect.value ?? 0;
        if (damage <= 0) {
            return;
        }

        this.playerState = {
            ...this.playerState,
            health: Math.max(0, this.playerState.health - damage),
        };
        this.handlePlayerHealthLost(damage);
        this.showPopupBatch('player-hp', [{ type: 'damage', value: damage }]);
        this.appendBattleLog(`${effect.cardName} deals ${damage} self-damage in hand`);
        this.emitBattleActionResolved({
            actionType: HAND_END_TURN_EFFECT_TYPE.HELD_CURSE_SELF_DAMAGE,
            sourceId: this.getPlayerActorId(),
            targetIds: [this.getPlayerActorId()],
            damage,
            block: 0,
            statusDelta: [],
        });
    }

    private applyCardKillReward(card: Card): void {
        const healOnKillPercent = card.effectPayload?.healOnKillPercent ?? 0;
        if (healOnKillPercent <= 0) {
            return;
        }

        const healAmount = Math.max(0, Math.floor(this.playerState.maxHealth * (healOnKillPercent / 100)));
        if (healAmount <= 0) {
            return;
        }

        const nextHealth = Math.min(this.playerState.maxHealth, this.playerState.health + healAmount);
        const actualHealing = nextHealth - this.playerState.health;
        if (actualHealing <= 0) {
            return;
        }

        this.playerState = {
            ...this.playerState,
            health: nextHealth,
        };
        this.showPopupBatch('player-hp', [{ type: 'heal', value: actualHealing }]);
        this.appendBattleLog(`${card.name} restores ${actualHealing} HP on kill`);
        this.syncPlayerBreakpointState();
    }

    private applyPlayerCardStatusEffects(effectResult: CardEffectResult): void {
        this.enemyStatusEffects = this.applyStatusEffectsToState(
            this.enemyStatusEffects,
            effectResult.statusEffectsApplied
                ?? (effectResult.statusApplied ? [effectResult.statusApplied] : []),
            this.getEnemyLabel(),
        );
    }

    private applyEnemyCardStatusEffects(effectResult: CardEffectResult): void {
        this.playerStatusEffects = this.applyStatusEffectsToState(
            this.playerStatusEffects,
            effectResult.statusEffectsApplied
                ?? (effectResult.statusApplied ? [effectResult.statusApplied] : []),
            'Player',
        );
    }

    private applyPlayerCardBuff(card: Card, effectResult: CardEffectResult): void {
        if (!effectResult.buffApplied) {
            return;
        }

        if (this.applyCustomBuffEffect('player', card, effectResult.buffApplied)) {
            return;
        }

        if (effectResult.buffApplied.target === 'TARGET') {
            this.enemyStatusEffects = this.applyBuffToState(
                this.enemyStatusEffects,
                effectResult,
                this.getEnemyLabel(),
            );
            return;
        }

        this.playerStatusEffects = this.applyBuffToState(
            this.playerStatusEffects,
            effectResult,
            'Player',
        );
    }

    private applyEnemyCardBuff(card: Card, effectResult: CardEffectResult): void {
        if (!effectResult.buffApplied) {
            return;
        }

        if (this.applyCustomBuffEffect('enemy', card, effectResult.buffApplied)) {
            return;
        }

        if (effectResult.buffApplied.target === 'TARGET') {
            this.playerStatusEffects = this.applyBuffToState(
                this.playerStatusEffects,
                effectResult,
                'Player',
            );
            return;
        }

        this.enemyStatusEffects = this.applyBuffToState(
            this.enemyStatusEffects,
            effectResult,
            this.getEnemyLabel(),
        );
    }

    private applyStatusEffectsToState(
        currentState: StatusEffectState,
        statusEffects: readonly CardStatusEffect[],
        targetLabel: string,
    ): StatusEffectState {
        let nextState = currentState;

        for (const statusEffect of statusEffects) {
            const application = this.toStatusEffectApplication(statusEffect);
            if (!application) {
                continue;
            }

            const updateResult = this.statusEffectService.applyStatusEffect(
                nextState,
                { ...application, target: targetLabel },
            );
            nextState = updateResult.statusEffects;
            this.appendStatusEventLogs(updateResult.events);
        }

        return nextState;
    }

    private applyBuffToState(
        currentState: StatusEffectState,
        effectResult: CardEffectResult,
        targetLabel: string,
    ): StatusEffectState {
        const application = this.toBuffStatusEffectApplication(effectResult);
        if (!application) {
            return currentState;
        }

        const updateResult = this.statusEffectService.applyStatusEffect(
            currentState,
            { ...application, target: targetLabel },
        );
        this.appendStatusEventLogs(updateResult.events);
        return updateResult.statusEffects;
    }

    private applyCustomBuffEffect(
        actor: 'player' | 'enemy',
        card: Card,
        buffApplied: NonNullable<CardEffectResult['buffApplied']>,
    ): boolean {
        switch (buffApplied.type) {
            case 'BLOCK_PERSIST':
                this.setOngoingBuffState(
                    actor,
                    card.type === CARD_TYPE.POWER
                        ? {
                            ...this.getOngoingBuffState(actor),
                            blockPersist: true,
                        }
                        : {
                            ...this.getOngoingBuffState(actor),
                            blockPersistCharges: this.getOngoingBuffState(actor).blockPersistCharges + 1,
                        },
                );
                this.appendBattleLog(
                    card.type === CARD_TYPE.POWER
                        ? `${this.getActorLabel(actor)} retains Block between turns`
                        : `${this.getActorLabel(actor)} keeps Block for the next turn`,
                );
                return true;
            case 'STRENGTH_ON_SELF_DAMAGE':
                this.setOngoingBuffState(actor, {
                    ...this.getOngoingBuffState(actor),
                    strengthOnSelfDamage: this.getOngoingBuffState(actor).strengthOnSelfDamage + buffApplied.value,
                });
                this.appendBattleLog(`${this.getActorLabel(actor)} converts self-damage into Strength`);
                return true;
            case 'APPLY_POISON_PER_TURN':
                this.setOngoingBuffState(actor, {
                    ...this.getOngoingBuffState(actor),
                    poisonPerTurn: this.getOngoingBuffState(actor).poisonPerTurn + buffApplied.value,
                });
                this.appendBattleLog(
                    `${this.getOpposingActorLabel(actor)} will gain ${buffApplied.value} Poison each turn`,
                );
                return true;
            case 'ENEMY_ATTACK_DOWN':
                this.enemyAttackDebuff += buffApplied.value;
                this.enemyAttackDebuffDuration = Math.max(this.enemyAttackDebuffDuration, buffApplied.duration ?? 1);
                this.refreshCurrentEnemyAttackIntent();
                this.appendBattleLog(`${this.getEnemyLabel()} loses ${buffApplied.value} attack`);
                return true;
            case 'POISON_MULTIPLIER':
                this.applyPoisonAmplifier(actor, buffApplied);
                return true;
            default:
                return false;
        }
    }

    private applyPoisonAmplifier(
        actor: 'player' | 'enemy',
        buffApplied: NonNullable<CardEffectResult['buffApplied']>,
    ): void {
        const affectsTarget = buffApplied.target !== 'SELF';
        const targetState = affectsTarget
            ? actor === 'player'
                ? this.enemyStatusEffects
                : this.playerStatusEffects
            : actor === 'player'
                ? this.playerStatusEffects
                : this.enemyStatusEffects;
        const currentPoison = targetState.poison;
        if (currentPoison === 0) {
            this.appendBattleLog(`${this.getTargetLabelForBuff(actor, affectsTarget)} has no Poison to amplify`);
            return;
        }

        const amplifiedPoison = Math.max(currentPoison, currentPoison * buffApplied.value);
        const nextState = {
            ...targetState,
            poison: amplifiedPoison,
        };
        if (affectsTarget) {
            if (actor === 'player') {
                this.enemyStatusEffects = nextState;
            } else {
                this.playerStatusEffects = nextState;
            }
        } else if (actor === 'player') {
            this.playerStatusEffects = nextState;
        } else {
            this.enemyStatusEffects = nextState;
        }

        this.appendBattleLog(
            `${this.getTargetLabelForBuff(actor, affectsTarget)} Poison rises to ${amplifiedPoison}`,
        );
    }

    private resolveHealthLossStrengthTriggers(actor: 'player' | 'enemy', healthLost: number): void {
        const buffState = this.getOngoingBuffState(actor);
        if (healthLost <= 0 || buffState.strengthOnSelfDamage <= 0) {
            return;
        }

        const targetLabel = this.getActorLabel(actor);
        const statusUpdate = this.statusEffectService.applyStatusEffect(
            actor === 'player' ? this.playerStatusEffects : this.enemyStatusEffects,
            {
                type: STATUS_EFFECT_TYPE.STRENGTH,
                stacks: buffState.strengthOnSelfDamage,
                target: targetLabel,
            },
        );
        if (actor === 'player') {
            this.playerStatusEffects = statusUpdate.statusEffects;
        } else {
            this.enemyStatusEffects = statusUpdate.statusEffects;
        }
        this.appendStatusEventLogs(statusUpdate.events);
    }

    private resolveSelfDamageStrengthTriggers(actor: 'player' | 'enemy', selfDamageTaken: number): void {
        this.resolveHealthLossStrengthTriggers(actor, selfDamageTaken);
    }

    private resolvePostPlayDrawCycle(state: DrawCycleState, effectResult: CardEffectResult): DrawCycleState {
        let nextState = state;

        if (effectResult.discardCount > 0) {
            nextState = this.drawCycleService.discardCards(nextState, effectResult.discardCount);
        }

        if (effectResult.cardsDrawn > 0) {
            nextState = this.drawCycleService.drawCards(nextState, effectResult.cardsDrawn);
        }

        return nextState;
    }

    private trackActivePower(card: Card): void {
        if (card.type !== CARD_TYPE.POWER) {
            return;
        }

        this.activePowerCards = [...this.activePowerCards, { ...card }];
    }

    // -----------------------------------------------------------------------
    // Effect Text
    // -----------------------------------------------------------------------

    private ensureBattlePresentationFacade(): BattlePresentationFacade {
        if (!this.battlePresentationFacade) {
            this.battlePresentationFacade = this.createBattlePresentationFacade();
        }

        return this.battlePresentationFacade;
    }

    private buildQueuedPopupActions(
        anchorId: DamagePopupAnchorId,
        requests: readonly DamagePopupRequest[],
        startDelayMs: number,
        splitAcrossSteps = false,
    ): QueuedPresentationSequence {
        const nextRequests = requests.filter((request) => request.value > 0);
        if (nextRequests.length === 0) {
            return { actions: [], nextDelayMs: startDelayMs };
        }

        if (!splitAcrossSteps || nextRequests.length === 1) {
            return {
                actions: [{ kind: 'popups', anchorId, requests: nextRequests, delayMs: startDelayMs }],
                nextDelayMs: splitAcrossSteps ? startDelayMs + ACTION_QUEUE_STEP_MS : startDelayMs,
            };
        }

        return {
            actions: nextRequests.map((request, index) => ({
                kind: 'popups',
                anchorId,
                requests: [request],
                delayMs: startDelayMs + (index * ACTION_QUEUE_STEP_MS),
            })),
            nextDelayMs: startDelayMs + (nextRequests.length * ACTION_QUEUE_STEP_MS),
        };
    }

    private showEffectText(card: Card, effect: {
        damageDealt: number;
        damageBlocked?: number;
        blockGained: number;
        fled: boolean;
        cardsDrawn: number;
        energyGained: number;
        healthRestored: number;
        selfDamageTaken: number;
        hitsResolved: number;
        hitDamages?: readonly number[];
        buffApplied?: CardEffectResult['buffApplied'];
        statusApplied?: CardStatusEffect;
    }): number {
        const actionLog = this.formatPlayerActionLog(card, effect);
        const selfDamageTaken = effect.selfDamageTaken ?? 0;
        const hitsResolved = effect.hitsResolved ?? (effect.damageDealt > 0 ? 1 : 0);
        const actions: BattlePresentationAction[] = [
            { kind: 'clear-effect-text' },
            { kind: 'log', message: actionLog },
        ];
        let queueDelayMs = 0;

        const selfDamageSequence = this.buildQueuedPopupActions(
            'player-hp',
            selfDamageTaken > 0
                ? [{ type: 'damage', value: selfDamageTaken } satisfies DamagePopupRequest]
                : [],
            queueDelayMs,
            true,
        );
        actions.push(...selfDamageSequence.actions);
        if (selfDamageSequence.actions.length > 0) {
            queueDelayMs = selfDamageSequence.nextDelayMs;
        }

        const enemyPopupSequence = this.buildQueuedPopupActions('enemy-hp', [
            ...(effect.damageBlocked && effect.damageBlocked > 0
                ? [{ type: 'blocked', value: effect.damageBlocked } satisfies DamagePopupRequest]
                : []),
            ...this.buildHitPopupRequests(effect.damageDealt, hitsResolved, effect.hitDamages),
        ], queueDelayMs, hitsResolved > 1);
        actions.push(...enemyPopupSequence.actions);
        if (enemyPopupSequence.actions.length > 0) {
            queueDelayMs = enemyPopupSequence.nextDelayMs;
        }

        const playerRecoverySequence = this.buildQueuedPopupActions('player-hp', [
            ...(effect.blockGained > 0
                ? [{ type: 'block_gain', value: effect.blockGained } satisfies DamagePopupRequest]
                : []),
            ...(effect.healthRestored > 0
                ? [{ type: 'heal', value: effect.healthRestored } satisfies DamagePopupRequest]
                : []),
        ], queueDelayMs);
        actions.push(...playerRecoverySequence.actions);

        if (effect.fled) {
            actions.push({ kind: 'effect-text', text: actionLog, color: '#66ffaa' });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0) {
            actions.push({ kind: 'effect-text', text: actionLog, color: '#ff8f8f' });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.blockGained > 0) {
            actions.push({ kind: 'effect-text', text: `${card.name}: +${effect.blockGained} Block`, color: '#6eb6ff' });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.healthRestored > 0) {
            actions.push({ kind: 'effect-text', text: `${card.name}: +${effect.healthRestored} HP`, color: '#7ee0a4' });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.statusApplied) {
            actions.push({
                kind: 'effect-text',
                text: `${card.name}: ${this.getStatusLabel(effect.statusApplied.type)}`,
                color: effect.statusApplied.type === STATUS_EFFECT_TYPE.POISON ? '#c483ff' : '#d3b0ff',
            });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.buffApplied) {
            actions.push({
                kind: 'effect-text',
                text: `${card.name}: ${effect.buffApplied.type} +${effect.buffApplied.value}`,
                color: '#ffb05e',
            });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.cardsDrawn > 0) {
            actions.push({
                kind: 'effect-text',
                text: effect.energyGained > 0
                    ? `${card.name}: draw ${effect.cardsDrawn}, +${effect.energyGained} energy`
                    : `${card.name}: draw ${effect.cardsDrawn}`,
                color: '#8cd5ff',
            });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (effect.energyGained > 0) {
            actions.push({ kind: 'effect-text', text: `${card.name}: +${effect.energyGained} energy`, color: '#8cd5ff' });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        actions.push({ kind: 'effect-text', text: `${card.name} used`, color: '#9aafc5' });
        return this.ensureBattlePresentationFacade().present(actions);
    }

    private playCardSelectionMotion(handIndex: number, card: Card): void {
        const cardSprite = this.cardSprites[handIndex];
        if (!this.canAnimateCardSprite(cardSprite)) {
            return;
        }

        const target = this.resolveCardMotionTarget(card);
        cardSprite.setDepth?.(24);

        this.addSceneTween({
            targets: cardSprite,
            x: target.x,
            y: target.y,
            angle: target.angle,
            alpha: 0.16,
            scaleX: 1.14,
            scaleY: 1.14,
            duration: CARD_SELECTION_MOTION_MS,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                cardSprite.setVisible?.(false);
            },
        });
    }

    private canAnimateCardSprite(cardSprite?: Phaser.GameObjects.Container): cardSprite is Phaser.GameObjects.Container {
        return cardSprite !== undefined
            && typeof cardSprite.x === 'number'
            && typeof cardSprite.y === 'number';
    }

    private resolveCardMotionTarget(card: Card): { x: number; y: number; angle: number } {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.BLOCK:
                return {
                    x: PLAYER_PANEL_X - 110,
                    y: PLAYER_PANEL_Y - 12,
                    angle: 8,
                };
            case CARD_EFFECT_TYPE.FLEE:
                return {
                    x: 120,
                    y: CARD_Y + 36,
                    angle: -16,
                };
            default:
                return {
                    x: ENEMY_PANEL_X,
                    y: ENEMY_PANEL_Y + 18,
                    angle: -10,
                };
        }
    }

    private playResolvedActionMotion(
        actor: 'player' | 'enemy',
        card: Card,
        effect: {
            damageDealt: number;
            damageBlocked?: number;
            blockGained: number;
            fled: boolean;
            selfDamageTaken?: number;
            hitsResolved?: number;
            buffApplied?: CardEffectResult['buffApplied'];
            statusApplied?: CardStatusEffect;
        },
    ): number {
        const actions: BattlePresentationAction[] = [];
        let queueDelayMs = 0;

        if (actor === 'player' && (effect.selfDamageTaken ?? 0) > 0) {
            actions.push({
                kind: 'impact',
                actor: 'player',
                color: COLOR_ACTION_ATTACK,
                delayMs: queueDelayMs,
            });
            queueDelayMs += ACTION_QUEUE_STEP_MS;
        }

        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0 || card.power > 0) {
                    actions.push({
                        kind: 'impact',
                        actor: actor === 'player' ? 'enemy' : 'player',
                        color: COLOR_ACTION_ATTACK,
                        delayMs: queueDelayMs,
                    });
                }
                return this.ensureBattlePresentationFacade().present(actions);
            case CARD_EFFECT_TYPE.MULTI_HIT:
                Array.from({ length: Math.max(1, effect.hitsResolved ?? 1) }, (_, index) => index)
                    .forEach((hitIndex) => {
                        actions.push({
                            kind: 'impact',
                            actor: actor === 'player' ? 'enemy' : 'player',
                            color: COLOR_ACTION_ATTACK,
                            delayMs: queueDelayMs + (hitIndex * ACTION_QUEUE_STEP_MS),
                        });
                    });
                return this.ensureBattlePresentationFacade().present(actions);
            case CARD_EFFECT_TYPE.BLOCK:
                if (effect.blockGained > 0) {
                    actions.push({
                        kind: 'pulse',
                        actor,
                        color: COLOR_ACTION_DEFEND,
                        delayMs: queueDelayMs,
                    });
                }
                return this.ensureBattlePresentationFacade().present(actions);
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                if (effect.statusApplied) {
                    actions.push({
                        kind: 'pulse',
                        actor: actor === 'player' ? 'enemy' : 'player',
                        color: COLOR_ACTION_STATUS,
                        delayMs: queueDelayMs,
                    });
                }
                return this.ensureBattlePresentationFacade().present(actions);
            case CARD_EFFECT_TYPE.BUFF:
                if (effect.buffApplied) {
                    actions.push({
                        kind: 'pulse',
                        actor,
                        color: COLOR_ACTION_BUFF,
                        delayMs: queueDelayMs,
                    });
                }
                return this.ensureBattlePresentationFacade().present(actions);
            case CARD_EFFECT_TYPE.FLEE:
                if (effect.fled) {
                    actions.push({
                        kind: 'pulse',
                        actor,
                        color: COLOR_ACTION_FLEE,
                        delayMs: queueDelayMs,
                    });
                }
                return this.ensureBattlePresentationFacade().present(actions);
        }

        return this.ensureBattlePresentationFacade().present(actions);
    }

    private playPanelImpactMotion(actor: 'player' | 'enemy', color: number): void {
        const overlay = this.getMotionOverlay(actor);
        if (!overlay) {
            return;
        }

        const origin = this.getMotionOverlayOrigin(actor);
        overlay.setPosition(origin.x + (actor === 'enemy' ? 10 : -10), origin.y);
        overlay.setFillStyle(color, 0.18);
        overlay.setStrokeStyle(3, color, 0.95);
        overlay.setScale(0.96);
        overlay.setAlpha(0.95);
        overlay.setVisible(true);

        this.addSceneTween({
            targets: overlay,
            x: origin.x,
            y: origin.y,
            alpha: 0,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: PANEL_IMPACT_MOTION_MS,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.resetMotionOverlay(actor);
            },
        });
        this.shakeImpactCamera();
    }

    private playPanelPulseMotion(actor: 'player' | 'enemy', color: number): void {
        const overlay = this.getMotionOverlay(actor);
        if (!overlay) {
            return;
        }

        const origin = this.getMotionOverlayOrigin(actor);
        overlay.setPosition(origin.x, origin.y);
        overlay.setFillStyle(color, 0.14);
        overlay.setStrokeStyle(3, color, 0.92);
        overlay.setScale(0.92);
        overlay.setAlpha(0.9);
        overlay.setVisible(true);

        this.addSceneTween({
            targets: overlay,
            alpha: 0,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: PANEL_PULSE_MOTION_MS,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.resetMotionOverlay(actor);
            },
        });
    }

    private getMotionOverlay(actor: 'player' | 'enemy'): Phaser.GameObjects.Rectangle | undefined {
        return actor === 'player'
            ? this.playerPanelMotionOverlay
            : this.enemyPanelMotionOverlay;
    }

    private getMotionOverlayOrigin(actor: 'player' | 'enemy'): { x: number; y: number } {
        return actor === 'player'
            ? { x: PLAYER_PANEL_X, y: PLAYER_PANEL_Y }
            : { x: ENEMY_PANEL_X, y: ENEMY_PANEL_Y };
    }

    private resetMotionOverlay(actor: 'player' | 'enemy'): void {
        const overlay = this.getMotionOverlay(actor);
        if (!overlay) {
            return;
        }

        const origin = this.getMotionOverlayOrigin(actor);
        overlay.setPosition(origin.x, origin.y);
        overlay.setFillStyle(0xffffff, 0);
        overlay.setStrokeStyle(2, 0xffffff, 0);
        overlay.setScale(1);
        overlay.setAlpha(0);
        overlay.setVisible(false);
    }

    private shakeImpactCamera(): void {
        const cameras = (this as Phaser.Scene & {
            cameras?: { main?: { shake: (duration: number, intensity: number) => void } };
        }).cameras;
        cameras?.main?.shake(CAMERA_IMPACT_SHAKE_DURATION_MS, CAMERA_IMPACT_SHAKE_INTENSITY);
    }

    private addSceneTween(config: object): void {
        const tweens = (this as Phaser.Scene & {
            tweens?: { add: (builder: object) => void };
        }).tweens;
        tweens?.add(config);
    }

    private showEnemyActionText(
        card: Card,
        damage: number,
        blockGained: number,
        damageBlocked = 0,
        hitDamages?: readonly number[],
    ): number {
        const actions: BattlePresentationAction[] = [
            { kind: 'clear-effect-text' },
            {
                kind: 'log',
                message: this.formatEnemyActionLog(card, damage, blockGained, damageBlocked),
            },
        ];
        let queueDelayMs = 0;

        const playerPopupSequence = this.buildQueuedPopupActions('player-hp', [
            ...(damageBlocked > 0
                ? [{ type: 'blocked', value: damageBlocked } satisfies DamagePopupRequest]
                : []),
            ...this.buildHitPopupRequests(
                damage,
                hitDamages?.length ?? (card.hitCount ?? card.effectPayload?.hitCount ?? (damage > 0 ? 1 : 0)),
                hitDamages,
            ),
        ], queueDelayMs, (hitDamages?.length ?? card.hitCount ?? card.effectPayload?.hitCount ?? 0) > 1);
        actions.push(...playerPopupSequence.actions);
        if (playerPopupSequence.actions.length > 0) {
            queueDelayMs = playerPopupSequence.nextDelayMs;
        }

        const enemyPopupSequence = this.buildQueuedPopupActions('enemy-hp', blockGained > 0
            ? [{ type: 'block_gain', value: blockGained }]
            : [], queueDelayMs);
        actions.push(...enemyPopupSequence.actions);

        if (damage > 0 || damageBlocked > 0) {
            const hitCount = hitDamages?.length ?? card.hitCount ?? card.effectPayload?.hitCount ?? 1;
            actions.push({
                kind: 'effect-text',
                text: hitCount > 1
                    ? `Enemy ${card.name}: flurry`
                    : `Enemy ${card.name}: attack`,
                color: '#ff8f8f',
            });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        if (blockGained > 0) {
            actions.push({
                kind: 'effect-text',
                text: `Enemy ${card.name}: +${blockGained} Block`,
                color: '#6eb6ff',
            });
            return this.ensureBattlePresentationFacade().present(actions);
        }

        actions.push({ kind: 'effect-text', text: `Enemy ${card.name}`, color: '#ffb0b0' });
        return this.ensureBattlePresentationFacade().present(actions);
    }

    private showEnemyBuffText(intent: BuffIntent): number {
        const enemyLabel = this.getEnemyLabel();
        if (intent.pattern === ENEMY_INTENT_PATTERN.CURSE) {
            return this.ensureBattlePresentationFacade().present([
                { kind: 'clear-effect-text' },
                { kind: 'log', message: `${enemyLabel} prepares ${intent.curseCardName} x${intent.curseCount}` },
                {
                    kind: 'effect-text',
                    text: `${enemyLabel} prepares ${intent.curseCardName} x${intent.curseCount}`,
                    color: '#d788ff',
                },
            ]);
        }

        return this.ensureBattlePresentationFacade().present([
            { kind: 'clear-effect-text' },
            { kind: 'log', message: `${enemyLabel} buffs +${intent.amount} ATK` },
            { kind: 'popups', anchorId: 'enemy-panel', requests: [{ type: 'buff', value: intent.amount }] },
            {
                kind: 'effect-text',
                text: `${enemyLabel} buffs +${intent.amount} ATK`,
                color: '#ffb05e',
            },
        ]);
    }

    private clearEffectText(): void {
        this.effectText?.destroy();
        this.effectText = undefined;
    }

    private resolveTurnEndStatusEffects(actor: 'player' | 'enemy'): void {
        const isPlayer = actor === 'player';
        const label = isPlayer ? 'Player' : this.getEnemyLabel();
        const statusBeforeTurnEnd = isPlayer ? this.playerStatusEffects : this.enemyStatusEffects;
        const poisonDecayBlocked = this.shouldPreventPoisonDecay(actor, statusBeforeTurnEnd);
        const statusResult = this.statusEffectService.processTurnEnd(
            isPlayer ? this.playerState : this.enemyState,
            statusBeforeTurnEnd,
            label,
        );

        if (isPlayer) {
            this.playerState = statusResult.combatant;
            this.playerStatusEffects = statusResult.statusEffects;
        } else {
            this.setCurrentEncounterEnemyState(statusResult.combatant);
            this.enemyStatusEffects = statusResult.statusEffects;
        }

        if (poisonDecayBlocked) {
            const nextStatusEffects = isPlayer ? this.playerStatusEffects : this.enemyStatusEffects;
            const preservedPoisonState = {
                ...nextStatusEffects,
                poison: statusBeforeTurnEnd.poison,
            };
            if (isPlayer) {
                this.playerStatusEffects = preservedPoisonState;
            } else {
                this.enemyStatusEffects = preservedPoisonState;
            }
        }

        if (statusResult.poisonDamage > 0) {
            this.appendBattleLog(`${label} takes ${statusResult.poisonDamage} poison`);
            this.showPopupBatch(isPlayer ? 'player-hp' : 'enemy-hp', [
                { type: 'poison', value: statusResult.poisonDamage },
            ]);
        }

        const statusEvents = poisonDecayBlocked
            ? statusResult.events.filter((event) => event.status !== STATUS_EFFECT_TYPE.POISON)
            : statusResult.events;
        this.appendStatusEventLogs(statusEvents);
        if (isPlayer && statusResult.poisonDamage > 0) {
            this.playerDamageTakenWindow += statusResult.poisonDamage;
            this.handlePlayerHealthLost(statusResult.poisonDamage);
        }

        if (isPlayer) {
            this.syncPlayerBreakpointState();
        }
    }

    private createFallbackEffectText(text: string, color: string): void {
        const add = (this as Phaser.Scene & {
            add?: { text?: (x: number, y: number, value: string, style: object) => Phaser.GameObjects.Text };
        }).add;
        if (!add?.text) {
            return;
        }

        this.effectText = add.text(MAIN_PANEL_CENTER_X, EFFECT_TEXT_Y, text, {
            fontSize: '14px',
            color,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0.78);
    }

    private showPopupBatch(anchorId: DamagePopupAnchorId, requests: readonly DamagePopupRequest[]): void {
        if (requests.length === 0) {
            return;
        }

        this.damagePopupController.showBatch(this.getPopupAnchor(anchorId), requests);
    }

    private buildHitPopupRequests(
        damageDealt: number,
        hitsResolved: number,
        hitDamages?: readonly number[],
    ): DamagePopupRequest[] {
        const explicitHitRequests = hitDamages
            ?.filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => ({ type: 'damage', value }) satisfies DamagePopupRequest);
        if (explicitHitRequests && explicitHitRequests.length > 0) {
            return explicitHitRequests;
        }

        if (damageDealt <= 0) {
            return [];
        }

        const resolvedHits = Number.isFinite(hitsResolved) && hitsResolved > 1
            ? Math.min(hitsResolved, damageDealt)
            : 1;

        if (resolvedHits <= 1) {
            return [{ type: 'damage', value: damageDealt }];
        }

        const baseHitDamage = Math.floor(damageDealt / resolvedHits);
        let remainder = damageDealt % resolvedHits;

        const requests: DamagePopupRequest[] = [];

        for (let hitIndex = 0; hitIndex < resolvedHits; hitIndex += 1) {
            const value = baseHitDamage + (remainder > 0 ? 1 : 0);
            remainder = Math.max(0, remainder - 1);

            if (value > 0) {
                requests.push({ type: 'damage', value });
            }
        }

        return requests;
    }

    private getPopupAnchor(anchorId: DamagePopupAnchorId): DamagePopupAnchor {
        switch (anchorId) {
            case 'enemy-hp':
                return { id: anchorId, x: MAIN_PANEL_CENTER_X, y: ENEMY_HP_POPUP_Y };
            case 'player-hp':
                return { id: anchorId, x: MAIN_PANEL_CENTER_X, y: PLAYER_HP_POPUP_Y };
            case 'enemy-panel':
                return { id: anchorId, x: ENEMY_PANEL_POPUP_X, y: ENEMY_PANEL_POPUP_Y };
            case 'player-panel':
                return { id: anchorId, x: PLAYER_PANEL_POPUP_X, y: PLAYER_PANEL_POPUP_Y };
        }
    }

    private appendStatusEventLogs(events: readonly StatusEffectEvent[]): void {
        this.emitLegacyStatusApplied(events);
        events.forEach((event) => {
            this.appendBattleLog(this.formatStatusEventLog(event));
        });
    }

    private formatStatusEventLog(event: StatusEffectEvent): string {
        if (event.type === 'STATUS_EXPIRE') {
            return `${event.target} ${this.getStatusLabel(event.status)} expired`;
        }

        const applyEvent = event as StatusApplyEvent;
        if (event.status === STATUS_EFFECT_TYPE.POISON) {
            return `${event.target} gains Poison ${applyEvent.value}`;
        }

        return `${event.target} gains ${this.getStatusLabel(event.status)} ${applyEvent.duration ?? applyEvent.value}`;
    }

    private getStatusLabel(status: string): string {
        switch (status) {
            case STATUS_EFFECT_TYPE.VULNERABLE:
                return 'Vulnerable';
            case STATUS_EFFECT_TYPE.WEAK:
                return 'Weak';
            case STATUS_EFFECT_TYPE.POISON:
                return 'Poison';
            case STATUS_EFFECT_TYPE.STRENGTH:
                return 'Strength';
            case STATUS_EFFECT_TYPE.THORNS:
                return 'Thorns';
            case STATUS_EFFECT_TYPE.REGENERATION:
                return 'Regeneration';
            case STATUS_EFFECT_TYPE.FRAIL:
                return 'Frail';
            default:
                return status;
        }
    }

    private toStatusEffectApplication(statusApplied?: CardStatusEffect): StatusEffectApplication | undefined {
        if (!statusApplied) {
            return undefined;
        }

        const resolvedValue = typeof statusApplied.duration === 'number'
            ? statusApplied.duration
            : typeof statusApplied.stacks === 'number'
                ? statusApplied.stacks
                : typeof statusApplied.amount === 'number'
                    ? statusApplied.amount
                    : 0;

        if (statusApplied.type === STATUS_EFFECT_TYPE.POISON) {
            return {
                type: STATUS_EFFECT_TYPE.POISON,
                stacks: resolvedValue,
                target: '',
            };
        }

        if (
            statusApplied.type === STATUS_EFFECT_TYPE.VULNERABLE
            || statusApplied.type === STATUS_EFFECT_TYPE.WEAK
            || statusApplied.type === STATUS_EFFECT_TYPE.REGENERATION
            || statusApplied.type === STATUS_EFFECT_TYPE.FRAIL
        ) {
            return {
                type: statusApplied.type,
                duration: resolvedValue,
                target: '',
            };
        }

        if (
            statusApplied.type === STATUS_EFFECT_TYPE.STRENGTH
            || statusApplied.type === STATUS_EFFECT_TYPE.THORNS
        ) {
            return {
                type: statusApplied.type,
                stacks: resolvedValue,
                target: '',
            };
        }

        return undefined;
    }

    private toBuffStatusEffectApplication(effectResult: CardEffectResult): StatusEffectApplication | undefined {
        const buff = effectResult.buffApplied;
        if (!buff || buff.value <= 0) {
            return undefined;
        }

        if (
            buff.type === STATUS_EFFECT_TYPE.STRENGTH
            || buff.type === STATUS_EFFECT_TYPE.THORNS
            || buff.type === STATUS_EFFECT_TYPE.POISON
        ) {
            return {
                type: buff.type,
                stacks: buff.value,
                target: buff.target === 'TARGET' ? this.getEnemyLabel() : 'Player',
            };
        }

        if (
            buff.type === STATUS_EFFECT_TYPE.REGENERATION
            || buff.type === STATUS_EFFECT_TYPE.FRAIL
            || buff.type === STATUS_EFFECT_TYPE.VULNERABLE
            || buff.type === STATUS_EFFECT_TYPE.WEAK
        ) {
            return {
                type: buff.type,
                duration: buff.duration ?? buff.value,
                target: buff.target === 'TARGET' ? this.getEnemyLabel() : 'Player',
            };
        }

        return undefined;
    }

    private getEnemyLabel(): string {
        return this.sceneData?.enemyName ?? 'Enemy';
    }

    private getActorLabel(actor: 'player' | 'enemy'): string {
        return actor === 'player' ? 'Player' : this.getEnemyLabel();
    }

    private getOpposingActorLabel(actor: 'player' | 'enemy'): string {
        return actor === 'player' ? this.getEnemyLabel() : 'Player';
    }

    private getTargetLabelForBuff(actor: 'player' | 'enemy', affectsTarget: boolean): string {
        if (affectsTarget) {
            return this.getOpposingActorLabel(actor);
        }

        return this.getActorLabel(actor);
    }

    private getOngoingBuffState(actor: 'player' | 'enemy'): OngoingBattleBuffState {
        return actor === 'player'
            ? this.playerOngoingBuffs
            : this.enemyOngoingBuffs;
    }

    private setOngoingBuffState(actor: 'player' | 'enemy', state: OngoingBattleBuffState): void {
        if (actor === 'player') {
            this.playerOngoingBuffs = state;
            return;
        }

        this.enemyOngoingBuffs = state;
    }

    private shouldPersistBlock(actor: 'player' | 'enemy'): boolean {
        const buffState = this.getOngoingBuffState(actor);
        return buffState.blockPersist || buffState.blockPersistCharges > 0;
    }

    private prepareTurnStartState(actor: 'player' | 'enemy'): void {
        const retainedBlockRatio = this.getDreadRuleRetainedBlockRatio();
        if (!this.shouldPersistBlock(actor)) {
            if (actor === 'player' && this.equipmentConfig.blockPersistRatio > 0) {
                this.playerState = {
                    ...this.playerState,
                    block: Math.floor(this.playerState.block * this.equipmentConfig.blockPersistRatio * retainedBlockRatio),
                };
            } else if (actor === 'player') {
                this.playerState = this.cardEffectService.resetBlock(this.playerState);
            } else {
                this.setCurrentEncounterEnemyState(this.cardEffectService.resetBlock(this.enemyState));
            }
        } else if (retainedBlockRatio < 1) {
            if (actor === 'player') {
                this.playerState = {
                    ...this.playerState,
                    block: Math.floor(this.playerState.block * retainedBlockRatio),
                };
            } else {
                this.setCurrentEncounterEnemyState({
                    ...this.enemyState,
                    block: Math.floor(this.enemyState.block * retainedBlockRatio),
                });
            }
        }

        this.consumeBlockPersistCharge(actor);
    }

    private getDreadRuleRetainedBlockRatio(): number {
        const retainedBlockRatio = this.dreadRule?.effects.blockRetainRatio;
        if (typeof retainedBlockRatio !== 'number') {
            return 1;
        }

        return Math.max(0, Math.min(1, retainedBlockRatio));
    }

    private consumeBlockPersistCharge(actor: 'player' | 'enemy'): void {
        const buffState = this.getOngoingBuffState(actor);
        if (buffState.blockPersist || buffState.blockPersistCharges <= 0) {
            return;
        }

        this.setOngoingBuffState(actor, {
            ...buffState,
            blockPersistCharges: buffState.blockPersistCharges - 1,
        });
    }

    private applyPlayerTurnStartOngoingEffects(): boolean {
        if (this.equipmentConfig.turnStartHeal > 0) {
            this.playerState = {
                ...this.playerState,
                health: Math.min(
                    this.playerState.maxHealth,
                    this.playerState.health + this.equipmentConfig.turnStartHeal,
                ),
            };
            this.appendBattleLog(`Player restores ${this.equipmentConfig.turnStartHeal} HP`);
            this.syncPlayerBreakpointState();
        }

        if (this.equipmentConfig.turnStartSelfDamage > 0) {
            this.playerState = {
                ...this.playerState,
                health: Math.max(0, this.playerState.health - this.equipmentConfig.turnStartSelfDamage),
            };
            this.playerDamageTakenWindow += this.equipmentConfig.turnStartSelfDamage;
            this.handlePlayerHealthLost(this.equipmentConfig.turnStartSelfDamage);
            this.showPopupBatch('player-hp', [{ type: 'damage', value: this.equipmentConfig.turnStartSelfDamage }]);
            this.appendBattleLog(`Player pays ${this.equipmentConfig.turnStartSelfDamage} HP`);
            this.emitBattleActionResolved({
                actionType: 'TURN_START_SELF_DAMAGE',
                sourceId: this.getPlayerActorId(),
                targetIds: [this.getPlayerActorId()],
                damage: this.equipmentConfig.turnStartSelfDamage,
                block: 0,
                statusDelta: [],
            });
            if (this.playerState.health <= 0) {
                this.showBattleEnd('player-lose');
                return true;
            }
        }

        this.applyPerTurnPoison('player');
        return this.playerState.health <= 0;
    }

    private applyPerTurnPoison(actor: 'player' | 'enemy'): void {
        const poisonPerTurn = this.getOngoingBuffState(actor).poisonPerTurn;
        if (poisonPerTurn <= 0) {
            return;
        }

        const affectsEnemy = actor === 'player';
        const targetLabel = affectsEnemy ? this.getEnemyLabel() : 'Player';
        const targetStatusEffects = affectsEnemy ? this.enemyStatusEffects : this.playerStatusEffects;
        const updateResult = this.statusEffectService.applyStatusEffect(
            targetStatusEffects,
            {
                type: STATUS_EFFECT_TYPE.POISON,
                stacks: poisonPerTurn,
                target: targetLabel,
            },
        );

        if (affectsEnemy) {
            this.enemyStatusEffects = updateResult.statusEffects;
            this.showPopupBatch('enemy-hp', [{ type: 'poison', value: poisonPerTurn }]);
        } else {
            this.playerStatusEffects = updateResult.statusEffects;
            this.showPopupBatch('player-hp', [{ type: 'poison', value: poisonPerTurn }]);
        }

        this.appendStatusEventLogs(updateResult.events);
    }

    private tickEnemyAttackDebuff(): void {
        if (this.enemyAttackDebuffDuration <= 0) {
            return;
        }

        this.enemyAttackDebuffDuration -= 1;
        if (this.enemyAttackDebuffDuration === 0) {
            this.enemyAttackDebuff = 0;
        }
    }

    private refreshCurrentEnemyAttackIntent(): void {
        const intent = this.currentEnemyIntent;
        if (intent?.type !== ENEMY_INTENT_TYPE.ATTACK) {
            this.updateEncounterEnemyEntry(this.getEnemyActorId(), (entry) => ({
                ...entry,
                currentIntent: this.currentEnemyIntent,
                intentQueue: [...this.enemyIntentQueue],
            }));
            this.updateEnemyIntentDisplay(false);
            return;
        }

        const sourceCard = this.getEffectiveEnemyCardPool().find(
            (card) => card.id === intent.sourceCardId,
        );
        if (sourceCard) {
            const hitCount = sourceCard.hitCount ?? sourceCard.effectPayload?.hitCount ?? 1;
            this.currentEnemyIntent = {
                ...intent,
                pattern: hitCount > 1
                    ? ENEMY_INTENT_PATTERN.FLURRY
                    : ENEMY_INTENT_PATTERN.STRIKE,
                damage: sourceCard.power * hitCount,
                hitCount: hitCount > 1 ? hitCount : undefined,
                damagePerHit: hitCount > 1 ? sourceCard.power : undefined,
            };
            if (this.currentEnemyIntent && this.enemyIntentQueue.length > 0) {
                this.enemyIntentQueue[0] = this.currentEnemyIntent;
            }
        }
        this.updateEncounterEnemyEntry(this.getEnemyActorId(), (entry) => ({
            ...entry,
            currentIntent: this.currentEnemyIntent,
            intentQueue: [...this.enemyIntentQueue],
        }));
        this.updateEnemyIntentDisplay(false);
    }

    private revealNextEnemyIntent(enemyId: string = this.getEnemyActorId()): EnemyIntent | undefined {
        const encounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (!encounterEnemy || this.getEffectiveEnemyCardPool(encounterEnemy).length === 0) {
            this.updateEncounterEnemyEntry(enemyId, (entry) => ({
                ...entry,
                intentQueue: [],
                currentIntent: undefined,
            }));
            if (this.getEnemyActorId() === enemyId) {
                this.enemyIntentQueue = [];
                this.currentEnemyIntent = undefined;
                this.updateEnemyIntentDisplay(false);
            }
            return undefined;
        }

        this.ensureEnemyIntentQueue(enemyId);
        const nextEncounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (this.getEnemyActorId() === enemyId) {
            this.currentEnemyIntent = nextEncounterEnemy?.currentIntent;
            this.enemyIntentQueue = [...(nextEncounterEnemy?.intentQueue ?? [])];
            this.updateEnemyIntentDisplay(true);
        }

        return nextEncounterEnemy?.currentIntent;
    }

    private ensureEnemyIntentQueue(enemyId: string = this.getEnemyActorId()): void {
        const encounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (!encounterEnemy) {
            return;
        }

        const previewCount = this.getLivingEncounterEnemyStates().length > 1
            ? 1
            : Math.max(1, this.equipmentConfig.previewEnemyIntentCount);
        const nextQueue = [...(encounterEnemy.intentQueue ?? [])];
        while (nextQueue.length < previewCount) {
            nextQueue.push(this.enemyIntentService.decideNextIntent({
                enemy: this.buildIntentEnemy(encounterEnemy),
                enemyCardPool: this.getEffectiveEnemyCardPool(encounterEnemy),
                floorNumber: this.sceneData?.floorNumber,
            }));
        }

        this.updateEncounterEnemyEntry(enemyId, (entry) => ({
            ...entry,
            intentQueue: nextQueue,
            currentIntent: nextQueue[0],
        }));

        if (this.getEnemyActorId() === enemyId) {
            this.enemyIntentQueue = [...nextQueue];
            this.currentEnemyIntent = nextQueue[0];
        }
    }

    private getEncounterEnemyIntentPreview(enemyId: string): EnemyIntent | undefined {
        const encounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (!encounterEnemy) {
            return undefined;
        }

        if ((encounterEnemy.intentQueue?.length ?? 0) === 0) {
            this.ensureEnemyIntentQueue(enemyId);
        }

        return this.getEncounterEnemyEntryById(enemyId)?.currentIntent;
    }

    private consumeCurrentEnemyIntent(enemyId: string = this.getEnemyActorId()): void {
        const encounterEnemy = this.getEncounterEnemyEntryById(enemyId);
        if (!encounterEnemy) {
            return;
        }

        const nextQueue = [...(encounterEnemy.intentQueue ?? [])];
        if (nextQueue.length > 0) {
            nextQueue.shift();
        }

        this.updateEncounterEnemyEntry(enemyId, (entry) => ({
            ...entry,
            intentQueue: nextQueue,
            currentIntent: nextQueue[0],
        }));

        if (this.getEnemyActorId() === enemyId) {
            this.enemyIntentQueue = [...nextQueue];
            this.currentEnemyIntent = nextQueue[0];
        }
    }

    private updateEnemyIntentDisplay(animated: boolean): void {
        if (!this.enemyIntentText) {
            return;
        }

        this.enemyIntentText.setText(this.formatEnemyIntentText());

        if (!animated) {
            this.enemyIntentText.setAlpha(1);
            return;
        }

        this.enemyIntentText.setAlpha(0.25);
        const tweens = (this as Phaser.Scene & {
            tweens?: { add: (config: object) => void };
        }).tweens;
        tweens?.add({
            targets: this.enemyIntentText,
            alpha: 1,
            duration: 200,
            ease: 'Sine.easeOut',
        });
    }

    private formatEnemyIntentText(): string {
        if (this.equipmentConfig.hideEnemyIntent) {
            return '';
        }

        const livingEnemies = this.getLivingEncounterEnemyStates();
        if (livingEnemies.length > 1) {
            if (this.shouldHideEnemyIntent()) {
                return livingEnemies
                    .map((entry) => `${entry.enemy.label}: ???`)
                    .join('\n');
            }

            return livingEnemies
                .map((entry) => this.formatEncounterEnemyIntentText(
                    entry.enemy.label,
                    this.getEncounterEnemyIntentPreview(entry.enemy.id),
                ))
                .join('\n');
        }

        if (this.shouldHideEnemyIntent()) {
            return 'Next ???';
        }

        const intent = this.currentEnemyIntent ?? this.getEncounterEnemyIntentPreview(this.getEnemyActorId());
        if (!intent) {
            return '';
        }

        const lines = [this.formatSingleEnemyIntentText(intent)];
        if (this.equipmentConfig.previewEnemyIntentCount > 1 && this.enemyIntentQueue[1]) {
            lines.push(this.formatSecondaryEnemyIntentText(this.enemyIntentQueue[1]));
        }

        return lines.join('\n');
    }

    private formatEncounterEnemyIntentText(enemyLabel: string, intent?: EnemyIntent): string {
        if (!intent) {
            return `${enemyLabel}: ---`;
        }

        return `${enemyLabel}: ${this.formatEncounterEnemyIntentBody(intent)}`;
    }

    private formatEncounterEnemyIntentBody(intent: EnemyIntent): string {
        switch (intent.type) {
            case ENEMY_INTENT_TYPE.ATTACK:
                return this.formatEncounterAttackIntentText(intent);
            case ENEMY_INTENT_TYPE.DEFEND:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CLEANSE) {
                    return `CLEANSE ✨ +${intent.block}${this.formatEnemyIntentCleanseHint(intent)}`;
                }
                return `GUARD 🛡️ +${intent.block}`;
            case ENEMY_INTENT_TYPE.BUFF:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CURSE) {
                    return `CURSE ☠️ ${intent.curseCardName} x${intent.curseCount}`;
                }
                return `RITUAL ⬆️ ${this.formatEnemyIntentBuffStat(intent.stat)} +${intent.amount}`;
        }
    }

    private formatSingleEnemyIntentText(intent: EnemyIntent): string {
        switch (intent.type) {
            case ENEMY_INTENT_TYPE.ATTACK:
                return this.formatAttackIntentText('Next', intent);
            case ENEMY_INTENT_TYPE.DEFEND:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CLEANSE) {
                    return `Next CLEANSE ✨ +${intent.block}${this.formatEnemyIntentCleanseHint(intent)}`;
                }
                return `Next GUARD 🛡️ +${intent.block}`;
            case ENEMY_INTENT_TYPE.BUFF:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CURSE) {
                    return `Next CURSE ☠️ ${intent.curseCardName} x${intent.curseCount}`;
                }
                return `Next RITUAL ⬆️ ${this.formatEnemyIntentBuffStat(intent.stat)} +${intent.amount}`;
        }
    }

    private formatSecondaryEnemyIntentText(intent: EnemyIntent): string {
        switch (intent.type) {
            case ENEMY_INTENT_TYPE.ATTACK:
                return this.formatAttackIntentText('Then', intent);
            case ENEMY_INTENT_TYPE.DEFEND:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CLEANSE) {
                    return `Then CLEANSE ✨ +${intent.block}${this.formatEnemyIntentCleanseHint(intent)}`;
                }
                return `Then GUARD 🛡️ +${intent.block}`;
            case ENEMY_INTENT_TYPE.BUFF:
                if (intent.pattern === ENEMY_INTENT_PATTERN.CURSE) {
                    return `Then CURSE ☠️ ${intent.curseCardName} x${intent.curseCount}`;
                }
                return `Then RITUAL ⬆️ ${this.formatEnemyIntentBuffStat(intent.stat)} +${intent.amount}`;
        }
    }

    private formatAttackIntentText(prefix: 'Next' | 'Then', intent: AttackIntent): string {
        if (intent.pattern === ENEMY_INTENT_PATTERN.CHARGE) {
            return `${prefix} CHARGE ⏳ ${intent.damage} · ${intent.warning}`;
        }
        if (intent.pattern === ENEMY_INTENT_PATTERN.AMBUSH) {
            return `${prefix} AMBUSH 🕶️ ${intent.damage} · ${intent.warning}`;
        }

        const dangerHint = this.formatEnemyIntentDangerHint(intent);
        if (intent.pattern === ENEMY_INTENT_PATTERN.FLURRY && (intent.hitCount ?? 1) > 1 && (intent.damagePerHit ?? 0) > 0) {
            return `${prefix} FLURRY ⚔️ ${intent.damagePerHit}x${intent.hitCount}${dangerHint}`;
        }

        return `${prefix} STRIKE ⚔️ ${intent.damage}${dangerHint}`;
    }

    private formatEncounterAttackIntentText(intent: AttackIntent): string {
        if (intent.pattern === ENEMY_INTENT_PATTERN.CHARGE) {
            return `CHARGE ⏳ ${intent.damage} · ${intent.warning}`;
        }
        if (intent.pattern === ENEMY_INTENT_PATTERN.AMBUSH) {
            return `AMBUSH 🕶️ ${intent.damage} · ${intent.warning}`;
        }

        const dangerHint = this.formatEnemyIntentDangerHint(intent);
        if (intent.pattern === ENEMY_INTENT_PATTERN.FLURRY && (intent.hitCount ?? 1) > 1 && (intent.damagePerHit ?? 0) > 0) {
            return `FLURRY ⚔️ ${intent.damagePerHit}x${intent.hitCount}${dangerHint}`;
        }

        return `STRIKE ⚔️ ${intent.damage}${dangerHint}`;
    }

    private formatEnemyIntentBuffStat(stat: EnemyIntentBuffStat): string {
        switch (stat) {
            case 'attack':
                return 'ATK';
        }
    }

    private formatEnemyIntentCleanseHint(intent: { readonly cleansedStatuses: readonly string[] }): string {
        if (intent.cleansedStatuses.length === 0) {
            return '';
        }

        return ` · clear ${intent.cleansedStatuses.join('/')}`;
    }

    private formatEnemyIntentDangerHint(intent: EnemyIntent): string {
        if (intent.type !== ENEMY_INTENT_TYPE.ATTACK) {
            return '';
        }

        const projectedDamage = Math.max(0, intent.damage - this.playerState.block);
        if (projectedDamage <= 0) {
            return ' · Blocked';
        }

        const projectedHealth = Math.max(0, this.playerState.health - projectedDamage);
        if (projectedHealth <= 0) {
            return ' · Lethal';
        }

        const currentState = this.getPlayerBreakpointState();
        const projectedHealthRatio = this.playerState.maxHealth <= 0
            ? 0
            : projectedHealth / this.playerState.maxHealth;
        if (projectedHealthRatio <= DESPERATION_HP_THRESHOLD && currentState !== 'desperation') {
            return ' · Desperation';
        }
        if (projectedHealthRatio <= BLOODIED_HP_THRESHOLD && currentState === 'stable') {
            return ' · Bloodied';
        }

        return '';
    }

    private getEffectiveEnemyCardPool(encounterEnemy?: EncounterEnemyState): readonly Card[] {
        const cardPool = encounterEnemy?.cardPool ?? this.enemyCardPool;
        const attackModifier = (encounterEnemy?.attackBuff ?? this.enemyAttackBuff)
            - (encounterEnemy?.attackDebuff ?? this.enemyAttackDebuff);
        if (attackModifier === 0) {
            return cardPool;
        }

        return cardPool.map((card) => {
            if (card.effectType !== CARD_EFFECT_TYPE.DAMAGE) {
                return card;
            }

            return {
                ...card,
                power: Math.max(0, card.power + attackModifier),
            };
        });
    }

    private resolveEnemyCardFromIntent(intent: EnemyIntent, encounterEnemy?: EncounterEnemyState): Card {
        if (intent.type === ENEMY_INTENT_TYPE.ATTACK || intent.type === ENEMY_INTENT_TYPE.DEFEND) {
            const sourceCard = this.getEffectiveEnemyCardPool(encounterEnemy).find((card) => card.id === intent.sourceCardId);
            if (sourceCard) {
                return sourceCard;
            }
        }

        if (
            intent.type === ENEMY_INTENT_TYPE.ATTACK
            && intent.pattern === ENEMY_INTENT_PATTERN.FLURRY
            && (intent.hitCount ?? 1) > 1
        ) {
            return createCard({
                name: intent.label,
                type: CARD_TYPE.ATTACK,
                power: intent.damagePerHit ?? Math.max(1, Math.floor(intent.damage / Math.max(1, intent.hitCount ?? 1))),
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                hitCount: intent.hitCount,
                effectPayload: { hitCount: intent.hitCount },
            });
        }

        return this.buildFallbackEnemyCard(intent.type, encounterEnemy);
    }

    private buildFallbackEnemyCard(intentType: EnemyIntentType, encounterEnemy?: EncounterEnemyState): Card {
        const enemy = this.buildIntentEnemy(encounterEnemy);

        if (intentType === ENEMY_INTENT_TYPE.DEFEND) {
            return createCard({
                name: 'Enemy Defend',
                type: CARD_TYPE.GUARD,
                power: Math.max(1, enemy.stats.defense + 2),
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
        }

        if (intentType === ENEMY_INTENT_TYPE.BUFF) {
            return createCard({
                name: 'Enemy Ritual',
                type: CARD_TYPE.POWER,
                power: 0,
                effectType: CARD_EFFECT_TYPE.BUFF,
            });
        }

        return createCard({
            name: 'Enemy Strike',
            type: CARD_TYPE.ATTACK,
            power: Math.max(
                0,
                enemy.stats.attack
                    + (encounterEnemy?.attackBuff ?? this.enemyAttackBuff)
                    - (encounterEnemy?.attackDebuff ?? this.enemyAttackDebuff),
            ),
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
    }

    private buildIntentEnemy(encounterEnemy?: EncounterEnemyState): EnemyEntity {
        const baseEnemy = encounterEnemy?.enemy ?? this.sceneData?.enemy;
        const combatState = encounterEnemy?.state ?? this.enemyState;

        return new Enemy(
            baseEnemy?.id ?? 'enemy-intent',
            baseEnemy?.label ?? this.getEnemyLabel(),
            baseEnemy?.position ? { ...baseEnemy.position } : { x: 0, y: 0 },
            {
                health: combatState?.health ?? baseEnemy?.stats.health ?? 0,
                maxHealth: combatState?.maxHealth ?? baseEnemy?.stats.maxHealth ?? 1,
                attack: baseEnemy?.stats.attack ?? 10,
                defense: baseEnemy?.stats.defense ?? 5,
                movementSpeed: baseEnemy?.stats.movementSpeed ?? DEFAULT_MOVEMENT_SPEED,
            },
            baseEnemy?.experienceReward ?? 0,
            baseEnemy?.kind ?? 'normal',
            baseEnemy?.archetypeId ?? 'ash-crawler',
            baseEnemy?.elite ?? false,
        );
    }

    // -----------------------------------------------------------------------
    // Display Update Helpers
    // -----------------------------------------------------------------------

    private updateAllDisplays(): void {
        this.updateHpBars();
        this.updateDreadRuleDisplay();
        this.updateZoneCountDisplays();
        this.updateEnergyDisplay();
        this.updateBlockDisplays();
        this.updateStatusDisplays();
        this.updatePowerDisplays();
        this.updateBattleLog();
    }

    // -----------------------------------------------------------------------
    // Battle End
    // -----------------------------------------------------------------------

    private showBattleEnd(
        outcome: BattleOutcomeType,
        resolution: BattleSceneResolution = outcome === 'player-win' ? 'victory' : 'defeat',
    ): void {
        this.isInputLocked = true;
        this.battleResolution = resolution;
        this.clearCardSprites();
        this.endTurnButton?.setVisible(false);
        this.resultText.setText(
            resolution === 'escape'
                ? 'ESCAPED'
                : outcome === 'player-win'
                    ? 'VICTORY!'
                    : 'DEFEAT...',
        );
        this.resultText.setColor(
            resolution === 'escape'
                ? '#66ffaa'
                : outcome === 'player-win'
                    ? '#ffdd44'
                    : '#ff4444',
        );
        this.resultText.setAlpha(0);

        this.tweens.add({
            targets: this.resultText,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            ease: 'Power2',
            yoyo: true,
            hold: 1000,
            onComplete: () => {
                this.endBattle(outcome);
            },
        });
    }

    private endBattle(outcome: BattleOutcomeType): void {
        const leadEnemyState = this.getEncounterEnemyStateById(this.sceneData.enemy.id)
            ?? this.encounterEnemyStates[0];
        const leadEnemyHealth = leadEnemyState
            ? 'state' in leadEnemyState
                ? leadEnemyState.state.health
                : leadEnemyState.health
            : this.enemyState.health;
        const result: BattleSceneResult = {
            outcome,
            resolution: this.battleResolution,
            totalRounds: this.turnNumber,
            totalPlayerDamage: this.totalPlayerDamage,
            totalEnemyDamage: this.totalEnemyDamage,
            playerRemainingHealth: this.playerState.health,
            enemyRemainingHealth: leadEnemyHealth,
            nextBattleStartEnergyBonus: this.nextBattleStartEnergyBonus,
            enemy: this.sceneData.enemy,
            enemies: this.encounterEnemyStates.map((entry) => new Enemy(
                entry.enemy.id,
                entry.enemy.label,
                { ...entry.enemy.position },
                {
                    ...entry.enemy.stats,
                    health: entry.state.health,
                    maxHealth: entry.state.maxHealth,
                },
                entry.enemy.experienceReward,
                entry.enemy.kind,
                entry.enemy.archetypeId,
                entry.enemy.elite,
            )),
        };

        if (this.onBattleEndCallback) {
            this.onBattleEndCallback(result);
        }

        this.scene.stop(SCENE_KEY);
        this.scene.wake('MainScene');
    }
}
