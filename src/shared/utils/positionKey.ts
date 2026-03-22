import type { Position } from '../../domain/entities/Player';

/** Position을 Set/Map 키로 변환한다. */
export function positionToKey(position: Position): string {
    return `${position.x},${position.y}`;
}
