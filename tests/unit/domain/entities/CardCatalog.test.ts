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
    resolveCardCost,
} from '../../../../src/domain/entities/CardCatalog';
import {
    CARD_ARCHETYPE,
    CARD_DISCARD_STRATEGY,
    CARD_EFFECT_TYPE,
    CARD_INSCRIPTION_ID,
    CARD_INSCRIPTION_PAYOFF_TYPE,
    CARD_INSCRIPTION_TRIGGER,
    CARD_KEYWORD,
    CARD_RARITY,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('CardCatalog', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    describe('expanded catalog definitions', () => {
        it('defines the 42-card expansion catalog', () => {
            expect(CARD_TEMPLATES).toHaveLength(42);
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
            const exploitWeakness = createCardFromCatalog(CARD_CATALOG_ID.EXPLOIT_WEAKNESS);
            const shieldBash = createCardFromCatalog(CARD_CATALOG_ID.SHIELD_BASH);

            expect(bloodPrice).toMatchObject({
                archetype: CARD_ARCHETYPE.BLOOD_OATH,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.DRAW,
                effectPayload: { drawCount: 2, selfDamage: 4 },
            });
            expect(venomStrike).toMatchObject({
                archetype: CARD_ARCHETYPE.SHADOW_ARTS,
                power: 4,
                statusEffect: { type: 'POISON', duration: 3 },
            });
            expect(exploitWeakness.inscription).toMatchObject({
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    amount: 8,
                },
            });
            const brace = createCardFromCatalog(CARD_CATALOG_ID.BRACE);
            expect(brace.inscription).toMatchObject({
                id: CARD_INSCRIPTION_ID.IRON_ENTRENCH,
                trigger: CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                    amount: 3,
                },
            });
            expect(shieldBash).toMatchObject({
                archetype: CARD_ARCHETYPE.IRON_WILL,
                effectPayload: {
                    scaling: { source: 'USER_BLOCK', multiplier: 1 },
                },
            });
        });

        it('defines Shadow, Iron, and Smuggler finisher cards', () => {
            const plagueFinale = createCardFromCatalog(CARD_CATALOG_ID.PLAGUE_FINALE);
            const citadelCrush = createCardFromCatalog(CARD_CATALOG_ID.CITADEL_CRUSH);
            const loadedDice = createCardFromCatalog(CARD_CATALOG_ID.LOADED_DICE);

            expect(plagueFinale).toMatchObject({
                archetype: CARD_ARCHETYPE.SHADOW_ARTS,
                rarity: CARD_RARITY.RARE,
                condition: { type: 'TARGET_DEBUFF_COUNT_AT_LEAST', value: 2 },
                effectPayload: {
                    buff: { type: 'POISON_MULTIPLIER', value: 3, target: 'TARGET' },
                },
            });
            expect(citadelCrush).toMatchObject({
                archetype: CARD_ARCHETYPE.IRON_WILL,
                rarity: CARD_RARITY.RARE,
                keywords: [CARD_KEYWORD.RETAIN],
                effectPayload: {
                    scaling: { source: 'USER_BLOCK', multiplier: 1.5, baseValue: 8 },
                },
            });
            expect(loadedDice).toMatchObject({
                archetype: CARD_ARCHETYPE.SMUGGLER,
                rarity: CARD_RARITY.RARE,
                keywords: [CARD_KEYWORD.RETAIN],
                effectPayload: {
                    scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 5, baseValue: 10 },
                },
            });
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SHADOW_ARTS]).toContain(CARD_CATALOG_ID.PLAGUE_FINALE);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.IRON_WILL]).toContain(CARD_CATALOG_ID.CITADEL_CRUSH);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SMUGGLER]).toContain(CARD_CATALOG_ID.LOADED_DICE);
            expect(DROPPABLE_CARD_IDS).toEqual(expect.arrayContaining([
                CARD_CATALOG_ID.PLAGUE_FINALE,
                CARD_CATALOG_ID.CITADEL_CRUSH,
                CARD_CATALOG_ID.LOADED_DICE,
            ]));
        });

        it('defines representative smuggler tempo and escape cards', () => {
            const cheapShot = createCardFromCatalog(CARD_CATALOG_ID.CHEAP_SHOT);
            const shadowStep = createCardFromCatalog(CARD_CATALOG_ID.SHADOW_STEP);
            const recycle = createCardFromCatalog(CARD_CATALOG_ID.RECYCLE);
            const backdoorExit = createCardFromCatalog(CARD_CATALOG_ID.BACKDOOR_EXIT);

            expect(cheapShot).toMatchObject({
                archetype: CARD_ARCHETYPE.SMUGGLER,
                cost: 1,
                condition: { type: 'TARGET_DEBUFF_COUNT_AT_LEAST', value: 1 },
                effectPayload: {
                    costWhenConditionMet: 0,
                    scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 3, baseValue: 7 },
                },
            });
            expect(shadowStep).toMatchObject({
                archetype: CARD_ARCHETYPE.SMUGGLER,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.FLEE,
                effectPayload: { perfectVanishAfterDiscard: true },
            });
            expect(recycle).toMatchObject({
                archetype: CARD_ARCHETYPE.SMUGGLER,
                effectPayload: {
                    discardCount: 1,
                    discardStrategy: CARD_DISCARD_STRATEGY.SELECTED,
                    drawCount: 2,
                },
            });
            expect(backdoorExit).toMatchObject({
                archetype: CARD_ARCHETYPE.SMUGGLER,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.FLEE,
                effectPayload: { perfectVanish: true },
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
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.BLOOD_OATH]).toContain(CARD_CATALOG_ID.ADRENALINE_RUSH);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SHADOW_ARTS]).toContain(CARD_CATALOG_ID.MIASMA);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SHADOW_ARTS]).toContain(CARD_CATALOG_ID.MARK_THE_VEIN);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.IRON_WILL]).toContain(CARD_CATALOG_ID.BARRICADE);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SMUGGLER]).toContain(CARD_CATALOG_ID.SHADOW_STEP);
            expect(ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.SMUGGLER]).toContain(CARD_CATALOG_ID.BACKDOOR_EXIT);
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

        it('keeps cost-conditional payoff cards playable', () => {
            const bloodrush = createCardFromCatalog(CARD_CATALOG_ID.BLOODRUSH);
            const lastStand = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);

            expect(checkCardCondition(bloodrush, 80, { playerMaxHealth: 100 })).toBe(true);
            expect(checkCardCondition(lastStand, 40, { playerMaxHealth: 100 })).toBe(true);
        });

        it('resolves HP-percent cost discounts with max-health context', () => {
            const bloodrush = createCardFromCatalog(CARD_CATALOG_ID.BLOODRUSH);
            const lastStand = createCardFromCatalog(CARD_CATALOG_ID.LAST_STAND);

            expect(resolveCardCost(bloodrush, 60, { playerMaxHealth: 100 })).toBe(2);
            expect(resolveCardCost(bloodrush, 50, { playerMaxHealth: 100 })).toBe(0);
            expect(resolveCardCost(lastStand, 30, { playerMaxHealth: 100 })).toBe(3);
            expect(resolveCardCost(lastStand, 25, { playerMaxHealth: 100 })).toBe(0);
        });

        it('checks Counter Strike windows with damage taken or guarded attack intent', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.COUNTER_STRIKE);

            expect(checkCardCondition(card, 100, { turnDamageTaken: 0 })).toBe(false);
            expect(checkCardCondition(card, 100, { turnDamageTaken: 3 })).toBe(true);
            expect(checkCardCondition(card, 100, {
                playerBlock: 4,
                enemyIntentType: 'attack',
                enemyIntentDamage: 7,
            })).toBe(true);
        });

        it('resolves target-debuff conditional discounts', () => {
            const card = createCardFromCatalog(CARD_CATALOG_ID.CHEAP_SHOT);

            expect(resolveCardCost(card, 100, { targetDebuffCount: 0 })).toBe(1);
            expect(resolveCardCost(card, 100, { targetDebuffCount: 1 })).toBe(0);
        });
    });
});
