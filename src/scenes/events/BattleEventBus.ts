export const BATTLE_EVENT_NAME = {
    TURN_STARTED: 'BATTLE_TURN_STARTED',
    CARD_PLAYED: 'BATTLE_CARD_PLAYED',
    ACTION_RESOLVED: 'BATTLE_ACTION_RESOLVED',
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
}

export interface BattleTurnEndedPayload {
    readonly battleId: string;
    readonly turnNumber: number;
    readonly remainingEnergy: number;
    readonly handCount: number;
    readonly retainedCount: number;
    readonly exhaustedCount: number;
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
