import { Scheduler } from 'rot-js';
import { type TurnScheduler } from '../../domain/services/TurnQueueService';

export class RotTurnScheduler implements TurnScheduler {
    private readonly scheduler = new Scheduler.Simple<string>();

    add(actorId: string, repeat: boolean) {
        this.scheduler.add(actorId, repeat);
    }

    next() {
        return this.scheduler.next() ?? null;
    }

    clear() {
        this.scheduler.clear();
    }
}
