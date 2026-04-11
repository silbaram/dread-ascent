export const BATTLE_EVENT_NAME = {
    TURN_STARTED: 'BATTLE_TURN_STARTED',
    CARD_PLAYED: 'BATTLE_CARD_PLAYED',
    ACTION_RESOLVED: 'BATTLE_ACTION_RESOLVED',
    DAMAGE_DEALT: 'BATTLE_DAMAGE_DEALT',
    DAMAGE_TAKEN: 'BATTLE_DAMAGE_TAKEN',
    SELF_DAMAGED: 'BATTLE_SELF_DAMAGED',
    HP_CHANGED: 'BATTLE_HP_CHANGED',
    STATUS_APPLIED: 'BATTLE_STATUS_APPLIED',
    EXHAUSTED: 'BATTLE_EXHAUSTED',
    RETAINED: 'BATTLE_RETAINED',
    TARGET_KILLED: 'BATTLE_TARGET_KILLED',
    THRESHOLD_CROSSED: 'BATTLE_THRESHOLD_CROSSED',
    ESCAPE_ATTEMPT: 'BATTLE_ESCAPE_ATTEMPT',
    DREAD_RULE_TRIGGERED: 'BATTLE_DREAD_RULE_TRIGGERED',
    TURN_ENDED: 'BATTLE_TURN_ENDED',
} as const;

export const LEGACY_BATTLE_EVENT_NAME = {
    TURN_STARTED: 'TURN_STARTED',
    CARD_PLAYED: 'CARD_PLAYED',
    TURN_ENDED: 'TURN_ENDED',
    STATUS_APPLIED: 'STATUS_APPLIED',
} as const;

export type BattleActionStatusDelta = {
    readonly targetId: string;
    readonly statusType: string;
    readonly value: number;
};

export type BattleActionHealthChange = {
    readonly targetId: string;
    readonly previousHealth: number;
    readonly currentHealth: number;
};

export interface BattleTurnStartedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly energy: number;
    readonly drawCount: number;
    readonly handCount: number;
    readonly dreadRuleId: string | null;
}

export interface LegacyTurnStartedPayload {
    readonly turnNumber: number;
    readonly energy: number;
    readonly drawCount: number;
    readonly handCount: number;
}

export interface BattleCardPlayedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly cardId: string;
    readonly effectType: string;
    readonly cost: number;
    readonly remainingEnergy: number;
    readonly targetIds: readonly string[];
}

export interface LegacyCardPlayedPayload {
    readonly cardId: string;
    readonly effectType: string;
    readonly cost: number;
    readonly remainingEnergy: number;
    readonly targetId: string;
}

export interface BattleActionResolvedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly actionType: string;
    readonly sourceId: string;
    readonly targetIds: readonly string[];
    readonly damage: number;
    readonly block: number;
    readonly statusDelta: readonly BattleActionStatusDelta[];
    readonly queueIndex: number;
    readonly selfDamage?: number;
    readonly healthChanges?: readonly BattleActionHealthChange[];
    readonly lineageId?: string;
}

export interface BattleTurnEndedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly remainingEnergy: number;
    readonly handCount: number;
    readonly retainedCount: number;
    readonly exhaustedCount: number;
}

export interface BattleDamagePayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly sourceId: string;
    readonly targetId: string;
    readonly amount: number;
    readonly actionType: string;
    readonly queueIndex: number;
    readonly lineageId?: string;
}

export interface BattleHpChangedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly actorId: string;
    readonly previousHealth: number;
    readonly currentHealth: number;
    readonly reason: string;
    readonly queueIndex?: number;
}

export interface BattleStatusAppliedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly targetId: string;
    readonly statusType: string;
    readonly value: number;
    readonly sourceId: string;
    readonly queueIndex: number;
    readonly lineageId?: string;
}

export interface BattleCardZonePayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly cardId: string;
    readonly cardName: string;
    readonly reason: string;
}

export interface BattleTargetKilledPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly targetId: string;
    readonly sourceId: string;
    readonly actionType: string;
    readonly queueIndex: number;
}

export interface BattleThresholdCrossedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly actorId: string;
    readonly threshold: 'bloodied' | 'desperation';
    readonly health: number;
    readonly maxHealth: number;
}

export interface BattleEscapeAttemptPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly sourceId: string;
    readonly cardId: string;
    readonly perfectVanish: boolean;
}

export interface BattleDreadRuleTriggeredPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly ruleId: string;
    readonly ruleName: string;
    readonly trigger: string;
    readonly value?: number;
    readonly sourceId?: string;
    readonly targetId?: string;
}

export interface LegacyTurnEndedPayload {
    readonly turnNumber: number;
    readonly remainingEnergy: number;
    readonly handCount: number;
}

export interface LegacyStatusAppliedPayload {
    readonly targetId: string;
    readonly statusType: string;
    readonly value: number;
    readonly expiresAtTurn: number;
}

export type BattleEventPayloadByName = {
    readonly [BATTLE_EVENT_NAME.TURN_STARTED]: BattleTurnStartedPayload;
    readonly [BATTLE_EVENT_NAME.CARD_PLAYED]: BattleCardPlayedPayload;
    readonly [BATTLE_EVENT_NAME.ACTION_RESOLVED]: BattleActionResolvedPayload;
    readonly [BATTLE_EVENT_NAME.DAMAGE_DEALT]: BattleDamagePayload;
    readonly [BATTLE_EVENT_NAME.DAMAGE_TAKEN]: BattleDamagePayload;
    readonly [BATTLE_EVENT_NAME.SELF_DAMAGED]: BattleDamagePayload;
    readonly [BATTLE_EVENT_NAME.HP_CHANGED]: BattleHpChangedPayload;
    readonly [BATTLE_EVENT_NAME.STATUS_APPLIED]: BattleStatusAppliedPayload;
    readonly [BATTLE_EVENT_NAME.EXHAUSTED]: BattleCardZonePayload;
    readonly [BATTLE_EVENT_NAME.RETAINED]: BattleCardZonePayload;
    readonly [BATTLE_EVENT_NAME.TARGET_KILLED]: BattleTargetKilledPayload;
    readonly [BATTLE_EVENT_NAME.THRESHOLD_CROSSED]: BattleThresholdCrossedPayload;
    readonly [BATTLE_EVENT_NAME.ESCAPE_ATTEMPT]: BattleEscapeAttemptPayload;
    readonly [BATTLE_EVENT_NAME.DREAD_RULE_TRIGGERED]: BattleDreadRuleTriggeredPayload;
    readonly [BATTLE_EVENT_NAME.TURN_ENDED]: BattleTurnEndedPayload;
    readonly [LEGACY_BATTLE_EVENT_NAME.TURN_STARTED]: LegacyTurnStartedPayload;
    readonly [LEGACY_BATTLE_EVENT_NAME.CARD_PLAYED]: LegacyCardPlayedPayload;
    readonly [LEGACY_BATTLE_EVENT_NAME.TURN_ENDED]: LegacyTurnEndedPayload;
    readonly [LEGACY_BATTLE_EVENT_NAME.STATUS_APPLIED]: LegacyStatusAppliedPayload;
};

export type BattleEventName = keyof BattleEventPayloadByName;

export interface BattleEventRecord<Name extends BattleEventName = BattleEventName> {
    readonly name: Name;
    readonly payload: BattleEventPayloadByName[Name];
}

export interface BattleEventBus {
    emit<Name extends BattleEventName>(name: Name, payload: BattleEventPayloadByName[Name]): void;
    subscribe(handler: (event: BattleEventRecord) => void): () => void;
    snapshot(): readonly BattleEventRecord[];
    clear(): void;
}

type BattleEventForwarder = <Name extends BattleEventName>(
    name: Name,
    payload: BattleEventPayloadByName[Name],
) => void;

export function createBattleEventBus(forward?: BattleEventForwarder): BattleEventBus {
    const records: BattleEventRecord[] = [];
    const subscribers = new Set<(event: BattleEventRecord) => void>();

    return {
        emit<Name extends BattleEventName>(
            name: Name,
            payload: BattleEventPayloadByName[Name],
        ): void {
            const record = {
                name,
                payload,
            } satisfies BattleEventRecord<Name>;
            records.push(record as BattleEventRecord);
            forward?.(name, payload);
            subscribers.forEach((subscriber) => {
                subscriber(record as BattleEventRecord);
            });
        },
        subscribe(handler: (event: BattleEventRecord) => void): () => void {
            subscribers.add(handler);
            return () => {
                subscribers.delete(handler);
            };
        },
        snapshot(): readonly BattleEventRecord[] {
            return [...records];
        },
        clear(): void {
            records.length = 0;
        },
    };
}
