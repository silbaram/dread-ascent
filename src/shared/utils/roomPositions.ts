import type { Position } from '../../domain/entities/Player';
import type { SpawnRoom } from '../../domain/services/EnemySpawnerService';
import type { RandomSource } from './shuffle';
import { shuffleArray } from './shuffle';
import { positionToKey } from './positionKey';
import { WORLD_TILE } from '../types/WorldTiles';

/** 방 영역 내의 FLOOR 타일 좌표를 수집한다. */
export function collectRoomFloorPositions(room: SpawnRoom, tiles: number[][]): Position[] {
    const positions: Position[] = [];

    for (let y = room.top; y <= room.bottom; y += 1) {
        for (let x = room.left; x <= room.right; x += 1) {
            if (tiles[y]?.[x] === WORLD_TILE.FLOOR) {
                positions.push({ x, y });
            }
        }
    }

    return positions;
}

/** 방 내에서 점유되지 않은 랜덤 스폰 위치를 선택한다. */
export function selectUnoccupiedPosition(
    room: SpawnRoom,
    tiles: number[][],
    occupied: Set<string>,
    random: RandomSource,
    entityLabel: string,
): Position {
    const candidates = shuffleArray(collectRoomFloorPositions(room, tiles), random);
    const position = candidates.find((candidate) => !occupied.has(positionToKey(candidate)));
    if (!position) {
        throw new Error(`No spawn position available for ${entityLabel}.`);
    }

    return position;
}
