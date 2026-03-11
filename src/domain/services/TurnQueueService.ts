export type TurnActorKind = 'player' | 'enemy';

export interface TurnActor {
    id: string;
    kind: TurnActorKind;
    label: string;
}

export interface TurnScheduler {
    add(actorId: string, repeat: boolean): void;
    next(): string | null;
    clear(): void;
}

export interface TurnSnapshot {
    round: number;
    activeActor: TurnActor;
    enemyCount: number;
}

export interface PlayerTurnResolution {
    round: number;
    enemyTurns: TurnActor[];
    nextActor: TurnActor;
}

export class TurnQueueService {
    private readonly actorsById = new Map<string, TurnActor>();
    private activeActorId?: string;
    private actorCount = 0;
    private round = 0;

    constructor(private readonly scheduler: TurnScheduler) {}

    initialize(player: TurnActor, enemies: TurnActor[]): TurnSnapshot {
        if (player.kind !== 'player') {
            throw new Error('Turn queue requires a player actor.');
        }

        const roster = [player, ...enemies];
        if (roster.length === 0) {
            throw new Error('Turn queue requires at least one actor.');
        }

        this.rebuildRoster(roster);
        this.round = 1;
        this.activeActorId = this.activatePlayerTurn(player.id);

        return this.getSnapshot();
    }

    refresh(player: TurnActor, enemies: TurnActor[]): TurnSnapshot {
        const activeActor = this.getActiveActor();
        if (activeActor.kind !== 'player') {
            throw new Error('Turn queue can only refresh during the player turn.');
        }

        this.rebuildRoster([player, ...enemies]);
        this.activeActorId = this.activatePlayerTurn(player.id);

        return this.getSnapshot();
    }

    getSnapshot(): TurnSnapshot {
        return {
            round: this.round,
            activeActor: this.getActiveActor(),
            enemyCount: Math.max(0, this.actorCount - 1),
        };
    }

    completePlayerTurn(): PlayerTurnResolution {
        const activeActor = this.getActiveActor();
        if (activeActor.kind !== 'player') {
            throw new Error('Only the active player turn can be completed.');
        }

        const enemyTurns: TurnActor[] = [];

        for (let step = 0; step < this.actorCount; step += 1) {
            const nextActorId = this.scheduler.next();
            if (nextActorId === null) {
                throw new Error('Turn queue has no next actor.');
            }

            const nextActor = this.getActor(nextActorId);
            if (nextActor.kind === 'player') {
                this.activeActorId = nextActor.id;
                this.round += 1;

                return {
                    round: this.round,
                    enemyTurns,
                    nextActor,
                };
            }

            enemyTurns.push(nextActor);
        }

        throw new Error('Turn queue could not cycle back to the player.');
    }

    private activatePlayerTurn(playerId: string) {
        for (let step = 0; step < this.actorCount; step += 1) {
            const nextActorId = this.scheduler.next();
            if (nextActorId === playerId) {
                return nextActorId;
            }
        }

        throw new Error('Turn queue could not activate the player turn.');
    }

    private rebuildRoster(roster: TurnActor[]) {
        this.scheduler.clear();
        this.actorsById.clear();

        for (const actor of roster) {
            if (this.actorsById.has(actor.id)) {
                throw new Error(`Duplicate turn actor id: ${actor.id}`);
            }

            this.actorsById.set(actor.id, actor);
            this.scheduler.add(actor.id, true);
        }

        this.actorCount = roster.length;
    }

    private getActiveActor() {
        if (!this.activeActorId) {
            throw new Error('Turn queue has not been initialized.');
        }

        return this.getActor(this.activeActorId);
    }

    private getActor(actorId: string) {
        const actor = this.actorsById.get(actorId);
        if (!actor) {
            throw new Error(`Turn actor not found: ${actorId}`);
        }

        return actor;
    }
}
