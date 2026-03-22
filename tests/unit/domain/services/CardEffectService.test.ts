import { beforeEach, describe, expect, it } from 'vitest';
import {
    CardEffectService,
    type CombatantState,
} from '../../../../src/domain/services/CardEffectService';
import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_TYPE,
    createCard,
    resetCardSequence,
} from '../../../../src/domain/entities/Card';

describe('CardEffectService', () => {
    let service: CardEffectService;

    beforeEach(() => {
        resetCardSequence();
        service = new CardEffectService();
    });

    function makePlayer(overrides?: Partial<CombatantState>): CombatantState {
        return { health: 100, maxHealth: 100, block: 0, ...overrides };
    }

    function makeEnemy(overrides?: Partial<CombatantState>): CombatantState {
        return { health: 50, maxHealth: 50, block: 0, ...overrides };
    }

    // -----------------------------------------------------------------------
    // DAMAGE Effect
    // -----------------------------------------------------------------------

    describe('DAMAGE effect', () => {
        it('deals damage to target health', () => {
            const card = createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 6,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.damageDealt).toBe(6);
            expect(result.targetState.health).toBe(44);
            expect(result.damageBlocked).toBe(0);
        });

        it('absorbs damage with block first', () => {
            const card = createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 10,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy({ block: 4 }));

            expect(result.damageBlocked).toBe(4);
            expect(result.damageDealt).toBe(6);
            expect(result.targetState.health).toBe(44);
            expect(result.targetState.block).toBe(0);
        });

        it('fully blocks damage when block >= damage', () => {
            const card = createCard({
                name: 'Strike',
                type: CARD_TYPE.ATTACK,
                power: 5,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy({ block: 8 }));

            expect(result.damageDealt).toBe(0);
            expect(result.damageBlocked).toBe(5);
            expect(result.targetState.health).toBe(50);
            expect(result.targetState.block).toBe(3);
        });

        it('does not reduce health below 0', () => {
            const card = createCard({
                name: 'Mega Strike',
                type: CARD_TYPE.ATTACK,
                power: 999,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy({ health: 10 }));

            expect(result.targetState.health).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // BLOCK Effect
    // -----------------------------------------------------------------------

    describe('BLOCK effect', () => {
        it('adds block to user', () => {
            const card = createCard({
                name: 'Fortify',
                type: CARD_TYPE.GUARD,
                power: 5,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.blockGained).toBe(5);
            expect(result.userState.block).toBe(5);
            expect(result.damageDealt).toBe(0);
        });

        it('stacks block on existing block', () => {
            const card = createCard({
                name: 'Fortify',
                type: CARD_TYPE.GUARD,
                power: 5,
                effectType: CARD_EFFECT_TYPE.BLOCK,
            });

            const result = service.applyEffect(card, makePlayer({ block: 3 }), makeEnemy());

            expect(result.userState.block).toBe(8);
            expect(result.blockGained).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // resetBlock
    // -----------------------------------------------------------------------

    describe('resetBlock', () => {
        it('resets block to 0 at turn end', () => {
            const state = makePlayer({ block: 15 });
            const result = service.resetBlock(state);

            expect(result.block).toBe(0);
        });

        it('returns same reference when block is already 0', () => {
            const state = makePlayer({ block: 0 });
            const result = service.resetBlock(state);

            expect(result).toBe(state);
        });
    });

    // -----------------------------------------------------------------------
    // STATUS_EFFECT
    // -----------------------------------------------------------------------

    describe('STATUS_EFFECT', () => {
        it('applies status effect to target', () => {
            const card = createCard({
                name: 'Weaken',
                type: CARD_TYPE.ATTACK,
                power: 0,
                cost: 1,
                effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
                statusEffect: { type: 'VULNERABLE', duration: 2 },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.statusApplied).toEqual({ type: 'VULNERABLE', duration: 2 });
            expect(result.damageDealt).toBe(0);
            expect(result.targetState.health).toBe(50);
        });
    });

    // -----------------------------------------------------------------------
    // FLEE Effect
    // -----------------------------------------------------------------------

    describe('FLEE effect', () => {
        it('marks combat as fled', () => {
            const card = createCard({
                name: 'Shadow Step',
                type: CARD_TYPE.ATTACK,
                power: 0,
                cost: 0,
                effectType: CARD_EFFECT_TYPE.FLEE,
                keywords: [CARD_KEYWORD.EXHAUST],
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.fled).toBe(true);
            expect(result.damageDealt).toBe(0);
            expect(result.targetState.health).toBe(50);
        });
    });
});
