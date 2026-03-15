export type FloorType = 'normal' | 'safe' | 'boss';

export interface FloorSnapshot {
    number: number;
    type: FloorType;
}

export interface RandomSource {
    next(): number;
}

export const DEFAULT_SAFE_FLOOR_CHANCE = 0.25;
export const BOSS_FLOOR_NUMBER = 100;

export class FloorProgressionService {
    private floorNumber = 1;
    private floorType: FloorType = 'normal';

    constructor(
        private readonly random: RandomSource = { next: () => Math.random() },
        private readonly safeFloorChance = DEFAULT_SAFE_FLOOR_CHANCE,
    ) {
        if (safeFloorChance < 0 || safeFloorChance > 1) {
            throw new Error('Safe floor chance must be between 0 and 1.');
        }
    }

    getSnapshot(): FloorSnapshot {
        return {
            number: this.floorNumber,
            type: this.floorType,
        };
    }

    reset(): FloorSnapshot {
        this.floorNumber = 1;
        this.floorType = 'normal';

        return this.getSnapshot();
    }

    restore(snapshot: FloorSnapshot): FloorSnapshot {
        if (!Number.isFinite(snapshot.number) || snapshot.number < 1) {
            throw new Error('Floor number must be greater than or equal to 1.');
        }
        if (snapshot.type !== 'normal' && snapshot.type !== 'safe' && snapshot.type !== 'boss') {
            throw new Error(`Unsupported floor type: ${snapshot.type}`);
        }

        this.floorNumber = Math.floor(snapshot.number);
        this.floorType = this.floorNumber >= BOSS_FLOOR_NUMBER ? 'boss' : snapshot.type;

        return this.getSnapshot();
    }

    advance(): FloorSnapshot {
        this.floorNumber += 1;
        if (this.floorNumber >= BOSS_FLOOR_NUMBER) {
            this.floorType = 'boss';
            return this.getSnapshot();
        }

        this.floorType = this.random.next() < this.safeFloorChance ? 'safe' : 'normal';

        return this.getSnapshot();
    }
}
