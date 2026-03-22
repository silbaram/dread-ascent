import { beforeEach, describe, expect, it } from 'vitest';
import {
    STATUS_EFFECT_TYPE,
    STATUS_EVENT_TYPE,
    StatusEffectService,
    type StatusEffectCombatant,
    type StatusEffectState,
} from '../../../../src/domain/services/StatusEffectService';

describe('StatusEffectService', () => {
    let service: StatusEffectService;

    beforeEach(() => {
        service = new StatusEffectService();
    });

    function createStatusEffects(overrides?: Partial<StatusEffectState>): StatusEffectState {
        return {
            ...service.createState(),
            ...overrides,
        };
    }

    function createCombatant(overrides?: Partial<StatusEffectCombatant>): StatusEffectCombatant {
        return {
            health: 40,
            maxHealth: 40,
            block: 6,
            ...overrides,
        };
    }

    describe('applyStatusEffect', () => {
        it('refreshes Vulnerable with the larger remaining duration instead of stacking', () => {
            const state = createStatusEffects({ vulnerable: 3 });

            const result = service.applyStatusEffect(state, {
                type: STATUS_EFFECT_TYPE.VULNERABLE,
                duration: 2,
                target: 'enemy-1',
            });

            expect(result.statusEffects.vulnerable).toBe(3);
            expect(result.events).toEqual([
                {
                    type: STATUS_EVENT_TYPE.APPLY,
                    target: 'enemy-1',
                    status: STATUS_EFFECT_TYPE.VULNERABLE,
                    value: 3,
                    duration: 3,
                },
            ]);
        });

        it('refreshes Weak with the larger remaining duration instead of stacking', () => {
            const state = createStatusEffects({ weak: 1 });

            const result = service.applyStatusEffect(state, {
                type: STATUS_EFFECT_TYPE.WEAK,
                duration: 4,
                target: 'player',
            });

            expect(result.statusEffects.weak).toBe(4);
            expect(result.events).toEqual([
                {
                    type: STATUS_EVENT_TYPE.APPLY,
                    target: 'player',
                    status: STATUS_EFFECT_TYPE.WEAK,
                    value: 4,
                    duration: 4,
                },
            ]);
        });

        it('adds Poison stacks on reapply', () => {
            const state = createStatusEffects({ poison: 3 });

            const result = service.applyStatusEffect(state, {
                type: STATUS_EFFECT_TYPE.POISON,
                stacks: 2,
                target: 'enemy-1',
            });

            expect(result.statusEffects.poison).toBe(5);
            expect(result.events).toEqual([
                {
                    type: STATUS_EVENT_TYPE.APPLY,
                    target: 'enemy-1',
                    status: STATUS_EFFECT_TYPE.POISON,
                    value: 5,
                },
            ]);
        });
    });

    describe('calculateDamage', () => {
        it('increases incoming damage by 50% when the target is Vulnerable', () => {
            const damage = service.calculateDamage(
                9,
                createStatusEffects(),
                createStatusEffects({ vulnerable: 2 }),
            );

            expect(damage).toBe(13);
        });

        it('reduces outgoing damage by 25% when the attacker is Weak', () => {
            const damage = service.calculateDamage(
                10,
                createStatusEffects({ weak: 2 }),
                createStatusEffects(),
            );

            expect(damage).toBe(7);
        });

        it('applies Weak before Vulnerable in damage calculation order', () => {
            const damage = service.calculateDamage(
                10,
                createStatusEffects({ weak: 1 }),
                createStatusEffects({ vulnerable: 1 }),
            );

            expect(damage).toBe(10);
        });
    });

    describe('processTurnEnd', () => {
        it('applies Poison fixed damage, ignores block, and reduces stacks by 1', () => {
            const result = service.processTurnEnd(
                createCombatant({ health: 20, block: 9 }),
                createStatusEffects({ poison: 3 }),
                'enemy-1',
            );

            expect(result.combatant.health).toBe(17);
            expect(result.combatant.block).toBe(9);
            expect(result.poisonDamage).toBe(3);
            expect(result.statusEffects.poison).toBe(2);
            expect(result.events).toEqual([]);
        });

        it('decrements Vulnerable and Weak at turn end and expires them at 0', () => {
            const result = service.processTurnEnd(
                createCombatant(),
                createStatusEffects({ vulnerable: 1, weak: 1 }),
                'player',
            );

            expect(result.statusEffects.vulnerable).toBe(0);
            expect(result.statusEffects.weak).toBe(0);
            expect(result.events).toEqual([
                {
                    type: STATUS_EVENT_TYPE.EXPIRE,
                    target: 'player',
                    status: STATUS_EFFECT_TYPE.VULNERABLE,
                },
                {
                    type: STATUS_EVENT_TYPE.EXPIRE,
                    target: 'player',
                    status: STATUS_EFFECT_TYPE.WEAK,
                },
            ]);
        });

        it('expires Poison when the last stack is consumed at turn end', () => {
            const result = service.processTurnEnd(
                createCombatant({ health: 5 }),
                createStatusEffects({ poison: 1 }),
                'enemy-1',
            );

            expect(result.combatant.health).toBe(4);
            expect(result.statusEffects.poison).toBe(0);
            expect(result.events).toEqual([
                {
                    type: STATUS_EVENT_TYPE.EXPIRE,
                    target: 'enemy-1',
                    status: STATUS_EFFECT_TYPE.POISON,
                },
            ]);
        });
    });
});
