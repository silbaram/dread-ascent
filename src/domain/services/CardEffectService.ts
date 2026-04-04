// ---------------------------------------------------------------------------
// Card Effect Service — 데이터 기반 카드 효과 적용
// ---------------------------------------------------------------------------

import { CARD_EFFECT_TYPE, type Card, type CardStatusEffect } from '../entities/Card';
import { StatusEffectService, type StatusEffectState } from './StatusEffectService';

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
    readonly healthRestored: number;
    readonly healingGained: number;
    readonly discardCount: number;
    readonly selfDamageTaken: number;
    readonly hitsResolved: number;
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
}

export class CardEffectService {
    private readonly statusEffectService = new StatusEffectService();

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
                return this.applyFlee(user, target);
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

    applyFlee(user: CombatantState, target: CombatantState): CardEffectResult {
        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: true,
            cardsDrawn: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: 0,
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
        let currentTarget = target;
        let damageDealt = 0;
        let damageBlocked = 0;

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            const damageResult = this.calculateDamageAfterBlock(resolvedPower, currentTarget.block);
            currentTarget = {
                ...currentTarget,
                health: Math.max(0, currentTarget.health - damageResult.actualDamage),
                block: damageResult.remainingBlock,
            };
            damageDealt += damageResult.actualDamage;
            damageBlocked += damageResult.damageBlocked;
        }

        return {
            targetState: currentTarget,
            userState: user,
            damageDealt,
            damageBlocked,
            blockGained: 0,
            fled: false,
            cardsDrawn: 0,
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: hitCount,
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

        if (card.condition.type === 'TURN_DAMAGE_TAKEN_AT_LEAST') {
            return (context?.turnDamageTaken ?? 0) >= card.condition.value;
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

        switch (scaling.source) {
            case 'MISSING_HEALTH':
                return Math.max(0, (user.maxHealth - user.health) * scaling.multiplier);
            case 'USER_BLOCK':
                return Math.max(0, user.block * scaling.multiplier);
            case 'TARGET_DEBUFF_COUNT':
                return Math.max(0, this.countTargetDebuffs(context?.targetStatusEffects) * scaling.multiplier);
            case 'TURN_DAMAGE_TAKEN':
                return Math.max(0, (context?.turnDamageTaken ?? 0) * scaling.multiplier);
            default:
                return card.power;
        }
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
            healthRestored: 0,
            healingGained: 0,
            discardCount: 0,
            selfDamageTaken: 0,
            hitsResolved: 0,
        };
    }
}
