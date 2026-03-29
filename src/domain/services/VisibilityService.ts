export interface GridPosition {
    x: number;
    y: number;
}

export interface FieldOfViewCalculator {
    computeVisibleTiles(origin: GridPosition, radius: number): GridPosition[];
}

export type VisibilityState = 'hidden' | 'explored' | 'visible';

export interface VisibilitySnapshot {
    tiles: VisibilityState[][];
}

export class VisibilityService {
    private readonly exploredTiles: boolean[][];

    constructor(
        private readonly width: number,
        private readonly height: number,
        private readonly calculator: FieldOfViewCalculator,
    ) {
        this.exploredTiles = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => false),
        );
    }

    private lastSnapshot?: VisibilitySnapshot;

    recalculate(origin: GridPosition, radius: number): VisibilitySnapshot {
        const visibleTiles = Array.from({ length: this.height }, () =>
            Array.from({ length: this.width }, () => false),
        );

        const visiblePositions = [origin, ...this.calculator.computeVisibleTiles(origin, radius)];
        for (const position of visiblePositions) {
            if (!this.isWithinBounds(position.x, position.y)) {
                continue;
            }

            visibleTiles[position.y][position.x] = true;
            this.exploredTiles[position.y][position.x] = true;
        }

        const snapshot = {
            tiles: visibleTiles.map((row, y) =>
                row.map((isVisible, x) => {
                    if (isVisible) {
                        return 'visible';
                    }

                    return this.exploredTiles[y][x] ? 'explored' : 'hidden';
                }),
            ),
        };
        this.lastSnapshot = snapshot;
        return snapshot;
    }

    public getState(x: number, y: number): VisibilityState {
        if (!this.lastSnapshot || !this.isWithinBounds(x, y)) {
            return 'hidden';
        }
        return this.lastSnapshot.tiles[y][x];
    }

    private isWithinBounds(x: number, y: number) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}
