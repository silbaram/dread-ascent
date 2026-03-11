import * as ROT from 'rot-js';
import type { Position } from '../../domain/entities/Player';
import type { FloorType } from '../../domain/services/FloorProgressionService';
import { WORLD_TILE } from '../../shared/types/WorldTiles';

export interface RoomData {
    center: [number, number];
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface MapData {
    width: number;
    height: number;
    tiles: number[][];
    rooms: RoomData[];
    playerSpawn: Position;
    stairsPosition: Position;
    restPoints: Position[];
    floorType: FloorType;
}

export interface MapGenerationOptions {
    floorType?: FloorType;
}

export class MapGenerator {
    static generate(width: number, height: number, options: MapGenerationOptions = {}): MapData {
        if (options.floorType === 'safe') {
            return this.generateSafeFloor(width, height);
        }

        return this.generateNormalFloor(width, height);
    }

    private static generateNormalFloor(width: number, height: number): MapData {
        const tiles: number[][] = Array.from({ length: height }, () => 
            Array.from({ length: width }, () => WORLD_TILE.WALL)
        );
        const digger = new ROT.Map.Digger(width, height);
        const rooms: RoomData[] = [];

        digger.create((x, y, value) => {
            tiles[y][x] = value;
        });

        const rotRooms = digger.getRooms();
        rotRooms.forEach(room => {
            const center = room.getCenter();
            rooms.push({
                center: [center[0], center[1]],
                left: room.getLeft(),
                right: room.getRight(),
                top: room.getTop(),
                bottom: room.getBottom()
            });
        });

        if (rooms.length === 0) {
            throw new Error('Map generation requires at least one room.');
        }

        const playerSpawn = this.toPosition(rooms[0].center);
        const stairsRoom = this.selectStairsRoom(rooms, playerSpawn);
        const stairsPosition = this.selectStairsPosition(stairsRoom, playerSpawn);
        tiles[stairsPosition.y][stairsPosition.x] = WORLD_TILE.STAIRS;

        return {
            width,
            height,
            tiles,
            rooms,
            playerSpawn,
            stairsPosition,
            restPoints: [],
            floorType: 'normal',
        };
    }

    private static generateSafeFloor(width: number, height: number): MapData {
        const tiles: number[][] = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => WORLD_TILE.WALL),
        );
        const margin = 2;
        const room: RoomData = {
            center: [Math.floor(width / 2), Math.floor(height / 2)],
            left: margin,
            right: width - margin - 1,
            top: margin,
            bottom: height - margin - 1,
        };

        for (let y = room.top; y <= room.bottom; y += 1) {
            for (let x = room.left; x <= room.right; x += 1) {
                tiles[y][x] = WORLD_TILE.FLOOR;
            }
        }

        const center = this.toPosition(room.center);
        const playerSpawn = {
            x: Math.max(room.left + 1, center.x - 6),
            y: center.y,
        };
        const stairsPosition = {
            x: Math.min(room.right - 1, center.x + 6),
            y: center.y,
        };
        const restPoint = center;

        tiles[restPoint.y][restPoint.x] = WORLD_TILE.REST;
        tiles[stairsPosition.y][stairsPosition.x] = WORLD_TILE.STAIRS;

        return {
            width,
            height,
            tiles,
            rooms: [room],
            playerSpawn,
            stairsPosition,
            restPoints: [restPoint],
            floorType: 'safe',
        };
    }

    private static selectStairsRoom(rooms: RoomData[], playerSpawn: Position) {
        return rooms.reduce((selected, room) => {
            const selectedDistance = this.distanceSquared(this.toPosition(selected.center), playerSpawn);
            const roomDistance = this.distanceSquared(this.toPosition(room.center), playerSpawn);

            return roomDistance > selectedDistance ? room : selected;
        }, rooms[0]);
    }

    private static selectStairsPosition(room: RoomData, playerSpawn: Position): Position {
        const preferred = this.toPosition(room.center);
        if (preferred.x !== playerSpawn.x || preferred.y !== playerSpawn.y) {
            return preferred;
        }

        const fallbackCandidates: Position[] = [
            { x: room.right - 1, y: room.bottom - 1 },
            { x: room.left + 1, y: room.top + 1 },
            { x: room.right - 1, y: room.top + 1 },
            { x: room.left + 1, y: room.bottom - 1 },
        ];

        return fallbackCandidates.find((candidate) =>
            candidate.x !== playerSpawn.x || candidate.y !== playerSpawn.y,
        ) ?? preferred;
    }

    private static toPosition([x, y]: [number, number]): Position {
        return { x, y };
    }

    private static distanceSquared(a: Position, b: Position) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return (dx * dx) + (dy * dy);
    }
}
