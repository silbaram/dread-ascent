import { beforeEach, describe, expect, it } from 'vitest';
import {
    DeckService,
    DEFAULT_ATTACK_CARD_COUNT,
    DEFAULT_ATTACK_CARD_POWER,
    DEFAULT_GUARD_CARD_COUNT,
    DEFAULT_GUARD_CARD_POWER,
} from '../../../../src/domain/services/DeckService';
import {
    CARD_TYPE,
    DECK_MAX_SIZE,
    createCard,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('DeckService', () => {
    let service: DeckService;

    beforeEach(() => {
        resetCardSequence();
        service = new DeckService();
    });

    // -----------------------------------------------------------------------
    // Starter Deck Initialization
    // -----------------------------------------------------------------------

    describe('initializeStarterDeck', () => {
        it('creates the default deck with 5 cards', () => {
            // Act
            const snapshot = service.initializeStarterDeck();

            // Assert
            expect(snapshot.size).toBe(DEFAULT_ATTACK_CARD_COUNT + DEFAULT_GUARD_CARD_COUNT);
            expect(snapshot.maxSize).toBe(DECK_MAX_SIZE);
            expect(snapshot.isFull).toBe(false);
        });

        it('contains 3 attack cards with power 8', () => {
            // Act
            service.initializeStarterDeck();
            const cards = service.getCards();
            const attackCards = cards.filter((c) => c.type === CARD_TYPE.ATTACK);

            // Assert
            expect(attackCards).toHaveLength(DEFAULT_ATTACK_CARD_COUNT);
            for (const card of attackCards) {
                expect(card.power).toBe(DEFAULT_ATTACK_CARD_POWER);
            }
        });

        it('contains 2 guard cards with power 5', () => {
            // Act
            service.initializeStarterDeck();
            const cards = service.getCards();
            const guardCards = cards.filter((c) => c.type === CARD_TYPE.GUARD);

            // Assert
            expect(guardCards).toHaveLength(DEFAULT_GUARD_CARD_COUNT);
            for (const card of guardCards) {
                expect(card.power).toBe(DEFAULT_GUARD_CARD_POWER);
            }
        });

        it('resets existing deck when re-initialized', () => {
            // Arrange
            service.initializeStarterDeck();
            const extraCard = createCard({ name: 'X', type: CARD_TYPE.ATTACK, power: 99 });
            service.addCard(extraCard);
            expect(service.getCards()).toHaveLength(6);

            // Act
            const snapshot = service.initializeStarterDeck();

            // Assert
            expect(snapshot.size).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // Add Card
    // -----------------------------------------------------------------------

    describe('addCard', () => {
        it('adds a card to the deck', () => {
            // Arrange
            service.initializeStarterDeck();
            const card = createCard({ name: 'New Card', type: CARD_TYPE.ATTACK, power: 10 });

            // Act
            const added = service.addCard(card);

            // Assert
            expect(added).toBe(true);
            expect(service.getCards()).toHaveLength(6);
        });

        it('rejects when deck is full', () => {
            // Arrange
            const smallService = new DeckService(5);
            smallService.initializeStarterDeck();
            const card = createCard({ name: 'Overflow', type: CARD_TYPE.ATTACK, power: 1 });

            // Act
            const added = smallService.addCard(card);

            // Assert
            expect(added).toBe(false);
            expect(smallService.getCards()).toHaveLength(5);
        });
    });

    // -----------------------------------------------------------------------
    // Remove Card
    // -----------------------------------------------------------------------

    describe('removeCard', () => {
        it('removes a card by id', () => {
            // Arrange
            service.initializeStarterDeck();
            const cards = service.getCards();
            const targetId = cards[0].id;

            // Act
            const removed = service.removeCard(targetId);

            // Assert
            expect(removed).toBe(true);
            expect(service.getCards()).toHaveLength(4);
            expect(service.findCard(targetId)).toBeUndefined();
        });

        it('returns false when card not found', () => {
            // Arrange
            service.initializeStarterDeck();

            // Act
            const removed = service.removeCard('non-existent-id');

            // Assert
            expect(removed).toBe(false);
            expect(service.getCards()).toHaveLength(5);
        });
    });

    // -----------------------------------------------------------------------
    // Query
    // -----------------------------------------------------------------------

    describe('findCard', () => {
        it('finds a card by id', () => {
            // Arrange
            service.initializeStarterDeck();
            const firstCard = service.getCards()[0];

            // Act
            const found = service.findCard(firstCard.id);

            // Assert
            expect(found).toEqual(firstCard);
        });
    });

    describe('isFull', () => {
        it('returns false when deck has room', () => {
            service.initializeStarterDeck();
            expect(service.isFull()).toBe(false);
        });

        it('returns true when deck is at capacity', () => {
            const smallService = new DeckService(5);
            smallService.initializeStarterDeck();
            expect(smallService.isFull()).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Reset & Restore
    // -----------------------------------------------------------------------

    describe('resetDeck', () => {
        it('clears all cards from the deck', () => {
            // Arrange
            service.initializeStarterDeck();

            // Act
            service.resetDeck();

            // Assert
            expect(service.getCards()).toHaveLength(0);
            expect(service.getSnapshot().size).toBe(0);
        });
    });

    describe('restoreDeck', () => {
        it('restores deck from saved card array', () => {
            // Arrange
            service.initializeStarterDeck();
            const savedCards = [...service.getCards()];
            service.resetDeck();

            // Act
            service.restoreDeck(savedCards);

            // Assert
            expect(service.getCards()).toHaveLength(savedCards.length);
            expect(service.getCards()).toEqual(savedCards);
        });
    });

    // -----------------------------------------------------------------------
    // Max size enforcement (20 cards)
    // -----------------------------------------------------------------------

    describe('max size enforcement', () => {
        it('enforces default max size of 20 cards', () => {
            // Arrange
            service.initializeStarterDeck(); // 5 cards

            // Add 15 more to reach 20
            for (let i = 0; i < 15; i++) {
                const card = createCard({ name: `Extra-${i}`, type: CARD_TYPE.ATTACK, power: i });
                service.addCard(card);
            }
            expect(service.getCards()).toHaveLength(20);
            expect(service.isFull()).toBe(true);

            // Act — try adding the 21st
            const overflow = createCard({ name: 'Overflow', type: CARD_TYPE.ATTACK, power: 99 });
            const added = service.addCard(overflow);

            // Assert
            expect(added).toBe(false);
            expect(service.getCards()).toHaveLength(20);
        });
    });
});
