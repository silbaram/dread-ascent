// ---------------------------------------------------------------------------
// BattleScene — Cycle 3 카드 배틀 전용 Phaser Scene (TASK-031, TASK-033)
// ---------------------------------------------------------------------------

import 'phaser';
import type { Card, CardStatusEffect } from '../domain/entities/Card';
import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
} from '../domain/entities/Card';
import { checkCardCondition } from '../domain/entities/CardCatalog';
import { Enemy, type Enemy as EnemyEntity } from '../domain/entities/Enemy';
import { DEFAULT_MOVEMENT_SPEED } from '../domain/entities/CombatStats';
import type { Player } from '../domain/entities/Player';
import { CardBattleService } from '../domain/services/CardBattleService';
import type { BattleOutcomeType } from '../domain/services/CardBattleLoopService';
import {
    getEquipmentCardBonus,
    applyEquipmentBonusToHand,
} from '../domain/services/EquipmentCardBonusService';
import type { ItemService } from '../domain/services/ItemService';
import type { DeckService } from '../domain/services/DeckService';
import { DrawCycleService, DEFAULT_HAND_SIZE, type DrawCycleState } from '../domain/services/DrawCycleService';
import {
    CardEffectService,
    type CardEffectResult,
    type CombatantState,
} from '../domain/services/CardEffectService';
import { EnergyService, type EnergyState } from '../domain/services/EnergyService';
import {
    ENEMY_INTENT_TYPE,
    EnemyIntentService,
    type BuffIntent,
    type EnemyIntent,
    type EnemyIntentBuffStat,
    type EnemyIntentType,
} from '../domain/services/EnemyIntentService';
import {
    STATUS_EFFECT_TYPE,
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
import { BATTLE_SCENE_LAYOUT } from './battleSceneLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** BattleScene에 전달되는 초기 데이터. */
export interface BattleSceneData {
    readonly player: Player;
    readonly enemy: EnemyEntity;
    readonly deckService: DeckService;
    readonly cardBattleService: CardBattleService;
    readonly itemService: ItemService;
    readonly enemyName: string;
    readonly floorNumber?: number;
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
    readonly enemy: EnemyEntity;
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
const BATTLE_LOG_MAX_ENTRIES = 3;
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

    // Battle state
    private drawCycleState!: DrawCycleState;
    private playerState!: CombatantState;
    private enemyState!: CombatantState;
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
    private battleResolution: BattleSceneResolution = 'victory';
    private activePowerCards: Card[] = [];
    private playerDamageTakenWindow = 0;
    private playerOngoingBuffs: OngoingBattleBuffState = EMPTY_ONGOING_BATTLE_BUFFS;
    private enemyOngoingBuffs: OngoingBattleBuffState = EMPTY_ONGOING_BATTLE_BUFFS;
    private enemyAttackDebuff = 0;
    private enemyAttackDebuffDuration = 0;

    // UI elements
    private cardSprites: Phaser.GameObjects.Container[] = [];
    private playerHpBar!: Phaser.GameObjects.Graphics;
    private enemyHpBar!: Phaser.GameObjects.Graphics;
    private playerHpText!: Phaser.GameObjects.Text;
    private enemyHpText!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;
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
    private playerPowerText?: Phaser.GameObjects.Text;
    private enemyPowerText?: Phaser.GameObjects.Text;
    private battleLogText?: Phaser.GameObjects.Text;
    private battleLogMaskGraphics?: Phaser.GameObjects.Graphics;
    private enemyIntentText?: Phaser.GameObjects.Text;
    private cardDetailTitleText?: Phaser.GameObjects.Text;
    private cardDetailBodyText?: Phaser.GameObjects.Text;
    private damagePopupController!: DamagePopupController;
    private enemyPanelMotionOverlay?: Phaser.GameObjects.Rectangle;
    private playerPanelMotionOverlay?: Phaser.GameObjects.Rectangle;

    private isInputLocked = false;

    // Callback for when battle ends
    private onBattleEndCallback?: (result: BattleSceneResult) => void;

    constructor() {
        super({ key: SCENE_KEY });
    }

    init(data: BattleSceneData): void {
        this.sceneData = data;

        // 서비스 초기화
        this.drawCycleService = new DrawCycleService();
        this.cardEffectService = new CardEffectService();
        this.energyService = new EnergyService();
        this.statusEffectService = new StatusEffectService();
        this.enemyIntentService = new EnemyIntentService();

        // 장비 보너스 적용
        const equipmentBonus = getEquipmentCardBonus(data.itemService.getInventory());
        const deckCards = data.deckService.getCards();
        const boostedDeck = applyEquipmentBonusToHand(deckCards, equipmentBonus);

        // 전투 상태 초기화
        this.drawCycleState = this.drawCycleService.initialize(boostedDeck);
        this.playerState = {
            health: data.player.stats.health,
            maxHealth: data.player.stats.maxHealth,
            block: 0,
        };
        this.enemyState = {
            health: data.enemy.stats.health,
            maxHealth: data.enemy.stats.maxHealth,
            block: 0,
        };
        this.energyState = this.energyService.initialize();
        this.playerStatusEffects = this.statusEffectService.createState();
        this.enemyStatusEffects = this.statusEffectService.createState();

        // 적 카드 풀
        this.enemyCardPool = data.cardBattleService.generateEnemyCardPool(
            data.enemy.kind,
            data.enemy.elite,
        );

        // 초기화
        this.turnNumber = 0;
        this.totalPlayerDamage = 0;
        this.totalEnemyDamage = 0;
        this.enemyAttackBuff = 0;
        this.isInputLocked = false;
        this.battleLogLines = [];
        this.currentEnemyIntent = undefined;
        this.battleResolution = 'victory';
        this.activePowerCards = [];
        this.playerDamageTakenWindow = 0;
        this.playerOngoingBuffs = EMPTY_ONGOING_BATTLE_BUFFS;
        this.enemyOngoingBuffs = EMPTY_ONGOING_BATTLE_BUFFS;
        this.enemyAttackDebuff = 0;
        this.enemyAttackDebuffDuration = 0;
    }

    create(): void {
        this.damagePopupController = new DamagePopupController(this);
        this.createBackground();
        this.createActionMotionLayers();
        this.createHpBars();
        this.createTurnDisplay();
        this.createResultText();
        this.createZoneCountDisplays();
        this.createEnergyDisplay();
        this.createBlockDisplays();
        this.createEnemyIntentDisplay();
        this.createStatusDisplays();
        this.createPowerDisplays();
        this.createBattleLog();
        this.createCardDetailPanel();
        this.createEndTurnButton();
        this.revealNextEnemyIntent();
        this.startPlayerTurn();
    }

    /** 배틀 종료 콜백을 등록한다. */
    public setOnBattleEnd(callback: (result: BattleSceneResult) => void): void {
        this.onBattleEndCallback = callback;
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
        this.add.text(MAIN_PANEL_CENTER_X, 42, this.sceneData.enemyName, {
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

    private updateTurnDisplay(): void {
        this.turnText.setText(`Turn ${this.turnNumber}`);
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
        this.playerStatusText?.setText(this.formatStatusSummary(this.playerStatusEffects));
        this.enemyStatusText?.setText(this.formatStatusSummary(this.enemyStatusEffects));
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

    // -----------------------------------------------------------------------
    // Battle Log
    // -----------------------------------------------------------------------

    private createBattleLog(): void {
        this.add.text(LOG_PANEL_CONTENT_X, LOG_PANEL_CONTENT_Y - 18, 'Recent Actions', {
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
        this.cardDetailTitleText?.setText(card.name);
        this.cardDetailBodyText?.setText([
            `${this.getCardTypeLabel(card)} · ${this.getCardRarityLabel(card)} · ${this.getCardArchetypeLabel(card)}`,
            `${this.describeCardEffect(card)} ${card.keywords.length > 0 ? `Keywords: ${card.keywords.join(', ')}` : 'Keywords: none'}`,
        ].join('\n'));
    }

    private clearCardDetail(): void {
        this.cardDetailTitleText?.setText('');
        this.cardDetailBodyText?.setText('Hover a card to inspect its effect and role.');
    }

    private updateBattleLog(): void {
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
        healthRestored: number;
        buffApplied?: CardEffectResult['buffApplied'];
        statusApplied?: CardStatusEffect;
    }): string {
        if (effect.fled) {
            return `${card.name}: retreat`;
        }

        if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0) {
            return `${card.name}: strike`;
        }

        if (effect.blockGained > 0) {
            return `${card.name}: +${effect.blockGained} Block`;
        }

        if (effect.healthRestored > 0) {
            return `${card.name}: +${effect.healthRestored} HP`;
        }

        if (effect.statusApplied) {
            return `${card.name}: ${this.getStatusLabel(effect.statusApplied.type)}`;
        }

        if (effect.buffApplied) {
            return `${card.name}: ${effect.buffApplied.type} +${effect.buffApplied.value}`;
        }

        if (effect.cardsDrawn > 0) {
            return `${card.name}: draw ${effect.cardsDrawn}`;
        }

        return `${card.name} used`;
    }

    private formatEnemyActionLog(card: Card, damage: number, blockGained: number, damageBlocked = 0): string {
        if (damage > 0 || damageBlocked > 0) {
            return `Enemy ${card.name}: attack`;
        }

        if (blockGained > 0) {
            return `Enemy ${card.name}: +${blockGained} Block`;
        }

        return `Enemy ${card.name}`;
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
        const hand = this.drawCycleState.hand;

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
        return this.energyService.canAfford(this.energyState, card.cost)
            && checkCardCondition(card, this.playerState.health, {
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
        switch (card.rarity) {
            case CARD_RARITY.UNCOMMON:
                return COLOR_RARITY_UNCOMMON;
            case CARD_RARITY.RARE:
                return COLOR_RARITY_RARE;
            default:
                return COLOR_RARITY_COMMON;
        }
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
                return `Deal ${card.power} damage.`;
            case CARD_EFFECT_TYPE.BLOCK:
                return `Gain ${card.secondaryPower ?? card.power} block.`;
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                return `Apply ${card.statusEffect?.type ?? card.statusEffects?.[0]?.type ?? 'status'} effect.`;
            case CARD_EFFECT_TYPE.FLEE:
                return 'Escape the battle.';
            case CARD_EFFECT_TYPE.DRAW:
                return `Draw ${card.drawCount ?? card.effectPayload?.drawCount ?? 0} card(s).`;
            case CARD_EFFECT_TYPE.HEAL:
                return `Restore ${card.healAmount ?? card.effectPayload?.healAmount ?? 0} health.`;
            case CARD_EFFECT_TYPE.MULTI_HIT:
                return `Hit ${card.hitCount ?? card.effectPayload?.hitCount ?? 1} time(s) for ${card.power}.`;
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

    private createCardVisual(
        card: Card,
        x: number,
        y: number,
        index: number,
        canAfford: boolean,
        baseScale: number = 1,
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const bgColor = canAfford ? this.getCardColor(card) : COLOR_CARD_DIM;
        const alpha = canAfford ? 0.85 : 0.45;

        const bg = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, bgColor, alpha);
        bg.setStrokeStyle(2, this.getCardBorderColor(card), canAfford ? 0.8 : 0.35);
        container.add(bg);

        // 에너지 비용 뱃지 (좌상단)
        const costBadge = this.add.circle(-CARD_WIDTH / 2 + 14, -CARD_HEIGHT / 2 + 14, 12, 0x222266, 0.9);
        container.add(costBadge);
        const costText = this.add.text(-CARD_WIDTH / 2 + 14, -CARD_HEIGHT / 2 + 14, `${card.cost}`, {
            fontSize: '14px',
            color: canAfford ? '#ffdd44' : '#888888',
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
            color: '#ffaa44',
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
            bg.setStrokeStyle(2, this.getCardBorderColor(card), canAfford ? 0.8 : 0.35);
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

        if (this.applyPlayerTurnStartOngoingEffects()) {
            return;
        }

        // 에너지 리필
        this.energyState = this.energyService.refill(this.energyState);

        // 드로우
        this.drawCycleState = this.drawCycleService.drawCards(this.drawCycleState, DEFAULT_HAND_SIZE);

        // UI 갱신
        this.isInputLocked = false;
        this.updateTurnDisplay();
        this.updateAllDisplays();
        this.displayHandCards();
    }

    private onPlayCard(handIndex: number): void {
        const card = this.drawCycleState.hand[handIndex];
        if (!card) return;

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
        this.enemyState = effectResult.targetState;
        this.playerDamageTakenWindow += effectResult.selfDamageTaken;

        this.applyPlayerCardStatusEffects(effectResult);
        this.applyPlayerCardBuff(card, effectResult);
        this.trackActivePower(card);
        this.resolveSelfDamageStrengthTriggers('player', effectResult.selfDamageTaken);

        // 데미지 추적
        this.totalEnemyDamage += effectResult.damageDealt;

        // 드로우 사이클에서 카드 사용 처리 (Exhaust/Discard)
        this.drawCycleState = this.drawCycleService.playCard(this.drawCycleState, card.id);
        this.drawCycleState = this.resolvePostPlayDrawCycle(this.drawCycleState, effectResult);

        // 효과 텍스트 표시
        this.showEffectText(card, effectResult);
        this.playResolvedActionMotion('player', card, effectResult);

        // 카드 사용 애니메이션 후 상태 갱신
        this.time.delayedCall(CARD_PLAY_ANIM_MS, () => {
            this.clearEffectText();
            this.updateAllDisplays();

            // 전투 이탈 체크
            if (effectResult.fled) {
                this.showBattleEnd('player-win', 'escape');
                return;
            }

            // 적 사망 체크
            if (this.enemyState.health <= 0) {
                this.showBattleEnd('player-win');
                return;
            }

            // 에너지 0 자동 턴 종료
            if (spendResult.autoEndTurn) {
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

        // 손패 정리 (Retain 카드 유지, 나머지 버림패)
        this.drawCycleState = this.drawCycleService.endTurn(this.drawCycleState);
        this.resolveTurnEndStatusEffects('player');
        this.playerDamageTakenWindow = 0;
        this.clearCardSprites();
        this.updateAllDisplays();

        if (this.playerState.health <= 0) {
            this.showBattleEnd('player-lose');
            return;
        }

        // 적 턴 실행
        this.time.delayedCall(ENEMY_TURN_DELAY_MS / 2, () => {
            this.executeEnemyTurn();
        });
    }

    // -----------------------------------------------------------------------
    // Enemy Turn
    // -----------------------------------------------------------------------

    private executeEnemyTurn(): void {
        this.prepareTurnStartState('enemy');

        if (this.enemyCardPool.length === 0) {
            this.afterEnemyTurn();
            return;
        }

        this.applyPerTurnPoison('enemy');

        const intent = this.currentEnemyIntent ?? this.revealNextEnemyIntent();
        if (!intent) {
            this.afterEnemyTurn();
            return;
        }

        if (intent.type === ENEMY_INTENT_TYPE.BUFF) {
            this.enemyAttackBuff += intent.amount;
            this.playPanelPulseMotion('enemy', COLOR_ACTION_BUFF);
            this.showEnemyBuffText(intent);

            this.time.delayedCall(ENEMY_TURN_DELAY_MS, () => {
                this.clearEffectText();
                this.updateAllDisplays();
                this.afterEnemyTurn();
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
        this.enemyState = effectResult.userState;
        this.playerState = effectResult.targetState;
        this.totalPlayerDamage += effectResult.damageDealt;
        this.playerDamageTakenWindow += effectResult.damageDealt;

        this.applyEnemyCardStatusEffects(effectResult);
        this.applyEnemyCardBuff(enemyCard, effectResult);
        this.resolveSelfDamageStrengthTriggers('enemy', effectResult.selfDamageTaken);

        // 적 행동 텍스트
        this.playResolvedActionMotion('enemy', enemyCard, effectResult);
        this.showEnemyActionText(
            enemyCard,
            effectResult.damageDealt,
            effectResult.blockGained,
            effectResult.damageBlocked,
        );

        this.time.delayedCall(ENEMY_TURN_DELAY_MS, () => {
            this.clearEffectText();
            this.updateAllDisplays();
            this.afterEnemyTurn();
        });
    }

    private afterEnemyTurn(): void {
        // 플레이어 사망 체크
        if (this.playerState.health <= 0) {
            this.showBattleEnd('player-lose');
            return;
        }

        this.resolveTurnEndStatusEffects('enemy');
        this.tickEnemyAttackDebuff();

        if (this.enemyState.health <= 0) {
            this.showBattleEnd('player-win');
            return;
        }

        this.prepareTurnStartState('player');
        this.revealNextEnemyIntent();

        // 다음 플레이어 턴
        this.startPlayerTurn();
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

    private showEffectText(card: Card, effect: {
        damageDealt: number;
        damageBlocked?: number;
        blockGained: number;
        fled: boolean;
        cardsDrawn: number;
        healthRestored: number;
        buffApplied?: CardEffectResult['buffApplied'];
        statusApplied?: CardStatusEffect;
    }): void {
        this.clearEffectText();
        this.appendBattleLog(this.formatPlayerActionLog(card, effect));

        this.showPopupBatch('enemy-hp', [
            ...(effect.damageBlocked && effect.damageBlocked > 0
                ? [{ type: 'blocked', value: effect.damageBlocked } satisfies DamagePopupRequest]
                : []),
            ...(effect.damageDealt > 0
                ? [{ type: 'damage', value: effect.damageDealt } satisfies DamagePopupRequest]
                : []),
        ]);
        this.showPopupBatch('player-hp', effect.blockGained > 0
            ? [{ type: 'block_gain', value: effect.blockGained }]
            : []);

        if (effect.fled) {
            this.createFallbackEffectText(`${card.name}: retreat`, '#66ffaa');
            return;
        }

        if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0) {
            this.createFallbackEffectText(`${card.name}: strike`, '#ff8f8f');
            return;
        }

        if (effect.blockGained > 0) {
            this.createFallbackEffectText(`${card.name}: +${effect.blockGained} Block`, '#6eb6ff');
            return;
        }

        if (effect.healthRestored > 0) {
            this.createFallbackEffectText(`${card.name}: +${effect.healthRestored} HP`, '#7ee0a4');
            return;
        }

        if (effect.statusApplied) {
            this.createFallbackEffectText(
                `${card.name}: ${this.getStatusLabel(effect.statusApplied.type)}`,
                effect.statusApplied.type === STATUS_EFFECT_TYPE.POISON ? '#c483ff' : '#d3b0ff',
            );
            return;
        }

        if (effect.buffApplied) {
            this.createFallbackEffectText(
                `${card.name}: ${effect.buffApplied.type} +${effect.buffApplied.value}`,
                '#ffb05e',
            );
            return;
        }

        if (effect.cardsDrawn > 0) {
            this.createFallbackEffectText(`${card.name}: draw ${effect.cardsDrawn}`, '#8cd5ff');
            return;
        }

        this.createFallbackEffectText(`${card.name} used`, '#9aafc5');
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
            buffApplied?: CardEffectResult['buffApplied'];
            statusApplied?: CardStatusEffect;
        },
    ): void {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                if (effect.damageDealt > 0 || (effect.damageBlocked ?? 0) > 0 || card.power > 0) {
                    this.playPanelImpactMotion(actor === 'player' ? 'enemy' : 'player', COLOR_ACTION_ATTACK);
                }
                return;
            case CARD_EFFECT_TYPE.BLOCK:
                if (effect.blockGained > 0) {
                    this.playPanelPulseMotion(actor, COLOR_ACTION_DEFEND);
                }
                return;
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                if (effect.statusApplied) {
                    this.playPanelPulseMotion(actor === 'player' ? 'enemy' : 'player', COLOR_ACTION_STATUS);
                }
                return;
            case CARD_EFFECT_TYPE.BUFF:
                if (effect.buffApplied) {
                    this.playPanelPulseMotion(actor, COLOR_ACTION_BUFF);
                }
                return;
            case CARD_EFFECT_TYPE.FLEE:
                if (effect.fled) {
                    this.playPanelPulseMotion(actor, COLOR_ACTION_FLEE);
                }
        }
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

    private showEnemyActionText(card: Card, damage: number, blockGained: number, damageBlocked = 0): void {
        this.clearEffectText();
        this.appendBattleLog(this.formatEnemyActionLog(card, damage, blockGained, damageBlocked));

        this.showPopupBatch('player-hp', [
            ...(damageBlocked > 0
                ? [{ type: 'blocked', value: damageBlocked } satisfies DamagePopupRequest]
                : []),
            ...(damage > 0
                ? [{ type: 'damage', value: damage } satisfies DamagePopupRequest]
                : []),
        ]);
        this.showPopupBatch('enemy-hp', blockGained > 0
            ? [{ type: 'block_gain', value: blockGained }]
            : []);

        if (damage > 0 || damageBlocked > 0) {
            this.createFallbackEffectText(`Enemy ${card.name}: attack`, '#ff8f8f');
            return;
        }

        if (blockGained > 0) {
            this.createFallbackEffectText(`Enemy ${card.name}: +${blockGained} Block`, '#6eb6ff');
            return;
        }

        this.createFallbackEffectText(`Enemy ${card.name}`, '#ffb0b0');
    }

    private showEnemyBuffText(intent: BuffIntent): void {
        this.clearEffectText();
        this.appendBattleLog(`Enemy buffs +${intent.amount} ATK`);

        this.showPopupBatch('enemy-panel', [{ type: 'buff', value: intent.amount }]);
        this.createFallbackEffectText(`Enemy buffs +${intent.amount} ATK`, '#ffb05e');
    }

    private clearEffectText(): void {
        this.effectText?.destroy();
        this.effectText = undefined;
    }

    private resolveTurnEndStatusEffects(actor: 'player' | 'enemy'): void {
        const isPlayer = actor === 'player';
        const label = isPlayer ? 'Player' : this.getEnemyLabel();
        const statusResult = this.statusEffectService.processTurnEnd(
            isPlayer ? this.playerState : this.enemyState,
            isPlayer ? this.playerStatusEffects : this.enemyStatusEffects,
            label,
        );

        if (isPlayer) {
            this.playerState = statusResult.combatant;
            this.playerStatusEffects = statusResult.statusEffects;
        } else {
            this.enemyState = statusResult.combatant;
            this.enemyStatusEffects = statusResult.statusEffects;
        }

        if (statusResult.poisonDamage > 0) {
            this.appendBattleLog(`${label} takes ${statusResult.poisonDamage} poison`);
            this.showPopupBatch(isPlayer ? 'player-hp' : 'enemy-hp', [
                { type: 'poison', value: statusResult.poisonDamage },
            ]);
        }

        this.appendStatusEventLogs(statusResult.events);
        if (isPlayer && statusResult.poisonDamage > 0) {
            this.playerDamageTakenWindow += statusResult.poisonDamage;
        }
    }

    private createFallbackEffectText(text: string, color: string): void {
        this.effectText = this.add.text(MAIN_PANEL_CENTER_X, EFFECT_TEXT_Y, text, {
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
        if (!this.shouldPersistBlock(actor)) {
            if (actor === 'player') {
                this.playerState = this.cardEffectService.resetBlock(this.playerState);
            } else {
                this.enemyState = this.cardEffectService.resetBlock(this.enemyState);
            }
        }

        this.consumeBlockPersistCharge(actor);
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
        this.applyPerTurnPoison('player');
        return false;
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
            this.updateEnemyIntentDisplay(false);
            return;
        }

        const sourceCard = this.getEffectiveEnemyCardPool().find(
            (card) => card.id === intent.sourceCardId,
        );
        if (sourceCard) {
            this.currentEnemyIntent = {
                ...intent,
                damage: sourceCard.power,
            };
        }
        this.updateEnemyIntentDisplay(false);
    }

    private revealNextEnemyIntent(): EnemyIntent | undefined {
        if (this.enemyCardPool.length === 0) {
            this.currentEnemyIntent = undefined;
            this.updateEnemyIntentDisplay(false);
            return undefined;
        }

        this.currentEnemyIntent = this.enemyIntentService.decideNextIntent({
            enemy: this.buildIntentEnemy(),
            enemyCardPool: this.getEffectiveEnemyCardPool(),
            floorNumber: this.sceneData?.floorNumber,
        });
        this.updateEnemyIntentDisplay(true);
        return this.currentEnemyIntent;
    }

    private updateEnemyIntentDisplay(animated: boolean): void {
        if (!this.enemyIntentText) {
            return;
        }

        this.enemyIntentText.setText(this.formatEnemyIntentText(this.currentEnemyIntent));

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

    private formatEnemyIntentText(intent?: EnemyIntent): string {
        if (!intent) {
            return '';
        }

        switch (intent.type) {
            case ENEMY_INTENT_TYPE.ATTACK:
                return `Next ⚔️ ${intent.damage}`;
            case ENEMY_INTENT_TYPE.DEFEND:
                return `Next 🛡️ +${intent.block}`;
            case ENEMY_INTENT_TYPE.BUFF:
                return `Next ⬆️ ${this.formatEnemyIntentBuffStat(intent.stat)} +${intent.amount}`;
        }
    }

    private formatEnemyIntentBuffStat(stat: EnemyIntentBuffStat): string {
        switch (stat) {
            case 'attack':
                return 'ATK';
        }
    }

    private getEffectiveEnemyCardPool(): readonly Card[] {
        const attackModifier = this.enemyAttackBuff - this.enemyAttackDebuff;
        if (attackModifier === 0) {
            return this.enemyCardPool;
        }

        return this.enemyCardPool.map((card) => {
            if (card.effectType !== CARD_EFFECT_TYPE.DAMAGE) {
                return card;
            }

            return {
                ...card,
                power: Math.max(0, card.power + attackModifier),
            };
        });
    }

    private resolveEnemyCardFromIntent(intent: EnemyIntent): Card {
        if (intent.type === ENEMY_INTENT_TYPE.ATTACK || intent.type === ENEMY_INTENT_TYPE.DEFEND) {
            const sourceCard = this.getEffectiveEnemyCardPool().find((card) => card.id === intent.sourceCardId);
            if (sourceCard) {
                return sourceCard;
            }
        }

        return this.buildFallbackEnemyCard(intent.type);
    }

    private buildFallbackEnemyCard(intentType: EnemyIntentType): Card {
        const enemy = this.buildIntentEnemy();

        if (intentType === ENEMY_INTENT_TYPE.DEFEND) {
            return createCard({
                name: 'Enemy Defend',
                type: CARD_TYPE.GUARD,
                power: Math.max(1, enemy.stats.defense + 2),
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
        }

        return createCard({
            name: 'Enemy Strike',
            type: CARD_TYPE.ATTACK,
            power: Math.max(0, enemy.stats.attack + this.enemyAttackBuff - this.enemyAttackDebuff),
            effectType: CARD_EFFECT_TYPE.DAMAGE,
        });
    }

    private buildIntentEnemy(): EnemyEntity {
        const baseEnemy = this.sceneData?.enemy;

        return new Enemy(
            baseEnemy?.id ?? 'enemy-intent',
            baseEnemy?.label ?? this.getEnemyLabel(),
            baseEnemy?.position ? { ...baseEnemy.position } : { x: 0, y: 0 },
            {
                health: this.enemyState?.health ?? baseEnemy?.stats.health ?? 0,
                maxHealth: this.enemyState?.maxHealth ?? baseEnemy?.stats.maxHealth ?? 1,
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
        const result: BattleSceneResult = {
            outcome,
            resolution: this.battleResolution,
            totalRounds: this.turnNumber,
            totalPlayerDamage: this.totalPlayerDamage,
            totalEnemyDamage: this.totalEnemyDamage,
            playerRemainingHealth: this.playerState.health,
            enemyRemainingHealth: this.enemyState.health,
            enemy: this.sceneData.enemy,
        };

        if (this.onBattleEndCallback) {
            this.onBattleEndCallback(result);
        }

        this.scene.stop(SCENE_KEY);
        this.scene.wake('MainScene');
    }
}
