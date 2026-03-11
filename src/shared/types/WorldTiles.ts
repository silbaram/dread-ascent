export const WORLD_TILE = {
    FLOOR: 0,
    WALL: 1,
    STAIRS: 2,
    REST: 3,
} as const;

export type WorldTile = (typeof WORLD_TILE)[keyof typeof WORLD_TILE];

export function isWalkableTile(tile: number): tile is WorldTile {
    return tile === WORLD_TILE.FLOOR
        || tile === WORLD_TILE.STAIRS
        || tile === WORLD_TILE.REST;
}
