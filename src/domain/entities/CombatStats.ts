export interface CombatStats {
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
}

export const BASE_PLAYER_STATS: CombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
};

export function cloneCombatStats(stats: CombatStats): CombatStats {
    return { ...stats };
}
