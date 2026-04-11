// ---------------------------------------------------------------------------
// Card Effect Service — 데이터 기반 카드 효과 적용
// ---------------------------------------------------------------------------

import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    type Card,
    type CardBuffEffect,
    type CardStatusEffect,
} from '../entities/Card';
import { StatusEffectService, type StatusEffectState } from './StatusEffectService';

export const BATTLE_ACTION_SCRIPT_TYPE = {
    DAMAGE: 'Damage',
    HEAL: 'Heal',
    GAIN_BLOCK: 'GainBlock',
    APPLY_STATUS: 'ApplyStatus',
    REMOVE_STATUS: 'RemoveStatus',
    DRAW: 'Draw',
    DISCARD: 'Discard',
    GAIN_ENERGY: 'GainEnergy',
    CREATE_CARD: 'CreateCard',
    EXHAUST: 'Exhaust',
    FLEE: 'Flee',
    SELF_DAMAGE: 'SelfDamage',
    APPLY_BUFF: 'ApplyBuff',
    DELAY: 'Delay',
    VFX_CUE: 'VFXCue',
    SFX_CUE: 'SFXCue',
} as const;

export type BattleActionScriptType =
    (typeof BATTLE_ACTION_SCRIPT_TYPE)[keyof typeof BATTLE_ACTION_SCRIPT_TYPE];

export type BattleActionScriptStep =
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.DAMAGE;
        readonly amount: number;
        readonly hitIndex?: number;
        readonly hitCount?: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.HEAL;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.GAIN_BLOCK;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.APPLY_STATUS;
        readonly status: CardStatusEffect;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.REMOVE_STATUS;
        readonly statusType: string;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.DRAW;
        readonly count: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.DISCARD;
        readonly count: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.GAIN_ENERGY;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.CREATE_CARD;
        readonly cardName: string;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.EXHAUST;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.FLEE;
        readonly perfectVanish: boolean;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.SELF_DAMAGE;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.APPLY_BUFF;
        readonly buff: CardBuffEffect;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.DELAY;
        readonly durationMs: number;
    }
    | {
        readonly type: typeof BATTLE_ACTION_SCRIPT_TYPE.VFX_CUE | typeof BATTLE_ACTION_SCRIPT_TYPE.SFX_CUE;
        readonly cue: string;
    };

export interface CombatantState {
    readonly health: number;
    readonly maxHealth: number;
    readonly block: number;
}

export interface CardEffectResult {
    readonly targetState: CombatantState;
    readonly userState: CombatantState;
    readonly damageDealt: number;
    readonly damageBlocked: number;
    readonly blockGained: number;
    readonly fled: boolean;
    readonly cardsDrawn: number;
    readonly energyGained: number;
    readonly healthRestored: number;
    readonly healingGained: number;
    readonly discardCount: number;
    readonly selfDamageTaken: number;
    readonly hitsResolved: number;
    readonly hitDamages?: readonly number[];
    readonly perfectVanish?: boolean;
    readonly statusApplied?: CardStatusEffect;
    readonly statusEffectsApplied?: readonly CardStatusEffect[];
    readonly buffApplied?: {
        readonly type: string;
        readonly value: number;
        readonly duration?: number;
        readonly target?: 'SELF' | 'TARGET';
    };
}

export interface CardEffectContext {
    readonly userStatusEffects?: StatusEffectState;
    readonly targetStatusEffects?: StatusEffectState;
    readonly turnDamageTaken?: number;
    readonly enemyIntentType?: string;
    readonly enemyIntentDamage?: number;
    readonly cardsDiscardedThisTurn?: number;
}

export class CardEffectService {
    private readonly statusEffectService = new StatusEffectService();

    buildActionScript(card: Card): readonly BattleActionScriptStep[] {
        const steps: BattleActionScriptStep[] = [];
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        if (selfDamage > 0) {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.SELF_DAMAGE,
                amount: selfDamage,
            });
        }

        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
            case CARD_EFFECT_TYPE.CONDITIONAL:
                if (card.power > 0 || card.effectPayload?.scaling) {
                    steps.push({
                        type: BATTLE_ACTION_SCRIPT_TYPE.DAMAGE,
                        amount: card.power,
                    });
                }
                break;
            case CARD_EFFECT_TYPE.MULTI_HIT: {
                const hitCount = card.hitCount ?? card.effectPayload?.hitCount ?? 1;
                for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
                    steps.push({
                        type: BATTLE_ACTION_SCRIPT_TYPE.DAMAGE,
                        amount: card.power,
                        hitIndex,
                        hitCount,
                    });
                }
                break;
            }
            case CARD_EFFECT_TYPE.BLOCK:
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.GAIN_BLOCK,
                    amount: card.secondaryPower ?? card.effectPayload?.blockAmount ?? card.power,
                });
                break;
            case CARD_EFFECT_TYPE.DAMAGE_BLOCK:
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.DAMAGE,
                    amount: card.power,
                });
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.GAIN_BLOCK,
                    amount: card.secondaryPower ?? card.effectPayload?.blockAmount ?? 0,
                });
                break;
            case CARD_EFFECT_TYPE.DRAW:
                break;
            case CARD_EFFECT_TYPE.HEAL:
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.HEAL,
                    amount: card.healAmount ?? card.effectPayload?.healAmount ?? 0,
                });
                break;
            case CARD_EFFECT_TYPE.FLEE:
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.FLEE,
                    perfectVanish: card.effectPayload?.perfectVanish === true,
                });
                break;
            case CARD_EFFECT_TYPE.DISCARD_EFFECT:
                steps.push({
                    type: BATTLE_ACTION_SCRIPT_TYPE.DISCARD,
                    count: card.discardCount ?? card.effectPayload?.discardCount ?? 1,
                });
                break;
            case CARD_EFFECT_TYPE.BUFF:
                break;
        }

        const statuses = this.cloneStatusEffects(card);
        statuses?.forEach((status) => {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.APPLY_STATUS,
                status,
            });
        });

        const buff = card.buff ?? card.effectPayload?.buff;
        if (buff) {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.APPLY_BUFF,
                buff: { ...buff },
            });
        }

        const drawCount = card.drawCount ?? card.effectPayload?.drawCount ?? 0;
        if (drawCount > 0) {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.DRAW,
                count: drawCount,
            });
        }

        const energyChange = card.effectPayload?.energyChange ?? 0;
        if (energyChange > 0) {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.GAIN_ENERGY,
                amount: energyChange,
            });
        }

        if (card.keywords.includes(CARD_KEYWORD.EXHAUST)) {
            steps.push({
                type: BATTLE_ACTION_SCRIPT_TYPE.EXHAUST,
            });
        }

        return steps;
    }

    applyEffect(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                return this.applyDamage(card, user, target, context);
            case CARD_EFFECT_TYPE.BLOCK:
                return this.applyBlock(card, user, target);
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                return this.applyStatusEffect(card, user, target);
            case CARD_EFFECT_TYPE.FLEE:
                return this.applyFlee(card, user, target, context);
            case CARD_EFFECT_TYPE.DRAW:
                return this.applyDraw(card, user, target);
            case CARD_EFFECT_TYPE.HEAL:
                return this.applyHeal(card, user, target);
            case CARD_EFFECT_TYPE.MULTI_HIT:
                return this.applyMultiHit(card, user, target, context);
            case CARD_EFFECT_TYPE.DAMAGE_BLOCK:
                return this.applyDamageBlock(card, user, target, context);
            case CARD_EFFECT_TYPE.BUFF:
                return this.applyBuff(card, user, target);
            case CARD_EFFECT_TYPE.DISCARD_EFFECT:
                return this.applyDiscardEffect(card, user, target, context);
            case CARD_EFFECT_TYPE.CONDITIONAL:
                return this.applyConditional(card, user, target, context);
            default:
                return this.noEffect(user, target);
        }
    }

    applyActionScriptStep(
        step: BattleActionScriptStep,
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        switch (step.type) {
            case BATTLE_ACTION_SCRIPT_TYPE.SELF_DAMAGE:
                return {
                    ...this.noEffect(user, target),
                    userState: this.applySelfDamage(user, step.amount),
                    selfDamageTaken: step.amount,
                };
            case BATTLE_ACTION_SCRIPT_TYPE.DAMAGE: {
                if (card.effectType === CARD_EFFECT_TYPE.CONDITIONAL && !this.isConditionMet(card, user, context)) {
                    return this.noEffect(user, target);
                }

                const damageCard = card.effectType === CARD_EFFECT_TYPE.CONDITIONAL
                    ? { ...card, power: card.secondaryPower ?? card.power }
                    : card;
                const resolvedPower = this.resolveDamagePower(damageCard, user, context);
                const damageResult = this.calculateDamageAfterBlock(resolvedPower, target.block);
                const actualDamage = step.hitCount
                    ? Math.min(target.health, damageResult.actualDamage)
                    : damageResult.actualDamage;

                return {
                    ...this.noEffect(user, target),
                    targetState: {
                        ...target,
                        health: Math.max(0, target.health - actualDamage),
                        block: damageResult.remainingBlock,
                    },
                    damageDealt: actualDamage,
                    damageBlocked: damageResult.damageBlocked,
                    hitsResolved: actualDamage > 0 || damageResult.damageBlocked > 0 ? 1 : 0,
                    hitDamages: step.hitCount ? [actualDamage] : undefined,
                };
            }
            case BATTLE_ACTION_SCRIPT_TYPE.GAIN_BLOCK:
                return {
                    ...this.noEffect(user, target),
                    userState: {
                        ...user,
                        block: user.block + step.amount,
                    },
                    blockGained: step.amount,
                };
            case BATTLE_ACTION_SCRIPT_TYPE.APPLY_STATUS:
                return {
                    ...this.noEffect(user, target),
                    statusApplied: { ...step.status },
                    statusEffectsApplied: [{ ...step.status }],
                };
            case BATTLE_ACTION_SCRIPT_TYPE.DRAW:
                return {
                    ...this.noEffect(user, target),
                    cardsDrawn: step.count,
                };
            case BATTLE_ACTION_SCRIPT_TYPE.DISCARD:
                return {
                    ...this.noEffect(user, target),
                    discardCount: step.count,
                };
            case BATTLE_ACTION_SCRIPT_TYPE.GAIN_ENERGY:
                return {
                    ...this.noEffect(user, target),
                    energyGained: step.amount,
                };
            case BATTLE_ACTION_SCRIPT_TYPE.HEAL: {
                const nextHealth = Math.min(user.maxHealth, user.health + step.amount);
                const actualHealing = nextHealth - user.health;

                return {
                    ...this.noEffect(user, target),
                    userState: {
                        ...user,
                        health: nextHealth,
                    },
                    healthRestored: actualHealing,
                    healingGained: actualHealing,
                };
            }
            case BATTLE_ACTION_SCRIPT_TYPE.FLEE:
                return {
                    ...this.noEffect(user, target),
                    fled: true,
                    perfectVanish: step.perfectVanish
                        || (
                            card.effectPayload?.perfectVanishAfterDiscard === true
                            && (context?.cardsDiscardedThisTurn ?? 0) > 0
                        ),
                };
            case BATTLE_ACTION_SCRIPT_TYPE.APPLY_BUFF:
                return {
                    ...this.noEffect(user, target),
                    buffApplied: { ...step.buff },
                };
            case BATTLE_ACTION_SCRIPT_TYPE.EXHAUST:
            case BATTLE_ACTION_SCRIPT_TYPE.REMOVE_STATUS:
            case BATTLE_ACTION_SCRIPT_TYPE.CREATE_CARD:
            case BATTLE_ACTION_SCRIPT_TYPE.DELAY:
            case BATTLE_ACTION_SCRIPT_TYPE.VFX_CUE:
            case BATTLE_ACTION_SCRIPT_TYPE.SFX_CUE:
                return this.noEffect(user, target);
        }
    }

    applyDamage(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        const resolvedPower = this.resolveDamagePower(card, user, context);
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        const { actualDamage, remainingBlock, damageBlocked } = this.calculateDamageAfterBlock(
            resolvedPower,
            target.block,
        );

        return {
            targetState: {
                ...target,
                health: Math.max(0, target.health - actualDamage),
                block: remainingBlock,
            },
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt: actualDamage,
            damageBlocked,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: actualDamage > 0 ? 1 : 0,
            statusApplied: card.statusEffect ? { ...card.statusEffect } : undefined,
            statusEffectsApplied: this.cloneStatusEffects(card),
            buffApplied: card.buff
                ? { ...card.buff }
                : card.effectPayload?.buff
                    ? { ...card.effectPayload.buff }
                    : undefined,
        };
    }

    applyBlock(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        const userAfterSelfDamage = this.applySelfDamage(user, selfDamage);
        const blockAmount = card.secondaryPower ?? card.effectPayload?.blockAmount ?? card.power;
        const cardsDrawn = card.drawCount ?? card.effectPayload?.drawCount ?? 0;

        return {
            targetState: target,
            userState: { ...userAfterSelfDamage, block: userAfterSelfDamage.block + blockAmount },
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: blockAmount,
            fled: false,
            cardsDrawn,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: 0,
            statusApplied: card.statusEffect ? { ...card.statusEffect } : undefined,
            statusEffectsApplied: this.cloneStatusEffects(card),
            buffApplied: card.buff
                ? { ...card.buff }
                : card.effectPayload?.buff
                    ? { ...card.effectPayload.buff }
                    : undefined,
        };
    }

    applyStatusEffect(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        return {
            targetState: target,
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: card.drawCount ?? card.effectPayload?.drawCount ?? 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: 0,
            statusApplied: card.statusEffect ? { ...card.statusEffect } : undefined,
            statusEffectsApplied: this.cloneStatusEffects(card),
            buffApplied: card.buff
                ? { ...card.buff }
                : card.effectPayload?.buff
                    ? { ...card.effectPayload.buff }
                    : undefined,
        };
    }

    applyFlee(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        const perfectVanish = card.effectPayload?.perfectVanish === true
            || (
                card.effectPayload?.perfectVanishAfterDiscard === true
                && (context?.cardsDiscardedThisTurn ?? 0) > 0
            );

        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: true,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: 0,
            perfectVanish,
        };
    }

    applyDraw(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        return {
            targetState: target,
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: card.drawCount ?? card.effectPayload?.drawCount ?? 0,
            energyGained: card.effectPayload?.energyChange ?? 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: 0,
        };
    }

    applyHeal(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const healAmount = card.healAmount ?? card.effectPayload?.healAmount ?? 0;
        const nextHealth = Math.min(user.maxHealth, user.health + healAmount);
        const actualHealing = nextHealth - user.health;

        return {
            targetState: target,
            userState: { ...user, health: nextHealth },
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: actualHealing,
            healingGained: actualHealing,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: 0,
        };
    }

    applyMultiHit(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        const hitCount = card.hitCount ?? card.effectPayload?.hitCount ?? 1;
        const resolvedPower = this.resolveDamagePower(card, user, context);
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        let currentTarget = target;
        let damageDealt = 0;
        let damageBlocked = 0;
        let hitsResolved = 0;
        const hitDamages: number[] = [];

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            const damageResult = this.calculateDamageAfterBlock(resolvedPower, currentTarget.block);
            const actualDamage = Math.min(currentTarget.health, damageResult.actualDamage);
            currentTarget = {
                ...currentTarget,
                health: Math.max(0, currentTarget.health - actualDamage),
                block: damageResult.remainingBlock,
            };
            damageDealt += actualDamage;
            damageBlocked += damageResult.damageBlocked;
            hitsResolved += 1;
            hitDamages.push(actualDamage);

            if (currentTarget.health <= 0) {
                break;
            }
        }

        return {
            targetState: currentTarget,
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt,
            damageBlocked,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved,
            hitDamages,
        };
    }

    applyDamageBlock(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        const resolvedPower = this.resolveDamagePower(card, user, context);
        const damageResult = this.calculateDamageAfterBlock(resolvedPower, target.block);
        const blockGained = card.secondaryPower ?? card.effectPayload?.blockAmount ?? 0;
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        const userAfterSelfDamage = this.applySelfDamage(user, selfDamage);

        return {
            targetState: {
                ...target,
                health: Math.max(0, target.health - damageResult.actualDamage),
                block: damageResult.remainingBlock,
            },
            userState: { ...userAfterSelfDamage, block: userAfterSelfDamage.block + blockGained },
            damageDealt: damageResult.actualDamage,
            damageBlocked: damageResult.damageBlocked,
            blockGained,
            fled: false,
            cardsDrawn: card.drawCount ?? card.effectPayload?.drawCount ?? 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: damageResult.actualDamage > 0 ? 1 : 0,
            statusApplied: card.statusEffect ? { ...card.statusEffect } : undefined,
            statusEffectsApplied: this.cloneStatusEffects(card),
        };
    }

    applyBuff(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        return {
            targetState: target,
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: card.drawCount ?? card.effectPayload?.drawCount ?? 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: selfDamage,
            hitsResolved: 0,
            buffApplied: card.buff
                ? { ...card.buff }
                : card.effectPayload?.buff
                    ? { ...card.effectPayload.buff }
                    : undefined,
        };
    }

    applyDiscardEffect(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        const selfDamage = card.selfDamage ?? card.effectPayload?.selfDamage ?? 0;
        const damageResult = this.calculateDamageAfterBlock(
            this.resolveDamagePower(card, user, context),
            target.block,
        );

        return {
            targetState: {
                ...target,
                health: Math.max(0, target.health - damageResult.actualDamage),
                block: damageResult.remainingBlock,
            },
            userState: this.applySelfDamage(user, selfDamage),
            damageDealt: damageResult.actualDamage,
            damageBlocked: damageResult.damageBlocked,
            blockGained: 0,
            fled: false,
            cardsDrawn: card.drawCount ?? card.effectPayload?.drawCount ?? 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: card.discardCount ?? card.effectPayload?.discardCount ?? 1,
            selfDamageTaken: selfDamage,
            hitsResolved: damageResult.actualDamage > 0 ? 1 : 0,
        };
    }

    applyConditional(
        card: Card,
        user: CombatantState,
        target: CombatantState,
        context?: CardEffectContext,
    ): CardEffectResult {
        if (!this.isConditionMet(card, user, context)) {
            return this.noEffect(user, target);
        }

        const conditionalCard: Card = {
            ...card,
            power: card.secondaryPower ?? card.power,
        };
        return this.applyDamage(conditionalCard, user, target, context);
    }

    resetBlock(state: CombatantState): CombatantState {
        if (state.block === 0) {
            return state;
        }
        return { ...state, block: 0 };
    }

    private cloneStatusEffects(card: Card): readonly CardStatusEffect[] | undefined {
        if (card.statusEffects && card.statusEffects.length > 0) {
            return card.statusEffects.map((statusEffect) => ({ ...statusEffect }));
        }

        if (card.statusEffect) {
            return [{ ...card.statusEffect }];
        }

        return undefined;
    }

    private isConditionMet(
        card: Card,
        user: CombatantState,
        context?: CardEffectContext,
    ): boolean {
        if (!card.condition) {
            return true;
        }

        if (card.condition.type === 'HP_THRESHOLD') {
            return user.health <= card.condition.value;
        }

        if (card.condition.type === 'HP_PERCENT_THRESHOLD') {
            if (user.maxHealth <= 0) {
                return false;
            }

            return (user.health / user.maxHealth) * 100 <= card.condition.value;
        }

        if (card.condition.type === 'TURN_DAMAGE_TAKEN_AT_LEAST') {
            return (context?.turnDamageTaken ?? 0) >= card.condition.value;
        }

        if (card.condition.type === 'COUNTER_WINDOW_READY') {
            return (context?.turnDamageTaken ?? 0) >= card.condition.value
                || (
                    context?.enemyIntentType === 'attack'
                    && (context.enemyIntentDamage ?? 0) > 0
                    && user.block >= card.condition.value
                );
        }

        if (card.condition.type === 'TARGET_DEBUFF_COUNT_AT_LEAST') {
            return this.countTargetDebuffs(context?.targetStatusEffects) >= card.condition.value;
        }

        return true;
    }

    private resolveDamagePower(
        card: Card,
        user: CombatantState,
        context?: CardEffectContext,
    ): number {
        const basePower = this.resolveScaledPower(card, user, context);
        if (!context?.userStatusEffects || !context?.targetStatusEffects) {
            return basePower;
        }

        return this.statusEffectService.calculateDamage(
            basePower,
            context.userStatusEffects,
            context.targetStatusEffects,
        );
    }

    private resolveScaledPower(
        card: Card,
        user: CombatantState,
        context?: CardEffectContext,
    ): number {
        const scaling = card.effectPayload?.scaling;
        if (!scaling) {
            return card.power;
        }

        const baseValue = scaling.baseValue ?? 0;
        switch (scaling.source) {
            case 'MISSING_HEALTH':
                return Math.max(0, Math.floor(baseValue + ((user.maxHealth - user.health) * scaling.multiplier)));
            case 'USER_BLOCK':
                return Math.max(0, Math.floor(baseValue + (user.block * scaling.multiplier)));
            case 'TARGET_DEBUFF_COUNT':
                return Math.max(
                    0,
                    Math.floor(baseValue + (this.countTargetDebuffs(context?.targetStatusEffects) * scaling.multiplier)),
                );
            case 'TURN_DAMAGE_TAKEN':
                return Math.max(0, Math.floor(baseValue + ((context?.turnDamageTaken ?? 0) * scaling.multiplier)));
            case 'COUNTER_WINDOW':
                return Math.max(0, Math.floor(baseValue + (this.resolveCounterWindowValue(user, context) * scaling.multiplier)));
            case 'CARDS_DISCARDED_THIS_TURN':
                return Math.max(0, Math.floor(baseValue + ((context?.cardsDiscardedThisTurn ?? 0) * scaling.multiplier)));
            default:
                return card.power;
        }
    }

    private resolveCounterWindowValue(
        user: CombatantState,
        context?: CardEffectContext,
    ): number {
        const turnDamageTaken = context?.turnDamageTaken ?? 0;
        const guardedIntentDamage = context?.enemyIntentType === 'attack'
            ? Math.min(user.block, context.enemyIntentDamage ?? 0)
            : 0;

        return Math.max(turnDamageTaken, guardedIntentDamage);
    }

    private countTargetDebuffs(statusEffects?: StatusEffectState): number {
        if (!statusEffects) {
            return 0;
        }

        return [
            statusEffects.vulnerable,
            statusEffects.weak,
            statusEffects.poison,
            statusEffects.frail,
        ].filter((value) => value > 0).length;
    }

    private calculateDamageAfterBlock(
        damage: number,
        block: number,
    ): { actualDamage: number; remainingBlock: number; damageBlocked: number } {
        if (block >= damage) {
            return {
                actualDamage: 0,
                remainingBlock: block - damage,
                damageBlocked: damage,
            };
        }

        return {
            actualDamage: damage - block,
            remainingBlock: 0,
            damageBlocked: block,
        };
    }

    private applySelfDamage(state: CombatantState, damage: number): CombatantState {
        if (damage <= 0) {
            return state;
        }

        return {
            ...state,
            health: Math.max(0, state.health - damage),
        };
    }

    private noEffect(user: CombatantState, target: CombatantState): CardEffectResult {
        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            energyGained: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: 0,
        };
    }
}
