import { beforeEach, describe, expect, it } from 'vitest';
import {
    CARD_TYPE,
    DECK_MAX_SIZE,
    addCardToDeck,
    createCard,
    createDeck,
    getDeckSize,
    isDeckFull,
    removeCardFromDeck,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('Card', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // Card Creation
    // -----------------------------------------------------------------------

    it('creates an ATTACK card with correct properties', () => {
        // Act
        const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });

        // Assert
        expect(card).toEqual({
            id: 'card-1',
            name: 'Slash',
            type: 'ATTACK',
            power: 8,
        });
    });

    it('creates a GUARD card with correct properties', () => {
        // Act
        const card = createCard({ name: 'Shield Block', type: CARD_TYPE.GUARD, power: 5 });

        // Assert
        expect(card).toEqual({
            id: 'card-1',
            name: 'Shield Block',
            type: 'GUARD',
            power: 5,
        });
    });

    it('generates unique sequential ids', () => {
        // Act
        const card1 = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        const card2 = createCard({ name: 'B', type: CARD_TYPE.GUARD, power: 2 });

        // Assert
        expect(card1.id).toBe('card-1');
        expect(card2.id).toBe('card-2');
    });

    it('accepts a custom id when provided', () => {
        // Act
        const card = createCard({ id: 'custom-id', name: 'X', type: CARD_TYPE.ATTACK, power: 3 });

        // Assert
        expect(card.id).toBe('custom-id');
    });

    it('floors decimal power values', () => {
        // Act
        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 7.9 });

        // Assert
        expect(card.power).toBe(7);
    });

    it('clamps negative power to 0', () => {
        // Act
        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: -5 });

        // Assert
        expect(card.power).toBe(0);
    });
});

describe('Deck', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // Deck Creation
    // -----------------------------------------------------------------------

    it('creates an empty deck with default max size', () => {
        // Act
        const deck = createDeck();

        // Assert
        expect(deck.cards).toEqual([]);
        expect(deck.maxSize).toBe(DECK_MAX_SIZE);
    });

    it('creates an empty deck with custom max size', () => {
        // Act
        const deck = createDeck(10);

        // Assert
        expect(deck.maxSize).toBe(10);
    });

    // -----------------------------------------------------------------------
    // Add Card
    // -----------------------------------------------------------------------

    it('adds a card to the deck', () => {
        // Arrange
        const deck = createDeck();
        const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });

        // Act
        const result = addCardToDeck(deck, card);

        // Assert
        expect(result.added).toBe(true);
        expect(result.deck.cards).toHaveLength(1);
        expect(result.deck.cards[0]).toEqual(card);
    });

    it('rejects adding when deck is at max capacity', () => {
        // Arrange
        let deck = createDeck(2);
        const card1 = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        const card2 = createCard({ name: 'B', type: CARD_TYPE.GUARD, power: 2 });
        const card3 = createCard({ name: 'C', type: CARD_TYPE.ATTACK, power: 3 });
        deck = addCardToDeck(deck, card1).deck;
        deck = addCardToDeck(deck, card2).deck;

        // Act
        const result = addCardToDeck(deck, card3);

        // Assert
        expect(result.added).toBe(false);
        expect(result.deck.cards).toHaveLength(2);
    });

    it('does not mutate the original deck on add', () => {
        // Arrange
        const original = createDeck();
        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });

        // Act
        addCardToDeck(original, card);

        // Assert
        expect(original.cards).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Remove Card
    // -----------------------------------------------------------------------

    it('removes a card by id', () => {
        // Arrange
        const card1 = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        const card2 = createCard({ name: 'B', type: CARD_TYPE.GUARD, power: 2 });
        let deck = createDeck();
        deck = addCardToDeck(deck, card1).deck;
        deck = addCardToDeck(deck, card2).deck;

        // Act
        const result = removeCardFromDeck(deck, card1.id);

        // Assert
        expect(result.removed).toBe(true);
        expect(result.deck.cards).toHaveLength(1);
        expect(result.deck.cards[0]).toEqual(card2);
    });

    it('returns removed=false when card id not found', () => {
        // Arrange
        const deck = createDeck();

        // Act
        const result = removeCardFromDeck(deck, 'non-existent');

        // Assert
        expect(result.removed).toBe(false);
    });

    it('does not mutate the original deck on remove', () => {
        // Arrange
        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        let deck = createDeck();
        deck = addCardToDeck(deck, card).deck;
        const deckBeforeRemove = deck;

        // Act
        removeCardFromDeck(deck, card.id);

        // Assert
        expect(deckBeforeRemove.cards).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Utility Functions
    // -----------------------------------------------------------------------

    it('reports deck full state correctly', () => {
        // Arrange
        let deck = createDeck(1);
        expect(isDeckFull(deck)).toBe(false);

        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        deck = addCardToDeck(deck, card).deck;

        // Assert
        expect(isDeckFull(deck)).toBe(true);
    });

    it('returns correct deck size', () => {
        // Arrange
        let deck = createDeck();
        expect(getDeckSize(deck)).toBe(0);

        const card = createCard({ name: 'A', type: CARD_TYPE.ATTACK, power: 1 });
        deck = addCardToDeck(deck, card).deck;

        // Assert
        expect(getDeckSize(deck)).toBe(1);
    });

    it('enforces DECK_MAX_SIZE of 20 by default', () => {
        // Arrange
        let deck = createDeck();
        for (let i = 0; i < 20; i++) {
            const card = createCard({ name: `Card-${i}`, type: CARD_TYPE.ATTACK, power: i });
            deck = addCardToDeck(deck, card).deck;
        }
        expect(getDeckSize(deck)).toBe(20);

        // Act — try adding the 21st card
        const extraCard = createCard({ name: 'Overflow', type: CARD_TYPE.ATTACK, power: 99 });
        const result = addCardToDeck(deck, extraCard);

        // Assert
        expect(result.added).toBe(false);
        expect(getDeckSize(result.deck)).toBe(20);
    });
});
