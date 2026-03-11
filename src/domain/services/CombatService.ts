import type { CombatStats } from '../entities/CombatStats';

export interface CombatRandomSource {
    next(): number;
}

export interface AttackResolution {
    damage: number;
    isCritical: boolean;
    remainingHealth: number;
    targetDefeated: boolean;
}

export const DEFAULT_CRIT_RATE = 0.1;
export const DEFAULT_CRIT_MULTIPLIER = 2;

export class CombatService {
    constructor(
        private readonly random: CombatRandomSource = { next: () => Math.random() },
        private readonly critRate = DEFAULT_CRIT_RATE,
        private readonly critMultiplier = DEFAULT_CRIT_MULTIPLIER,
    ) {}

    resolveAttack(attacker: CombatStats, defender: CombatStats): AttackResolution {
        const baseDamage = Math.max(1, attacker.attack - defender.defense);
        const isCritical = this.random.next() < this.critRate;
        const damage = isCritical ? baseDamage * this.critMultiplier : baseDamage;
        const remainingHealth = Math.max(0, defender.health - damage);

        return {
            damage,
            isCritical,
            remainingHealth,
            targetDefeated: remainingHealth === 0,
        };
    }
}
