export type FloorType = 'normal' | 'safe';

export interface FloorSnapshot {
    number: number;
    type: FloorType;
}

export interface RandomSource {
    next(): number;
}

export const DEFAULT_SAFE_FLOOR_CHANCE = 0.25;

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

    advance(): FloorSnapshot {
        this.floorNumber += 1;
        this.floorType = this.random.next() < this.safeFloorChance ? 'safe' : 'normal';

        return this.getSnapshot();
    }
}
