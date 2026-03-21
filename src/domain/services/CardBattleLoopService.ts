// ---------------------------------------------------------------------------
// Card Battle Loop Service — 멀티 라운드 배틀 루프 (순수 도메인 로직)
// ---------------------------------------------------------------------------

import type { Card } from '../entities/Card';
import type { CardClashResult } from './CardBattleResolver';
import { resolveCardClash } from './CardBattleResolver';
import type { CardBattleService } from './CardBattleService';

// ---------------------------------------------------------------------------
// Battle Phase State Machine
// ---------------------------------------------------------------------------

/**
 * 배틀 상태 머신 단계.
 * IDLE → DRAW → SELECT → RESOLVE → (NEXT_ROUND | END)
 */
export const BATTLE_PHASE = {
    IDLE: 'IDLE',
    DRAW: 'DRAW',
    SELECT: 'SELECT',
    RESOLVE: 'RESOLVE',
    NEXT_ROUND: 'NEXT_ROUND',
    END: 'END',
} as const;

export type BattlePhase = (typeof BATTLE_PHASE)[keyof typeof BATTLE_PHASE];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 한 라운드의 결과 기록. */
export interface RoundResult {
    readonly round: number;
    readonly playerCard: Card;
    readonly enemyCard: Card;
    readonly clashResult: CardClashResult;
    readonly playerHpAfter: number;
    readonly enemyHpAfter: number;
}

/** 전체 배틀 결과. */
export type BattleOutcomeType = 'player-win' | 'player-lose';

export interface BattleLoopResult {
    readonly outcome: BattleOutcomeType;
    readonly totalRounds: number;
    readonly rounds: readonly RoundResult[];
    readonly finalPlayerHp: number;
    readonly finalEnemyHp: number;
}

/** 진행 중인 배틀의 상태 스냅샷. */
export interface BattleLoopState {
    readonly phase: BattlePhase;
    readonly round: number;
    readonly playerHp: number;
    readonly playerMaxHp: number;
    readonly enemyHp: number;
    readonly enemyMaxHp: number;
    readonly playerHand: readonly Card[];
    readonly enemyCardPool: readonly Card[];
    readonly rounds: readonly RoundResult[];
}

/** 배틀 실행 파라미터. */
export interface BattleLoopParams {
    readonly deck: readonly Card[];
    readonly enemyCardPool: readonly Card[];
    readonly playerHp: number;
    readonly playerMaxHp: number;
    readonly enemyHp: number;
    readonly enemyMaxHp: number;
    /** 플레이어 카드 선택 전략. 미지정 시 첫 번째 카드 자동 선택. */
    readonly selectPlayerCard?: (hand: readonly Card[]) => Card;
}

// ---------------------------------------------------------------------------
// Safety Constants
// ---------------------------------------------------------------------------

/** 무한 루프 방지용 최대 라운드 수. */
const MAX_ROUNDS = 100;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 멀티 라운드 카드 배틀 루프를 관리한다.
 * 도메인 순수 로직으로, Phaser 의존 없음.
 */
export class CardBattleLoopService {
    constructor(
        private readonly cardBattleService: CardBattleService,
    ) {}

    /**
     * 전체 배틀을 자동으로 해결한다.
     * 매 라운드: 드로우 → 선택 → 판정 → HP 반영 → 반복
     *
     * @returns 배틀 최종 결과 (승패, 라운드 기록, 최종 HP)
     */
    runFullBattle(params: BattleLoopParams): BattleLoopResult {
        let playerHp = params.playerHp;
        let enemyHp = params.enemyHp;
        const rounds: RoundResult[] = [];
        let round = 0;

        while (playerHp > 0 && enemyHp > 0 && round < MAX_ROUNDS) {
            round++;

            // --- DRAW phase ---
            const drawResult = this.cardBattleService.drawHand(params.deck);
            if (drawResult.hand.length === 0) {
                break;
            }

            // --- SELECT phase ---
            const playerCard = params.selectPlayerCard
                ? params.selectPlayerCard(drawResult.hand)
                : drawResult.hand[0];
            const enemyCard = this.cardBattleService.selectEnemyCard(params.enemyCardPool);

            // --- RESOLVE phase ---
            const clashResult = resolveCardClash(playerCard, enemyCard);

            if (clashResult.enemyDamage > 0) {
                enemyHp = Math.max(0, enemyHp - clashResult.enemyDamage);
            }
            if (clashResult.playerDamage > 0) {
                playerHp = Math.max(0, playerHp - clashResult.playerDamage);
            }

            rounds.push({
                round,
                playerCard,
                enemyCard,
                clashResult,
                playerHpAfter: playerHp,
                enemyHpAfter: enemyHp,
            });
        }

        // 동시 사망(양쪽 HP 0 이하) 시 플레이어 승리
        const outcome: BattleOutcomeType = enemyHp <= 0 ? 'player-win' : 'player-lose';

        return {
            outcome,
            totalRounds: rounds.length,
            rounds,
            finalPlayerHp: playerHp,
            finalEnemyHp: enemyHp,
        };
    }

    /**
     * 현재 배틀 상태를 스냅샷으로 생성한다.
     * UI에서 단계별 진행 시 활용.
     */
    createBattleState(params: BattleLoopParams): BattleLoopState {
        return {
            phase: BATTLE_PHASE.IDLE,
            round: 0,
            playerHp: params.playerHp,
            playerMaxHp: params.playerMaxHp,
            enemyHp: params.enemyHp,
            enemyMaxHp: params.enemyMaxHp,
            playerHand: [],
            enemyCardPool: params.enemyCardPool,
            rounds: [],
        };
    }

    /**
     * 드로우 페이즈: 덱에서 손패를 뽑아 새 상태를 반환한다.
     */
    drawPhase(state: BattleLoopState, deck: readonly Card[]): BattleLoopState {
        const drawResult = this.cardBattleService.drawHand(deck);
        return {
            ...state,
            phase: BATTLE_PHASE.DRAW,
            round: state.round + 1,
            playerHand: drawResult.hand,
        };
    }

    /**
     * 해결 페이즈: 플레이어가 선택한 카드와 적 카드로 1라운드를 해결한다.
     * @returns 업데이트된 상태 (HP 반영, 라운드 기록 추가)
     */
    resolveRound(state: BattleLoopState, playerCard: Card): BattleLoopState {
        const enemyCard = this.cardBattleService.selectEnemyCard(state.enemyCardPool);
        const clashResult = resolveCardClash(playerCard, enemyCard);

        const newPlayerHp = clashResult.playerDamage > 0
            ? Math.max(0, state.playerHp - clashResult.playerDamage)
            : state.playerHp;
        const newEnemyHp = clashResult.enemyDamage > 0
            ? Math.max(0, state.enemyHp - clashResult.enemyDamage)
            : state.enemyHp;

        const roundResult: RoundResult = {
            round: state.round,
            playerCard,
            enemyCard,
            clashResult,
            playerHpAfter: newPlayerHp,
            enemyHpAfter: newEnemyHp,
        };

        const isBattleOver = newPlayerHp <= 0 || newEnemyHp <= 0;

        return {
            ...state,
            phase: isBattleOver ? BATTLE_PHASE.END : BATTLE_PHASE.RESOLVE,
            playerHp: newPlayerHp,
            enemyHp: newEnemyHp,
            playerHand: [],
            rounds: [...state.rounds, roundResult],
        };
    }

    /**
     * 배틀이 종료되었는지 확인한다.
     */
    isBattleOver(state: BattleLoopState): boolean {
        return state.playerHp <= 0 || state.enemyHp <= 0;
    }

    /**
     * 배틀 종료 시 최종 결과를 반환한다.
     * 동시 사망은 플레이어 승리.
     */
    getBattleResult(state: BattleLoopState): BattleOutcomeType {
        return state.enemyHp <= 0 ? 'player-win' : 'player-lose';
    }
}
