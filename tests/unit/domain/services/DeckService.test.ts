import { beforeEach, describe, expect, it } from 'vitest';
import { DeckService } from '../../../../src/domain/services/DeckService';
import {
    CARD_TYPE,
    DECK_MAX_SIZE,
    createCard,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';
import { STARTER_DECK_COMPOSITION } from '../../../../src/domain/entities/CardCatalog';

// ---------------------------------------------------------------------------
// Cycle 3 시작 덱 상수
// ---------------------------------------------------------------------------

const STARTER_DECK_SIZE = STARTER_DECK_COMPOSITION.reduce((sum, e) => sum + e.count, 0); // 7

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
        it('creates the starter deck with 7 cards (Strike x4 + Fortify x3)', () => {
            const snapshot = service.initializeStarterDeck();

            expect(snapshot.size).toBe(STARTER_DECK_SIZE);
            expect(snapshot.maxSize).toBe(DECK_MAX_SIZE);
            expect(snapshot.isFull).toBe(false);
        });

        it('contains 4 Strike cards with power 6 and cost 1', () => {
            service.initializeStarterDeck();
            const cards = service.getCards();
            const strikes = cards.filter((c) => c.name === 'Strike');

            expect(strikes).toHaveLength(4);
            for (const card of strikes) {
                expect(card.power).toBe(6);
                expect(card.cost).toBe(1);
                expect(card.type).toBe(CARD_TYPE.ATTACK);
            }
        });

        it('contains 3 Fortify cards with power 5 and cost 1', () => {
            service.initializeStarterDeck();
            const cards = service.getCards();
            const fortifies = cards.filter((c) => c.name === 'Fortify');

            expect(fortifies).toHaveLength(3);
            for (const card of fortifies) {
                expect(card.power).toBe(5);
                expect(card.cost).toBe(1);
                expect(card.type).toBe(CARD_TYPE.GUARD);
            }
        });

        it('resets existing deck when re-initialized', () => {
            service.initializeStarterDeck();
            const extraCard = createCard({ name: 'X', type: CARD_TYPE.ATTACK, power: 99 });
            service.addCard(extraCard);
            expect(service.getCards()).toHaveLength(STARTER_DECK_SIZE + 1);

            const snapshot = service.initializeStarterDeck();

            expect(snapshot.size).toBe(STARTER_DECK_SIZE);
        });
    });

    // -----------------------------------------------------------------------
    // Add Card
    // -----------------------------------------------------------------------

    describe('addCard', () => {
        it('adds a card to the deck', () => {
            service.initializeStarterDeck();
            const card = createCard({ name: 'New Card', type: CARD_TYPE.ATTACK, power: 10 });

            const added = service.addCard(card);

            expect(added).toBe(true);
            expect(service.getCards()).toHaveLength(STARTER_DECK_SIZE + 1);
        });

        it('rejects when deck is full', () => {
            const smallService = new DeckService(STARTER_DECK_SIZE);
            smallService.initializeStarterDeck();
            const card = createCard({ name: 'Overflow', type: CARD_TYPE.ATTACK, power: 1 });

            const added = smallService.addCard(card);

            expect(added).toBe(false);
            expect(smallService.getCards()).toHaveLength(STARTER_DECK_SIZE);
        });
    });

    // -----------------------------------------------------------------------
    // Remove Card
    // -----------------------------------------------------------------------

    describe('removeCard', () => {
        it('removes a card by id', () => {
            service.initializeStarterDeck();
            const cards = service.getCards();
            const targetId = cards[0].id;

            const removed = service.removeCard(targetId);

            expect(removed).toBe(true);
            expect(service.getCards()).toHaveLength(STARTER_DECK_SIZE - 1);
            expect(service.findCard(targetId)).toBeUndefined();
        });

        it('returns false when card not found', () => {
            service.initializeStarterDeck();

            const removed = service.removeCard('non-existent-id');

            expect(removed).toBe(false);
            expect(service.getCards()).toHaveLength(STARTER_DECK_SIZE);
        });
    });

    // -----------------------------------------------------------------------
    // Query
    // -----------------------------------------------------------------------

    describe('findCard', () => {
        it('finds a card by id', () => {
            service.initializeStarterDeck();
            const firstCard = service.getCards()[0];

            const found = service.findCard(firstCard.id);

            expect(found).toEqual(firstCard);
        });
    });

    describe('isFull', () => {
        it('returns false when deck has room', () => {
            service.initializeStarterDeck();
            expect(service.isFull()).toBe(false);
        });

        it('returns true when deck is at capacity', () => {
            const smallService = new DeckService(STARTER_DECK_SIZE);
            smallService.initializeStarterDeck();
            expect(smallService.isFull()).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Reset & Restore
    // -----------------------------------------------------------------------

    describe('resetDeck', () => {
        it('clears all cards from the deck', () => {
            service.initializeStarterDeck();

            service.resetDeck();

            expect(service.getCards()).toHaveLength(0);
            expect(service.getSnapshot().size).toBe(0);
        });
    });

    describe('restoreDeck', () => {
        it('restores deck from saved card array', () => {
            service.initializeStarterDeck();
            const savedCards = [...service.getCards()];
            service.resetDeck();

            service.restoreDeck(savedCards);

            expect(service.getCards()).toHaveLength(savedCards.length);
            expect(service.getCards()).toEqual(savedCards);
        });
    });

    // -----------------------------------------------------------------------
    // Max size enforcement (20 cards)
    // -----------------------------------------------------------------------

    describe('max size enforcement', () => {
        it('enforces default max size of 20 cards', () => {
            service.initializeStarterDeck(); // 7 cards

            // Add 13 more to reach 20
            for (let i = 0; i < 20 - STARTER_DECK_SIZE; i++) {
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
