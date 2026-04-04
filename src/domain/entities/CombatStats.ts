export interface CombatStats {
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    movementSpeed: number;
}

export interface CombatStatModifier {
    maxHealth?: number;
    attack?: number;
    defense?: number;
    movementSpeed?: number;
}

export const DEFAULT_MOVEMENT_SPEED = 100;

export const BASE_PLAYER_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
};

export function cloneCombatStats(stats: CombatStats): CombatStats {
    return { ...stats };
}
