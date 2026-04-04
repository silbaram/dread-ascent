import { describe, expect, it } from 'vitest';
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
        expect(Object.keys(CARD_BALANCE_TABLE)).toHaveLength(35);
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.STRIKE]).toMatchObject({
            name: 'Strike',
            cost: 1,
            power: 6,
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.BLOOD_PRICE]).toMatchObject({
            cost: 1,
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
