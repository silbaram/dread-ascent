import { beforeEach, describe, expect, it } from 'vitest';
import {
    DrawCycleService,
    DEFAULT_HAND_SIZE,
    HAND_END_TURN_EFFECT_TYPE,
    type DrawCycleState,
} from '../../../../src/domain/services/DrawCycleService';
import {
    CARD_DISCARD_STRATEGY,
    CARD_KEYWORD,
    CARD_TYPE,
    CARD_EFFECT_TYPE,
    createCard,
    resetCardSequence,
    type Card,
} from '../../../../src/domain/entities/Card';
import type { RandomSource } from '../../../../src/shared/utils/shuffle';

// ---------------------------------------------------------------------------
// Deterministic random for testing
// ---------------------------------------------------------------------------

class FixedRandom implements RandomSource {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

class SequentialRandom implements RandomSource {
    private index = 0;

    constructor(private readonly values: number[]) {}

    next(): number {
        const value = this.values[this.index % this.values.length];
        this.index++;
        return value;
    }
}

/** 셔플하지 않는 (순서 유지) 랜덤. Fisher-Yates가 i를 선택하면 swap이 no-op. */
class IdentityRandom implements RandomSource {
    next(): number {
        return 0.99;
    }
}

describe('DrawCycleService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    function buildCards(count: number): Card[] {
        return Array.from({ length: count }, (_, i) =>
            createCard({
                name: `Card-${i}`,
                type: i % 2 === 0 ? CARD_TYPE.ATTACK : CARD_TYPE.GUARD,
                power: i + 1,
            }),
        );
    }

    function finishTurn(service: DrawCycleService, state: DrawCycleState): DrawCycleState {
        return service.endTurn(state).state;
    }

    // -----------------------------------------------------------------------
    // initialize
    // -----------------------------------------------------------------------

    describe('initialize', () => {
        it('places all cards in the draw pile and empties hand/discard', () => {
            const service = new DrawCycleService(new FixedRandom(0.5));
            const cards = buildCards(10);

            const state = service.initialize(cards);

            expect(state.drawPile).toHaveLength(10);
            expect(state.hand).toHaveLength(0);
            expect(state.discardPile).toHaveLength(0);
        });

        it('shuffles the draw pile (not same order as input)', () => {
            // With SequentialRandom, Fisher-Yates should reorder cards
            const service = new DrawCycleService(new SequentialRandom([0.1, 0.3, 0.5, 0.7, 0.9]));
            const cards = buildCards(10);
            const originalIds = cards.map((c) => c.id);

            const state = service.initialize(cards);
            const drawIds = state.drawPile.map((c) => c.id);

            // At least one card should be in different position (shuffle applied)
            const isSameOrder = originalIds.every((id, i) => id === drawIds[i]);
            expect(isSameOrder).toBe(false);
        });

        it('preserves total card count after initialization', () => {
            const service = new DrawCycleService(new FixedRandom(0.5));
            const cards = buildCards(7);

            const state = service.initialize(cards);
            const counts = service.getZoneCounts(state);

            expect(counts.total).toBe(7);
        });
    });

    // -----------------------------------------------------------------------
    // drawCards
    // -----------------------------------------------------------------------

    describe('drawCards', () => {
        it('draws 5 cards (DEFAULT_HAND_SIZE) from draw pile to hand', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            const state = service.initialize(cards);

            const result = service.drawCards(state);

            expect(result.hand).toHaveLength(DEFAULT_HAND_SIZE);
            expect(result.drawPile).toHaveLength(5);
            expect(result.discardPile).toHaveLength(0);
        });

        it('draws specified number of cards', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            const state = service.initialize(cards);

            const result = service.drawCards(state, 3);

            expect(result.hand).toHaveLength(3);
            expect(result.drawPile).toHaveLength(7);
        });

        it('draws all remaining when draw pile has fewer cards than requested (no discard)', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(3);
            const state = service.initialize(cards);

            const result = service.drawCards(state, 5);

            expect(result.hand).toHaveLength(3);
            expect(result.drawPile).toHaveLength(0);
        });

        it('reshuffles discard pile when draw pile is insufficient', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);

            // 시작: 10장 → 뽑기 5장 → 턴종료(5장 버림) → 뽑기 5장 → 턴종료(5장 버림)
            // 이제 drawPile=0, discardPile=10 상태
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);
            state = finishTurn(service, state);
            state = service.drawCards(state, 5);
            state = finishTurn(service, state);

            expect(state.drawPile).toHaveLength(0);
            expect(state.discardPile).toHaveLength(10);

            // 셔플하여 다시 5장 드로우
            const result = service.drawCards(state, 5);

            expect(result.hand).toHaveLength(5);
            expect(result.drawPile).toHaveLength(5);
            expect(result.discardPile).toHaveLength(0);
        });

        it('reshuffles discard and draws partial when total cards fewer than requested', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(4);

            // 4장 → 뽑기 4장 → 턴종료(4장 버림) → drawPile=0, discard=4
            let state = service.initialize(cards);
            state = service.drawCards(state, 4);
            state = finishTurn(service, state);

            // 5장 요청, 하지만 총 4장밖에 없으므로 4장만 드로우
            const result = service.drawCards(state, 5);

            expect(result.hand).toHaveLength(4);
            expect(result.drawPile).toHaveLength(0);
            expect(result.discardPile).toHaveLength(0);
        });

        it('draws across draw pile and reshuffled discard when draw pile partially insufficient', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(8);

            // 8장 시작, 5장 드로우 → drawPile=3, hand=5
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);
            // 턴 종료 → drawPile=3, discard=5
            state = finishTurn(service, state);

            // 5장 드로우 요청: drawPile에서 3장 + discard 셔플 후 2장
            const result = service.drawCards(state, 5);

            expect(result.hand).toHaveLength(5);
            expect(result.drawPile).toHaveLength(3);
            expect(result.discardPile).toHaveLength(0);
        });

        it('preserves total card count across draw cycle', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);

            let state = service.initialize(cards);
            expect(service.getZoneCounts(state).total).toBe(10);

            state = service.drawCards(state);
            expect(service.getZoneCounts(state).total).toBe(10);

            state = finishTurn(service, state);
            expect(service.getZoneCounts(state).total).toBe(10);

            state = service.drawCards(state);
            expect(service.getZoneCounts(state).total).toBe(10);
        });

        it('does not mutate the input state', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            const state = service.initialize(cards);
            const originalDrawPileLength = state.drawPile.length;

            service.drawCards(state, 5);

            expect(state.drawPile).toHaveLength(originalDrawPileLength);
            expect(state.hand).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // playCard
    // -----------------------------------------------------------------------

    describe('playCard', () => {
        it('moves played card from hand to discard pile', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            const cardToPlay = state.hand[0];
            const result = service.playCard(state, cardToPlay.id);

            expect(result.hand).toHaveLength(4);
            expect(result.hand.find((c) => c.id === cardToPlay.id)).toBeUndefined();
            expect(result.discardPile).toHaveLength(1);
            expect(result.discardPile[0].id).toBe(cardToPlay.id);
        });

        it('does not change state when card is not in hand', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            const result = service.playCard(state, 'nonexistent-id');

            expect(result).toBe(state); // Same reference — no change
        });

        it('allows playing multiple cards in sequence', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            const card1 = state.hand[0];
            const card2 = state.hand[1];

            state = service.playCard(state, card1.id);
            state = service.playCard(state, card2.id);

            expect(state.hand).toHaveLength(3);
            expect(state.discardPile).toHaveLength(2);
            expect(state.discardPile[0].id).toBe(card1.id);
            expect(state.discardPile[1].id).toBe(card2.id);
        });

        it('preserves draw pile when playing cards', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            const drawPileBefore = state.drawPile.length;
            state = service.playCard(state, state.hand[0].id);

            expect(state.drawPile).toHaveLength(drawPileBefore);
        });
    });

    // -----------------------------------------------------------------------
    // discardCards
    // -----------------------------------------------------------------------

    describe('discardCards', () => {
        it('moves the requested number of cards from the front of the hand to discard', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(8);
            let state = service.initialize(cards);
            state = service.drawCards(state, 4);

            const discardedIds = state.hand.slice(0, 2).map((card) => card.id);
            const keptIds = state.hand.slice(2).map((card) => card.id);

            const result = service.discardCards(state, 2);

            expect(result.hand.map((card) => card.id)).toEqual(keptIds);
            expect(result.discardPile.map((card) => card.id)).toEqual(discardedIds);
        });

        it('discards the whole hand when the requested count is larger than the hand size', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(6);
            let state = service.initialize(cards);
            state = service.drawCards(state, 3);

            const result = service.discardCards(state, 9);

            expect(result.hand).toHaveLength(0);
            expect(result.discardPile).toHaveLength(3);
        });

        it('can discard the highest-cost card while preserving the rest of the hand order', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cheap = createCard({
                id: 'cheap',
                name: 'Cheap',
                type: CARD_TYPE.ATTACK,
                power: 3,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const expensive = createCard({
                id: 'expensive',
                name: 'Expensive',
                type: CARD_TYPE.ATTACK,
                power: 9,
                cost: 2,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const middle = createCard({
                id: 'middle',
                name: 'Middle',
                type: CARD_TYPE.GUARD,
                power: 5,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
            const state: DrawCycleState = {
                drawPile: [],
                hand: [cheap, expensive, middle],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.discardCards(state, 1, CARD_DISCARD_STRATEGY.HIGHEST_COST);

            expect(result.hand.map((card) => card.id)).toEqual(['cheap', 'middle']);
            expect(result.discardPile.map((card) => card.id)).toEqual(['expensive']);
        });

        it('can discard selected cards by id while preserving the rest of the hand order', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cheap = createCard({
                id: 'cheap',
                name: 'Cheap',
                type: CARD_TYPE.ATTACK,
                power: 3,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const expensive = createCard({
                id: 'expensive',
                name: 'Expensive',
                type: CARD_TYPE.ATTACK,
                power: 9,
                cost: 2,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const middle = createCard({
                id: 'middle',
                name: 'Middle',
                type: CARD_TYPE.GUARD,
                power: 5,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
            const state: DrawCycleState = {
                drawPile: [],
                hand: [cheap, expensive, middle],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.discardCards(
                state,
                1,
                CARD_DISCARD_STRATEGY.SELECTED,
                ['middle'],
            );

            expect(result.hand.map((card) => card.id)).toEqual(['cheap', 'expensive']);
            expect(result.discardPile.map((card) => card.id)).toEqual(['middle']);
        });

        it('falls back to highest-cost discard when a selected discard has no valid choice', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cheap = createCard({
                id: 'cheap',
                name: 'Cheap',
                type: CARD_TYPE.ATTACK,
                power: 3,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const expensive = createCard({
                id: 'expensive',
                name: 'Expensive',
                type: CARD_TYPE.ATTACK,
                power: 9,
                cost: 2,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
            const middle = createCard({
                id: 'middle',
                name: 'Middle',
                type: CARD_TYPE.GUARD,
                power: 5,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
            const state: DrawCycleState = {
                drawPile: [],
                hand: [cheap, expensive, middle],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.discardCards(
                state,
                1,
                CARD_DISCARD_STRATEGY.SELECTED,
                ['missing-card'],
            );

            expect(result.hand.map((card) => card.id)).toEqual(['cheap', 'middle']);
            expect(result.discardPile.map((card) => card.id)).toEqual(['expensive']);
        });
    });

    // -----------------------------------------------------------------------
    // endTurn
    // -----------------------------------------------------------------------

    describe('endTurn', () => {
        it('moves all remaining hand cards to discard pile', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            const handBefore = [...state.hand];
            const result = service.endTurn(state);

            expect(result.state.hand).toHaveLength(0);
            expect(result.state.discardPile).toHaveLength(5);
            expect(result.effects).toEqual([]);
            // 버림패에 손패의 모든 카드가 있어야 함
            for (const card of handBefore) {
                expect(result.state.discardPile.some((c) => c.id === card.id)).toBe(true);
            }
        });

        it('returns same state when hand is already empty', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            const state = service.initialize(cards);

            const result = service.endTurn(state);

            expect(result.state).toBe(state);
            expect(result.effects).toEqual([]);
        });

        it('appends to existing discard pile', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);

            // 카드 1장 사용 → 버림패 1장
            state = service.playCard(state, state.hand[0].id);
            expect(state.discardPile).toHaveLength(1);

            // 턴 종료 → 나머지 4장도 버림패로
            state = finishTurn(service, state);
            expect(state.discardPile).toHaveLength(5);
            expect(state.hand).toHaveLength(0);
        });

        it('moves ETHEREAL cards to exhaust pile before retain resolution', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const retainCard = createCard({
                name: 'Brace',
                type: CARD_TYPE.GUARD,
                power: 4,
                keywords: [CARD_KEYWORD.RETAIN],
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
            const etherealCard = createCard({
                name: 'Dread',
                type: CARD_TYPE.CURSE,
                power: 0,
                keywords: [CARD_KEYWORD.ETHEREAL, CARD_KEYWORD.UNPLAYABLE],
                effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
            });

            const state: DrawCycleState = {
                drawPile: [],
                hand: [etherealCard, retainCard],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.endTurn(state);

            expect(result.state.hand.map((card) => card.id)).toEqual([retainCard.id]);
            expect(result.state.exhaustPile.map((card) => card.id)).toEqual([etherealCard.id]);
            expect(result.effects).toContainEqual({
                type: HAND_END_TURN_EFFECT_TYPE.ETHEREAL_EXHAUSTED,
                cardId: etherealCard.id,
                cardName: etherealCard.name,
            });
        });

        it('exhausts a card when ETHEREAL and RETAIN are both present', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const dualKeywordCard = createCard({
                name: 'Fleeting Guard',
                type: CARD_TYPE.SKILL,
                power: 0,
                keywords: [CARD_KEYWORD.RETAIN, CARD_KEYWORD.ETHEREAL],
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });

            const state: DrawCycleState = {
                drawPile: [],
                hand: [dualKeywordCard],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.endTurn(state);

            expect(result.state.hand).toEqual([]);
            expect(result.state.discardPile).toEqual([]);
            expect(result.state.exhaustPile.map((card) => card.id)).toEqual([dualKeywordCard.id]);
            expect(result.effects).toContainEqual({
                type: HAND_END_TURN_EFFECT_TYPE.ETHEREAL_EXHAUSTED,
                cardId: dualKeywordCard.id,
                cardName: dualKeywordCard.name,
            });
        });

        it('reports held curse self-damage as an end-turn effect', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const curseCard = createCard({
                name: 'Hemorrhage',
                type: CARD_TYPE.CURSE,
                power: 0,
                keywords: [CARD_KEYWORD.UNPLAYABLE],
                effectType: CARD_EFFECT_TYPE.CONDITIONAL,
                selfDamage: 1,
            });

            const state: DrawCycleState = {
                drawPile: [],
                hand: [curseCard],
                discardPile: [],
                exhaustPile: [],
            };

            const result = service.endTurn(state);

            expect(result.effects).toContainEqual({
                type: HAND_END_TURN_EFFECT_TYPE.HELD_CURSE_SELF_DAMAGE,
                cardId: curseCard.id,
                cardName: curseCard.name,
                value: 1,
            });
            expect(result.state.discardPile.map((card) => card.id)).toEqual([curseCard.id]);
        });
    });

    // -----------------------------------------------------------------------
    // getZoneCounts
    // -----------------------------------------------------------------------

    describe('getZoneCounts', () => {
        it('returns correct counts for each zone', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(10);
            let state = service.initialize(cards);
            state = service.drawCards(state, 5);
            state = service.playCard(state, state.hand[0].id);

            const counts = service.getZoneCounts(state);

            expect(counts.drawPile).toBe(5);
            expect(counts.hand).toBe(4);
            expect(counts.discardPile).toBe(1);
            expect(counts.total).toBe(10);
        });
    });

    // -----------------------------------------------------------------------
    // Full Cycle Integration
    // -----------------------------------------------------------------------

    describe('full draw cycle', () => {
        it('completes a full cycle: draw → play → endTurn → reshuffle → draw', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(7);

            // 전투 시작: 7장 셔플 → drawPile
            let state = service.initialize(cards);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 7, hand: 0, discardPile: 0, exhaustPile: 0, total: 7,
            });

            // 턴 1: 5장 드로우
            state = service.drawCards(state, 5);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 5, discardPile: 0, exhaustPile: 0, total: 7,
            });

            // 카드 2장 사용
            state = service.playCard(state, state.hand[0].id);
            state = service.playCard(state, state.hand[0].id);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 3, discardPile: 2, exhaustPile: 0, total: 7,
            });

            // 턴 종료: 남은 3장 → 버림패
            state = finishTurn(service, state);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 0, discardPile: 5, exhaustPile: 0, total: 7,
            });

            // 턴 2: 5장 드로우 요청, drawPile에서 2장 + discard 셔플 후 3장
            state = service.drawCards(state, 5);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 5, discardPile: 0, exhaustPile: 0, total: 7,
            });

            // 턴 종료
            state = finishTurn(service, state);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 0, discardPile: 5, exhaustPile: 0, total: 7,
            });

            // 턴 3: 다시 5장 드로우 (drawPile 2 + discard 5 셔플 후 3)
            state = service.drawCards(state, 5);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 2, hand: 5, discardPile: 0, exhaustPile: 0, total: 7,
            });

            // 총 카드 수는 항상 7장
            expect(service.getZoneCounts(state).total).toBe(7);
        });

        it('handles deck with exactly 5 cards (no leftover in draw pile)', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const cards = buildCards(5);

            let state = service.initialize(cards);
            state = service.drawCards(state, 5);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 0, hand: 5, discardPile: 0, exhaustPile: 0, total: 5,
            });

            state = finishTurn(service, state);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 0, hand: 0, discardPile: 5, exhaustPile: 0, total: 5,
            });

            // 다음 드로우: discard 전체 셔플 후 5장 드로우
            state = service.drawCards(state, 5);
            expect(service.getZoneCounts(state)).toEqual({
                drawPile: 0, hand: 5, discardPile: 0, exhaustPile: 0, total: 5,
            });
        });

        it('all card IDs remain unique and consistent through cycles', () => {
            const service = new DrawCycleService(new SequentialRandom([0.1, 0.2, 0.3, 0.4, 0.5]));
            const cards = buildCards(8);
            const originalIds = new Set(cards.map((c) => c.id));

            let state = service.initialize(cards);

            // 3 full cycles
            for (let cycle = 0; cycle < 3; cycle++) {
                state = service.drawCards(state, 5);
                // 사용
                while (state.hand.length > 0) {
                    state = service.playCard(state, state.hand[0].id);
                }
                state = finishTurn(service, state);
            }

            // 모든 카드가 여전히 존재하는지 확인
            const allCards = [...state.drawPile, ...state.hand, ...state.discardPile];
            const currentIds = new Set(allCards.map((c) => c.id));
            expect(currentIds.size).toBe(originalIds.size);
            for (const id of originalIds) {
                expect(currentIds.has(id)).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Exhaust Keyword (TASK-034)
    // -----------------------------------------------------------------------

    describe('Exhaust keyword', () => {
        function buildExhaustCard(): Card {
            return createCard({
                name: 'Bloodrush',
                type: CARD_TYPE.ATTACK,
                power: 18,
                cost: 2,
                keywords: [CARD_KEYWORD.EXHAUST],
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
        }

        it('moves exhausted card to exhaust pile instead of discard', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const normalCards = buildCards(4);
            const exhaustCard = buildExhaustCard();
            const allCards = [...normalCards, exhaustCard];

            let state = service.initialize(allCards);
            state = service.drawCards(state, 5);

            // exhaust 카드를 찾아서 사용
            const exhaustInHand = state.hand.find((c) => c.keywords.includes(CARD_KEYWORD.EXHAUST));
            expect(exhaustInHand).toBeDefined();

            state = service.playCard(state, exhaustInHand!.id);

            expect(state.exhaustPile).toHaveLength(1);
            expect(state.exhaustPile[0].id).toBe(exhaustInHand!.id);
            expect(state.discardPile).toHaveLength(0);
            expect(state.hand).toHaveLength(4);
        });

        it('exhausted cards are not reshuffled back into draw pile', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const normalCards = buildCards(4);
            const exhaustCard = buildExhaustCard();
            const allCards = [...normalCards, exhaustCard];

            let state = service.initialize(allCards);
            state = service.drawCards(state, 5);

            // exhaust 카드 사용
            const exhaustInHand = state.hand.find((c) => c.keywords.includes(CARD_KEYWORD.EXHAUST));
            state = service.playCard(state, exhaustInHand!.id);
            state = finishTurn(service, state);

            // 다음 턴: 4장만 순환, exhaust 카드는 제외
            state = service.drawCards(state, 5);

            const counts = service.getZoneCounts(state);
            expect(counts.exhaustPile).toBe(1);
            // total = drawPile + hand + discard + exhaust = 5
            expect(counts.total).toBe(5);
            // 순환 가능 카드 = total - exhaust = 4
            expect(counts.drawPile + counts.hand + counts.discardPile).toBe(4);
        });
    });

    // -----------------------------------------------------------------------
    // Retain Keyword (TASK-034)
    // -----------------------------------------------------------------------

    describe('Retain keyword', () => {
        function buildRetainCard(): Card {
            return createCard({
                name: 'Last Stand',
                type: CARD_TYPE.ATTACK,
                power: 30,
                cost: 3,
                keywords: [CARD_KEYWORD.RETAIN],
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });
        }

        it('retains card in hand on turn end', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const normalCards = buildCards(4);
            const retainCard = buildRetainCard();
            const allCards = [...normalCards, retainCard];

            let state = service.initialize(allCards);
            state = service.drawCards(state, 5);

            // 일반 카드 2장 사용
            state = service.playCard(state, state.hand[0].id);
            state = service.playCard(state, state.hand[0].id);

            // 턴 종료: retain 카드는 유지, 나머지는 버림패
            state = finishTurn(service, state);

            const retainInHand = state.hand.find((c) => c.keywords.includes(CARD_KEYWORD.RETAIN));
            expect(retainInHand).toBeDefined();
            expect(state.hand).toHaveLength(1);
            expect(state.hand[0].id).toBe(retainCard.id);
        });

        it('non-retain cards are discarded normally on turn end', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const normalCards = buildCards(4);
            const retainCard = buildRetainCard();
            const allCards = [...normalCards, retainCard];

            let state = service.initialize(allCards);
            state = service.drawCards(state, 5);

            // 턴 종료: 4장 버림, 1장(retain) 유지
            state = finishTurn(service, state);

            expect(state.hand).toHaveLength(1);
            expect(state.discardPile).toHaveLength(4);
        });

        it('retained card persists across multiple turns', () => {
            const service = new DrawCycleService(new IdentityRandom());
            const normalCards = buildCards(6);
            const retainCard = buildRetainCard();
            const allCards = [...normalCards, retainCard];

            let state = service.initialize(allCards);

            // 턴 1: 5장 드로우 → 턴 종료 (retain 있으면 유지)
            state = service.drawCards(state, 5);
            state = finishTurn(service, state);

            // 턴 2: 기존 retain + 새 드로우
            state = service.drawCards(state, 5);
            const retainInHand = state.hand.filter((c) => c.keywords.includes(CARD_KEYWORD.RETAIN));

            // retain 카드가 손패에 있다면 턴 종료 후에도 유지
            if (retainInHand.length > 0) {
                state = finishTurn(service, state);
                expect(state.hand.some((c) => c.keywords.includes(CARD_KEYWORD.RETAIN))).toBe(true);
            }
        });
    });
});
