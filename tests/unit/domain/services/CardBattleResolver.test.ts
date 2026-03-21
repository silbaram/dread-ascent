import { beforeEach, describe, expect, it } from 'vitest';
import { resolveCardClash } from '../../../../src/domain/services/CardBattleResolver';
import { CARD_TYPE, createCard, resetCardSequence } from '../../../../src/domain/entities/Card';

describe('CardBattleResolver', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    function attack(power: number, name = 'Attack') {
        return createCard({ name, type: CARD_TYPE.ATTACK, power });
    }

    function guard(power: number, name = 'Guard') {
        return createCard({ name, type: CARD_TYPE.GUARD, power });
    }

    // -----------------------------------------------------------------------
    // ATTACK vs GUARD
    // -----------------------------------------------------------------------

    describe('Attack vs Guard', () => {
        it('player attack > enemy guard → enemy takes damage', () => {
            // Arrange
            const playerCard = attack(10);
            const enemyCard = guard(4);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.matchup).toBe('ATTACK_VS_GUARD');
            expect(result.playerDamage).toBe(0);
            expect(result.enemyDamage).toBe(6); // 10 - 4
        });

        it('player attack == enemy guard → defense success (0 damage)', () => {
            // Arrange
            const playerCard = attack(5);
            const enemyCard = guard(5);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.enemyDamage).toBe(0);
            expect(result.playerDamage).toBe(0);
        });

        it('player attack < enemy guard → defense success (0 damage)', () => {
            // Arrange
            const playerCard = attack(3);
            const enemyCard = guard(8);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.enemyDamage).toBe(0);
            expect(result.playerDamage).toBe(0);
        });

        it('enemy attack > player guard → player takes damage', () => {
            // Arrange
            const playerCard = guard(3);
            const enemyCard = attack(10);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.matchup).toBe('ATTACK_VS_GUARD');
            expect(result.playerDamage).toBe(7); // 10 - 3
            expect(result.enemyDamage).toBe(0);
        });

        it('enemy attack < player guard → player defense success', () => {
            // Arrange
            const playerCard = guard(10);
            const enemyCard = attack(4);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.playerDamage).toBe(0);
            expect(result.enemyDamage).toBe(0);
        });

        it('provides a descriptive message on breakthrough', () => {
            const result = resolveCardClash(attack(8, 'Slash'), guard(3, 'Block'));
            expect(result.description).toContain('breaks through');
            expect(result.description).toContain('5');
        });

        it('provides a descriptive message on full block', () => {
            const result = resolveCardClash(attack(3, 'Poke'), guard(10, 'Wall'));
            expect(result.description).toContain('blocks');
        });
    });

    // -----------------------------------------------------------------------
    // ATTACK vs ATTACK
    // -----------------------------------------------------------------------

    describe('Attack vs Attack', () => {
        it('both sides take damage equal to opponent power', () => {
            // Arrange
            const playerCard = attack(8);
            const enemyCard = attack(5);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.matchup).toBe('ATTACK_VS_ATTACK');
            expect(result.playerDamage).toBe(5); // enemy power
            expect(result.enemyDamage).toBe(8);  // player power
        });

        it('equal power → both take equal damage', () => {
            // Arrange
            const playerCard = attack(6);
            const enemyCard = attack(6);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.playerDamage).toBe(6);
            expect(result.enemyDamage).toBe(6);
        });

        it('returns both cards in the result', () => {
            const playerCard = attack(7);
            const enemyCard = attack(3);
            const result = resolveCardClash(playerCard, enemyCard);

            expect(result.playerCard).toBe(playerCard);
            expect(result.enemyCard).toBe(enemyCard);
        });
    });

    // -----------------------------------------------------------------------
    // GUARD vs GUARD
    // -----------------------------------------------------------------------

    describe('Guard vs Guard', () => {
        it('no damage to either side', () => {
            // Arrange
            const playerCard = guard(5);
            const enemyCard = guard(8);

            // Act
            const result = resolveCardClash(playerCard, enemyCard);

            // Assert
            expect(result.matchup).toBe('GUARD_VS_GUARD');
            expect(result.playerDamage).toBe(0);
            expect(result.enemyDamage).toBe(0);
        });

        it('provides descriptive message for guard vs guard', () => {
            const result = resolveCardClash(guard(5), guard(5));
            expect(result.description).toContain('no damage');
        });
    });

    // -----------------------------------------------------------------------
    // Edge Cases
    // -----------------------------------------------------------------------

    describe('Edge Cases', () => {
        it('zero power attack vs guard → 0 damage', () => {
            const result = resolveCardClash(attack(0), guard(5));
            expect(result.enemyDamage).toBe(0);
            expect(result.playerDamage).toBe(0);
        });

        it('attack vs zero power guard → full attack damage', () => {
            const result = resolveCardClash(attack(10), guard(0));
            expect(result.enemyDamage).toBe(10);
            expect(result.playerDamage).toBe(0);
        });

        it('zero power attack vs attack → both 0 damage', () => {
            const result = resolveCardClash(attack(0), attack(0));
            expect(result.playerDamage).toBe(0);
            expect(result.enemyDamage).toBe(0);
        });

        it('zero power guard vs guard → 0 damage', () => {
            const result = resolveCardClash(guard(0), guard(0));
            expect(result.playerDamage).toBe(0);
            expect(result.enemyDamage).toBe(0);
        });

        it('very high power values produce correct result', () => {
            const result = resolveCardClash(attack(999), guard(1));
            expect(result.enemyDamage).toBe(998);
            expect(result.playerDamage).toBe(0);
        });
    });
});
