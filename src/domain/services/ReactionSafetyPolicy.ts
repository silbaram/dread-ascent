export const REACTION_TRIGGER_LIMIT = {
    ONCE_PER_ACTION: 'once-per-action',
    ONCE_PER_TURN: 'once-per-turn',
    ONCE_PER_COMBAT: 'once-per-combat',
} as const;

export type ReactionTriggerLimit = typeof REACTION_TRIGGER_LIMIT[keyof typeof REACTION_TRIGGER_LIMIT];

export const REACTION_SKIP_REASON = {
    DUPLICATE_ACTION: 'duplicate-action',
    DUPLICATE_TURN: 'duplicate-turn',
    DUPLICATE_COMBAT: 'duplicate-combat',
    SELF_RECURSION: 'self-recursion',
} as const;

export type ReactionSkipReason = typeof REACTION_SKIP_REASON[keyof typeof REACTION_SKIP_REASON];

export interface ReactionSafetyRequest {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly reactionId: string;
    readonly sourceId: string;
    readonly originalActionId: string;
    readonly generatedActionId: string;
    readonly triggerLimit: ReactionTriggerLimit;
    readonly allowSelfRetrigger?: boolean;
}

export interface ReactionLineage {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly reactionId: string;
    readonly sourceId: string;
    readonly originalActionId: string;
    readonly generatedActionId: string;
    readonly triggerLimit: ReactionTriggerLimit;
}

export type ReactionSafetyDecision =
    | {
        readonly allowed: true;
        readonly lineage: ReactionLineage;
    }
    | {
        readonly allowed: false;
        readonly reason: ReactionSkipReason;
        readonly lineage: ReactionLineage;
    };

export class ReactionSafetyPolicy {
    private readonly handledActionKeys = new Set<string>();
    private readonly handledTurnKeys = new Set<string>();
    private readonly handledCombatKeys = new Set<string>();
    private readonly lineages: ReactionLineage[] = [];
    private activeTurnNumber?: number;

    resetCombat(): void {
        this.handledActionKeys.clear();
        this.handledTurnKeys.clear();
        this.handledCombatKeys.clear();
        this.lineages.length = 0;
        this.activeTurnNumber = undefined;
    }

    startTurn(turnNumber: number): void {
        if (this.activeTurnNumber === turnNumber) {
            return;
        }

        this.activeTurnNumber = turnNumber;
        this.handledTurnKeys.clear();
    }

    tryRecord(request: ReactionSafetyRequest): ReactionSafetyDecision {
        const lineage = this.createLineage(request);
        if (
            !request.allowSelfRetrigger
            && this.isSelfRecursive(request)
        ) {
            return {
                allowed: false,
                reason: REACTION_SKIP_REASON.SELF_RECURSION,
                lineage,
            };
        }

        const scopeKey = this.createScopeKey(lineage);
        const handledKeys = this.getHandledKeys(lineage.triggerLimit);
        if (handledKeys.has(scopeKey)) {
            return {
                allowed: false,
                reason: this.getDuplicateReason(lineage.triggerLimit),
                lineage,
            };
        }

        handledKeys.add(scopeKey);
        this.lineages.push(lineage);
        return {
            allowed: true,
            lineage,
        };
    }

    private isSelfRecursive(request: ReactionSafetyRequest): boolean {
        return request.originalActionId === request.generatedActionId
            || request.originalActionId.includes(`->reaction:${request.reactionId}`);
    }

    snapshotLineages(): readonly ReactionLineage[] {
        return [...this.lineages];
    }

    private createLineage(request: ReactionSafetyRequest): ReactionLineage {
        return {
            battleId: request.battleId,
            turnNumber: request.turnNumber,
            reactionId: request.reactionId,
            sourceId: request.sourceId,
            originalActionId: request.originalActionId,
            generatedActionId: request.generatedActionId,
            triggerLimit: request.triggerLimit,
        };
    }

    private createScopeKey(lineage: ReactionLineage): string {
        const sourceKey = `${lineage.battleId}:${lineage.reactionId}:${lineage.sourceId}`;
        switch (lineage.triggerLimit) {
            case REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION:
                return `${sourceKey}:${lineage.originalActionId}`;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_TURN:
                return sourceKey;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_COMBAT:
                return sourceKey;
        }
    }

    private getHandledKeys(triggerLimit: ReactionTriggerLimit): Set<string> {
        switch (triggerLimit) {
            case REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION:
                return this.handledActionKeys;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_TURN:
                return this.handledTurnKeys;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_COMBAT:
                return this.handledCombatKeys;
        }
    }

    private getDuplicateReason(triggerLimit: ReactionTriggerLimit): ReactionSkipReason {
        switch (triggerLimit) {
            case REACTION_TRIGGER_LIMIT.ONCE_PER_ACTION:
                return REACTION_SKIP_REASON.DUPLICATE_ACTION;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_TURN:
                return REACTION_SKIP_REASON.DUPLICATE_TURN;
            case REACTION_TRIGGER_LIMIT.ONCE_PER_COMBAT:
                return REACTION_SKIP_REASON.DUPLICATE_COMBAT;
        }
    }
}
