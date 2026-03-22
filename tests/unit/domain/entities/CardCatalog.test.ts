import { beforeEach, describe, expect, it } from 'vitest';
import {
    CARD_CATALOG_ID,
    CARD_TEMPLATES,
    STARTER_DECK_COMPOSITION,
    createCardFromCatalog,
    createStarterDeckCards,
    getCardTemplate,
    checkCardCondition,
} from '../../../../src/domain/entities/CardCatalog';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('CardCatalog', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // 7종 카드 정의 검증
    // -----------------------------------------------------------------------

    describe('7 card definitions', () => {
        it('defines exactly 7 card templates', () => {
            expect(CARD_TEMPLATES).toHaveLength(7);
        });

        it('Strike: cost 1, damage 6', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.STRIKE);
            expect(card.name).toBe('Strike');
            expect(card.cost).toBe(1);
            expect(card.power).toBe(6);
            expect(card.effectType).toBe(CARD_EFFECT_TYPE.DAMAGE);
            expect(card.keywords).toEqual([]);
        });

        it('Fortify: cost 1, block 5', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.FORTIFY);
            expect(card.name).toBe('Fortify');
            expect(card.cost).toBe(1);
            expect(card.power).toBe(5);
            expect(card.effectType).toBe(CARD_EFFECT_TYPE.BLOCK);
        });

        it('Weaken: cost 1, Vulnerable 2 turns', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.WEAKEN);
            expect(card.name).toBe('Weaken');
            expect(card.cost).toBe(1);
            expect(card.effectType).toBe(CARD_EFFECT_TYPE.STATUS_EFFECT);
            expect(card.statusEffect).toEqual({ type: 'VULNERABLE', duration: 2 });
        });

        it('Bloodrush: cost 2, damage 18, Exhaust', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.BLOODRUSH);
            expect(card.name).toBe('Bloodrush');
            expect(card.cost).toBe(2);
            expect(card.power).toBe(18);
            expect(card.keywords).toContain(CARD_KEYWORD.EXHAUST);
        });

        it('Shadow Step: cost 0, flee, Exhaust, Rare', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.SHADOW_STEP);
            expect(card.name).toBe('Shadow Step');
            expect(card.cost).toBe(0);
            expect(card.effectType).toBe(CARD_EFFECT_TYPE.FLEE);
            expect(card.keywords).toContain(CARD_KEYWORD.EXHAUST);
            expect(card.rarity).toBe(CARD_RARITY.RARE);
        });

        it('Last Stand: cost 3, damage 30, Retain, HP<=5 condition', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);
            expect(card.name).toBe('Last Stand');
            expect(card.cost).toBe(3);
            expect(card.power).toBe(30);
            expect(card.keywords).toContain(CARD_KEYWORD.RETAIN);
            expect(card.rarity).toBe(CARD_RARITY.RARE);
            expect(card.condition).toEqual({ type: 'HP_THRESHOLD', value: 5 });
        });

        it('Shockwave: cost 2, damage 8', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.SHOCKWAVE);
            expect(card.name).toBe('Shockwave');
            expect(card.cost).toBe(2);
            expect(card.power).toBe(8);
            expect(card.effectType).toBe(CARD_EFFECT_TYPE.DAMAGE);
        });

        it('all cards have unique names', () => {
            const names = CARD_TEMPLATES.map((t) => t.params.name);
            expect(new Set(names).size).toBe(names.length);
        });

        it('all catalog IDs are unique', () => {
            const ids = CARD_TEMPLATES.map((t) => t.catalogId);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    // -----------------------------------------------------------------------
    // Starter Deck
    // -----------------------------------------------------------------------

    describe('starter deck', () => {
        it('creates starter deck with Strike x4, Fortify x3', () => {
            const cards = createStarterDeckCards();

            expect(cards).toHaveLength(7);

            const strikes = cards.filter((c) => c.name === 'Strike');
            const fortifies = cards.filter((c) => c.name === 'Fortify');

            expect(strikes).toHaveLength(4);
            expect(fortifies).toHaveLength(3);
        });

        it('all starter cards have unique IDs', () => {
            const cards = createStarterDeckCards();
            const ids = cards.map((c) => c.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('starter cards have correct cost values', () => {
            const cards = createStarterDeckCards();
            for (const card of cards) {
                expect(card.cost).toBe(1);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Template Lookup
    // -----------------------------------------------------------------------

    describe('getCardTemplate', () => {
        it('returns template for valid catalog ID', () => {
            const template = getCardTemplate(CARD_CATALOG_ID.STRIKE);
            expect(template).toBeDefined();
            expect(template!.params.name).toBe('Strike');
        });

        it('returns undefined for invalid catalog ID', () => {
            const template = getCardTemplate('INVALID' as never);
            expect(template).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Card Condition Check
    // -----------------------------------------------------------------------

    describe('checkCardCondition', () => {
        it('returns true when card has no condition', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.STRIKE);
            expect(checkCardCondition(card, 100)).toBe(true);
        });

        it('Last Stand: returns true when HP <= 5', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);
            expect(checkCardCondition(card, 5)).toBe(true);
            expect(checkCardCondition(card, 3)).toBe(true);
            expect(checkCardCondition(card, 1)).toBe(true);
        });

        it('Last Stand: returns false when HP > 5', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);
            expect(checkCardCondition(card, 6)).toBe(false);
            expect(checkCardCondition(card, 100)).toBe(false);
        });
    });
});
