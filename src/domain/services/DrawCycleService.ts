// ---------------------------------------------------------------------------
// Draw Cycle Service — 덱/손패/버림패/제거 순환 도메인 로직 (TASK-030, TASK-034)
// ---------------------------------------------------------------------------

import { CARD_KEYWORD, type Card } from '../entities/Card';
import { COMBAT_RESOURCE_BALANCE } from './CombatBalance';
import { shuffleArray, type RandomSource } from '../../shared/utils/shuffle';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 매 턴 기본 드로우 수. */
export const DEFAULT_HAND_SIZE = COMBAT_RESOURCE_BALANCE.cardsPerTurn;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 드로우 사이클의 불변 상태 스냅샷. */
export interface DrawCycleState {
    /** 뽑을 카드 더미 (위→아래 순서). */
    readonly drawPile: readonly Card[];
    /** 현재 손패. */
    readonly hand: readonly Card[];
    /** 버린 카드 더미. */
    readonly discardPile: readonly Card[];
    /** 영구 제거된 카드 (Exhaust). */
    readonly exhaustPile: readonly Card[];
}

/** 각 영역의 카드 수 요약. */
export interface DrawCycleZoneCounts {
    readonly drawPile: number;
    readonly hand: number;
    readonly discardPile: number;
    readonly exhaustPile: number;
    readonly total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasKeyword(card: Card, keyword: string): boolean {
    return card.keywords.includes(keyword as Card['keywords'][number]);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 덱 → 손패 → 버림패/제거 순환을 관리한다.
 * 모든 메서드는 불변 상태를 입력받아 새 상태를 반환하는 순수 함수 스타일이다.
 * Phaser/Firebase 의존 없음.
 */
export class DrawCycleService {
    constructor(
        private readonly random: RandomSource = { next: () => Math.random() },
    ) {}

    /**
     * 전투 시작 시 드로우 사이클을 초기화한다.
     * 전체 카드를 셔플하여 뽑을 카드 더미에 배치한다.
     */
    initialize(cards: readonly Card[]): DrawCycleState {
        const drawPile = shuffleArray(cards, this.random);
        return {
            drawPile,
            hand: [],
            discardPile: [],
            exhaustPile: [],
        };
    }

    /**
     * 뽑을 카드 더미에서 지정 수만큼 손패로 드로우한다.
     * 뽑을 카드가 부족하면 버림패를 셔플하여 뽑을 카드 더미에 합친 뒤 나머지를 드로우한다.
     */
    drawCards(state: DrawCycleState, count: number = DEFAULT_HAND_SIZE): DrawCycleState {
        let drawPile = [...state.drawPile];
        let discardPile = [...state.discardPile];
        const drawnCards: Card[] = [...state.hand];

        let remaining = count;

        // 1차: 현재 뽑을 카드에서 드로우
        const firstDraw = Math.min(remaining, drawPile.length);
        for (let i = 0; i < firstDraw; i++) {
            const card = drawPile.shift();
            if (card) {
                drawnCards.push(card);
                remaining--;
            }
        }

        // 뽑을 카드가 부족하고, 버림패가 있으면 셔플 후 추가 드로우
        if (remaining > 0 && discardPile.length > 0) {
            drawPile = shuffleArray(discardPile, this.random);
            discardPile = [];

            const secondDraw = Math.min(remaining, drawPile.length);
            for (let i = 0; i < secondDraw; i++) {
                const card = drawPile.shift();
                if (card) {
                    drawnCards.push(card);
                }
            }
        }

        return {
            ...state,
            drawPile,
            hand: drawnCards,
            discardPile,
        };
    }

    /**
     * 손패에서 카드를 사용한다.
     * - Exhaust 키워드가 있는 카드는 제거 영역(exhaustPile)으로 이동한다.
     * - 그 외 카드는 버림패로 이동한다.
     *
     * @returns 새 상태. 해당 카드가 손패에 없으면 상태를 변경하지 않는다.
     */
    playCard(state: DrawCycleState, cardId: string): DrawCycleState {
        const cardIndex = state.hand.findIndex((c) => c.id === cardId);
        if (cardIndex === -1) {
            return state;
        }

        const card = state.hand[cardIndex];
        const newHand = [...state.hand.slice(0, cardIndex), ...state.hand.slice(cardIndex + 1)];

        if (hasKeyword(card, CARD_KEYWORD.EXHAUST)) {
            return {
                ...state,
                hand: newHand,
                exhaustPile: [...state.exhaustPile, card],
            };
        }

        return {
            ...state,
            hand: newHand,
            discardPile: [...state.discardPile, card],
        };
    }

    /**
     * 손패에서 지정 수만큼 카드를 버린다.
     * 현재 UI에는 선택 플로우가 없으므로 손패 앞쪽부터 순서대로 처리한다.
     */
    discardCards(state: DrawCycleState, count: number): DrawCycleState {
        const discardCount = Math.max(0, Math.floor(count));
        if (discardCount === 0 || state.hand.length === 0) {
            return state;
        }

        const discardedCards = state.hand.slice(0, discardCount);
        if (discardedCards.length === 0) {
            return state;
        }

        return {
            ...state,
            hand: state.hand.slice(discardedCards.length),
            discardPile: [...state.discardPile, ...discardedCards],
        };
    }

    /**
     * 턴 종료 시 손패를 정리한다.
     * - Retain 키워드가 있는 카드는 손패에 유지한다.
     * - 그 외 카드는 버림패로 이동한다.
     */
    endTurn(state: DrawCycleState): DrawCycleState {
        if (state.hand.length === 0) {
            return state;
        }

        const retainedCards: Card[] = [];
        const discardedCards: Card[] = [];

        for (const card of state.hand) {
            if (hasKeyword(card, CARD_KEYWORD.RETAIN)) {
                retainedCards.push(card);
            } else {
                discardedCards.push(card);
            }
        }

        return {
            ...state,
            hand: retainedCards,
            discardPile: [...state.discardPile, ...discardedCards],
        };
    }

    /**
     * 각 영역의 카드 수를 조회한다.
     */
    getZoneCounts(state: DrawCycleState): DrawCycleZoneCounts {
        return {
            drawPile: state.drawPile.length,
            hand: state.hand.length,
            discardPile: state.discardPile.length,
            exhaustPile: state.exhaustPile.length,
            total: state.drawPile.length + state.hand.length + state.discardPile.length + state.exhaustPile.length,
        };
    }
}
