// ---------------------------------------------------------------------------
// BattleScene — 카드 배틀 전용 Phaser Scene
// ---------------------------------------------------------------------------

import 'phaser';
import type { Card } from '../domain/entities/Card';
import { CARD_TYPE } from '../domain/entities/Card';
import type { Enemy } from '../domain/entities/Enemy';
import type { Player } from '../domain/entities/Player';
import { CardBattleService } from '../domain/services/CardBattleService';
import {
    CardBattleLoopService,
    type BattleLoopState,
    type BattleOutcomeType,
} from '../domain/services/CardBattleLoopService';
import {
    getEquipmentCardBonus,
    applyEquipmentBonusToHand,
    type EquipmentCardBonus,
} from '../domain/services/EquipmentCardBonusService';
import type { ItemService } from '../domain/services/ItemService';
import type { DeckService } from '../domain/services/DeckService';
import type { RoundResult } from '../domain/services/CardBattleLoopService';

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
const CARD_WIDTH = 120;
const CARD_HEIGHT = 160;
const CARD_GAP = 20;
const CARD_Y = 420;
const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 20;
const RESULT_DISPLAY_MS = 1200;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class BattleScene extends Phaser.Scene {
    private battleLoopService!: CardBattleLoopService;
    private battleState!: BattleLoopState;
    private boostedDeck!: readonly Card[];
    private equipmentBonus!: EquipmentCardBonus;
    private sceneData!: BattleSceneData;

    // UI elements
    private cardSprites: Phaser.GameObjects.Container[] = [];
    private playerHpBar!: Phaser.GameObjects.Graphics;
    private enemyHpBar!: Phaser.GameObjects.Graphics;
    private playerHpText!: Phaser.GameObjects.Text;
    private enemyHpText!: Phaser.GameObjects.Text;
    private roundText!: Phaser.GameObjects.Text;
    private resultText!: Phaser.GameObjects.Text;
    private enemyCardDisplay?: Phaser.GameObjects.Container;
    private clashResultText?: Phaser.GameObjects.Text;

    private isInputLocked = false;
    private selectedCardIndex = -1;

    // Callback for when battle ends
    private onBattleEndCallback?: (result: BattleSceneResult) => void;

    constructor() {
        super({ key: SCENE_KEY });
    }

    init(data: BattleSceneData): void {
        this.sceneData = data;
        this.battleLoopService = new CardBattleLoopService(data.cardBattleService);

        // 장비 보너스 계산 및 적용
        this.equipmentBonus = getEquipmentCardBonus(data.itemService.getInventory());
        const deckCards = data.deckService.getCards();
        this.boostedDeck = applyEquipmentBonusToHand(deckCards, this.equipmentBonus);

        // 적 카드 풀 생성
        const enemyCardPool = data.cardBattleService.generateEnemyCardPool(
            data.enemy.kind,
            data.enemy.elite,
        );

        // 배틀 상태 초기화
        this.battleState = this.battleLoopService.createBattleState({
            deck: this.boostedDeck,
            enemyCardPool,
            playerHp: data.player.stats.health,
            playerMaxHp: data.player.stats.maxHealth,
            enemyHp: data.enemy.stats.health,
            enemyMaxHp: data.enemy.stats.maxHealth,
        });

        this.isInputLocked = false;
        this.selectedCardIndex = -1;
    }

    create(): void {
        this.createBackground();
        this.createHpBars();
        this.createRoundDisplay();
        this.createResultText();
        this.startNextRound();
    }

    /** 배틀 종료 콜백을 등록한다. */
    public setOnBattleEnd(callback: (result: BattleSceneResult) => void): void {
        this.onBattleEndCallback = callback;
    }

    // -----------------------------------------------------------------------
    // Background & Layout
    // -----------------------------------------------------------------------

    private createBackground(): void {
        this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);

        // 적 이름 표시
        this.add.text(400, 40, this.sceneData.enemyName, {
            fontSize: '20px',
            color: '#ff6666',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // 플레이어 라벨
        this.add.text(400, 340, 'Your Hand', {
            fontSize: '16px',
            color: '#aaaaaa',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    // -----------------------------------------------------------------------
    // HP Bars
    // -----------------------------------------------------------------------

    private createHpBars(): void {
        // 적 HP (상단 중앙)
        this.add.text(400, 65, 'Enemy HP', {
            fontSize: '12px',
            color: '#ff8888',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.enemyHpBar = this.add.graphics();
        this.enemyHpText = this.add.text(400, 85, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // 플레이어 HP (중앙)
        this.add.text(400, 290, 'Player HP', {
            fontSize: '12px',
            color: '#88ff88',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.playerHpBar = this.add.graphics();
        this.playerHpText = this.add.text(400, 310, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.updateHpBars();
    }

    private updateHpBars(): void {
        const state = this.battleState;

        // 적 HP Bar
        this.enemyHpBar.clear();
        const enemyBarX = 400 - HP_BAR_WIDTH / 2;
        this.enemyHpBar.fillStyle(0x333333);
        this.enemyHpBar.fillRect(enemyBarX, 78, HP_BAR_WIDTH, HP_BAR_HEIGHT);
        const enemyHpRatio = Math.max(0, state.enemyHp / state.enemyMaxHp);
        this.enemyHpBar.fillStyle(enemyHpRatio > 0.3 ? 0xff4444 : 0xff0000);
        this.enemyHpBar.fillRect(enemyBarX, 78, HP_BAR_WIDTH * enemyHpRatio, HP_BAR_HEIGHT);
        this.enemyHpText.setText(`${state.enemyHp} / ${state.enemyMaxHp}`);

        // 플레이어 HP Bar
        this.playerHpBar.clear();
        const playerBarX = 400 - HP_BAR_WIDTH / 2;
        this.playerHpBar.fillStyle(0x333333);
        this.playerHpBar.fillRect(playerBarX, 303, HP_BAR_WIDTH, HP_BAR_HEIGHT);
        const playerHpRatio = Math.max(0, state.playerHp / state.playerMaxHp);
        this.playerHpBar.fillStyle(playerHpRatio > 0.3 ? 0x44ff44 : 0xff6600);
        this.playerHpBar.fillRect(playerBarX, 303, HP_BAR_WIDTH * playerHpRatio, HP_BAR_HEIGHT);
        this.playerHpText.setText(`${state.playerHp} / ${state.playerMaxHp}`);
    }

    // -----------------------------------------------------------------------
    // Round Display
    // -----------------------------------------------------------------------

    private createRoundDisplay(): void {
        this.roundText = this.add.text(400, 15, '', {
            fontSize: '18px',
            color: '#ffcc00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
    }

    private updateRoundDisplay(): void {
        this.roundText.setText(`Round ${this.battleState.round}`);
    }

    // -----------------------------------------------------------------------
    // Result Text
    // -----------------------------------------------------------------------

    private createResultText(): void {
        this.resultText = this.add.text(400, 200, '', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
    }

    // -----------------------------------------------------------------------
    // Card Display
    // -----------------------------------------------------------------------

    private displayHandCards(hand: readonly Card[]): void {
        this.clearCardSprites();

        const totalWidth = hand.length * CARD_WIDTH + (hand.length - 1) * CARD_GAP;
        const startX = 400 - totalWidth / 2 + CARD_WIDTH / 2;

        hand.forEach((card, index) => {
            const x = startX + index * (CARD_WIDTH + CARD_GAP);
            const container = this.createCardVisual(card, x, CARD_Y, index);
            this.cardSprites.push(container);
        });
    }

    private createCardVisual(card: Card, x: number, y: number, index: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);

        // 카드 배경
        const isAttack = card.type === CARD_TYPE.ATTACK;
        const bgColor = isAttack ? 0xcc3333 : 0x3366cc;
        const bg = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, bgColor, 0.85);
        bg.setStrokeStyle(2, 0xffffff, 0.6);
        container.add(bg);

        // 타입 아이콘
        const icon = isAttack ? '⚔️' : '🛡️';
        const iconText = this.add.text(0, -40, icon, {
            fontSize: '32px',
        }).setOrigin(0.5);
        container.add(iconText);

        // 타입 라벨
        const typeLabel = this.add.text(0, -5, isAttack ? 'ATK' : 'GRD', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(typeLabel);

        // 파워 수치
        const powerText = this.add.text(0, 30, `${card.power}`, {
            fontSize: '36px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);
        container.add(powerText);

        // 카드 이름
        const nameText = this.add.text(0, 60, card.name, {
            fontSize: '10px',
            color: '#cccccc',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(nameText);

        // 인터랙션
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
            if (!this.isInputLocked) {
                container.setScale(1.08);
                bg.setStrokeStyle(3, 0xffff00, 1);
            }
        });
        bg.on('pointerout', () => {
            if (!this.isInputLocked && this.selectedCardIndex !== index) {
                container.setScale(1);
                bg.setStrokeStyle(2, 0xffffff, 0.6);
            }
        });
        bg.on('pointerdown', () => {
            if (!this.isInputLocked) {
                this.selectCard(index);
            }
        });

        return container;
    }

    private clearCardSprites(): void {
        this.cardSprites.forEach((sprite) => sprite.destroy());
        this.cardSprites = [];
    }

    // -----------------------------------------------------------------------
    // Card Selection & Resolution
    // -----------------------------------------------------------------------

    private selectCard(index: number): void {
        if (this.isInputLocked) return;

        this.selectedCardIndex = index;
        this.isInputLocked = true;

        // 선택된 카드 시각 피드백
        this.cardSprites.forEach((container, i) => {
            if (i === index) {
                container.setScale(1.15);
                const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
                bg.setStrokeStyle(3, 0xffff00, 1);
                // 선택된 카드를 위로 이동
                this.tweens.add({
                    targets: container,
                    y: CARD_Y - 20,
                    duration: 200,
                    ease: 'Power2',
                });
            } else {
                container.setAlpha(0.4);
            }
        });

        // 잠시 후 라운드 해결
        this.time.delayedCall(400, () => {
            this.resolveCurrentRound(index);
        });
    }

    private resolveCurrentRound(cardIndex: number): void {
        const playerCard = this.battleState.playerHand[cardIndex];
        if (!playerCard) return;

        // 라운드 해결
        this.battleState = this.battleLoopService.resolveRound(this.battleState, playerCard);
        const lastRound = this.battleState.rounds[this.battleState.rounds.length - 1];
        if (!lastRound) return;

        // 적 카드 표시
        this.showEnemyCard(lastRound);

        // 결과 표시
        this.time.delayedCall(600, () => {
            this.showClashResult(lastRound);
            this.updateHpBars();

            // 배틀 종료 체크
            this.time.delayedCall(RESULT_DISPLAY_MS, () => {
                this.clearRoundDisplay();

                if (this.battleLoopService.isBattleOver(this.battleState)) {
                    this.showBattleEnd();
                } else {
                    this.startNextRound();
                }
            });
        });
    }

    // -----------------------------------------------------------------------
    // Enemy Card Display
    // -----------------------------------------------------------------------

    private showEnemyCard(round: RoundResult): void {
        this.enemyCardDisplay?.destroy();

        const card = round.enemyCard;
        const container = this.add.container(400, 180);

        const isAttack = card.type === CARD_TYPE.ATTACK;
        const bg = this.add.rectangle(0, 0, 100, 130, isAttack ? 0x993333 : 0x335599, 0.85);
        bg.setStrokeStyle(2, 0xff6666, 0.8);
        container.add(bg);

        const icon = this.add.text(0, -30, isAttack ? '⚔️' : '🛡️', {
            fontSize: '24px',
        }).setOrigin(0.5);
        container.add(icon);

        const typeLabel = this.add.text(0, -5, isAttack ? 'ATK' : 'GRD', {
            fontSize: '12px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(typeLabel);

        const power = this.add.text(0, 25, `${card.power}`, {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(power);

        // 등장 애니메이션
        container.setAlpha(0);
        container.setScale(0.5);
        this.tweens.add({
            targets: container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut',
        });

        this.enemyCardDisplay = container;
    }

    // -----------------------------------------------------------------------
    // Clash Result Display
    // -----------------------------------------------------------------------

    private showClashResult(round: RoundResult): void {
        this.clashResultText?.destroy();

        const { clashResult } = round;
        let text: string;
        let color: string;

        if (clashResult.enemyDamage > 0 && clashResult.playerDamage === 0) {
            text = `💥 ${clashResult.enemyDamage} DMG!`;
            color = '#66ff66';
        } else if (clashResult.playerDamage > 0 && clashResult.enemyDamage === 0) {
            text = `💔 ${clashResult.playerDamage} DMG!`;
            color = '#ff6666';
        } else if (clashResult.playerDamage > 0 && clashResult.enemyDamage > 0) {
            text = `⚡ ${clashResult.enemyDamage} vs ${clashResult.playerDamage}`;
            color = '#ffaa44';
        } else {
            text = '🛡️ No Damage';
            color = '#aaaaaa';
        }

        this.clashResultText = this.add.text(400, 250, text, {
            fontSize: '22px',
            color,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // 등장 애니메이션
        this.clashResultText.setAlpha(0);
        this.tweens.add({
            targets: this.clashResultText,
            alpha: 1,
            duration: 200,
        });
    }

    private clearRoundDisplay(): void {
        this.clearCardSprites();
        this.enemyCardDisplay?.destroy();
        this.enemyCardDisplay = undefined;
        this.clashResultText?.destroy();
        this.clashResultText = undefined;
    }

    // -----------------------------------------------------------------------
    // Round Flow
    // -----------------------------------------------------------------------

    private startNextRound(): void {
        this.isInputLocked = false;
        this.selectedCardIndex = -1;

        // 드로우 페이즈
        this.battleState = this.battleLoopService.drawPhase(this.battleState, this.boostedDeck);
        this.updateRoundDisplay();

        // 손패가 비어있으면 (덱이 비어있는 경우) 배틀 종료
        if (this.battleState.playerHand.length === 0) {
            this.showBattleEnd();
            return;
        }

        // 카드 표시
        this.displayHandCards(this.battleState.playerHand);
    }

    // -----------------------------------------------------------------------
    // Battle End
    // -----------------------------------------------------------------------

    private showBattleEnd(): void {
        this.isInputLocked = true;
        this.clearRoundDisplay();

        const outcome = this.battleLoopService.getBattleResult(this.battleState);
        const isVictory = outcome === 'player-win';

        this.resultText.setText(isVictory ? '🏆 VICTORY!' : '💀 DEFEAT...');
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
        // 총 데미지 계산
        let totalPlayerDamage = 0;
        let totalEnemyDamage = 0;
        for (const round of this.battleState.rounds) {
            totalPlayerDamage += round.clashResult.playerDamage;
            totalEnemyDamage += round.clashResult.enemyDamage;
        }

        const result: BattleSceneResult = {
            outcome,
            totalRounds: this.battleState.rounds.length,
            totalPlayerDamage,
            totalEnemyDamage,
            enemy: this.sceneData.enemy,
        };

        if (this.onBattleEndCallback) {
            this.onBattleEndCallback(result);
        }

        // MainScene으로 복귀
        this.scene.stop(SCENE_KEY);
        this.scene.wake('MainScene');
    }
}
