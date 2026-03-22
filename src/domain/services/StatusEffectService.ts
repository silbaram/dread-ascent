// ---------------------------------------------------------------------------
// Status Effect Service — 상태이상 적용/계산/턴 종료 도메인 로직 (TASK-036)
// ---------------------------------------------------------------------------

import { STATUS_EFFECT_BALANCE } from './CombatBalance';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STATUS_EFFECT_TYPE = {
    VULNERABLE: 'VULNERABLE',
    WEAK: 'WEAK',
    POISON: 'POISON',
} as const;

export type StatusEffectType = (typeof STATUS_EFFECT_TYPE)[keyof typeof STATUS_EFFECT_TYPE];

export const STATUS_EVENT_TYPE = {
    APPLY: 'STATUS_APPLY',
    EXPIRE: 'STATUS_EXPIRE',
} as const;

export type StatusEventType = (typeof STATUS_EVENT_TYPE)[keyof typeof STATUS_EVENT_TYPE];

export const VULNERABLE_MULTIPLIER = STATUS_EFFECT_BALANCE.vulnerableDamageMultiplier;
export const WEAK_MULTIPLIER = STATUS_EFFECT_BALANCE.weakDamageMultiplier;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusEffectState {
    readonly vulnerable: number;
    readonly weak: number;
    readonly poison: number;
}

export interface StatusEffectCombatant {
    readonly health: number;
    readonly maxHealth: number;
    readonly block: number;
}

export type StatusEffectApplication =
    | {
        readonly type: typeof STATUS_EFFECT_TYPE.VULNERABLE | typeof STATUS_EFFECT_TYPE.WEAK;
        readonly duration: number;
        readonly target: string;
    }
    | {
        readonly type: typeof STATUS_EFFECT_TYPE.POISON;
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCount(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function decrementCount(
    value: number,
    amount: number = STATUS_EFFECT_BALANCE.durationDecayPerTurn,
): number {
    if (value <= 0) {
        return 0;
    }
    return Math.max(0, value - amount);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StatusEffectService {
    createState(): StatusEffectState {
        return {
            vulnerable: 0,
            weak: 0,
            poison: 0,
        };
    }

    applyStatusEffect(
        state: StatusEffectState,
        effect: StatusEffectApplication,
    ): StatusEffectUpdateResult {
        if (effect.type === STATUS_EFFECT_TYPE.POISON) {
            const stacks = normalizeCount(effect.stacks);
            if (stacks === 0) {
                return { statusEffects: state, events: [] };
            }

            const nextPoison = state.poison + stacks;
            return {
                statusEffects: {
                    ...state,
                    poison: nextPoison,
                },
                events: [
                    {
                        type: STATUS_EVENT_TYPE.APPLY,
                        target: effect.target,
                        status: STATUS_EFFECT_TYPE.POISON,
                        value: nextPoison,
                    },
                ],
            };
        }

        const duration = normalizeCount(effect.duration);
        if (duration === 0) {
            return { statusEffects: state, events: [] };
        }

        const key = effect.type === STATUS_EFFECT_TYPE.VULNERABLE ? 'vulnerable' : 'weak';
        const nextDuration = Math.max(state[key], duration);

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
        let damage = normalizeCount(baseDamage);

        if (attackerStatusEffects.weak > 0) {
            damage = Math.floor(damage * WEAK_MULTIPLIER);
        }

        if (targetStatusEffects.vulnerable > 0) {
            damage = Math.floor(damage * VULNERABLE_MULTIPLIER);
        }

        return damage;
    }

    processTurnEnd(
        combatant: StatusEffectCombatant,
        statusEffects: StatusEffectState,
        target: string,
    ): StatusEffectTurnEndResult {
        const nextStatusEffects: StatusEffectState = {
            vulnerable: decrementCount(statusEffects.vulnerable),
            weak: decrementCount(statusEffects.weak),
            poison: decrementCount(
                statusEffects.poison,
                STATUS_EFFECT_BALANCE.poison.stackDecayPerTurn,
            ),
        };

        const events: StatusEffectEvent[] = [];

        if (statusEffects.vulnerable > 0 && nextStatusEffects.vulnerable === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.VULNERABLE,
            });
        }

        if (statusEffects.weak > 0 && nextStatusEffects.weak === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.WEAK,
            });
        }

        if (statusEffects.poison > 0 && nextStatusEffects.poison === 0) {
            events.push({
                type: STATUS_EVENT_TYPE.EXPIRE,
                target,
                status: STATUS_EFFECT_TYPE.POISON,
            });
        }

        const poisonDamage = statusEffects.poison * STATUS_EFFECT_BALANCE.poison.damagePerStack;
        if (poisonDamage === 0) {
            return {
                combatant,
                statusEffects: nextStatusEffects.vulnerable === statusEffects.vulnerable
                    && nextStatusEffects.weak === statusEffects.weak
                    && nextStatusEffects.poison === statusEffects.poison
                    ? statusEffects
                    : nextStatusEffects,
                poisonDamage,
                events,
            };
        }

        return {
            combatant: {
                ...combatant,
                health: Math.max(0, combatant.health - poisonDamage),
            },
            statusEffects: nextStatusEffects,
            poisonDamage,
            events,
        };
    }
}
