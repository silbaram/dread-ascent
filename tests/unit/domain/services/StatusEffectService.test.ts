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

        it('adds Poison stacks on reapply', () => {
            const state = createStatusEffects({ poison: 3 });

            const result = service.applyStatusEffect(state, {
                type: STATUS_EFFECT_TYPE.POISON,
                stacks: 2,
                target: 'enemy-1',
            });

            expect(result.statusEffects.poison).toBe(5);
            expect(result.events[0]).toMatchObject({
                status: STATUS_EFFECT_TYPE.POISON,
                value: 5,
            });
        });

        it('adds Strength and Thorns as stacks, and refreshes Regeneration as duration', () => {
            const result = service.applyStatusEffect(service.createState(), {
                type: STATUS_EFFECT_TYPE.STRENGTH,
                stacks: 2,
                target: 'player',
            });
            const thorns = service.applyStatusEffect(result.statusEffects, {
                type: STATUS_EFFECT_TYPE.THORNS,
                stacks: 3,
                target: 'player',
            });
            const regeneration = service.applyStatusEffect(thorns.statusEffects, {
                type: STATUS_EFFECT_TYPE.REGENERATION,
                duration: 2,
                target: 'player',
            });

            expect(regeneration.statusEffects).toMatchObject({
                strength: 2,
                thorns: 3,
                regeneration: 2,
            });
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

        it('adds Strength before Weak and Vulnerable modifiers', () => {
            const damage = service.calculateDamage(
                10,
                createStatusEffects({ strength: 3, weak: 1 }),
                createStatusEffects({ vulnerable: 1 }),
            );

            expect(damage).toBe(13);
        });
    });

    describe('calculateBlockGain', () => {
        it('reduces block gain while Frail is active', () => {
            const blockGain = service.calculateBlockGain(
                12,
                createStatusEffects({ frail: 2 }),
            );

            expect(blockGain).toBe(9);
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

        it('heals and decays Regeneration at turn end', () => {
            const result = service.processTurnEnd(
                createCombatant({ health: 30, maxHealth: 40 }),
                createStatusEffects({ regeneration: 3 }),
                'player',
            );

            expect(result.combatant.health).toBe(33);
            expect(result.regenerationHeal).toBe(3);
            expect(result.statusEffects.regeneration).toBe(2);
        });

        it('decrements Vulnerable, Weak, and Frail at turn end and expires them at 0', () => {
            const result = service.processTurnEnd(
                createCombatant(),
                createStatusEffects({ vulnerable: 1, weak: 1, frail: 1 }),
                'player',
            );

            expect(result.statusEffects).toMatchObject({
                vulnerable: 0,
                weak: 0,
                frail: 0,
            });
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
                {
                    type: STATUS_EVENT_TYPE.EXPIRE,
                    target: 'player',
                    status: STATUS_EFFECT_TYPE.FRAIL,
                },
            ]);
        });
    });
});
