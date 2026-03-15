import type { CombatStats } from './CombatStats';
import type { Position } from './Player';

export type EnemyKind = 'normal' | 'boss';
export type EnemyArchetypeId = 'ash-crawler' | 'blade-raider' | 'dread-sentinel' | 'final-boss';

export class Enemy {
    public lastKnownPlayerPosition?: Position;

    constructor(
        public readonly id: string,
        public readonly label: string,
        public position: Position,
        public stats: CombatStats,
        public readonly experienceReward: number,
        public readonly kind: EnemyKind = 'normal',
        public readonly archetypeId: EnemyArchetypeId = 'ash-crawler',
        public readonly elite = false,
    ) {}

    moveTo(x: number, y: number) {
        this.position.x = x;
        this.position.y = y;
    }

    rememberPlayer(position: Position) {
        this.lastKnownPlayerPosition = { ...position };
    }

    forgetPlayer() {
        this.lastKnownPlayerPosition = undefined;
    }

    applyDamage(amount: number) {
        this.stats.health = Math.max(0, this.stats.health - amount);
        return this.stats.health;
    }

    isDead() {
        return this.stats.health <= 0;
    }

    isBoss() {
        return this.kind === 'boss';
    }

    isElite() {
        return this.elite;
    }
}
