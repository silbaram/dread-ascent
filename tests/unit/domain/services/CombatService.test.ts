import { describe, expect, it } from 'vitest';
import { CombatService, type CombatRandomSource } from '../../../../src/domain/services/CombatService';

class FixedRandomSource implements CombatRandomSource {
    constructor(private readonly value: number) {}

    next() {
        return this.value;
    }
}

describe('CombatService', () => {
    it('applies the minimum non-critical damage formula from the system doc', () => {
        // Arrange
        const service = new CombatService(new FixedRandomSource(0.99));

        // Act
        const result = service.resolveAttack(
            { health: 100, maxHealth: 100, attack: 3, defense: 1 },
            { health: 10, maxHealth: 10, attack: 10, defense: 5 },
        );

        // Assert
        expect(result).toEqual({
            damage: 1,
            isCritical: false,
            remainingHealth: 9,
            targetDefeated: false,
        });
    });

    it('applies critical multiplier and lethal damage when the crit roll succeeds', () => {
        // Arrange
        const service = new CombatService(new FixedRandomSource(0.01));

        // Act
        const result = service.resolveAttack(
            { health: 100, maxHealth: 100, attack: 10, defense: 1 },
            { health: 10, maxHealth: 10, attack: 10, defense: 5 },
        );

        // Assert
        expect(result).toEqual({
            damage: 10,
            isCritical: true,
            remainingHealth: 0,
            targetDefeated: true,
        });
    });
});
