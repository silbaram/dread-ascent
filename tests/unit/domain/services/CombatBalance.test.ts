import { describe, expect, it } from 'vitest';
import {
    CARD_DISCARD_STRATEGY,
    CARD_INSCRIPTION_ID,
    CARD_INSCRIPTION_PAYOFF_TYPE,
    CARD_INSCRIPTION_TRIGGER,
    CARD_TARGET_SCOPE,
} from '../../../../src/domain/entities/Card';
import {
    CARD_BALANCE_TABLE,
    CARD_CATALOG_ID,
    COMBAT_BALANCE,
    COMBAT_RESOURCE_BALANCE,
    ENEMY_INTENT_BALANCE,
    STARTER_DECK_COMPOSITION,
    STATUS_EFFECT_BALANCE,
} from '../../../../src/domain/services/CombatBalance';

describe('CombatBalance', () => {
    it('defines the expanded card catalog in a shared balance table', () => {
        expect(Object.keys(CARD_BALANCE_TABLE)).toHaveLength(42);
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.STRIKE]).toMatchObject({
            name: 'Strike',
            cost: 1,
            power: 6,
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.BLOOD_PRICE]).toMatchObject({
            cost: 0,
            effectPayload: { drawCount: 2, selfDamage: 4 },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.VENOM_STRIKE]).toMatchObject({
            cost: 1,
            statusEffect: { type: 'POISON', duration: 3 },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.BARRICADE]).toMatchObject({
            cost: 3,
            effectPayload: {
                buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.ADRENALINE_RUSH]).toMatchObject({
            cost: 1,
            rarity: 'RARE',
            effectPayload: {
                drawCount: 3,
                selfDamage: 5,
                energyChange: 3,
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.SHOCKWAVE]).toMatchObject({
            cost: 2,
            power: 8,
            targetScope: CARD_TARGET_SCOPE.ALL_ENEMIES,
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.CHEAP_SHOT]).toMatchObject({
            archetype: 'SMUGGLER',
            condition: { type: 'TARGET_DEBUFF_COUNT_AT_LEAST', value: 1 },
            effectPayload: {
                costWhenConditionMet: 0,
                scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 3, baseValue: 7 },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.COUNTER_STRIKE]).toMatchObject({
            archetype: 'IRON_WILL',
            condition: { type: 'COUNTER_WINDOW_READY', value: 1 },
            effectPayload: {
                scaling: { source: 'COUNTER_WINDOW', multiplier: 1 },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.BACKDOOR_EXIT]).toMatchObject({
            archetype: 'SMUGGLER',
            effectPayload: { perfectVanish: true },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.SHADOW_STEP]).toMatchObject({
            archetype: 'SMUGGLER',
            effectPayload: { perfectVanishAfterDiscard: true },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.RECYCLE]).toMatchObject({
            archetype: 'SMUGGLER',
            effectPayload: {
                discardStrategy: CARD_DISCARD_STRATEGY.SELECTED,
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.EXPLOIT_WEAKNESS]).toMatchObject({
            archetype: 'SHADOW_ARTS',
            effectPayload: {
                scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
            },
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    amount: 8,
                },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.BRACE]).toMatchObject({
            archetype: 'IRON_WILL',
            inscription: {
                id: CARD_INSCRIPTION_ID.IRON_ENTRENCH,
                trigger: CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                    amount: 3,
                },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.PLAGUE_FINALE]).toMatchObject({
            archetype: 'SHADOW_ARTS',
            rarity: 'RARE',
            condition: { type: 'TARGET_DEBUFF_COUNT_AT_LEAST', value: 2 },
            effectPayload: {
                buff: { type: 'POISON_MULTIPLIER', value: 3, target: 'TARGET' },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.CITADEL_CRUSH]).toMatchObject({
            archetype: 'IRON_WILL',
            rarity: 'RARE',
            effectPayload: {
                scaling: { source: 'USER_BLOCK', multiplier: 1.5, baseValue: 8 },
            },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.LOADED_DICE]).toMatchObject({
            archetype: 'SMUGGLER',
            rarity: 'RARE',
            effectPayload: {
                scaling: { source: 'CARDS_DISCARDED_THIS_TURN', multiplier: 5, baseValue: 10 },
            },
        });
    });

    it('keeps the starter deck and expands per-turn resources for card combat', () => {
        expect(COMBAT_RESOURCE_BALANCE).toEqual({
            maxEnergy: 3,
            cardsPerTurn: 5,
            maxHandSize: 10,
            rewardOfferSize: 3,
        });
        expect(STARTER_DECK_COMPOSITION).toEqual([
            { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
            { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
        ]);
    });

    it('defines extended status effect balance for poison, frail, and regeneration', () => {
        expect(STATUS_EFFECT_BALANCE).toEqual({
            durationDecayPerTurn: 1,
            vulnerableDamageMultiplier: 1.5,
            weakDamageMultiplier: 0.75,
            frailBlockMultiplier: 0.75,
            poison: {
                damagePerStack: 1,
                stackDecayPerTurn: 1,
            },
            regeneration: {
                healPerStack: 1,
                stackDecayPerTurn: 1,
            },
        });
    });

    it('keeps floor-band enemy intent scaling in the shared balance object', () => {
        expect(ENEMY_INTENT_BALANCE.floorScaling.floorBandSize).toBe(10);
        expect(ENEMY_INTENT_BALANCE.floorScaling.perBand.normal).toEqual({
            attack: 1,
            defend: 0,
            buff: 0,
        });
        expect(ENEMY_INTENT_BALANCE.floorScaling.perBand.elite).toEqual({
            attack: 1,
            defend: 0,
            buff: 1,
        });
        expect(COMBAT_BALANCE.enemyIntent).toBe(ENEMY_INTENT_BALANCE);
    });
});
