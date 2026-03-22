import { describe, expect, it } from 'vitest';
import {
    EnergyService,
    DEFAULT_MAX_ENERGY,
} from '../../../../src/domain/services/EnergyService';

describe('EnergyService', () => {
    const service = new EnergyService();

    // -----------------------------------------------------------------------
    // initialize
    // -----------------------------------------------------------------------

    describe('initialize', () => {
        it('creates energy state with default max (3)', () => {
            const state = service.initialize();

            expect(state.current).toBe(DEFAULT_MAX_ENERGY);
            expect(state.max).toBe(DEFAULT_MAX_ENERGY);
        });

        it('accepts custom max energy', () => {
            const state = service.initialize(5);

            expect(state.current).toBe(5);
            expect(state.max).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // refill
    // -----------------------------------------------------------------------

    describe('refill', () => {
        it('refills energy to max at turn start', () => {
            const state = { current: 1, max: 3 };
            const result = service.refill(state);

            expect(result.current).toBe(3);
            expect(result.max).toBe(3);
        });

        it('returns same reference when already at max', () => {
            const state = { current: 3, max: 3 };
            const result = service.refill(state);

            expect(result).toBe(state);
        });

        it('works with 0 energy', () => {
            const state = { current: 0, max: 3 };
            const result = service.refill(state);

            expect(result.current).toBe(3);
        });
    });

    // -----------------------------------------------------------------------
    // spendEnergy
    // -----------------------------------------------------------------------

    describe('spendEnergy', () => {
        it('deducts energy when sufficient', () => {
            const state = { current: 3, max: 3 };
            const result = service.spendEnergy(state, 1);

            expect(result.playable).toBe(true);
            if (result.playable) {
                expect(result.energyState.current).toBe(2);
                expect(result.autoEndTurn).toBe(false);
            }
        });

        it('rejects when energy is insufficient', () => {
            const state = { current: 1, max: 3 };
            const result = service.spendEnergy(state, 2);

            expect(result.playable).toBe(false);
            if (!result.playable) {
                expect(result.reason).toBe('insufficient_energy');
            }
        });

        it('allows playing a 0-cost card with 0 energy', () => {
            const state = { current: 0, max: 3 };
            const result = service.spendEnergy(state, 0);

            expect(result.playable).toBe(true);
            if (result.playable) {
                expect(result.energyState.current).toBe(0);
                expect(result.autoEndTurn).toBe(true);
            }
        });

        it('signals auto end turn when energy reaches 0', () => {
            const state = { current: 2, max: 3 };
            const result = service.spendEnergy(state, 2);

            expect(result.playable).toBe(true);
            if (result.playable) {
                expect(result.energyState.current).toBe(0);
                expect(result.autoEndTurn).toBe(true);
            }
        });

        it('does not signal auto end turn when energy remains', () => {
            const state = { current: 3, max: 3 };
            const result = service.spendEnergy(state, 1);

            expect(result.playable).toBe(true);
            if (result.playable) {
                expect(result.autoEndTurn).toBe(false);
            }
        });

        it('allows spending exact remaining energy', () => {
            const state = { current: 3, max: 3 };
            const result = service.spendEnergy(state, 3);

            expect(result.playable).toBe(true);
            if (result.playable) {
                expect(result.energyState.current).toBe(0);
                expect(result.autoEndTurn).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // canAfford
    // -----------------------------------------------------------------------

    describe('canAfford', () => {
        it('returns true when energy >= cost', () => {
            expect(service.canAfford({ current: 3, max: 3 }, 2)).toBe(true);
        });

        it('returns false when energy < cost', () => {
            expect(service.canAfford({ current: 1, max: 3 }, 2)).toBe(false);
        });

        it('returns true for 0-cost with 0 energy', () => {
            expect(service.canAfford({ current: 0, max: 3 }, 0)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // hasPlayableCards
    // -----------------------------------------------------------------------

    describe('hasPlayableCards', () => {
        it('returns true when at least one card is affordable', () => {
            const state = { current: 1, max: 3 };
            expect(service.hasPlayableCards(state, [2, 1, 3])).toBe(true);
        });

        it('returns false when no cards are affordable', () => {
            const state = { current: 1, max: 3 };
            expect(service.hasPlayableCards(state, [2, 3])).toBe(false);
        });

        it('returns false when energy is 0 and no 0-cost cards', () => {
            const state = { current: 0, max: 3 };
            expect(service.hasPlayableCards(state, [1, 2, 3])).toBe(false);
        });

        it('returns false for empty hand', () => {
            const state = { current: 3, max: 3 };
            expect(service.hasPlayableCards(state, [])).toBe(false);
        });
    });
});
