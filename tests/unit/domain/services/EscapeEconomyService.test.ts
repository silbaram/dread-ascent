import { describe, expect, it } from 'vitest';
import {
    ESCAPE_GOLD_POLICY_NOTE,
    ESCAPE_RESULT_TIER,
    EscapeEconomyService,
} from '../../../../src/domain/services/EscapeEconomyService';

describe('EscapeEconomyService', () => {
    const service = new EscapeEconomyService();

    it('resolves an untouched non-gear flee as Clean Escape with item loss', () => {
        const result = service.resolve({
            currentHealth: 100,
            maxHealth: 100,
            battleHealthLoss: 0,
            battleRounds: 1,
            hasEscapeArtistsBoots: false,
            currentNextBattleStartEnergyBonus: 0,
        });

        expect(result).toMatchObject({
            tier: ESCAPE_RESULT_TIER.CLEAN,
            healthLoss: 0,
            itemLossPolicy: 'lose-random-item',
            rewardPolicy: 'none',
            nextBattleStartEnergyBonus: 0,
            battleHealthLoss: 0,
            modifierSources: [],
            goldPolicy: 'not-implemented',
            goldPolicyNote: ESCAPE_GOLD_POLICY_NOTE,
        });
    });

    it('resolves a damaged flee as Bloody Escape with non-lethal health loss and no item loss', () => {
        const result = service.resolve({
            currentHealth: 8,
            maxHealth: 100,
            battleHealthLoss: 12,
            battleRounds: 3,
            hasEscapeArtistsBoots: false,
            currentNextBattleStartEnergyBonus: 0,
        });

        expect(result).toMatchObject({
            tier: ESCAPE_RESULT_TIER.BLOODY,
            healthLoss: 7,
            itemLossPolicy: 'none',
            rewardPolicy: 'none',
            nextBattleStartEnergyBonus: 0,
            battleHealthLoss: 12,
            modifierSources: [],
            goldPolicy: 'not-implemented',
            goldPolicyNote: ESCAPE_GOLD_POLICY_NOTE,
        });
    });

    it('resolves Escape Artist Boots with no battle damage as Perfect Vanish', () => {
        const result = service.resolve({
            currentHealth: 100,
            maxHealth: 100,
            battleHealthLoss: 0,
            battleRounds: 1,
            hasEscapeArtistsBoots: true,
            currentNextBattleStartEnergyBonus: 1,
        });

        expect(result).toMatchObject({
            tier: ESCAPE_RESULT_TIER.PERFECT,
            healthLoss: 0,
            itemLossPolicy: 'protected-by-gear',
            rewardPolicy: 'next-battle-energy',
            nextBattleStartEnergyBonus: 2,
            perfectVanishEnergyBonus: 1,
            modifierSources: ['escape-artists-boots'],
            goldPolicy: 'not-implemented',
            goldPolicyNote: ESCAPE_GOLD_POLICY_NOTE,
        });
    });

    it('resolves a card-driven perfect vanish without item loss', () => {
        const result = service.resolve({
            currentHealth: 100,
            maxHealth: 100,
            battleHealthLoss: 0,
            battleRounds: 1,
            hasEscapeArtistsBoots: false,
            perfectVanishRequested: true,
            currentNextBattleStartEnergyBonus: 0,
        });

        expect(result).toMatchObject({
            tier: ESCAPE_RESULT_TIER.PERFECT,
            healthLoss: 0,
            itemLossPolicy: 'none',
            rewardPolicy: 'next-battle-energy',
            nextBattleStartEnergyBonus: 1,
            perfectVanishEnergyBonus: 1,
            modifierSources: ['card-perfect-vanish'],
            goldPolicy: 'not-implemented',
            goldPolicyNote: ESCAPE_GOLD_POLICY_NOTE,
        });
    });

    it('keeps battle damage as Bloody Escape even when a card requested Perfect Vanish', () => {
        const result = service.resolve({
            currentHealth: 100,
            maxHealth: 100,
            battleHealthLoss: 1,
            battleRounds: 2,
            hasEscapeArtistsBoots: false,
            perfectVanishRequested: true,
            currentNextBattleStartEnergyBonus: 0,
        });

        expect(result).toMatchObject({
            tier: ESCAPE_RESULT_TIER.BLOODY,
            healthLoss: 10,
            itemLossPolicy: 'none',
            rewardPolicy: 'none',
            nextBattleStartEnergyBonus: 0,
            perfectVanishEnergyBonus: 0,
            battleHealthLoss: 1,
            modifierSources: ['card-perfect-vanish'],
        });
    });
});
