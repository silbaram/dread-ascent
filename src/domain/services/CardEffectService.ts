// ---------------------------------------------------------------------------
// Card Effect Service — 데이터 기반 카드 효과 적용 (TASK-034)
// ---------------------------------------------------------------------------

import { CARD_EFFECT_TYPE, type Card } from '../entities/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 전투 참여자의 상태. Block, HP 등을 관리한다. */
export interface CombatantState {
    readonly health: number;
    readonly maxHealth: number;
    readonly block: number;
}

/** 카드 효과 적용 결과. */
export interface CardEffectResult {
    /** 효과 적용 후 대상(적) 상태. */
    readonly targetState: CombatantState;
    /** 효과 적용 후 사용자 상태. */
    readonly userState: CombatantState;
    /** 실제 적용된 피해량 (Block 흡수 후). */
    readonly damageDealt: number;
    /** Block에 의해 흡수된 피해량. */
    readonly damageBlocked: number;
    /** 부여된 Block 수치. */
    readonly blockGained: number;
    /** 전투 이탈 여부 (Shadow Step). */
    readonly fled: boolean;
    /** 상태이상 적용 정보. */
    readonly statusApplied?: {
        readonly type: string;
        readonly duration: number;
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 카드 효과를 데이터 기반으로 적용한다.
 * 카드의 effectType에 따라 피해, Block, 상태이상, 도주 등의 효과를 처리한다.
 */
export class CardEffectService {
    /**
     * 카드 효과를 적용한다.
     * @param card - 사용할 카드
     * @param user - 카드를 사용하는 참여자 상태
     * @param target - 효과 대상 참여자 상태
     * @returns 효과 적용 결과
     */
    applyEffect(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        switch (card.effectType) {
            case CARD_EFFECT_TYPE.DAMAGE:
                return this.applyDamage(card, user, target);
            case CARD_EFFECT_TYPE.BLOCK:
                return this.applyBlock(card, user, target);
            case CARD_EFFECT_TYPE.STATUS_EFFECT:
                return this.applyStatusEffect(card, user, target);
            case CARD_EFFECT_TYPE.FLEE:
                return this.applyFlee(user, target);
            default:
                return this.noEffect(user, target);
        }
    }

    /**
     * 대상에게 피해를 가한다. Block이 먼저 차감된다.
     */
    applyDamage(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const baseDamage = card.power;
        const { actualDamage, remainingBlock, damageBlocked } = this.calculateDamageAfterBlock(
            baseDamage,
            target.block,
        );

        const newTargetHealth = Math.max(0, target.health - actualDamage);

        return {
            targetState: { ...target, health: newTargetHealth, block: remainingBlock },
            userState: user,
            damageDealt: actualDamage,
            damageBlocked,
            blockGained: 0,
            fled: false,
        };
    }

    /**
     * 사용자에게 Block을 부여한다.
     */
    applyBlock(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        const blockAmount = card.power;
        const newBlock = user.block + blockAmount;

        return {
            targetState: target,
            userState: { ...user, block: newBlock },
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: blockAmount,
            fled: false,
        };
    }

    /**
     * 대상에게 상태이상을 적용한다.
     */
    applyStatusEffect(card: Card, user: CombatantState, target: CombatantState): CardEffectResult {
        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
            statusApplied: card.statusEffect
                ? { type: card.statusEffect.type, duration: card.statusEffect.duration }
                : undefined,
        };
    }

    /**
     * 전투 이탈 효과를 적용한다.
     */
    applyFlee(user: CombatantState, target: CombatantState): CardEffectResult {
        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: true,
        };
    }

    /**
     * 턴 종료 시 Block을 0으로 초기화한다.
     */
    resetBlock(state: CombatantState): CombatantState {
        if (state.block === 0) {
            return state;
        }
        return { ...state, block: 0 };
    }

    /**
     * 피해에 Block 흡수를 적용한다.
     * Block이 피해보다 크면 남은 Block이 유지되고 피해는 0.
     * Block이 피해보다 작으면 Block은 0이 되고 나머지 피해가 적용.
     */
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

    private noEffect(user: CombatantState, target: CombatantState): CardEffectResult {
        return {
            targetState: target,
            userState: user,
            damageDealt: 0,
            damageBlocked: 0,
            blockGained: 0,
            fled: false,
        };
    }
}
