import * as ROT from 'rot-js';
import type { Position } from '../../domain/entities/Player';
import type { PathFinder } from '../../domain/services/EnemyAiService';

type PassableResolver = (x: number, y: number) => boolean;

export class RotPathFinder implements PathFinder {
    constructor(private readonly isPassable: PassableResolver) {}

    findPath(origin: Position, target: Position): Position[] {
        const path: Position[] = [];
        const astar = new ROT.Path.AStar(
            target.x,
            target.y,
            (x, y) => this.isPassable(x, y),
            { topology: 4 },
        );

        astar.compute(origin.x, origin.y, (x: number, y: number) => {
            path.push({ x, y });
        });

        if (path.length === 0) {
            return [];
        }

        const destination = path[path.length - 1];
        if (destination.x !== target.x || destination.y !== target.y) {
            return [];
        }

        return path.slice(1);
    }
}
