import {
    BASE_PLAYER_STATS,
    type CombatStats,
    cloneCombatStats,
} from './CombatStats';

export interface Position {
    x: number;
    y: number;
}

export class Player {
    public readonly stats: CombatStats;
    public experience = 0;

    constructor(
        public position: Position,
        stats: CombatStats = BASE_PLAYER_STATS,
    ) {
        this.stats = cloneCombatStats(stats);
    }

    moveTo(x: number, y: number) {
        this.position.x = x;
        this.position.y = y;
    }

    applyDamage(amount: number) {
        this.stats.health = Math.max(0, this.stats.health - amount);
        return this.stats.health;
    }

    gainExperience(amount: number) {
        this.experience += amount;
        return this.experience;
    }

    isDead() {
        return this.stats.health <= 0;
    }
}
