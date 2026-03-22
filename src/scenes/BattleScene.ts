// ---------------------------------------------------------------------------
// BattleScene — Cycle 3 카드 배틀 전용 Phaser Scene (TASK-031, TASK-033)
// ---------------------------------------------------------------------------

import 'phaser';
import type { Card } from '../domain/entities/Card';
import { CARD_EFFECT_TYPE } from '../domain/entities/Card';
import { checkCardCondition } from '../domain/entities/CardCatalog';
import type { Enemy } from '../domain/entities/Enemy';
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
import { CardEffectService, type CombatantState } from '../domain/services/CardEffectService';
import { EnergyService, type EnergyState } from '../domain/services/EnergyService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** BattleScene에 전달되는 초기 데이터. */
export interface BattleSceneData {
    readonly player: Player;
    readonly enemy: Enemy;
    readonly deckService: DeckService;
    readonly cardBattleService: CardBattleService;
    readonly itemService: ItemService;
    readonly enemyName: string;
}

/** 배틀 종료 시 MainScene에 반환하는 결과. */
export interface BattleSceneResult {
    readonly outcome: BattleOutcomeType;
    readonly totalRounds: number;
    readonly totalPlayerDamage: number;
    readonly totalEnemyDamage: number;
    readonly enemy: Enemy;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCENE_KEY = 'BattleScene';
const SCENE_CENTER_X = 400;
const SCENE_WIDTH = 800;
const CARD_WIDTH = 100;
const CARD_HEIGHT = 140;
const CARD_GAP = 12;
const CARD_Y = 440;
const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 20;
const ENEMY_HP_BAR_Y = 78;
const PLAYER_HP_BAR_Y = 303;
const HP_LOW_THRESHOLD = 0.3;
const CARD_PLAY_ANIM_MS = 300;
const ENEMY_TURN_DELAY_MS = 800;
const END_TURN_BUTTON_X = 720;
const END_TURN_BUTTON_Y = 440;

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
const COLOR_CARD_FLEE = 0x339966;
const COLOR_CARD_DIM = 0x555555;
const COLOR_END_TURN_BG = 0x446644;
const COLOR_END_TURN_HOVER = 0x558855;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class BattleScene extends Phaser.Scene {
    // Domain services
    private drawCycleService!: DrawCycleService;
    private cardEffectService!: CardEffectService;
    private energyService!: EnergyService;

    // Battle state
    private drawCycleState!: DrawCycleState;
    private playerState!: CombatantState;
    private enemyState!: CombatantState;
    private energyState!: EnergyState;
    private enemyCardPool!: readonly Card[];
    private sceneData!: BattleSceneData;
    private turnNumber = 0;
    private totalPlayerDamage = 0;
    private totalEnemyDamage = 0;

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
    private deckCountText!: Phaser.GameObjects.Text;
    private discardCountText!: Phaser.GameObjects.Text;
    private energyText!: Phaser.GameObjects.Text;
    private playerBlockText!: Phaser.GameObjects.Text;
    private enemyBlockText!: Phaser.GameObjects.Text;

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

        // 적 카드 풀
        this.enemyCardPool = data.cardBattleService.generateEnemyCardPool(
            data.enemy.kind,
            data.enemy.elite,
        );

        // 초기화
        this.turnNumber = 0;
        this.totalPlayerDamage = 0;
        this.totalEnemyDamage = 0;
        this.isInputLocked = false;
    }

    create(): void {
        this.createBackground();
        this.createHpBars();
        this.createTurnDisplay();
        this.createResultText();
        this.createZoneCountDisplays();
        this.createEnergyDisplay();
        this.createBlockDisplays();
        this.createEndTurnButton();
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
        this.add.rectangle(SCENE_CENTER_X, 300, SCENE_WIDTH, 600, COLOR_BG);

        // 적 이름 표시
        this.add.text(SCENE_CENTER_X, 40, this.sceneData.enemyName, {
            fontSize: '20px',
            color: '#ff6666',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // 플레이어 라벨
        this.add.text(SCENE_CENTER_X, 355, 'Your Hand', {
            fontSize: '14px',
            color: '#aaaaaa',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    // -----------------------------------------------------------------------
    // HP Bars
    // -----------------------------------------------------------------------

    private createHpBars(): void {
        this.add.text(SCENE_CENTER_X, 65, 'Enemy HP', {
            fontSize: '12px',
            color: '#ff8888',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.enemyHpBar = this.add.graphics();
        this.enemyHpText = this.add.text(SCENE_CENTER_X, 85, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(SCENE_CENTER_X, 290, 'Player HP', {
            fontSize: '12px',
            color: '#88ff88',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.playerHpBar = this.add.graphics();
        this.playerHpText = this.add.text(SCENE_CENTER_X, 310, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.updateHpBars();
    }

    private updateHpBars(): void {
        const barX = SCENE_CENTER_X - HP_BAR_WIDTH / 2;

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
        this.turnText = this.add.text(SCENE_CENTER_X, 15, '', {
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
        // 덱 잔여 수 (좌하단)
        this.add.text(50, 375, 'Deck', {
            fontSize: '11px',
            color: '#88aaff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.deckCountText = this.add.text(50, 395, '0', {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // 버림패 수 (우하단 — End Turn 버튼 왼쪽)
        this.add.text(650, 375, 'Discard', {
            fontSize: '11px',
            color: '#ffaa88',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.discardCountText = this.add.text(650, 395, '0', {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.updateZoneCountDisplays();
    }

    private updateZoneCountDisplays(): void {
        const counts = this.drawCycleService.getZoneCounts(this.drawCycleState);
        this.deckCountText.setText(`${counts.drawPile}`);
        this.discardCountText.setText(`${counts.discardPile}`);
    }

    // -----------------------------------------------------------------------
    // Energy Display
    // -----------------------------------------------------------------------

    private createEnergyDisplay(): void {
        this.add.text(50, 440, 'Energy', {
            fontSize: '11px',
            color: '#ffdd44',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.energyText = this.add.text(50, 465, '', {
            fontSize: '22px',
            color: '#ffdd44',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.updateEnergyDisplay();
    }

    private updateEnergyDisplay(): void {
        this.energyText.setText(`${this.energyState.current} / ${this.energyState.max}`);
    }

    // -----------------------------------------------------------------------
    // Block Displays
    // -----------------------------------------------------------------------

    private createBlockDisplays(): void {
        this.playerBlockText = this.add.text(SCENE_CENTER_X + 130, 310, '', {
            fontSize: '14px',
            color: '#6699ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.enemyBlockText = this.add.text(SCENE_CENTER_X + 130, 85, '', {
            fontSize: '14px',
            color: '#6699ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.updateBlockDisplays();
    }

    private updateBlockDisplays(): void {
        this.playerBlockText.setText(this.playerState.block > 0 ? `Block: ${this.playerState.block}` : '');
        this.enemyBlockText.setText(this.enemyState.block > 0 ? `Block: ${this.enemyState.block}` : '');
    }

    // -----------------------------------------------------------------------
    // Result Text
    // -----------------------------------------------------------------------

    private createResultText(): void {
        this.resultText = this.add.text(SCENE_CENTER_X, 200, '', {
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

        if (hand.length === 0) return;

        const totalWidth = hand.length * CARD_WIDTH + (hand.length - 1) * CARD_GAP;
        const startX = SCENE_CENTER_X - totalWidth / 2 + CARD_WIDTH / 2;

        hand.forEach((card, index) => {
            const x = startX + index * (CARD_WIDTH + CARD_GAP);
            const isPlayable = this.canPlayCard(card);
            const container = this.createCardVisual(card, x, CARD_Y, index, isPlayable);
            this.cardSprites.push(container);
        });
    }

    private canPlayCard(card: Card): boolean {
        return this.energyService.canAfford(this.energyState, card.cost)
            && checkCardCondition(card, this.playerState.health);
    }

    private getCardColor(card: Card): number {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE: return COLOR_CARD_ATTACK;
            case CARD_EFFECT_TYPE.BLOCK: return COLOR_CARD_GUARD;
            case CARD_EFFECT_TYPE.STATUS_EFFECT: return COLOR_CARD_STATUS;
            case CARD_EFFECT_TYPE.FLEE: return COLOR_CARD_FLEE;
            default: return COLOR_CARD_ATTACK;
        }
    }

    private getCardIcon(card: Card): string {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE: return '⚔️';
            case CARD_EFFECT_TYPE.BLOCK: return '🛡️';
            case CARD_EFFECT_TYPE.STATUS_EFFECT: return '💫';
            case CARD_EFFECT_TYPE.FLEE: return '💨';
            default: return '⚔️';
        }
    }

    private createCardVisual(
        card: Card, x: number, y: number, index: number, canAfford: boolean,
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const bgColor = canAfford ? this.getCardColor(card) : COLOR_CARD_DIM;
        const alpha = canAfford ? 0.85 : 0.45;

        const bg = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, bgColor, alpha);
        bg.setStrokeStyle(2, 0xffffff, canAfford ? 0.6 : 0.3);
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
        }).setOrigin(0.5);
        container.add(nameText);

        // 키워드 표시
        if (card.keywords.length > 0) {
            const kwText = this.add.text(0, 58, card.keywords.join(' '), {
                fontSize: '7px',
                color: '#ffaa44',
                fontFamily: 'monospace',
            }).setOrigin(0.5);
            container.add(kwText);
        }

        // 인터랙션 (사용 가능한 카드만)
        if (canAfford) {
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerover', () => {
                if (!this.isInputLocked) {
                    container.setScale(1.08);
                    bg.setStrokeStyle(3, 0xffff00, 1);
                }
            });
            bg.on('pointerout', () => {
                if (!this.isInputLocked) {
                    container.setScale(1);
                    bg.setStrokeStyle(2, 0xffffff, 0.6);
                }
            });
            bg.on('pointerdown', () => {
                if (!this.isInputLocked) {
                    this.onPlayCard(index);
                }
            });
        }

        return container;
    }

    private clearCardSprites(): void {
        this.cardSprites.forEach((sprite) => sprite.destroy());
        this.cardSprites = [];
    }

    // -----------------------------------------------------------------------
    // Player Turn Flow
    // -----------------------------------------------------------------------

    private startPlayerTurn(): void {
        this.turnNumber++;

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

        // 카드 효과 적용
        const effectResult = this.cardEffectService.applyEffect(card, this.playerState, this.enemyState);
        this.playerState = effectResult.userState;
        this.enemyState = effectResult.targetState;

        // 데미지 추적
        this.totalEnemyDamage += effectResult.damageDealt;

        // 드로우 사이클에서 카드 사용 처리 (Exhaust/Discard)
        this.drawCycleState = this.drawCycleService.playCard(this.drawCycleState, card.id);

        // 효과 텍스트 표시
        this.showEffectText(card, effectResult);

        // 카드 사용 애니메이션 후 상태 갱신
        this.time.delayedCall(CARD_PLAY_ANIM_MS, () => {
            this.clearEffectText();
            this.updateAllDisplays();

            // 전투 이탈 체크
            if (effectResult.fled) {
                this.endBattle('player-win'); // TODO(PLAN-TBD-002): 도주 결과 분류
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
        // plan.md 기준: Block은 각 전투자의 턴 종료 시점에 소멸한다.
        this.playerState = this.cardEffectService.resetBlock(this.playerState);
        this.clearCardSprites();
        this.updateAllDisplays();

        // 적 턴 실행
        this.time.delayedCall(ENEMY_TURN_DELAY_MS / 2, () => {
            this.executeEnemyTurn();
        });
    }

    // -----------------------------------------------------------------------
    // Enemy Turn
    // -----------------------------------------------------------------------

    private executeEnemyTurn(): void {
        // 적 카드 풀에서 랜덤 선택
        if (this.enemyCardPool.length === 0) {
            this.afterEnemyTurn();
            return;
        }

        const enemyCardIndex = Math.floor(Math.random() * this.enemyCardPool.length);
        const enemyCard = this.enemyCardPool[enemyCardIndex];

        // 적 카드 효과를 플레이어에게 적용 (적이 attacker, 플레이어가 target)
        const effectResult = this.cardEffectService.applyEffect(enemyCard, this.enemyState, this.playerState);
        this.enemyState = effectResult.userState;
        this.playerState = effectResult.targetState;
        this.totalPlayerDamage += effectResult.damageDealt;

        // 적 행동 텍스트
        this.showEnemyActionText(enemyCard, effectResult.damageDealt, effectResult.blockGained);

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

        this.enemyState = this.cardEffectService.resetBlock(this.enemyState);

        // 다음 플레이어 턴
        this.startPlayerTurn();
    }

    // -----------------------------------------------------------------------
    // Effect Text
    // -----------------------------------------------------------------------

    private showEffectText(card: Card, effect: { damageDealt: number; blockGained: number; fled: boolean }): void {
        this.clearEffectText();

        let text: string;
        let color: string;

        if (effect.fled) {
            text = '💨 Fled!';
            color = '#66ffaa';
        } else if (effect.damageDealt > 0) {
            text = `⚔️ ${card.name}: ${effect.damageDealt} DMG`;
            color = '#ff6666';
        } else if (effect.blockGained > 0) {
            text = `🛡️ ${card.name}: +${effect.blockGained} Block`;
            color = '#6699ff';
        } else {
            text = `${card.name} used`;
            color = '#aaaaaa';
        }

        this.effectText = this.add.text(SCENE_CENTER_X, 230, text, {
            fontSize: '18px',
            color,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
    }

    private showEnemyActionText(card: Card, damage: number, blockGained: number): void {
        this.clearEffectText();

        let text: string;
        let color: string;

        if (damage > 0) {
            text = `💥 Enemy ${card.name}: ${damage} DMG`;
            color = '#ff4444';
        } else if (blockGained > 0) {
            text = `🛡️ Enemy gains +${blockGained} Block`;
            color = '#ff8866';
        } else {
            text = `Enemy: ${card.name}`;
            color = '#ff8888';
        }

        this.effectText = this.add.text(SCENE_CENTER_X, 230, text, {
            fontSize: '18px',
            color,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
    }

    private clearEffectText(): void {
        this.effectText?.destroy();
        this.effectText = undefined;
    }

    // -----------------------------------------------------------------------
    // Display Update Helpers
    // -----------------------------------------------------------------------

    private updateAllDisplays(): void {
        this.updateHpBars();
        this.updateZoneCountDisplays();
        this.updateEnergyDisplay();
        this.updateBlockDisplays();
    }

    // -----------------------------------------------------------------------
    // Battle End
    // -----------------------------------------------------------------------

    private showBattleEnd(outcome: BattleOutcomeType): void {
        this.isInputLocked = true;
        this.clearCardSprites();
        this.endTurnButton?.setVisible(false);

        const isVictory = outcome === 'player-win';

        this.resultText.setText(isVictory ? 'VICTORY!' : 'DEFEAT...');
        this.resultText.setColor(isVictory ? '#ffdd44' : '#ff4444');
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
            totalRounds: this.turnNumber,
            totalPlayerDamage: this.totalPlayerDamage,
            totalEnemyDamage: this.totalEnemyDamage,
            enemy: this.sceneData.enemy,
        };

        if (this.onBattleEndCallback) {
            this.onBattleEndCallback(result);
        }

        this.scene.stop(SCENE_KEY);
        this.scene.wake('MainScene');
    }
}
