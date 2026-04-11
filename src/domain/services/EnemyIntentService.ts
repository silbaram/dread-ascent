// ---------------------------------------------------------------------------
// Enemy Intent Service — 적의 다음 행동 의도 결정/조회 로직 (TASK-030)
// ---------------------------------------------------------------------------

import {
    CARD_EFFECT_TYPE,
    CARD_TYPE,
    type Card,
} from '../entities/Card';
import type { Enemy, EnemyArchetypeId } from '../entities/Enemy';
import {
    ENEMY_INTENT_BALANCE,
    type EnemyIntentProfile,
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

export const ENEMY_INTENT_CHARGE_PHASE = {
    WARNING: 'warning',
    BURST: 'burst',
} as const;

export type EnemyIntentChargePhase =
    (typeof ENEMY_INTENT_CHARGE_PHASE)[keyof typeof ENEMY_INTENT_CHARGE_PHASE];

export const ENEMY_INTENT_AMBUSH_REVEAL_RULE = {
    FULL: 'full',
    PARTIAL: 'partial',
    HIDDEN: 'hidden',
} as const;

export type EnemyIntentAmbushRevealRule =
    (typeof ENEMY_INTENT_AMBUSH_REVEAL_RULE)[keyof typeof ENEMY_INTENT_AMBUSH_REVEAL_RULE];

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
    readonly chargePhase?: EnemyIntentChargePhase;
    readonly burstDamage?: number;
    readonly sourceCardId?: string;
}

export interface AmbushIntent {
    readonly type: typeof ENEMY_INTENT_TYPE.ATTACK;
    readonly pattern: typeof ENEMY_INTENT_PATTERN.AMBUSH;
    readonly damage: number;
    readonly label: string;
    readonly warning: string;
    readonly revealRule?: EnemyIntentAmbushRevealRule;
    readonly previewDamage?: number;
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

export interface EnemyIntentTimelineStep {
    readonly pattern: EnemyIntentPattern;
    readonly chargePhase?: EnemyIntentChargePhase;
    readonly ambushRevealRule?: EnemyIntentAmbushRevealRule;
}

interface EnemyIntentTimelineDefinition {
    readonly id: string;
    readonly steps: readonly EnemyIntentTimelineStep[];
}

interface EnemyIntentTimelineCursor {
    readonly timelineId: string;
    nextIndex: number;
}

const NORMAL_TIMELINES_BY_ARCHETYPE: Partial<Record<EnemyArchetypeId, readonly EnemyIntentTimelineStep[]>> = {
    'ash-crawler': [
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.RITUAL },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
    ],
    'mire-broodling': [
        { pattern: ENEMY_INTENT_PATTERN.CURSE },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.CLEANSE },
    ],
    'blade-raider': [
        {
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            ambushRevealRule: ENEMY_INTENT_AMBUSH_REVEAL_RULE.PARTIAL,
        },
        {
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
        },
        {
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
        },
    ],
    'dread-sentinel': [
        { pattern: ENEMY_INTENT_PATTERN.GUARD },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.GUARD },
    ],
};

const ELITE_TIMELINES_BY_ARCHETYPE: Partial<Record<EnemyArchetypeId, readonly EnemyIntentTimelineStep[]>> = {
    'ash-crawler': [
        { pattern: ENEMY_INTENT_PATTERN.RITUAL },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.CURSE },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
    ],
    'mire-broodling': [
        { pattern: ENEMY_INTENT_PATTERN.CURSE },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.CLEANSE },
        { pattern: ENEMY_INTENT_PATTERN.CURSE },
    ],
    'blade-raider': [
        {
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            ambushRevealRule: ENEMY_INTENT_AMBUSH_REVEAL_RULE.HIDDEN,
        },
        {
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
        },
        {
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
        },
        { pattern: ENEMY_INTENT_PATTERN.FLURRY },
    ],
    'dread-sentinel': [
        { pattern: ENEMY_INTENT_PATTERN.GUARD },
        { pattern: ENEMY_INTENT_PATTERN.RITUAL },
        { pattern: ENEMY_INTENT_PATTERN.STRIKE },
        { pattern: ENEMY_INTENT_PATTERN.GUARD },
    ],
};

const BOSS_TIMELINE = [
    {
        pattern: ENEMY_INTENT_PATTERN.CHARGE,
        chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
    },
    {
        pattern: ENEMY_INTENT_PATTERN.CHARGE,
        chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
    },
    { pattern: ENEMY_INTENT_PATTERN.FLURRY },
    { pattern: ENEMY_INTENT_PATTERN.CLEANSE },
    { pattern: ENEMY_INTENT_PATTERN.CURSE },
] as const satisfies readonly EnemyIntentTimelineStep[];

const SHOWDOWN_TIMELINE = [
    { pattern: ENEMY_INTENT_PATTERN.CURSE },
    {
        pattern: ENEMY_INTENT_PATTERN.CHARGE,
        chargePhase: ENEMY_INTENT_CHARGE_PHASE.WARNING,
    },
    {
        pattern: ENEMY_INTENT_PATTERN.CHARGE,
        chargePhase: ENEMY_INTENT_CHARGE_PHASE.BURST,
    },
    { pattern: ENEMY_INTENT_PATTERN.FLURRY },
    { pattern: ENEMY_INTENT_PATTERN.GUARD },
] as const satisfies readonly EnemyIntentTimelineStep[];

const DEFAULT_NORMAL_TIMELINE: readonly EnemyIntentTimelineStep[] = [
    { pattern: ENEMY_INTENT_PATTERN.STRIKE },
    { pattern: ENEMY_INTENT_PATTERN.RITUAL },
    { pattern: ENEMY_INTENT_PATTERN.STRIKE },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EnemyIntentService {
    private readonly intentByEnemyId = new Map<string, EnemyIntent>();
    private readonly cursorByEnemyId = new Map<string, EnemyIntentTimelineCursor>();

    constructor(_random: EnemyIntentRandomSource = { next: () => 0 }) {}

    decideNextIntent(request: DecideEnemyIntentRequest): EnemyIntent {
        const timeline = this.resolveTimeline(request.enemy);
        const cursor = this.getTimelineCursor(request.enemy.id, timeline);
        const step = timeline.steps[cursor.nextIndex % timeline.steps.length];
        cursor.nextIndex += 1;
        const intent = this.buildIntentForTimelineStep(step, request);
        this.intentByEnemyId.set(request.enemy.id, intent);
        return intent;
    }

    getIntent(enemyId: string): EnemyIntent | undefined {
        return this.intentByEnemyId.get(enemyId);
    }

    clearIntent(enemyId: string): void {
        this.intentByEnemyId.delete(enemyId);
        this.cursorByEnemyId.delete(enemyId);
    }

    private getTimelineCursor(
        enemyId: string,
        timeline: EnemyIntentTimelineDefinition,
    ): EnemyIntentTimelineCursor {
        const cursor = this.cursorByEnemyId.get(enemyId);
        if (cursor?.timelineId === timeline.id) {
            return cursor;
        }

        const nextCursor = {
            timelineId: timeline.id,
            nextIndex: 0,
        };
        this.cursorByEnemyId.set(enemyId, nextCursor);
        return nextCursor;
    }

    private resolveTimeline(enemy: Enemy): EnemyIntentTimelineDefinition {
        if (this.isShowdownEnemy(enemy)) {
            return {
                id: `${enemy.archetypeId}:showdown`,
                steps: SHOWDOWN_TIMELINE,
            };
        }

        if (enemy.isBoss()) {
            return {
                id: `${enemy.archetypeId}:boss`,
                steps: BOSS_TIMELINE,
            };
        }

        if (enemy.isElite()) {
            return {
                id: `${enemy.archetypeId}:elite`,
                steps: ELITE_TIMELINES_BY_ARCHETYPE[enemy.archetypeId] ?? DEFAULT_NORMAL_TIMELINE,
            };
        }

        return {
            id: `${enemy.archetypeId}:normal`,
            steps: NORMAL_TIMELINES_BY_ARCHETYPE[enemy.archetypeId] ?? DEFAULT_NORMAL_TIMELINE,
        };
    }

    private isShowdownEnemy(enemy: Enemy): boolean {
        return enemy.archetypeId === 'final-boss' && /showdown/i.test(enemy.id);
    }

    private buildIntentForTimelineStep(
        step: EnemyIntentTimelineStep,
        request: DecideEnemyIntentRequest,
    ): EnemyIntent {
        switch (step.pattern) {
            case ENEMY_INTENT_PATTERN.STRIKE:
                return this.buildStrikeIntent(request);
            case ENEMY_INTENT_PATTERN.FLURRY:
                return this.buildFlurryIntent(request);
            case ENEMY_INTENT_PATTERN.GUARD:
                return this.buildGuardIntent(request);
            case ENEMY_INTENT_PATTERN.RITUAL:
                return this.buildRitualIntent(request);
            case ENEMY_INTENT_PATTERN.CHARGE:
                return this.buildChargeIntent(
                    request,
                    step.chargePhase ?? ENEMY_INTENT_CHARGE_PHASE.BURST,
                );
            case ENEMY_INTENT_PATTERN.CURSE:
                return this.buildCurseIntent(request);
            case ENEMY_INTENT_PATTERN.CLEANSE:
                return this.buildCleanseIntent(request);
            case ENEMY_INTENT_PATTERN.AMBUSH:
                return this.buildAmbushIntent(
                    request,
                    step.ambushRevealRule ?? ENEMY_INTENT_AMBUSH_REVEAL_RULE.PARTIAL,
                );
        }
    }

    private buildStrikeIntent(request: DecideEnemyIntentRequest): StrikeIntent {
        const strikeCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card)
                && !this.isChargeIntentCard(card)
                && !this.isAmbushIntentCard(card)
                && this.getHitCount(card) <= 1,
        );

        if (strikeCard) {
            return {
                type: ENEMY_INTENT_TYPE.ATTACK,
                pattern: ENEMY_INTENT_PATTERN.STRIKE,
                damage: Math.max(0, strikeCard.power),
                label: strikeCard.name,
                sourceCardId: strikeCard.id,
            };
        }

        return {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.STRIKE,
            damage: Math.max(1, request.enemy.stats.attack),
            label: 'Attack',
        };
    }

    private buildFlurryIntent(request: DecideEnemyIntentRequest): FlurryIntent {
        const flurryCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card) && this.getHitCount(card) > 1,
        );

        if (flurryCard) {
            const hitCount = this.getHitCount(flurryCard);
            const damagePerHit = Math.max(0, flurryCard.power);
            return {
                type: ENEMY_INTENT_TYPE.ATTACK,
                pattern: ENEMY_INTENT_PATTERN.FLURRY,
                damage: damagePerHit * hitCount,
                hitCount,
                damagePerHit,
                label: flurryCard.name,
                sourceCardId: flurryCard.id,
            };
        }

        const hitCount = 2;
        const damagePerHit = Math.max(1, Math.ceil(request.enemy.stats.attack / hitCount));
        return {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.FLURRY,
            damage: damagePerHit * hitCount,
            hitCount,
            damagePerHit,
            label: 'Flurry',
        };
    }

    private buildChargeIntent(
        request: DecideEnemyIntentRequest,
        phase: EnemyIntentChargePhase,
    ): ChargeIntent {
        const chargeCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card) && this.isChargeIntentCard(card),
        ) ?? this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card),
        );
        const burstDamage = this.resolveCardDamage(chargeCard, request.enemy.stats.attack);
        const isWarning = phase === ENEMY_INTENT_CHARGE_PHASE.WARNING;

        return {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.CHARGE,
            damage: isWarning ? 0 : burstDamage,
            burstDamage,
            label: chargeCard?.name ?? 'Charge',
            warning: isWarning ? 'Burst next turn' : 'Burst released',
            chargePhase: phase,
            sourceCardId: isWarning ? undefined : chargeCard?.id,
        };
    }

    private buildAmbushIntent(
        request: DecideEnemyIntentRequest,
        revealRule: EnemyIntentAmbushRevealRule,
    ): AmbushIntent {
        const ambushCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card) && this.isAmbushIntentCard(card),
        ) ?? this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isAttackCard(card),
        );
        const damage = this.resolveCardDamage(ambushCard, request.enemy.stats.attack);
        const previewDamage = revealRule === ENEMY_INTENT_AMBUSH_REVEAL_RULE.PARTIAL
            ? Math.max(1, Math.ceil(damage / 2))
            : undefined;

        return {
            type: ENEMY_INTENT_TYPE.ATTACK,
            pattern: ENEMY_INTENT_PATTERN.AMBUSH,
            damage,
            label: ambushCard?.name ?? 'Ambush',
            warning: revealRule === ENEMY_INTENT_AMBUSH_REVEAL_RULE.HIDDEN
                ? 'Hidden prep'
                : 'Partial read',
            revealRule,
            previewDamage,
            sourceCardId: ambushCard?.id,
        };
    }

    private buildGuardIntent(request: DecideEnemyIntentRequest): GuardIntent {
        const guardCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isDefendCard(card)
                && !this.isCleanseIntentCard(card)
                && this.isThornsIntentCard(card),
        ) ?? this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isDefendCard(card) && !this.isCleanseIntentCard(card),
        ) ?? this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isDefendCard(card),
        );

        if (guardCard) {
            return {
                type: ENEMY_INTENT_TYPE.DEFEND,
                pattern: ENEMY_INTENT_PATTERN.GUARD,
                block: Math.max(0, guardCard.power),
                label: guardCard.name,
                sourceCardId: guardCard.id,
            };
        }

        return {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.GUARD,
            block: Math.max(1, request.enemy.stats.defense + 2),
            label: 'Defend',
        };
    }

    private buildCleanseIntent(request: DecideEnemyIntentRequest): CleanseIntent {
        const cleanseCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isDefendCard(card) && this.isCleanseIntentCard(card),
        ) ?? this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isDefendCard(card),
        );

        if (cleanseCard) {
            return {
                type: ENEMY_INTENT_TYPE.DEFEND,
                pattern: ENEMY_INTENT_PATTERN.CLEANSE,
                block: Math.max(0, cleanseCard.power),
                label: cleanseCard.name,
                cleansedStatuses: this.inferCleansedStatuses(cleanseCard),
                sourceCardId: cleanseCard.id,
            };
        }

        return {
            type: ENEMY_INTENT_TYPE.DEFEND,
            pattern: ENEMY_INTENT_PATTERN.CLEANSE,
            block: Math.max(1, request.enemy.stats.defense + 2),
            label: 'Cleanse',
            cleansedStatuses: ['Poison'],
        };
    }

    private buildRitualIntent(request: DecideEnemyIntentRequest): RitualIntent {
        const ritualCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isRitualIntentCard(card),
        );
        const profile = this.resolveProfile(request.enemy);

        return {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.RITUAL,
            stat: ENEMY_INTENT_BUFF_STAT.ATTACK,
            amount: ENEMY_INTENT_BALANCE.buffAmount[profile],
            label: ritualCard?.name ?? 'Battle Cry',
        };
    }

    private buildCurseIntent(request: DecideEnemyIntentRequest): CurseIntent {
        const curseCard = this.pickStrongestCard(
            request.enemyCardPool,
            (card) => this.isCurseIntentCard(card),
        );

        return {
            type: ENEMY_INTENT_TYPE.BUFF,
            pattern: ENEMY_INTENT_PATTERN.CURSE,
            label: curseCard?.name ?? 'Dread Curse',
            curseCardName: curseCard ? this.inferCurseCardName(curseCard) : 'Dread',
            curseCount: 1,
            sourceCardId: curseCard?.id,
        };
    }

    private resolveProfile(enemy: Enemy): EnemyIntentProfile {
        if (enemy.isBoss()) {
            return 'boss';
        }

        return enemy.isElite() ? 'elite' : 'normal';
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

    private resolveCardDamage(card: Card | undefined, fallbackDamage: number): number {
        if (!card) {
            return Math.max(1, fallbackDamage);
        }

        return Math.max(0, card.power) * this.getHitCount(card);
    }

    private getIntentThreatScore(card: Card): number {
        return Math.max(0, card.power) * this.getHitCount(card);
    }

    private getHitCount(card: Card): number {
        return Math.max(1, card.hitCount ?? card.effectPayload?.hitCount ?? 1);
    }

    private isAttackCard(card: Card): boolean {
        return card.effectType === CARD_EFFECT_TYPE.DAMAGE
            || card.effectType === CARD_EFFECT_TYPE.MULTI_HIT
            || card.type === CARD_TYPE.ATTACK;
    }

    private isDefendCard(card: Card): boolean {
        return card.effectType === CARD_EFFECT_TYPE.BLOCK
            || card.type === CARD_TYPE.GUARD;
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

    private isRitualIntentCard(card: Card): boolean {
        return /ritual|battle cry/i.test(card.name)
            && !this.isCurseIntentCard(card);
    }

    private isThornsIntentCard(card: Card): boolean {
        return /thorn/i.test(card.name)
            || card.buff?.type === 'THORNS'
            || card.effectPayload?.buff?.type === 'THORNS';
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
