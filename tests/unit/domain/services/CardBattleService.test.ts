import { beforeEach, describe, expect, it } from 'vitest';
import {
    CardBattleService,
    ENEMY_CARD_POOL_TEMPLATES,
    HAND_SIZE,
    type BattleRandomSource,
} from '../../../../src/domain/services/CardBattleService';
import { CARD_TYPE, createCard, resetCardSequence, type Card } from '../../../../src/domain/entities/Card';

// ---------------------------------------------------------------------------
// Deterministic random for testing
// ---------------------------------------------------------------------------

class SequentialRandom implements BattleRandomSource {
    private index = 0;

    constructor(private readonly values: number[]) {}

    next(): number {
        const value = this.values[this.index % this.values.length];
        this.index++;
        return value;
    }
}

class FixedRandom implements BattleRandomSource {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

describe('CardBattleService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    function buildDeck(count: number): Card[] {
        return Array.from({ length: count }, (_, i) =>
            createCard({ name: `Card-${i}`, type: i % 2 === 0 ? CARD_TYPE.ATTACK : CARD_TYPE.GUARD, power: i + 1 }),
        );
    }

    // -----------------------------------------------------------------------
    // drawHand
    // -----------------------------------------------------------------------

    describe('drawHand', () => {
        it('draws exactly 3 cards from a deck of 5+', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));
            const deck = buildDeck(5);

            // Act
            const result = service.drawHand(deck);

            // Assert
            expect(result.hand).toHaveLength(HAND_SIZE);
            expect(result.deckSize).toBe(5);
        });

        it('draws cards without duplicates', () => {
            // Arrange
            const service = new CardBattleService(new SequentialRandom([0.1, 0.2, 0.3, 0.4, 0.5]));
            const deck = buildDeck(10);

            // Act
            const result = service.drawHand(deck);
            const ids = result.hand.map((c) => c.id);

            // Assert
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('returns all cards when deck has fewer than HAND_SIZE', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));
            const deck = buildDeck(2);

            // Act
            const result = service.drawHand(deck);

            // Assert
            expect(result.hand).toHaveLength(2);
        });

        it('returns 1 card when deck has exactly 1 card', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));
            const deck = buildDeck(1);

            // Act
            const result = service.drawHand(deck);

            // Assert
            expect(result.hand).toHaveLength(1);
        });

        it('returns empty hand when deck is empty', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));

            // Act
            const result = service.drawHand([]);

            // Assert
            expect(result.hand).toHaveLength(0);
        });

        it('does not mutate the original deck', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));
            const deck = buildDeck(5);
            const originalLength = deck.length;

            // Act
            service.drawHand(deck);

            // Assert
            expect(deck).toHaveLength(originalLength);
        });

        it('drawn cards are actual references from the deck', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.5));
            const deck = buildDeck(5);

            // Act
            const result = service.drawHand(deck);

            // Assert — every drawn card must exist in the original deck
            for (const card of result.hand) {
                expect(deck.some((d) => d.id === card.id)).toBe(true);
            }
        });

        it('produces different hands with different random values', () => {
            // Arrange
            const deck = buildDeck(10);
            const service1 = new CardBattleService(new FixedRandom(0.1));
            const service2 = new CardBattleService(new FixedRandom(0.9));

            // Act
            const hand1 = service1.drawHand(deck).hand.map((c) => c.id);
            const hand2 = service2.drawHand(deck).hand.map((c) => c.id);

            // Assert — with different seeds, at least the selection should differ
            // (Not guaranteed to differ with all seeds, but 0.1 vs 0.9 on 10 cards should)
            const isSameHand = hand1.every((id, i) => id === hand2[i]);
            expect(isSameHand).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // selectEnemyCard
    // -----------------------------------------------------------------------

    describe('selectEnemyCard', () => {
        it('selects a card from the pool', () => {
            // Arrange
            const service = new CardBattleService(new FixedRandom(0.0));
            const pool = buildDeck(3);

            // Act
            const card = service.selectEnemyCard(pool);

            // Assert
            expect(pool.some((c) => c.id === card.id)).toBe(true);
        });

        it('throws when pool is empty', () => {
            const service = new CardBattleService(new FixedRandom(0.5));
            expect(() => service.selectEnemyCard([])).toThrow('Enemy card pool is empty');
        });

        it('selects different cards based on random value', () => {
            const pool = buildDeck(5);
            const service1 = new CardBattleService(new FixedRandom(0.0));  // index 0
            const service2 = new CardBattleService(new FixedRandom(0.99)); // index 4

            const card1 = service1.selectEnemyCard(pool);
            const card2 = service2.selectEnemyCard(pool);

            expect(card1.id).not.toBe(card2.id);
        });
    });

    // -----------------------------------------------------------------------
    // generateEnemyCardPool
    // -----------------------------------------------------------------------

    describe('generateEnemyCardPool', () => {
        it('generates normal enemy pool (2 attack, 1 guard)', () => {
            // Arrange
            const service = new CardBattleService();
            const template = ENEMY_CARD_POOL_TEMPLATES['normal'];

            // Act
            const pool = service.generateEnemyCardPool('normal', false);

            // Assert
            const attacks = pool.filter((c) => c.type === CARD_TYPE.ATTACK);
            const guards = pool.filter((c) => c.type === CARD_TYPE.GUARD);
            expect(attacks).toHaveLength(template.attackCount);
            expect(guards).toHaveLength(template.guardCount);
            expect(attacks[0].power).toBe(template.attackPower);
            expect(guards[0].power).toBe(template.guardPower);
        });

        it('generates elite enemy pool (3 attack, 2 guard)', () => {
            const service = new CardBattleService();
            const template = ENEMY_CARD_POOL_TEMPLATES['elite'];

            const pool = service.generateEnemyCardPool('normal', true); // elite flag

            const attacks = pool.filter((c) => c.type === CARD_TYPE.ATTACK);
            const guards = pool.filter((c) => c.type === CARD_TYPE.GUARD);
            expect(attacks).toHaveLength(template.attackCount);
            expect(guards).toHaveLength(template.guardCount);
        });

        it('generates boss enemy pool (4 attack, 3 guard)', () => {
            const service = new CardBattleService();
            const template = ENEMY_CARD_POOL_TEMPLATES['boss'];

            const pool = service.generateEnemyCardPool('boss', false);

            const attacks = pool.filter((c) => c.type === CARD_TYPE.ATTACK);
            const guards = pool.filter((c) => c.type === CARD_TYPE.GUARD);
            expect(attacks).toHaveLength(template.attackCount);
            expect(guards).toHaveLength(template.guardCount);
            expect(attacks[0].power).toBe(template.attackPower);
            expect(guards[0].power).toBe(template.guardPower);
        });

        it('all generated cards have unique ids', () => {
            const service = new CardBattleService();
            const pool = service.generateEnemyCardPool('boss', false);
            const ids = pool.map((c) => c.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });
});
