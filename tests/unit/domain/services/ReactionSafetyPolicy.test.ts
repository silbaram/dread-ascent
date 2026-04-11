import { describe, expect, it } from 'vitest';
import {
    REACTION_SKIP_REASON,
    REACTION_TRIGGER_LIMIT,
    ReactionSafetyPolicy,
    type ReactionSafetyRequest,
} from '../../../../src/domain/services/ReactionSafetyPolicy';

function createRequest(overrides: Partial<ReactionSafetyRequest> = {}): ReactionSafetyRequest {
    return {
        battleId: 'battle:test',
        turnNumber: 1,
        reactionId: 'blood-moon:first-self-damage-strength',
        sourceId: 'blood-moon',
        originalActionId: 'battle:test:1:0:SELF_DAMAGE:player:player',
        generatedActionId: 'battle:test:1:0:SELF_DAMAGE:player:player->reaction:blood-moon',
        triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
        ...overrides,
    };
}

describe('ReactionSafetyPolicy', () => {
    it('records lineage and allows a once-per-action reaction only once for the same action', () => {
        const policy = new ReactionSafetyPolicy();
        const request = createRequest();

        const firstDecision = policy.tryRecord(request);
        const secondDecision = policy.tryRecord(request);

        expect(firstDecision.allowed).toBe(true);
        expect(policy.snapshotLineages()).toEqual([
            expect.objectContaining({
                reactionId: request.reactionId,
                sourceId: request.sourceId,
                originalActionId: request.originalActionId,
                generatedActionId: request.generatedActionId,
                triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION,
            }),
        ]);
        expect(secondDecision).toEqual({
            allowed: false,
            reason: REACTION_SKIP_REASON.DUPLICATE_ACTION,
            lineage: expect.objectContaining({
                reactionId: request.reactionId,
                originalActionId: request.originalActionId,
            }),
        });
    });

    it('allows a once-per-turn reaction again after the turn scope starts over', () => {
        const policy = new ReactionSafetyPolicy();
        const firstTurnRequest = createRequest({
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_TURN,
        });
        const sameTurnRequest = createRequest({
            triggerLimit: REACTION_TRIGGER_LIMIT.ONCE_PER_TURN,
            originalActionId: 'battle:test:1:1:SELF_DAMAGE:player:player',
            generatedActionId: 'battle:test:1:1:SELF_DAMAGE:player:player->reaction:blood-moon',
        });

        expect(policy.tryRecord(firstTurnRequest).allowed).toBe(true);
        expect(policy.tryRecord(sameTurnRequest)).toEqual({
            allowed: false,
            reason: REACTION_SKIP_REASON.DUPLICATE_TURN,
            lineage: expect.objectContaining({
                reactionId: firstTurnRequest.reactionId,
                originalActionId: sameTurnRequest.originalActionId,
            }),
        });

        policy.startTurn(2);

        expect(policy.tryRecord({
            ...sameTurnRequest,
            turnNumber: 2,
            originalActionId: 'battle:test:2:0:SELF_DAMAGE:player:player',
            generatedActionId: 'battle:test:2:0:SELF_DAMAGE:player:player->reaction:blood-moon',
        }).allowed).toBe(true);
    });

    it('blocks direct self-recursion unless the reaction is explicitly whitelisted', () => {
        const policy = new ReactionSafetyPolicy();
        const recursiveRequest = createRequest({
            originalActionId: 'battle:test:1:0:SELF_DAMAGE:player:player',
            generatedActionId: 'battle:test:1:0:SELF_DAMAGE:player:player',
        });

        expect(policy.tryRecord(recursiveRequest)).toEqual({
            allowed: false,
            reason: REACTION_SKIP_REASON.SELF_RECURSION,
            lineage: expect.objectContaining({
                originalActionId: recursiveRequest.originalActionId,
                generatedActionId: recursiveRequest.generatedActionId,
            }),
        });
        expect(policy.tryRecord({
            ...recursiveRequest,
            allowSelfRetrigger: true,
        }).allowed).toBe(true);
    });

    it('blocks reactions whose source action lineage already contains the same reaction', () => {
        const policy = new ReactionSafetyPolicy();
        const recursiveRequest = createRequest({
            reactionId: 'thorn-mail:reflect-damage',
            sourceId: 'thorn-mail',
            originalActionId:
                'battle:test:1:0:DAMAGE:enemy:player->reaction:thorn-mail:reflect-damage',
            generatedActionId:
                'battle:test:1:0:DAMAGE:enemy:player->reaction:thorn-mail:reflect-damage->reaction:thorn-mail:reflect-damage',
        });

        expect(policy.tryRecord(recursiveRequest)).toEqual({
            allowed: false,
            reason: REACTION_SKIP_REASON.SELF_RECURSION,
            lineage: expect.objectContaining({
                reactionId: recursiveRequest.reactionId,
                originalActionId: recursiveRequest.originalActionId,
            }),
        });
    });
});
