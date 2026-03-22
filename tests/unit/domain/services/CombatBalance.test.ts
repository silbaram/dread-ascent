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
    it('defines all 7 battle cards in a shared balance table', () => {
        expect(Object.keys(CARD_BALANCE_TABLE)).toHaveLength(7);
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.STRIKE]).toMatchObject({
            name: 'Strike',
            cost: 1,
            power: 6,
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.WEAKEN]).toMatchObject({
            cost: 1,
            statusEffect: { type: 'VULNERABLE', duration: 2 },
        });
        expect(CARD_BALANCE_TABLE[CARD_CATALOG_ID.LAST_STAND]).toMatchObject({
            cost: 3,
            power: 30,
            condition: { type: 'HP_THRESHOLD', value: 5 },
        });
    });

    it('defines per-turn resources and the starter deck composition', () => {
        expect(COMBAT_RESOURCE_BALANCE).toEqual({
            maxEnergy: 3,
            cardsPerTurn: 5,
        });
        expect(STARTER_DECK_COMPOSITION).toEqual([
            { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
            { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
        ]);
    });

    it('defines status effect multipliers and poison tick balance', () => {
        expect(STATUS_EFFECT_BALANCE).toEqual({
            durationDecayPerTurn: 1,
            vulnerableDamageMultiplier: 1.5,
            weakDamageMultiplier: 0.75,
            poison: {
                damagePerStack: 1,
                stackDecayPerTurn: 1,
            },
        });
    });

    it('defines floor-band enemy intent scaling in the shared balance object', () => {
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
