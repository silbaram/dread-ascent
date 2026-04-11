import { describe, expect, it } from 'vitest';
import {
    CARD_INSCRIPTION_ID,
    CARD_INSCRIPTION_PAYOFF_TYPE,
    CARD_INSCRIPTION_PAYOFF_WINDOW,
    CARD_INSCRIPTION_TRIGGER,
} from '../../../../src/domain/entities/Card';
import { REACTION_TRIGGER_LIMIT } from '../../../../src/domain/services/ReactionSafetyPolicy';
import {
    BATTLE_EVENT_NAME,
    type BattleEventRecord,
} from '../../../../src/scenes/events/BattleEventBus.ts';
import {
    BATTLE_REACTION_ACTION_TYPE,
    resolveBattleReactionDefinitions,
    type BattleReactionRegistryContext,
} from '../../../../src/scenes/events/BattleReactionRegistry.ts';

function createContext(
    overrides: Partial<BattleReactionRegistryContext> = {},
): BattleReactionRegistryContext {
    return {
        playerActorId: 'player',
        enemyActorId: 'enemy-1',
        playerStrengthOnHealthLoss: 2,
        bloodMoonStrengthGain: 1,
        dreadRuleId: 'blood-moon',
        dreadRuleName: 'Blood Moon',
        inscribedCards: [{
            cardId: 'exploit-weakness',
            cardName: 'Exploit Weakness',
            inscription: {
                id: CARD_INSCRIPTION_ID.SHADOW_EXPOSE,
                label: 'Shadow Mark',
                trigger: CARD_INSCRIPTION_TRIGGER.TARGET_DEBUFF_THRESHOLD,
                targetDebuffThreshold: 2,
                payoff: {
                    type: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                    label: 'Exposed',
                    amount: 8,
                    window: CARD_INSCRIPTION_PAYOFF_WINDOW.CURRENT_TURN,
                },
                exposedDamageBonus: 8,
            },
        }],
        isTargetAlive: () => true,
        countTargetDebuffs: () => 2,
        getEquipmentReflectDamage: () => 0,
        ...overrides,
    };
}

function createActionResolvedEvent(
    overrides: Partial<BattleEventRecord<typeof BATTLE_EVENT_NAME.ACTION_RESOLVED>['payload']> = {},
): BattleEventRecord {
    return {
        name: BATTLE_EVENT_NAME.ACTION_RESOLVED,
        payload: {
            battleId: 'battle:test',
            turnNumber: 1,
            actionType: 'SELF_DAMAGE',
            sourceId: 'player',
            targetIds: ['player'],
            damage: 4,
            block: 0,
            statusDelta: [],
            queueIndex: 0,
            ...overrides,
        },
    };
}

describe('BattleReactionRegistry', () => {
    it('declares self-damage follow-up reactions with source ids and trigger limits', () => {
        const reactions = resolveBattleReactionDefinitions(
            createActionResolvedEvent(),
            createContext(),
        );

        expect(reactions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'player-self-damage',
                sourceId: 'player',
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
                actions: [{
                    type: BATTLE_REACTION_ACTION_TYPE.TRACK_PLAYER_SELF_DAMAGE,
                    amount: 4,
                }],
            }),
            expect.objectContaining({
                id: 'blood-moon:first-self-damage-strength',
                sourceId: 'blood-moon',
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_TURN,
                actions: [{
                    type: BATTLE_REACTION_ACTION_TYPE.APPLY_DREAD_RULE_STRENGTH,
                    amount: 1,
                }],
            }),
            expect.objectContaining({
                id: 'player-health-loss',
                sourceId: 'player',
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
                actions: expect.arrayContaining([{
                    type: BATTLE_REACTION_ACTION_TYPE.APPLY_STRENGTH,
                    actorId: 'player',
                    amount: 2,
                }]),
            }),
        ]));
    });

    it('declares health-loss state and Berserker Rage actions from action resolution', () => {
        const activeReactions = resolveBattleReactionDefinitions(
            createActionResolvedEvent({
                sourceId: 'enemy-1',
                targetIds: ['player'],
                actionType: 'DAMAGE',
            }),
            createContext(),
        );

        expect(activeReactions[0]).toEqual(expect.objectContaining({
            id: 'player-health-loss',
            sourceId: 'player',
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
            actions: expect.arrayContaining([
                {
                    type: BATTLE_REACTION_ACTION_TYPE.PLAYER_HEALTH_LOST,
                    amount: 4,
                },
                {
                    type: BATTLE_REACTION_ACTION_TYPE.APPLY_STRENGTH,
                    actorId: 'player',
                    amount: 2,
                },
            ]),
        }));
    });

    it('declares Thorn Mail as a reaction damage action when reflection is active', () => {
        const reactions = resolveBattleReactionDefinitions(
            {
                name: BATTLE_EVENT_NAME.DAMAGE_TAKEN,
                payload: {
                    battleId: 'battle:test',
                    turnNumber: 1,
                    sourceId: 'enemy-1',
                    targetId: 'player',
                    amount: 5,
                    actionType: 'DAMAGE',
                    queueIndex: 2,
                },
            },
            createContext({ getEquipmentReflectDamage: () => 2 }),
        );

        expect(reactions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'thorn-mail:reflect-damage',
                sourceId: 'thorn-mail',
                actions: [{
                    type: BATTLE_REACTION_ACTION_TYPE.DEAL_REACTION_DAMAGE,
                    sourceId: 'thorn-mail',
                    targetId: 'enemy-1',
                    actionType: 'REACTION_THORNS',
                    amount: 2,
                }],
            }),
        ]));
    });

    it('declares Exposed as a status-applied reaction sourced by the inscription card', () => {
        const reactions = resolveBattleReactionDefinitions(
            {
                name: BATTLE_EVENT_NAME.STATUS_APPLIED,
                payload: {
                    battleId: 'battle:test',
                    turnNumber: 1,
                    targetId: 'enemy-1',
                    statusType: 'WEAK',
                    value: 1,
                    sourceId: 'player',
                    queueIndex: 3,
                },
            },
            createContext(),
        );

        expect(reactions).toEqual([{
            id: 'card-inscription:SHADOW_EXPOSE:exploit-weakness:enemy-1',
            sourceId: 'exploit-weakness',
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
            actions: [{
                type: BATTLE_REACTION_ACTION_TYPE.OPEN_CARD_INSCRIPTION_PAYOFF,
                targetId: 'enemy-1',
                sourceCardId: 'exploit-weakness',
                sourceCardName: 'Exploit Weakness',
                payoffType: CARD_INSCRIPTION_PAYOFF_TYPE.DAMAGE_BONUS,
                payoffLabel: 'Exposed',
                amount: 8,
                expiresAtTurn: 1,
            }],
        }]);
    });

    it('declares retained-card inscription payoffs from the retained zone event', () => {
        const reactions = resolveBattleReactionDefinitions(
            {
                name: BATTLE_EVENT_NAME.RETAINED,
                payload: {
                    battleId: 'battle:test',
                    turnNumber: 1,
                    cardId: 'brace',
                    cardName: 'Brace',
                    reason: 'turn-end',
                },
            },
            createContext({
                inscribedCards: [{
                    cardId: 'brace',
                    cardName: 'Brace',
                    inscription: {
                        id: CARD_INSCRIPTION_ID.IRON_ENTRENCH,
                        label: 'Iron Entrench',
                        trigger: CARD_INSCRIPTION_TRIGGER.CARD_RETAINED,
                        payoff: {
                            type: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                            label: 'Entrenched',
                            amount: 3,
                            window: CARD_INSCRIPTION_PAYOFF_WINDOW.NEXT_TURN,
                        },
                    },
                }],
            }),
        );

        expect(reactions).toEqual([
            expect.objectContaining({
                id: 'card-zone:retained',
            }),
            {
                id: 'card-inscription:IRON_ENTRENCH:brace:player',
                sourceId: 'brace',
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
                actions: [{
                    type: BATTLE_REACTION_ACTION_TYPE.OPEN_CARD_INSCRIPTION_PAYOFF,
                    targetId: 'player',
                    sourceCardId: 'brace',
                    sourceCardName: 'Brace',
                    payoffType: CARD_INSCRIPTION_PAYOFF_TYPE.BLOCK_BONUS,
                    payoffLabel: 'Entrenched',
                    amount: 3,
                    expiresAtTurn: 2,
                }],
            },
        ]);
    });

    it('declares Retain and Exhaust zone events as traceable reactions', () => {
        const retained = resolveBattleReactionDefinitions(
            {
                name: BATTLE_EVENT_NAME.RETAINED,
                payload: {
                    battleId: 'battle:test',
                    turnNumber: 1,
                    cardId: 'brace',
                    cardName: 'Brace',
                    reason: 'turn-end',
                },
            },
            createContext(),
        );
        const exhausted = resolveBattleReactionDefinitions(
            {
                name: BATTLE_EVENT_NAME.EXHAUSTED,
                payload: {
                    battleId: 'battle:test',
                    turnNumber: 1,
                    cardId: 'dread',
                    cardName: 'Dread',
                    reason: 'ethereal-turn-end',
                },
            },
            createContext(),
        );

        expect(retained[0]).toEqual(expect.objectContaining({
            id: 'card-zone:retained',
            sourceId: 'brace',
            actions: [expect.objectContaining({
                type: BATTLE_REACTION_ACTION_TYPE.TRACE_CARD_ZONE,
                zone: 'retained',
            })],
        }));
        expect(exhausted[0]).toEqual(expect.objectContaining({
            id: 'card-zone:exhausted',
            sourceId: 'dread',
            actions: [expect.objectContaining({
                type: BATTLE_REACTION_ACTION_TYPE.TRACE_CARD_ZONE,
                zone: 'exhausted',
            })],
        }));
    });
});
