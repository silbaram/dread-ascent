// ---------------------------------------------------------------------------
// Enemy Intent Service — 적의 다음 행동 의도 결정/조회 로직 (TASK-038)
// ---------------------------------------------------------------------------

import {
    CARD_EFFECT_TYPE,
    CARD_TYPE,
    type Card,
} from '../entities/Card';
import type { Enemy } from '../entities/Enemy';
import {
    ENEMY_INTENT_BALANCE,
    type EnemyIntentProfile,
    type EnemyIntentWeights,
} from './CombatBalance';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENEMY_INTENT_TYPE = {
    ATTACK: 'attack',
    DEFEND: 'defend',
    BUFF: 'buff',
} as const;

export type EnemyIntentType = (typeof ENEMY_INTENT_TYPE)[keyof typeof ENEMY_INTENT_TYPE];

export const ENEMY_INTENT_BUFF_STAT = {
    ATTACK: 'attack',
} as const;

export type EnemyIntentBuffStat = (typeof ENEMY_INTENT_BUFF_STAT)[keyof typeof ENEMY_INTENT_BUFF_STAT];

export const ENEMY_INTENT_PATTERN = {
    STRIKE: 'strike',
    FLURRY: 'flurry',
    GUARD: 'guard',
    RITUAL: 'ritual',
    CHARGE: 'charge',
    CURSE: 'curse',
    CLEANSE: 'cleanse',
    AMBUSH: 'ambush',
} as const;

export type EnemyIntentPattern = (typeof ENEMY_INTENT_PATTERN)[keyof typeof ENEMY_INTENT_PATTERN];

const LOW_HEALTH_THRESHOLD = ENEMY_INTENT_BALANCE.lowHealthThreshold;
const HIGH_HEALTH_THRESHOLD = ENEMY_INTENT_BALANCE.highHealthThreshold;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnemyIntentRandomSource {
    next(): number;
}

export interface StrikeIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.ATTACK;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.STRIKE;
    readonly damage: number;
    readonly label: string;
    readonly sourceCardId?: string;
}

export interface FlurryIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.ATTACK;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.FLURRY;
    readonly damage: number;
    readonly label: string;
    readonly hitCount?: number;
    readonly damagePerHit?: number;
    readonly sourceCardId?: string;
}

export interface ChargeIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.ATTACK;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.CHARGE;
    readonly damage: number;
    readonly label: string;
    readonly warning: string;
    readonly sourceCardId?: string;
}

export interface AmbushIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.ATTACK;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.AMBUSH;
    readonly damage: number;
    readonly label: string;
    readonly warning: string;
    readonly sourceCardId?: string;
}

export type AttackIntent = StrikeIntent | FlurryIntent | ChargeIntent | AmbushIntent;

export interface GuardIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.DEFEND;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.GUARD;
    readonly block: number;
    readonly label: string;
    readonly sourceCardId?: string;
}

export interface CleanseIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.DEFEND;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.CLEANSE;
    readonly block: number;
    readonly label: string;
    readonly cleansedStatuses: readonly string[];
    readonly sourceCardId?: string;
}

export type DefendIntent = GuardIntent | CleanseIntent;

export interface RitualIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.BUFF;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.RITUAL;
    readonly stat: EnemyIntentBuffStat;
    readonly amount: number;
    readonly label: string;
}

export interface CurseIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.BUFF;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.CURSE;
    readonly label: string;
    readonly curseCardName: string;
    readonly curseCount: number;
    readonly sourceCardId?: string;
}

export type BuffIntent = RitualIntent | CurseIntent;

export type EnemyIntent = AttackIntent | DefendIntent | BuffIntent;

export interface DecideEnemyIntentRequest {
    readonly enemy: Enemy;
    readonly enemyCardPool?: readonly Card[];
    readonly floorNumber?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EnemyIntentService {
    private readonly intentByEnemyId = new Map<string, EnemyIntent>();

    constructor(
        private readonly random: EnemyIntentRandomSource = { next: () => Math.random() },
    ) {}

    decideNextIntent(request: DecideEnemyIntentRequest): EnemyIntent {
        const intentType = this.selectIntentType(
            this.resolveWeights(request.enemy, request.floorNumber),
        );
        const intent = this.buildIntent(intentType, request);
        this.intentByEnemyId.set(request.enemy.id, intent);
        return intent;
    }

    getIntent(enemyId: string): EnemyIntent | undefined {
        return this.intentByEnemyId.get(enemyId);
    }

    clearIntent(enemyId: string): void {
        this.intentByEnemyId.delete(enemyId);
    }

    private resolveWeights(
        enemy: Enemy,
        floorNumber: number = 1,
    ): EnemyIntentWeights {
        const profile = this.resolveProfile(enemy);
        let weights = this.applyFloorScaling(
            ENEMY_INTENT_BALANCE.baseWeights[profile],
            ENEMY_INTENT_BALANCE.floorScaling.perBand[profile],
            floorNumber,
        );

        const healthRatio = enemy.stats.maxHealth <= 0
            ? 0
            : enemy.stats.health / enemy.stats.maxHealth;

        if (healthRatio <= LOW_HEALTH_THRESHOLD) {
            weights = this.applyWeightAdjustment(
                weights,
                ENEMY_INTENT_BALANCE.lowHealthAdjustment,
            );
        }

        if (healthRatio >= HIGH_HEALTH_THRESHOLD) {
            weights = {
                ...weights,
                buff: weights.buff + ENEMY_INTENT_BALANCE.highHealthBuffBonus[profile],
            };
        }

        return weights;
    }

    private resolveProfile(enemy: Enemy): EnemyIntentProfile {
        if (enemy.isBoss()) {
            return 'boss';
        }

        return enemy.isElite() ? 'elite' : 'normal';
    }

    private applyFloorScaling(
        baseWeights: EnemyIntentWeights,
        floorScaling: EnemyIntentWeights,
        floorNumber: number,
    ): EnemyIntentWeights {
        const floorBandSize = ENEMY_INTENT_BALANCE.floorScaling.floorBandSize;
        const floorBand = Math.max(0, Math.floor((Math.max(1, floorNumber) - 1) / floorBandSize));

        if (floorBand === 0) {
            return baseWeights;
        }

        return {
            attack: baseWeights.attack + (floorScaling.attack * floorBand),
            defend: baseWeights.defend + (floorScaling.defend * floorBand),
            buff: baseWeights.buff + (floorScaling.buff * floorBand),
        };
    }

    private applyWeightAdjustment(
        baseWeights: EnemyIntentWeights,
        adjustment: EnemyIntentWeights,
    ): EnemyIntentWeights {
        return {
            attack: Math.max(0, baseWeights.attack + adjustment.attack),
            defend: Math.max(0, baseWeights.defend + adjustment.defend),
            buff: Math.max(0, baseWeights.buff + adjustment.buff),
        };
    }

    private selectIntentType(weights: EnemyIntentWeights): EnemyIntentType {
        const totalWeight = weights.attack + weights.defend + weights.buff;
        if (totalWeight <= 0) {
            return ENEMY_INTENT_TYPE.ATTACK;
        }

        const roll = this.random.next() * totalWeight;

        if (roll < weights.attack) {
            return ENEMY_INTENT_TYPE.ATTACK;
        }

        if (roll < weights.attack + weights.defend) {
            return ENEMY_INTENT_TYPE.DEFEND;
        }

        return ENEMY_INTENT_TYPE.BUFF;
    }

    private buildIntent(
        intentType: EnemyIntentType,
        request: DecideEnemyIntentRequest,
    ): EnemyIntent {
        switch (intentType) {
            case ENEMY_INTENT_TYPE.ATTACK:
                return this.buildAttackIntent(request);
            case ENEMY_INTENT_TYPE.DEFEND:
                return this.buildDefendIntent(request);
            case ENEMY_INTENT_TYPE.BUFF:
                return this.buildBuffIntent(request);
        }
    }

    private buildAttackIntent(request: DecideEnemyIntentRequest): AttackIntent {
        const strongestAttackCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => card.effectType === CARD_EFFECT_TYPE.DAMAGE || card.type === CARD_TYPE.ATTACK,
        );

        if (strongestAttackCard) {
            const hitCount = strongestAttackCard.hitCount ?? strongestAttackCard.effectPayload?.hitCount ?? 1;
            const damagePerHit = strongestAttackCard.power;
            if (this.isAmbushIntentCard(strongestAttackCard)) {
                return {
                    type: ENEMY_INTENT_TYPE.ATTACK,
                    pattern: ENEMY_INTENT_PATTERN.AMBUSH,
                    damage: damagePerHit * hitCount,
                    label: strongestAttackCard.name,
                    warning: 'Hidden prep',
                    sourceCardId: strongestAttackCard.id,
                };
            }
            if (this.isChargeIntentCard(strongestAttackCard)) {
                return {
                    type: ENEMY_INTENT_TYPE.ATTACK,
                    pattern: ENEMY_INTENT_PATTERN.CHARGE,
                    damage: damagePerHit * hitCount,
                    label: strongestAttackCard.name,
                    warning: 'Next turn burst',
                    sourceCardId: strongestAttackCard.id,
                };
            }
            return {
                type: ENEMY_INTENT_TYPE.ATTACK,
                pattern: hitCount > 1
                    ? ENEMY_INTENT_PATTERN.FLURRY
                    : ENEMY_INTENT_PATTERN.STRIKE,
                damage: damagePerHit * hitCount,
                label: strongestAttackCard.name,
                hitCount: hitCount > 1 ? hitCount : undefined,
                damagePerHit: hitCount > 1 ? damagePerHit : undefined,
                sourceCardId: strongestAttackCard.id,
            };
        }

        return {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: Math.max(1, request.enemy.stats.attack),
            label: 'Attack',
        };
    }

    private buildDefendIntent(request: DecideEnemyIntentRequest): DefendIntent {
        const strongestDefendCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => card.effectType === CARD_EFFECT_TYPE.BLOCK || card.type === CARD_TYPE.GUARD,
        );

        if (strongestDefendCard) {
            if (this.isCleanseIntentCard(strongestDefendCard)) {
                return {
                    type: ENEMY_INTENT_TYPE.DEFEND,
                    pattern: ENEMY_INTENT_PATTERN.CLEANSE,
                    block: strongestDefendCard.power,
                    label: strongestDefendCard.name,
                    cleansedStatuses: this.inferCleansedStatuses(strongestDefendCard),
                    sourceCardId: strongestDefendCard.id,
                };
            }

            return {
                type: ENEMY_INTENT_TYPE.DEFEND,
                pattern: ENEMY_INTENT_PATTERN.GUARD,
                block: strongestDefendCard.power,
                label: strongestDefendCard.name,
                sourceCardId: strongestDefendCard.id,
            };
        }

        return {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: Math.max(1, request.enemy.stats.defense + 2),
            label: 'Defend',
        };
    }

    private buildBuffIntent(request: DecideEnemyIntentRequest): BuffIntent {
        const curseCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isCurseIntentCard(card),
        );
        if (curseCard) {
            return {
                type: ENEMY_INTENT_TYPE.BUFF,
                pattern: ENEMY_INTENT_PATTERN.CURSE,
                label: curseCard.name,
                curseCardName: this.inferCurseCardName(curseCard),
                curseCount: 1,
                sourceCardId: curseCard.id,
            };
        }

        const profile = this.resolveProfile(request.enemy);

        return {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: ENEMY_INTENT_BUFF_STAT.ATTACK,
            amount: ENEMY_INTENT_BALANCE.buffAmount[profile],
            label: 'Battle Cry',
        };
    }

    private pickStrongestCard(
        cards: readonly Card[] | undefined,
        predicate: (card: Card) => boolean,
    ): Card | undefined {
        return cards
            ?.filter(predicate)
            .reduce<Card | undefined>((strongest, card) => {
                if (!strongest || this.getIntentThreatScore(card) > this.getIntentThreatScore(strongest)) {
                    return card;
                }
                return strongest;
            }, undefined);
    }

    private getIntentThreatScore(card: Card): number {
        const hitCount = card.hitCount ?? card.effectPayload?.hitCount ?? 1;
        return card.power * Math.max(1, hitCount);
    }

    private isChargeIntentCard(card: Card): boolean {
        return /charge|wind[- ]?up|primed/i.test(card.name);
    }

    private isAmbushIntentCard(card: Card): boolean {
        return /ambush|lurk|stalk/i.test(card.name);
    }

    private isCleanseIntentCard(card: Card): boolean {
        return /cleanse|purge|purify/i.test(card.name);
    }

    private isCurseIntentCard(card: Card): boolean {
        return /curse|hex|dread/i.test(card.name);
    }

    private inferCleansedStatuses(card: Card): readonly string[] {
        if (/poison/i.test(card.name)) {
            return ['Poison'];
        }
        if (/frail/i.test(card.name)) {
            return ['Frail'];
        }
        if (/weak/i.test(card.name)) {
            return ['Weak'];
        }
        if (/vulnerable/i.test(card.name)) {
            return ['Vulnerable'];
        }

        return ['Poison'];
    }

    private inferCurseCardName(card: Card): string {
        if (/hex/i.test(card.name)) {
            return 'Hex';
        }

        return 'Dread';
    }
}
