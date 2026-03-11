import * as ROT from 'rot-js';
import type { FieldOfViewCalculator, GridPosition } from '../../domain/services/VisibilityService';

type TransparencyResolver = (x: number, y: number) => boolean;

export class RotFovCalculator implements FieldOfViewCalculator {
    constructor(private readonly isTransparent: TransparencyResolver) {}

    computeVisibleTiles(origin: GridPosition, radius: number): GridPosition[] {
        const visibleTiles: GridPosition[] = [];
        const fov = new ROT.FOV.PreciseShadowcasting((x, y) => this.isTransparent(x, y));

        fov.compute(origin.x, origin.y, radius, (x: number, y: number, _radius: number, visibility: number) => {
            if (visibility > 0) {
                visibleTiles.push({ x, y });
            }
        });

        return visibleTiles;
    }
}
