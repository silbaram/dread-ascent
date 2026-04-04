import { beforeEach, describe, expect, it } from 'vitest';
import {
    ARCHETYPE_CARD_IDS,
    CARD_CATALOG_ID,
    CARD_TEMPLATES,
    DROPPABLE_CARD_IDS,
    RARITY_CARD_IDS,
    STARTER_DECK_COMPOSITION,
    checkCardCondition,
    createCardFromCatalog,
    createStarterDeckCards,
    getCardTemplate,
} from '../../../../src/domain/entities/CardCatalog';
import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('CardCatalog', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    describe('expanded catalog definitions', () => {
        it('defines the 35-card expansion catalog', () => {
            expect(CARD_TEMPLATES).toHaveLength(35);
        });

        it('keeps starter cards intact', () => {
            const strike = createCardFromCatalog(CARD_CATALOG_ID.STRIKE);
            const fortify = createCardFromCatalog(CARD_CATALOG_ID.FORTIFY);

            expect(strike).toMatchObject({
                name: 'Strike',
                cost: 1,
                power: 6,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                rarity: CARD_RARITY.COMMON,
            });
            expect(fortify).toMatchObject({
                name: 'Fortify',
                cost: 1,
                power: 5,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });
        });

        it('defines representative blood oath, shadow arts, and iron will cards', () => {
            const bloodPrice = createCardFromCatalog(CARD_CATALOG_ID.BLOOD_PRICE);
            const venomStrike = createCardFromCatalog(CARD_CATALOG_ID.VENOM_STRIKE);
            const shieldBash = createCardFromCatalog(CARD_CATALOG_ID.SHIELD_BASH);

            expect(bloodPrice).toMatchObject({
                archetype: CARD_ARCHETYPE.BLOOD_OATH,
                effectType: CARD_EFFECT_TYPE.DRAW,
                effectPayload: { drawCount: 2, selfDamage: 4 },
            });
            expect(venomStrike).toMatchObject({
                archetype: CARD_ARCHETYPE.SHADOW_ARTS,
                power: 4,
                statusEffect: { type: 'POISON', duration: 3 },
            });
            expect(shieldBash).toMatchObject({
                archetype: CARD_ARCHETYPE.IRON_WILL,
                effectPayload: {
                    scaling: { source: 'USER_BLOCK', multiplier: 1 },
                },
            });
        });

        it('defines representative rare cards and curses', () => {
            const barricade = createCardFromCatalog(CARD_CATALOG_ID.BARRICADE);
            const hemorrhage = createCardFromCatalog(CARD_CATALOG_ID.HEMORRHAGE);

            expect(barricade).toMatchObject({
                rarity: CARD_RARITY.RARE,
                effectType: CARD_EFFECT_TYPE.BUFF,
                effectPayload: {
                    buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
                },
            });
            expect(hemorrhage.keywords).toContain(CARD_KEYWORD.UNPLAYABLE);
        });

        it('keeps catalog ids and names unique', () => {
            const ids = CARD_TEMPLATES.map((template) => template.catalogId);
            const names = CARD_TEMPLATES.map((template) => template.params.name);

            expect(new Set(ids).size).toBe(ids.length);
            expect(new Set(names).size).toBe(names.length);
        });
    });

    describe('starter deck', () => {
        it('creates starter deck with Strike x4 and Fortify x3', () => {
            const cards = createStarterDeckCards();

            expect(cards).toHaveLength(7);
            expect(cards.filter((card) => card.name === 'Strike')).toHaveLength(4);
            expect(cards.filter((card) => card.name === 'Fortify')).toHaveLength(3);
            expect(STARTER_DECK_COMPOSITION).toEqual([
                { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
                { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
            ]);
        });
    });

    describe('lookup helpers', () => {
        it('returns templates for valid ids and undefined for invalid ids', () => {
            expect(getCardTemplate(CARD_CATALOG_ID.QUICK_DRAW)?.params.name).toBe('Quick Draw');
            expect(getCardTemplate('INVALID' as never)).toBeUndefined();
        });

        it('groups cards by archetype and rarity', () => {
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.BLOOD_OATH]).toContain(CARD_CATALOG_ID.BLOOD_PRICE);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SHADOW_ARTS]).toContain(CARD_CATALOG_ID.MIASMA);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.IRON_WILL]).toContain(CARD_CATALOG_ID.BARRICADE);
            expect(RARITY_CARD_IDS[CARD_RARITY.UNCOMMON]).toContain(CARD_CATALOG_ID.CRIMSON_PACT);
            expect(RARITY_CARD_IDS[CARD_RARITY.RARE]).toContain(CARD_CATALOG_ID.SHADOW_STEP);
        });

        it('excludes curses from the droppable pool', () => {
            expect(DROPPABLE_CARD_IDS).not.toContain(CARD_CATALOG_ID.HEMORRHAGE);
            expect(DROPPABLE_CARD_IDS).not.toContain(CARD_CATALOG_ID.DREAD);
        });
    });

    describe('checkCardCondition', () => {
        it('returns true when a card has no condition', () => {
            expect(checkCardCondition(createCardFromCatalog(CARD_CATALOG_ID.STRIKE), 100)).toBe(true);
        });

        it('checks the Last Stand HP threshold condition', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);

            expect(checkCardCondition(card, 5)).toBe(true);
            expect(checkCardCondition(card, 6)).toBe(false);
        });

        it('checks turn-damage conditions with the combat context', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.COUNTER_STRIKE);

            expect(checkCardCondition(card, 100, { turnDamageTaken: 0 })).toBe(false);
            expect(checkCardCondition(card, 100, { turnDamageTaken: 3 })).toBe(true);
        });
    });
});
