import {
    BASE_PLAYER_STATS,
    type CombatStatModifier,
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

    reset(stats: CombatStats = BASE_PLAYER_STATS) {
        const nextStats = cloneCombatStats(stats);
        this.stats.health = nextStats.health;
        this.stats.maxHealth = nextStats.maxHealth;
        this.stats.attack = nextStats.attack;
        this.stats.defense = nextStats.defense;
        this.stats.movementSpeed = nextStats.movementSpeed;
        this.experience = 0;
    }

    restore(stats: CombatStats, experience: number) {
        const nextStats = cloneCombatStats(stats);
        this.stats.health = nextStats.health;
        this.stats.maxHealth = nextStats.maxHealth;
        this.stats.attack = nextStats.attack;
        this.stats.defense = nextStats.defense;
        this.stats.movementSpeed = nextStats.movementSpeed;
        this.experience = Math.max(0, Math.floor(experience));
    }

    applyDamage(amount: number) {
        this.stats.health = Math.max(0, this.stats.health - amount);
        return this.stats.health;
    }

    heal(amount: number) {
        const healed = Math.max(0, Math.min(amount, this.stats.maxHealth - this.stats.health));
        this.stats.health += healed;
        return healed;
    }

    applyStatModifier(modifier: CombatStatModifier) {
        this.stats.maxHealth = Math.max(1, this.stats.maxHealth + (modifier.maxHealth ?? 0));
        this.stats.attack = Math.max(0, this.stats.attack + (modifier.attack ?? 0));
        this.stats.defense = Math.max(0, this.stats.defense + (modifier.defense ?? 0));
        this.stats.movementSpeed = Math.max(1, this.stats.movementSpeed + (modifier.movementSpeed ?? 0));
        this.stats.health = Math.min(this.stats.health, this.stats.maxHealth);

        return cloneCombatStats(this.stats);
    }

    gainExperience(amount: number) {
        this.experience += amount;
        return this.experience;
    }

    isDead() {
        return this.stats.health <= 0;
    }
}
