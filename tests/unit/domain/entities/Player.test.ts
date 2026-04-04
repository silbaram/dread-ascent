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
            movementSpeed: 100,
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
            movementSpeed: 10,
        });

        // Act
        player.reset({
            health: 120,
            maxHealth: 120,
            attack: 14,
            defense: 7,
            movementSpeed: 135,
        });

        // Assert
        expect(player.stats).toEqual({
            health: 120,
            maxHealth: 120,
            attack: 14,
            defense: 7,
            movementSpeed: 135,
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
            movementSpeed: 88,
        }, 88);

        // Assert
        expect(player.stats).toEqual({
            health: 73,
            maxHealth: 120,
            attack: 16,
            defense: 9,
            movementSpeed: 88,
        });
        expect(player.experience).toBe(88);
    });

    it('applies additive movement speed modifiers with a minimum of one', () => {
        // Arrange
        const player = new Player({ x: 1, y: 1 });

        // Act
        const stats = player.applyStatModifier({ movementSpeed: -150 });

        // Assert
        expect(stats.movementSpeed).toBe(1);
        expect(player.stats.movementSpeed).toBe(1);
    });
});
