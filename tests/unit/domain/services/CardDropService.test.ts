import { beforeEach, describe, expect, it } from 'vitest';
import {
    CardDropService,
    NORMAL_DROP_RATE,
    ELITE_DROP_RATE,
    BOSS_DROP_RATE,
    BASE_DROP_CARD_POWER,
    POWER_SCALING_PER_FLOOR,
    type DropRandomSource,
} from '../../../../src/domain/services/CardDropService';
import { DeckService } from '../../../../src/domain/services/DeckService';
import {
    CARD_TYPE,
    DECK_MAX_SIZE,
    createCard,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 고정 난수 시퀀스를 반환하는 DropRandomSource */
function createFixedRandom(values: readonly number[]): DropRandomSource {
    let index = 0;
    return {
        next(): number {
            const value = values[index % values.length];
            index++;
            return value;
        },
    };
}

/** 항상 같은 값을 반환하는 DropRandomSource */
function createConstantRandom(value: number): DropRandomSource {
    return { next: () => value };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CardDropService', () => {
    let deckService: DeckService;

    beforeEach(() => {
        resetCardSequence();
        deckService = new DeckService();
        deckService.initializeStarterDeck();
    });

    // -----------------------------------------------------------------------
    // Drop Rate
    // -----------------------------------------------------------------------

    describe('getDropRate', () => {
        const service = new CardDropService();

        it('returns 30% for normal enemies', () => {
            expect(service.getDropRate('normal', false)).toBe(NORMAL_DROP_RATE);
        });

        it('returns 60% for elite enemies', () => {
            expect(service.getDropRate('normal', true)).toBe(ELITE_DROP_RATE);
        });

        it('returns 100% for boss enemies', () => {
            expect(service.getDropRate('boss', false)).toBe(BOSS_DROP_RATE);
        });

        it('returns 100% for boss regardless of elite flag', () => {
            expect(service.getDropRate('boss', true)).toBe(BOSS_DROP_RATE);
        });
    });

    // -----------------------------------------------------------------------
    // Power Scaling
    // -----------------------------------------------------------------------

    describe('calculateScaledPower', () => {
        const service = new CardDropService();

        it('returns base power on floor 1', () => {
            // basePower(5) + 1 * 0.5 = 5.5 → round → 6
            expect(service.calculateScaledPower(1)).toBe(
                Math.round(BASE_DROP_CARD_POWER + 1 * POWER_SCALING_PER_FLOOR),
            );
        });

        it('scales power linearly with floor number', () => {
            // basePower(5) + 10 * 0.5 = 10
            expect(service.calculateScaledPower(10)).toBe(10);
        });

        it('rounds to nearest integer', () => {
            // basePower(5) + 3 * 0.5 = 6.5 → round → 7 (0.5 rounds up)
            expect(service.calculateScaledPower(3)).toBe(7);
        });

        it('handles floor 0 gracefully', () => {
            expect(service.calculateScaledPower(0)).toBe(BASE_DROP_CARD_POWER);
        });
    });

    // -----------------------------------------------------------------------
    // Card Generation
    // -----------------------------------------------------------------------

    describe('generateDropCard', () => {
        it('generates an ATTACK card when random < 0.5', () => {
            // First random call: type selection (0.2 < 0.5 → ATTACK)
            // Second random call: name selection
            const service = new CardDropService(createFixedRandom([0.2, 0.0]));

            const card = service.generateDropCard(1);

            expect(card.type).toBe(CARD_TYPE.ATTACK);
            expect(card.power).toBe(Math.round(BASE_DROP_CARD_POWER + 1 * POWER_SCALING_PER_FLOOR));
            expect(card.id).toBeDefined();
            expect(card.name).toBeTruthy();
        });

        it('generates a GUARD card when random >= 0.5', () => {
            // First random call: type selection (0.7 >= 0.5 → GUARD)
            // Second random call: name selection
            const service = new CardDropService(createFixedRandom([0.7, 0.0]));

            const card = service.generateDropCard(5);

            expect(card.type).toBe(CARD_TYPE.GUARD);
            expect(card.power).toBe(Math.round(BASE_DROP_CARD_POWER + 5 * POWER_SCALING_PER_FLOOR));
        });
    });

    // -----------------------------------------------------------------------
    // Roll Card Drop
    // -----------------------------------------------------------------------

    describe('rollCardDrop', () => {
        it('drops a card when roll is below normal drop rate', () => {
            // Roll: 0.1 < 0.3 → drop success
            // Type: 0.2 < 0.5 → ATTACK
            // Name: 0.0 → first name
            const service = new CardDropService(createFixedRandom([0.1, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', false, 1, deckService);

            expect(result.dropped).toBe(true);
            if (result.dropped) {
                expect(result.card.type).toBe(CARD_TYPE.ATTACK);
                expect(result.addedToDeck).toBe(true);
                expect(result.deckFull).toBe(false);
            }
        });

        it('does not drop when roll is above normal drop rate', () => {
            // Roll: 0.5 >= 0.3 → no drop
            const service = new CardDropService(createConstantRandom(0.5));

            const result = service.rollCardDrop('normal', false, 1, deckService);

            expect(result.dropped).toBe(false);
        });

        it('drops for elite enemies at 60% rate', () => {
            // Roll: 0.5 < 0.6 → drop success
            const service = new CardDropService(createFixedRandom([0.5, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', true, 1, deckService);

            expect(result.dropped).toBe(true);
        });

        it('does not drop for elite when roll exceeds 60%', () => {
            // Roll: 0.7 >= 0.6 → no drop
            const service = new CardDropService(createConstantRandom(0.7));

            const result = service.rollCardDrop('normal', true, 1, deckService);

            expect(result.dropped).toBe(false);
        });

        it('always drops for boss enemies', () => {
            // Roll: 0.99 < 1.0 → drop success
            const service = new CardDropService(createFixedRandom([0.99, 0.2, 0.0]));

            const result = service.rollCardDrop('boss', false, 1, deckService);

            expect(result.dropped).toBe(true);
        });

        it('reports deckFull when deck is at max capacity', () => {
            // Fill deck to max
            const smallDeck = new DeckService(6);
            smallDeck.initializeStarterDeck(); // 5 cards in deck of max 6

            // Add one more to fill it
            smallDeck.addCard(createCard({ name: 'Filler', type: CARD_TYPE.ATTACK, power: 5 }));
            expect(smallDeck.isFull()).toBe(true);

            // Roll: 0.0 < 0.3 → drop success, but deck full
            const service = new CardDropService(createFixedRandom([0.0, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', false, 1, smallDeck);

            expect(result.dropped).toBe(true);
            if (result.dropped) {
                expect(result.addedToDeck).toBe(false);
                expect(result.deckFull).toBe(true);
            }
        });

        it('adds card to deck when space is available', () => {
            const initialSize = deckService.getSnapshot().size;
            const service = new CardDropService(createFixedRandom([0.0, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', false, 5, deckService);

            expect(result.dropped).toBe(true);
            if (result.dropped) {
                expect(deckService.getSnapshot().size).toBe(initialSize + 1);
                expect(result.addedToDeck).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Swap Card
    // -----------------------------------------------------------------------

    describe('swapCard', () => {
        it('swaps an existing card with the new card', () => {
            const service = new CardDropService();
            const existingCards = deckService.getCards();
            const cardToRemove = existingCards[0];
            const newCard = createCard({ name: 'New Strike', type: CARD_TYPE.ATTACK, power: 15 });

            const result = service.swapCard(cardToRemove.id, newCard, deckService);

            expect(result.swapped).toBe(true);
            if (result.swapped) {
                expect(result.removedCard.id).toBe(cardToRemove.id);
                expect(result.addedCard.id).toBe(newCard.id);
                expect(deckService.findCard(cardToRemove.id)).toBeUndefined();
                expect(deckService.findCard(newCard.id)).toBeDefined();
            }
        });

        it('fails when card to remove does not exist', () => {
            const service = new CardDropService();
            const newCard = createCard({ name: 'New Card', type: CARD_TYPE.GUARD, power: 10 });

            const result = service.swapCard('nonexistent-id', newCard, deckService);

            expect(result.swapped).toBe(false);
            if (!result.swapped) {
                expect(result.reason).toBe('card-not-found');
            }
        });

        it('maintains deck size after swap', () => {
            const service = new CardDropService();
            const initialSize = deckService.getSnapshot().size;
            const cardToRemove = deckService.getCards()[0];
            const newCard = createCard({ name: 'Swap Card', type: CARD_TYPE.ATTACK, power: 12 });

            service.swapCard(cardToRemove.id, newCard, deckService);

            expect(deckService.getSnapshot().size).toBe(initialSize);
        });
    });

    // -----------------------------------------------------------------------
    // Edge Cases
    // -----------------------------------------------------------------------

    describe('edge cases', () => {
        it('drop rate boundary: roll exactly equal to drop rate does NOT drop', () => {
            // Roll: 0.3 >= 0.3 → no drop (boundary)
            const service = new CardDropService(createConstantRandom(NORMAL_DROP_RATE));

            const result = service.rollCardDrop('normal', false, 1, deckService);

            expect(result.dropped).toBe(false);
        });

        it('drop rate boundary: roll just below drop rate drops', () => {
            // Roll: 0.2999 < 0.3 → drop
            const service = new CardDropService(createFixedRandom([0.2999, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', false, 1, deckService);

            expect(result.dropped).toBe(true);
        });

        it('high floor produces strong cards', () => {
            const service = new CardDropService(createFixedRandom([0.0, 0.2, 0.0]));

            const result = service.rollCardDrop('normal', false, 50, deckService);

            expect(result.dropped).toBe(true);
            if (result.dropped) {
                // basePower(5) + 50 * 0.5 = 30
                expect(result.card.power).toBe(30);
            }
        });
    });
});
