import { beforeEach, describe, expect, it } from 'vitest';
import {
    CardEffectService,
    type CombatantState,
} from '../../../../src/domain/services/CardEffectService';
import {
    StatusEffectService,
    type StatusEffectState,
} from '../../../../src/domain/services/StatusEffectService';
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

    function makeStatusEffects(overrides?: Partial<StatusEffectState>): StatusEffectState {
        return {
            ...new StatusEffectService().createState(),
            ...overrides,
        };
    }

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

        it('can apply self-damage and bonus draw from effect payload', () => {
            const card = createCard({
                name: 'Blood Price',
                type: CARD_TYPE.SKILL,
                power: 0,
                effectType: CARD_EFFECT_TYPE.DRAW,
                effectPayload: {
                    drawCount: 2,
                    selfDamage: 4,
                },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.userState.health).toBe(96);
            expect(result.selfDamageTaken).toBe(4);
            expect(result.cardsDrawn).toBe(2);
        });

        it('preserves attached status effects on damage cards', () => {
            const card = createCard({
                name: 'Crippling Blow',
                type: CARD_TYPE.ATTACK,
                power: 8,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                statusEffects: [
                    { type: 'WEAK', duration: 1 },
                    { type: 'FRAIL', duration: 1 },
                ],
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.damageDealt).toBe(8);
            expect(result.statusApplied).toEqual({ type: 'WEAK', duration: 1 });
            expect(result.statusEffectsApplied).toEqual([
                { type: 'WEAK', duration: 1 },
                { type: 'FRAIL', duration: 1 },
            ]);
        });
    });

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

        it('can attach a status effect to a guard card', () => {
            const card = createCard({
                name: 'Smoke Screen',
                type: CARD_TYPE.GUARD,
                power: 4,
                effectType: CARD_EFFECT_TYPE.BLOCK,
                statusEffect: { type: 'WEAK', duration: 1 },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.userState.block).toBe(4);
            expect(result.statusApplied).toEqual({ type: 'WEAK', duration: 1 });
        });

        it('reports guard-card buff metadata for ongoing block effects', () => {
            const card = createCard({
                name: 'Brace',
                type: CARD_TYPE.GUARD,
                power: 4,
                effectType: CARD_EFFECT_TYPE.BLOCK,
                buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.blockGained).toBe(4);
            expect(result.buffApplied).toEqual({ type: 'BLOCK_PERSIST', value: 1, target: 'SELF' });
        });

        it('preserves status metadata for damage cards', () => {
            const card = createCard({
                name: 'Crippling Blow',
                type: CARD_TYPE.ATTACK,
                power: 8,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                statusEffects: [
                    { type: 'WEAK', duration: 1 },
                    { type: 'FRAIL', duration: 1 },
                ],
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.damageDealt).toBe(8);
            expect(result.statusApplied).toEqual({ type: 'WEAK', duration: 1 });
            expect(result.statusEffectsApplied).toEqual([
                { type: 'WEAK', duration: 1 },
                { type: 'FRAIL', duration: 1 },
            ]);
        });
    });

    describe('extended effect families', () => {
        it('heals the user up to max health', () => {
            const card = createCard({
                name: 'Second Wind',
                type: CARD_TYPE.SKILL,
                power: 0,
                effectType: CARD_EFFECT_TYPE.HEAL,
                effectPayload: { healAmount: 6 },
            });

            const result = service.applyEffect(card, makePlayer({ health: 92 }), makeEnemy());

            expect(result.userState.health).toBe(98);
            expect(result.healthRestored).toBe(6);
        });

        it('applies repeated hits through target block', () => {
            const card = createCard({
                name: 'Flurry',
                type: CARD_TYPE.ATTACK,
                power: 3,
                effectType: CARD_EFFECT_TYPE.MULTI_HIT,
                effectPayload: { hitCount: 3 },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy({ block: 4 }));

            expect(result.damageBlocked).toBe(4);
            expect(result.damageDealt).toBe(5);
            expect(result.targetState.health).toBe(45);
        });

        it('combines damage and block in one result', () => {
            const card = createCard({
                name: 'Guard Breaker',
                type: CARD_TYPE.ATTACK,
                power: 6,
                effectType: CARD_EFFECT_TYPE.DAMAGE_BLOCK,
                effectPayload: { blockAmount: 4 },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy({ block: 2 }));

            expect(result.damageDealt).toBe(4);
            expect(result.userState.block).toBe(4);
            expect(result.blockGained).toBe(4);
        });

        it('reports buff metadata for power cards', () => {
            const card = createCard({
                name: 'Crimson Pact',
                type: CARD_TYPE.POWER,
                power: 0,
                effectType: CARD_EFFECT_TYPE.BUFF,
                effectPayload: {
                    selfDamage: 3,
                    buff: { type: 'STRENGTH', value: 1, target: 'SELF' },
                },
            });

            const result = service.applyEffect(card, makePlayer(), makeEnemy());

            expect(result.userState.health).toBe(97);
            expect(result.buffApplied).toEqual({ type: 'STRENGTH', value: 1, target: 'SELF' });
        });

        it('resolves conditional effects when the condition is met', () => {
            const card = createCard({
                name: 'Last Stand',
                type: CARD_TYPE.ATTACK,
                power: 30,
                effectType: CARD_EFFECT_TYPE.CONDITIONAL,
                condition: { type: 'HP_THRESHOLD', value: 5 },
                keywords: [CARD_KEYWORD.RETAIN],
            });

            const met = service.applyEffect(card, makePlayer({ health: 5 }), makeEnemy());
            const missed = service.applyEffect(card, makePlayer({ health: 6 }), makeEnemy());

            expect(met.damageDealt).toBe(30);
            expect(missed.damageDealt).toBe(0);
        });

        it('scales missing-health attacks before damage resolution', () => {
            const card = createCard({
                name: 'Death Wish',
                type: CARD_TYPE.ATTACK,
                power: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                effectPayload: {
                    scaling: { source: 'MISSING_HEALTH', multiplier: 1 },
                },
            });

            const result = service.applyEffect(
                card,
                makePlayer({ health: 83, maxHealth: 100 }),
                makeEnemy(),
            );

            expect(result.damageDealt).toBe(17);
            expect(result.targetState.health).toBe(33);
        });

        it('scales user-block attacks and target-debuff attacks from the combat context', () => {
            const shieldBash = createCard({
                name: 'Shield Bash',
                type: CARD_TYPE.ATTACK,
                power: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                effectPayload: {
                    scaling: { source: 'USER_BLOCK', multiplier: 1 },
                },
            });
            const exploitWeakness = createCard({
                name: 'Exploit Weakness',
                type: CARD_TYPE.ATTACK,
                power: 0,
                effectType: CARD_EFFECT_TYPE.DAMAGE,
                effectPayload: {
                    scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
                },
            });

            const shieldResult = service.applyEffect(
                shieldBash,
                makePlayer({ block: 7 }),
                makeEnemy(),
            );
            const exploitResult = service.applyEffect(
                exploitWeakness,
                makePlayer(),
                makeEnemy(),
                {
                    userStatusEffects: makeStatusEffects(),
                    targetStatusEffects: makeStatusEffects({ vulnerable: 1, poison: 3 }),
                },
            );

            expect(shieldResult.damageDealt).toBe(7);
            expect(exploitResult.damageDealt).toBe(12);
        });

        it('gates turn-damage conditionals on the damage taken window', () => {
            const card = createCard({
                name: 'Counter Strike',
                type: CARD_TYPE.ATTACK,
                power: 0,
                effectType: CARD_EFFECT_TYPE.CONDITIONAL,
                condition: { type: 'TURN_DAMAGE_TAKEN_AT_LEAST', value: 1 },
                effectPayload: {
                    scaling: { source: 'TURN_DAMAGE_TAKEN', multiplier: 1 },
                },
            });

            const blocked = service.applyEffect(card, makePlayer(), makeEnemy(), { turnDamageTaken: 0 });
            const resolved = service.applyEffect(card, makePlayer(), makeEnemy(), { turnDamageTaken: 6 });

            expect(blocked.damageDealt).toBe(0);
            expect(resolved.damageDealt).toBe(6);
            expect(resolved.targetState.health).toBe(44);
        });
    });

    describe('resetBlock', () => {
        it('resets block to 0 at turn end', () => {
            const state = makePlayer({ block: 15 });
            const result = service.resetBlock(state);

            expect(result.block).toBe(0);
        });
    });

    describe('FLEE effect', () => {
        it('marks combat as fled', () => {
            const card = createCard({
                name: 'Shadow Step',
                type: CARD_TYPE.SKILL,
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
