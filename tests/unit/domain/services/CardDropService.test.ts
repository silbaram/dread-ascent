import { beforeEach, describe, expect, it } from 'vitest';
import {
    BOSS_DROP_RATE,
    CardDropService,
    ELITE_DROP_RATE,
    NORMAL_DROP_RATE,
    type DropRandomSource,
} from '../../../../src/domain/services/CardDropService';
import { DeckService } from '../../../../src/domain/services/DeckService';
import {
    CARD_ARCHETYPE,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';
import {
    CARD_CATALOG_ID,
    createCardFromCatalog,
} from '../../../../src/domain/entities/CardCatalog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFixedRandom(values: readonly number[]): DropRandomSource {
    let index = 0;
    return {
        next(): number {
            const value = values[index % values.length];
            index += 1;
            return value;
        },
    };
}

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

    describe('getRewardRarityWeights', () => {
        const service = new CardDropService();

        it('keeps the base distribution on early floors', () => {
            expect(service.getRewardRarityWeights(1)).toEqual({
                COMMON: 60,
                UNCOMMON: 30,
                RARE: 10,
            });
        });

        it('shifts weight toward uncommon and rare cards on higher floors', () => {
            expect(service.getRewardRarityWeights(9)).toEqual({
                COMMON: 50,
                UNCOMMON: 36,
                RARE: 14,
            });
        });
    });

    describe('detectBiasArchetype', () => {
        it('returns the dominant non-neutral archetype in the current deck', () => {
            const service = new CardDropService();
            const deckCards = [
                ...deckService.getCards(),
                createCardFromCatalog(CARD_CATALOG_ID.BLOOD_PRICE),
                createCardFromCatalog(CARD_CATALOG_ID.DEATH_WISH),
            ];

            expect(service.detectBiasArchetype(deckCards)).toBe(CARD_ARCHETYPE.BLOOD_OATH);
        });

        it('seeds a build archetype when the deck has no direction yet', () => {
            const service = new CardDropService(createFixedRandom([0.34]));

            expect(service.detectBiasArchetype(deckService.getCards())).toBe(CARD_ARCHETYPE.SHADOW_ARTS);
        });
    });

    describe('generateRewardOffer', () => {
        it('builds a 3-card offer with archetype, neutral, and random slots', () => {
            const service = new CardDropService(createFixedRandom([0.1, 0.0, 0.0, 0.0]));
            const deckCards = [
                ...deckService.getCards(),
                createCardFromCatalog(CARD_CATALOG_ID.BLOOD_PRICE),
                createCardFromCatalog(CARD_CATALOG_ID.BLOOD_SHIELD),
            ];

            const offer = service.generateRewardOffer(1, deckCards);

            expect(offer.biasArchetype).toBe(CARD_ARCHETYPE.BLOOD_OATH);
            expect(offer.rarityBand).toBe(CARD_RARITY.COMMON);
            expect(offer.choices).toHaveLength(3);
            expect(offer.choices.map((choice) => choice.slot)).toEqual([
                'ARCHETYPE',
                'NEUTRAL',
                'RANDOM',
            ]);
            expect(offer.choices[0].card.archetype).toBe(CARD_ARCHETYPE.BLOOD_OATH);
            expect(offer.choices[1].card.archetype).toBe(CARD_ARCHETYPE.NEUTRAL);
            expect(offer.choices[2].card.archetype).not.toBe(CARD_ARCHETYPE.NEUTRAL);
            expect(new Set(offer.choices.map((choice) => choice.catalogId)).size).toBe(3);
        });

        it('can roll a rare reward band and fall back within the slot pool', () => {
            const service = new CardDropService(createFixedRandom([0.95, 0.0, 0.0, 0.0]));
            const deckCards = [
                ...deckService.getCards(),
                createCardFromCatalog(CARD_CATALOG_ID.IRON_GUARD),
            ];

            const offer = service.generateRewardOffer(1, deckCards);

            expect(offer.rarityBand).toBe(CARD_RARITY.RARE);
            expect(offer.choices[0].card.archetype).toBe(CARD_ARCHETYPE.IRON_WILL);
            expect(offer.choices[1].card.archetype).toBe(CARD_ARCHETYPE.NEUTRAL);
        });
    });

    describe('rollCardDrop', () => {
        it('drops a reward offer when the roll is below the normal drop rate', () => {
            const service = new CardDropService(createFixedRandom([0.1, 0.0, 0.0, 0.0]));
            const deckCards = [
                ...deckService.getCards(),
                createCardFromCatalog(CARD_CATALOG_ID.VENOM_STRIKE),
            ];

            const result = service.rollCardDrop('normal', false, 1, deckCards);

            expect(result.dropped).toBe(true);
            if (result.dropped) {
                expect(result.offer.choices).toHaveLength(3);
                expect(result.offer.biasArchetype).toBe(CARD_ARCHETYPE.SHADOW_ARTS);
            }
        });

        it('does not drop when the roll is above the normal drop rate', () => {
            const service = new CardDropService(createConstantRandom(0.5));

            expect(service.rollCardDrop('normal', false, 1, deckService.getCards())).toEqual({
                dropped: false,
            });
        });

        it('always drops for boss enemies', () => {
            const service = new CardDropService(createFixedRandom([0.99, 0.0, 0.0, 0.0]));

            const result = service.rollCardDrop('boss', false, 1, deckService.getCards());

            expect(result.dropped).toBe(true);
        });
    });

    describe('swapCard', () => {
        it('swaps an existing card with the selected reward card', () => {
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
    });
});
