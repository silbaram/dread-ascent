import { describe, expect, it } from 'vitest';
import { Player } from '../../../../src/domain/entities/Player';

describe('Player', () => {
    it('heals only up to max health', () => {
        // Arrange
        const player = new Player({ x: 1, y: 1 });
        player.applyDamage(25);

        // Act
        const healed = player.heal(40);

        // Assert
        expect(healed).toBe(25);
        expect(player.stats.health).toBe(100);
    });

    it('applies additive combat stat modifiers and clamps current health to max', () => {
        // Arrange
        const player = new Player({ x: 1, y: 1 });
        player.applyDamage(10);

        // Act
        player.applyStatModifier({
            maxHealth: -20,
            attack: 3,
            defense: 2,
        });

        // Assert
        expect(player.stats).toEqual({
            health: 80,
            maxHealth: 80,
            attack: 13,
            defense: 7,
        });
    });

    it('resets stats and experience for a new run', () => {
        // Arrange
        const player = new Player({ x: 1, y: 1 });
        player.applyDamage(40);
        player.gainExperience(55);
        player.applyStatModifier({
            attack: 4,
            defense: 2,
        });

        // Act
        player.reset({
            health: 120,
            maxHealth: 120,
            attack: 14,
            defense: 7,
        });

        // Assert
        expect(player.stats).toEqual({
            health: 120,
            maxHealth: 120,
            attack: 14,
            defense: 7,
        });
        expect(player.experience).toBe(0);
    });

    it('restores saved stats and experience for a continued run', () => {
        // Arrange
        const player = new Player({ x: 1, y: 1 });

        // Act
        player.restore({
            health: 73,
            maxHealth: 120,
            attack: 16,
            defense: 9,
        }, 88);

        // Assert
        expect(player.stats).toEqual({
            health: 73,
            maxHealth: 120,
            attack: 16,
            defense: 9,
        });
        expect(player.experience).toBe(88);
    });
});
