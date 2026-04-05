// ---------------------------------------------------------------------------
// Status Effect Service — 상태이상 적용/계산/턴 종료 도메인 로직
// ---------------------------------------------------------------------------

import { STATUS_EFFECT_BALANCE } from './CombatBalance';

export const STATUS_EFFECT_TYPE = {
    VULNERABLE: 'VULNERABLE',
    WEAK: 'WEAK',
    POISON: 'POISON',
    STRENGTH: 'STRENGTH',
    THORNS: 'THORNS',
    REGENERATION: 'REGENERATION',
    FRAIL: 'FRAIL',
} as const;

export type StatusEffectType = (typeof STATUS_EFFECT_TYPE)[keyof typeof STATUS_EFFECT_TYPE];

export const STATUS_EVENT_TYPE = {
    APPLY: 'STATUS_APPLY',
    EXPIRE: 'STATUS_EXPIRE',
} as const;

export type StatusEventType = (typeof STATUS_EVENT_TYPE)[keyof typeof STATUS_EVENT_TYPE];

export const VULNERABLE_MULTIPLIER = STATUS_EFFECT_BALANCE.vulnerableDamageMultiplier;
export const WEAK_MULTIPLIER = STATUS_EFFECT_BALANCE.weakDamageMultiplier;
export const POISON_DAMAGE_PER_STACK = STATUS_EFFECT_BALANCE.poison.damagePerStack;
export const FRAIL_BLOCK_MULTIPLIER = STATUS_EFFECT_BALANCE.frailBlockMultiplier;

type DurationStatusKey = 'vulnerable' | 'weak' | 'regeneration' | 'frail';
type StackStatusKey = 'poison' | 'strength' | 'thorns';

export interface StatusEffectState {
    readonly vulnerable: number;
    readonly weak: number;
    readonly poison: number;
    readonly strength: number;
    readonly thorns: number;
    readonly regeneration: number;
    readonly frail: number;
}

export interface StatusEffectCombatant {
    readonly health: number;
    readonly maxHealth: number;
    readonly block: number;
}

export type StatusEffectApplication =
    | {
        readonly type: typeof STATUS_EFFECT_TYPE.VULNERABLE
            | typeof STATUS_EFFECT_TYPE.WEAK
            | typeof STATUS_EFFECT_TYPE.REGENERATION
            | typeof STATUS_EFFECT_TYPE.FRAIL;
        readonly duration: number;
        readonly target: string;
    }
    | {
        readonly type: typeof STATUS_EFFECT_TYPE.POISON
            | typeof STATUS_EFFECT_TYPE.STRENGTH
            | typeof STATUS_EFFECT_TYPE.THORNS;
        readonly stacks: number;
        readonly target: string;
    };

export interface StatusApplyEvent {
    readonly type: typeof STATUS_EVENT_TYPE.APPLY;
    readonly target: string;
    readonly status: StatusEffectType;
    readonly value: number;
    readonly duration?: number;
}

export interface StatusExpireEvent {
    readonly type: typeof STATUS_EVENT_TYPE.EXPIRE;
    readonly target: string;
    readonly status: StatusEffectType;
}

export type StatusEffectEvent = StatusApplyEvent | StatusExpireEvent;

export interface StatusEffectUpdateResult {
    readonly statusEffects: StatusEffectState;
    readonly events: readonly StatusEffectEvent[];
}

export interface StatusEffectTurnEndResult extends StatusEffectUpdateResult {
    readonly combatant: StatusEffectCombatant;
    readonly poisonDamage: number;
    readonly regenerationHeal: number;
}

export interface StatusEffectTurnEndOptions {
    readonly poisonDecayOverride?: number;
    readonly regenerationDecayOverride?: number;
}

function normalizeCount(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function decrementCount(value: number, amount: number = STATUS_EFFECT_BALANCE.durationDecayPerTurn): number {
    if (value <= 0) {
        return 0;
    }
    return Math.max(0, value - amount);
}

function getStatusValue(
    state: Partial<StatusEffectState>,
    key: keyof StatusEffectState,
): number {
    return normalizeCount(state[key] ?? 0);
}

function resolveDurationKey(type: DurationStatusKey | StatusEffectType): DurationStatusKey {
    switch (type) {
        case STATUS_EFFECT_TYPE.VULNERABLE:
            return 'vulnerable';
        case STATUS_EFFECT_TYPE.WEAK:
            return 'weak';
        case STATUS_EFFECT_TYPE.REGENERATION:
            return 'regeneration';
        default:
            return 'frail';
    }
}

function resolveStackKey(type: StackStatusKey | StatusEffectType): StackStatusKey {
    switch (type) {
        case STATUS_EFFECT_TYPE.POISON:
            return 'poison';
        case STATUS_EFFECT_TYPE.STRENGTH:
            return 'strength';
        default:
            return 'thorns';
    }
}

export class StatusEffectService {
    createState(): StatusEffectState {
        return {
            vulnerable: 0,
            weak: 0,
            poison: 0,
            strength: 0,
            thorns: 0,
            regeneration: 0,
            frail: 0,
        };
    }

    applyStatusEffect(state: StatusEffectState, effect: StatusEffectApplication): StatusEffectUpdateResult {
        if ('stacks' in effect) {
            const stacks = normalizeCount(effect.stacks);
            if (stacks === 0) {
                return { statusEffects: state, events: [] };
            }

            const key = resolveStackKey(effect.type);
            const nextValue = getStatusValue(state, key) + stacks;
            return {
                statusEffects: {
                    ...state,
                    [key]: nextValue,
                },
                events: [
                    {
                        type: STATUS_EVENT_TYPE.APPLY,
                        target: effect.target,
                        status: effect.type,
                        value: nextValue,
                    },
                ],
            };
        }

        const duration = normalizeCount(effect.duration);
        if (duration === 0) {
            return { statusEffects: state, events: [] };
        }

        const key = resolveDurationKey(effect.type);
        const nextDuration = Math.max(getStatusValue(state, key), duration);
        return {
            statusEffects: {
                ...state,
                [key]: nextDuration,
            },
            events: [
                {
                    type: STATUS_EVENT_TYPE.APPLY,
                    target: effect.target,
                    status: effect.type,
                    value: nextDuration,
                    duration: nextDuration,
                },
            ],
        };
    }

    calculateDamage(
        baseDamage: number,
        attackerStatusEffects: StatusEffectState,
        targetStatusEffects: StatusEffectState,
    ): number {
        let damage = normalizeCount(baseDamage + getStatusValue(attackerStatusEffects, 'strength'));

        if (getStatusValue(attackerStatusEffects, 'weak') > 0) {
            damage = Math.floor(damage * WEAK_MULTIPLIER);
        }

        if (getStatusValue(targetStatusEffects, 'vulnerable') > 0) {
            damage = Math.floor(damage * VULNERABLE_MULTIPLIER);
        }

        return damage;
    }

    calculateBlockGain(baseBlock: number, statusEffects: StatusEffectState): number {
        const block = normalizeCount(baseBlock);
        if (getStatusValue(statusEffects, 'frail') === 0) {
            return block;
        }

        return Math.floor(block * FRAIL_BLOCK_MULTIPLIER);
    }

    getThornsDamage(statusEffects: StatusEffectState): number {
        return getStatusValue(statusEffects, 'thorns');
    }

    processTurnEnd(
        combatant: StatusEffectCombatant,
        statusEffects: StatusEffectState,
        target: string,
        options: StatusEffectTurnEndOptions = {},
    ): StatusEffectTurnEndResult {
        const nextStatusEffects: StatusEffectState = {
            vulnerable: decrementCount(getStatusValue(statusEffects, 'vulnerable')),
            weak: decrementCount(getStatusValue(statusEffects, 'weak')),
            poison: decrementCount(
                getStatusValue(statusEffects, 'poison'),
                options.poisonDecayOverride ?? STATUS_EFFECT_BALANCE.poison.stackDecayPerTurn,
            ),
            strength: getStatusValue(statusEffects, 'strength'),
            thorns: getStatusValue(statusEffects, 'thorns'),
            regeneration: decrementCount(
                getStatusValue(statusEffects, 'regeneration'),
                options.regenerationDecayOverride ?? STATUS_EFFECT_BALANCE.regeneration.stackDecayPerTurn,
            ),
            frail: decrementCount(getStatusValue(statusEffects, 'frail')),
        };

        const events: StatusEffectEvent[] = [];

        if (getStatusValue(statusEffects, 'vulnerable') > 0 && nextStatusEffects.vulnerable === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.VULNERABLE,
            });
        }

        if (getStatusValue(statusEffects, 'weak') > 0 && nextStatusEffects.weak === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.WEAK,
            });
        }

        if (getStatusValue(statusEffects, 'poison') > 0 && nextStatusEffects.poison === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.POISON,
            });
        }

        if (getStatusValue(statusEffects, 'regeneration') > 0 && nextStatusEffects.regeneration === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.REGENERATION,
            });
        }

        if (getStatusValue(statusEffects, 'frail') > 0 && nextStatusEffects.frail === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.FRAIL,
            });
        }

        const poisonDamage = getStatusValue(statusEffects, 'poison') * POISON_DAMAGE_PER_STACK;
        const regenerationHeal = getStatusValue(statusEffects, 'regeneration')
            * STATUS_EFFECT_BALANCE.regeneration.healPerStack;
        const nextHealth = Math.min(
            combatant.maxHealth,
            Math.max(0, combatant.health - poisonDamage) + regenerationHeal,
        );

        return {
            combatant: {
                ...combatant,
                health: nextHealth,
            },
            statusEffects: nextStatusEffects,
            poisonDamage,
            regenerationHeal,
            events,
        };
    }
}
