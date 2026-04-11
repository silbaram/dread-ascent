import type {
    ReactionTriggerLimit,
} from '../../domain/services/ReactionSafetyPolicy';
import { REACTION_TRIGGER_LIMIT } from '../../domain/services/ReactionSafetyPolicy';
import {
    CARD_INSCRIPTION_PAYOFF_WINDOW,
    CARD_INSCRIPTION_TRIGGER,
    type CardInscription,
} from '../../domain/entities/Card';
import {
    BATTLE_EVENT_NAME,
    type BattleActionResolvedPayload,
    type BattleCardZonePayload,
    type BattleDamagePayload,
    type BattleEventRecord,
    type BattleStatusAppliedPayload,
} from './BattleEventBus.ts';

export const BATTLE_REACTION_ACTION_TYPE = {
    TRACK_PLAYER_SELF_DAMAGE: 'TRACK_PLAYER_SELF_DAMAGE',
    PLAYER_HEALTH_LOST: 'PLAYER_HEALTH_LOST',
    SYNC_PLAYER_BREAKPOINT: 'SYNC_PLAYER_BREAKPOINT',
    APPEND_BREAKPOINT_CARD_REACTIONS: 'APPEND_BREAKPOINT_CARD_REACTIONS',
    APPLY_STRENGTH: 'APPLY_STRENGTH',
    APPLY_DREAD_RULE_STRENGTH: 'APPLY_DREAD_RULE_STRENGTH',
    OPEN_CARD_INSCRIPTION_PAYOFF: 'OPEN_CARD_INSCRIPTION_PAYOFF',
    DEAL_REACTION_DAMAGE: 'DEAL_REACTION_DAMAGE',
    TRACE_CARD_ZONE: 'TRACE_CARD_ZONE',
} as const;

type BattleReactionActionType =
    (typeof BATTLE_REACTION_ACTION_TYPE)[keyof typeof BATTLE_REACTION_ACTION_TYPE];

export type BattleReactionAction =
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.TRACK_PLAYER_SELF_DAMAGE;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.PLAYER_HEALTH_LOST;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.SYNC_PLAYER_BREAKPOINT;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.APPEND_BREAKPOINT_CARD_REACTIONS;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.APPLY_STRENGTH;
        readonly actorId: string;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.APPLY_DREAD_RULE_STRENGTH;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.OPEN_CARD_INSCRIPTION_PAYOFF;
        readonly targetId: string;
        readonly sourceCardId: string;
        readonly sourceCardName: string;
        readonly payoffType: CardInscription['payoff']['type'];
        readonly payoffLabel: string;
        readonly amount: number;
        readonly expiresAtTurn: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.DEAL_REACTION_DAMAGE;
        readonly sourceId: string;
        readonly targetId: string;
        readonly actionType: string;
        readonly amount: number;
    }
    | {
        readonly type: typeof BATTLE_REACTION_ACTION_TYPE.TRACE_CARD_ZONE;
        readonly zone: 'retained' | 'exhausted';
        readonly cardId: string;
        readonly cardName: string;
        readonly reason: string;
    };

export interface BattleReactionDefinition {
    readonly id: string;
    readonly sourceId: string;
    readonly triggerLimit: ReactionTriggerLimit;
    readonly allowSelfRetrigger?: boolean;
    readonly actions: readonly BattleReactionAction[];
}

export interface BattleReactionRegistryContext {
    readonly playerActorId: string;
    readonly enemyActorId: string;
    readonly playerStrengthOnHealthLoss: number;
    readonly bloodMoonStrengthGain: number;
    readonly dreadRuleId?: string;
    readonly dreadRuleName?: string;
    readonly inscribedCards: readonly {
        readonly cardId: string;
        readonly cardName: string;
        readonly inscription: CardInscription;
    }[];
    readonly isTargetAlive: (targetId: string) => boolean;
    readonly countTargetDebuffs: (targetId: string) => number;
    readonly getEquipmentReflectDamage: (healthLost: number) => number;
}

interface BattleReactionDraft {
    readonly id: string;
    readonly sourceId: string;
    readonly triggerLimit: ReactionTriggerLimit;
    readonly allowSelfRetrigger?: boolean;
    readonly actions: readonly BattleReactionAction[];
}

const EXPOSING_STATUS_TYPES = new Set(['POISON', 'VULNERABLE', 'WEAK', 'FRAIL']);

function getInscriptionTriggerStatusTypes(inscription: CardInscription): ReadonlySet<string> {
    return new Set(inscription.triggerStatusTypes ?? EXPOSING_STATUS_TYPES);
}

export function resolveBattleReactionDefinitions(
    event: BattleEventRecord,
    context: BattleReactionRegistryContext,
): readonly BattleReactionDefinition[] {
    switch (event.name) {
        case BATTLE_EVENT_NAME.ACTION_RESOLVED:
            return resolveActionResolvedReactions(
                event.payload as BattleActionResolvedPayload,
                context,
            );
        case BATTLE_EVENT_NAME.DAMAGE_TAKEN:
            return resolveDamageTakenReactions(
                event.payload as BattleDamagePayload,
                context,
            );
        case BATTLE_EVENT_NAME.STATUS_APPLIED:
            return resolveStatusAppliedReactions(
                event.payload as BattleStatusAppliedPayload,
                context,
            );
        case BATTLE_EVENT_NAME.RETAINED:
            return [
                createCardZoneTraceReaction(
                    event.payload as BattleCardZonePayload,
                    'retained',
                ),
                ...resolveRetainedReactions(
                    event.payload as BattleCardZonePayload,
                    context,
                ),
            ];
        case BATTLE_EVENT_NAME.EXHAUSTED:
            return [createCardZoneTraceReaction(
                event.payload as BattleCardZonePayload,
                'exhausted',
            )];
        default:
            return [];
    }
}

function resolveActionResolvedReactions(
    payload: BattleActionResolvedPayload,
    context: BattleReactionRegistryContext,
): readonly BattleReactionDefinition[] {
    if (payload.damage <= 0) {
        return [];
    }

    const reactions: BattleReactionDraft[] = [];
    const isPlayerTarget = payload.targetIds.includes(context.playerActorId);
    const isPlayerSelfDamage =
        payload.sourceId === context.playerActorId
        && isPlayerTarget;

    if (isPlayerSelfDamage) {
        reactions.push({
            id: 'player-self-damage',
            sourceId: context.playerActorId,
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
            actions: [{
                type: BATTLE_REACTION_ACTION_TYPE.TRACK_PLAYER_SELF_DAMAGE,
                amount: payload.damage,
            }],
        });

        if (context.bloodMoonStrengthGain > 0 && context.dreadRuleId) {
            reactions.push({
                id: `${context.dreadRuleId}:first-self-damage-strength`,
                sourceId: context.dreadRuleId,
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_TURN,
                actions: [{
                    type: BATTLE_REACTION_ACTION_TYPE.APPLY_DREAD_RULE_STRENGTH,
                    amount: context.bloodMoonStrengthGain,
                }],
            });
        }
    }

    if (isPlayerTarget) {
        const healthLossActions: BattleReactionAction[] = [
            {
                type: BATTLE_REACTION_ACTION_TYPE.PLAYER_HEALTH_LOST,
                amount: payload.damage,
            },
            { type: BATTLE_REACTION_ACTION_TYPE.SYNC_PLAYER_BREAKPOINT },
            { type: BATTLE_REACTION_ACTION_TYPE.APPEND_BREAKPOINT_CARD_REACTIONS },
        ];

        if (context.playerStrengthOnHealthLoss > 0) {
            healthLossActions.push({
                type: BATTLE_REACTION_ACTION_TYPE.APPLY_STRENGTH,
                actorId: context.playerActorId,
                amount: context.playerStrengthOnHealthLoss,
            });
        }

        reactions.push({
            id: 'player-health-loss',
            sourceId: context.playerActorId,
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
            actions: healthLossActions,
        });
    }

    return reactions;
}

function resolveDamageTakenReactions(
    payload: BattleDamagePayload,
    context: BattleReactionRegistryContext,
): readonly BattleReactionDefinition[] {
    if (
        payload.targetId !== context.playerActorId
        || payload.sourceId === context.playerActorId
        || payload.amount <= 0
    ) {
        return [];
    }

    const reflectedDamage = context.getEquipmentReflectDamage(payload.amount);
    if (reflectedDamage <= 0 || !context.isTargetAlive(payload.sourceId)) {
        return [];
    }

    return [{
        id: 'thorn-mail:reflect-damage',
        sourceId: 'thorn-mail',
        triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
        actions: [{
            type: BATTLE_REACTION_ACTION_TYPE.DEAL_REACTION_DAMAGE,
            sourceId: 'thorn-mail',
            targetId: payload.sourceId,
            actionType: 'REACTION_THORNS',
            amount: reflectedDamage,
        }],
    }];
}

function resolveStatusAppliedReactions(
    payload: BattleStatusAppliedPayload,
    context: BattleReactionRegistryContext,
): readonly BattleReactionDefinition[] {
    if (
        payload.targetId === context.playerActorId
        || !context.isTargetAlive(payload.targetId)
    ) {
        return [];
    }

    const targetDebuffCount = context.countTargetDebuffs(payload.targetId);
    const inscribedCard = context.inscribedCards.find((card) =>
        card.inscription.trigger === CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD
        && getInscriptionTriggerStatusTypes(card.inscription).has(payload.statusType)
        && targetDebuffCount >= (card.inscription.targetDebuffThreshold ?? Number.MAX_SAFE_INTEGER),
    );
    if (!inscribedCard) {
        return [];
    }

    return [createCardInscriptionPayoffReaction(
        inscribedCard,
        payload.targetId,
        payload.turnNumber,
    )];
}

function resolveRetainedReactions(
    payload: BattleCardZonePayload,
    context: BattleReactionRegistryContext,
): readonly BattleReactionDefinition[] {
    const inscribedCard = context.inscribedCards.find((card) =>
        card.cardId === payload.cardId
        && card.inscription.trigger === CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
    );

    if (!inscribedCard) {
        return [];
    }

    return [createCardInscriptionPayoffReaction(
        inscribedCard,
        context.playerActorId,
        payload.turnNumber,
    )];
}

function createCardInscriptionPayoffReaction(
    card: BattleReactionRegistryContext['inscribedCards'][number],
    targetId: string,
    turnNumber: number,
): BattleReactionDefinition {
    return {
        id: `card-inscription:${card.inscription.id}:${card.cardId}:${targetId}`,
        sourceId: card.cardId,
        triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
        actions: [{
            type: BATTLE_REACTION_ACTION_TYPE.OPEN_CARD_INSCRIPTION_PAYOFF,
            targetId,
            sourceCardId: card.cardId,
            sourceCardName: card.cardName,
            payoffType: card.inscription.payoff.type,
            payoffLabel: card.inscription.payoff.label,
            amount: card.inscription.payoff.amount,
            expiresAtTurn: resolveCardInscriptionPayoffExpirationTurn(
                turnNumber,
                card.inscription.payoff.window,
            ),
        }],
    };
}

function resolveCardInscriptionPayoffExpirationTurn(
    turnNumber: number,
    window: CardInscription['payoff']['window'],
): number {
    return window === CARD_INSCRIPTION_PAYOFF_WINDOW.NEXT_TURN
        ? turnNumber + 1
        : turnNumber;
}

function createCardZoneTraceReaction(
    payload: BattleCardZonePayload,
    zone: 'retained' | 'exhausted',
): BattleReactionDefinition {
    return {
        id: `card-zone:${zone}`,
        sourceId: payload.cardId,
        triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
        actions: [{
            type: BATTLE_REACTION_ACTION_TYPE.TRACE_CARD_ZONE,
            zone,
            cardId: payload.cardId,
            cardName: payload.cardName,
            reason: payload.reason,
        }],
    };
}

export function isBattleReactionActionType(value: string): value is BattleReactionActionType {
    return Object.values(BATTLE_REACTION_ACTION_TYPE).includes(value as BattleReactionActionType);
}
