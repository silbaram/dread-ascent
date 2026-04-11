export const ESCAPE_RESULT_TIER = {
    CLEAN: 'clean_escape',
    BLOODY: 'bloody_escape',
    PERFECT: 'perfect_vanish',
} as const;

export type EscapeResultTier = (typeof ESCAPE_RESULT_TIER)[keyof typeof ESCAPE_RESULT_TIER];

export type EscapeItemLossPolicy = 'lose-random-item' | 'protected-by-gear' | 'none';
export type EscapeRewardPolicy = 'none' | 'next-battle-energy';
export type EscapeModifierSource = 'card-perfect-vanish' | 'escape-artists-boots';
export type EscapeGoldPolicy = 'not-implemented';

export const ESCAPE_GOLD_POLICY_NOTE = '[TBD: gold economy not implemented]' as const;

export interface EscapeEconomyRequest {
    readonly currentHealth: number;
    readonly maxHealth: number;
    readonly battleHealthLoss: number;
    readonly battleRounds: number;
    readonly hasEscapeArtistsBoots: boolean;
    readonly perfectVanishRequested?: boolean;
    readonly currentNextBattleStartEnergyBonus: number;
}

export interface EscapeEconomyResult {
    readonly tier: EscapeResultTier;
    readonly battleHealthLoss: number;
    readonly healthLoss: number;
    readonly itemLossPolicy: EscapeItemLossPolicy;
    readonly rewardPolicy: EscapeRewardPolicy;
    readonly nextBattleStartEnergyBonus: number;
    readonly perfectVanishEnergyBonus: number;
    readonly battleRounds: number;
    readonly modifierSources: readonly EscapeModifierSource[];
    readonly goldPolicy: EscapeGoldPolicy;
    readonly goldPolicyNote: typeof ESCAPE_GOLD_POLICY_NOTE;
}

export const ESCAPE_ECONOMY_BALANCE = {
    bloodyHealthLossPercent: 0.1,
    perfectVanishEnergyBonus: 1,
} as const;

export class EscapeEconomyService {
    resolve(request: EscapeEconomyRequest): EscapeEconomyResult {
        const currentHealth = this.normalizeCount(request.currentHealth);
        const maxHealth = Math.max(1, this.normalizeCount(request.maxHealth));
        const battleHealthLoss = this.normalizeCount(request.battleHealthLoss);
        const currentEnergyBonus = this.normalizeCount(request.currentNextBattleStartEnergyBonus);
        const battleRounds = Math.max(1, this.normalizeCount(request.battleRounds));
        const modifierSources = this.resolveModifierSources(request);
        const sharedResult = {
            battleHealthLoss,
            battleRounds,
            modifierSources,
            goldPolicy: 'not-implemented' as const,
            goldPolicyNote: ESCAPE_GOLD_POLICY_NOTE,
        };

        if ((request.hasEscapeArtistsBoots || request.perfectVanishRequested === true) && battleHealthLoss === 0) {
            return {
                ...sharedResult,
                tier: ESCAPE_RESULT_TIER.PERFECT,
                healthLoss: 0,
                itemLossPolicy: request.hasEscapeArtistsBoots ? 'protected-by-gear' : 'none',
                rewardPolicy: 'next-battle-energy',
                nextBattleStartEnergyBonus: currentEnergyBonus + ESCAPE_ECONOMY_BALANCE.perfectVanishEnergyBonus,
                perfectVanishEnergyBonus: ESCAPE_ECONOMY_BALANCE.perfectVanishEnergyBonus,
            };
        }

        if (battleHealthLoss > 0) {
            return {
                ...sharedResult,
                tier: ESCAPE_RESULT_TIER.BLOODY,
                healthLoss: this.calculateBloodyEscapeHealthLoss(currentHealth, maxHealth),
                itemLossPolicy: 'none',
                rewardPolicy: 'none',
                nextBattleStartEnergyBonus: currentEnergyBonus,
                perfectVanishEnergyBonus: 0,
            };
        }

        return {
            ...sharedResult,
            tier: ESCAPE_RESULT_TIER.CLEAN,
            healthLoss: 0,
            itemLossPolicy: request.hasEscapeArtistsBoots ? 'protected-by-gear' : 'lose-random-item',
            rewardPolicy: 'none',
            nextBattleStartEnergyBonus: currentEnergyBonus,
            perfectVanishEnergyBonus: 0,
        };
    }

    private resolveModifierSources(request: EscapeEconomyRequest): readonly EscapeModifierSource[] {
        const sources: EscapeModifierSource[] = [];
        if (request.perfectVanishRequested === true) {
            sources.push('card-perfect-vanish');
        }
        if (request.hasEscapeArtistsBoots) {
            sources.push('escape-artists-boots');
        }
        return sources;
    }

    private calculateBloodyEscapeHealthLoss(currentHealth: number, maxHealth: number): number {
        const configuredLoss = Math.max(
            1,
            Math.floor(maxHealth * ESCAPE_ECONOMY_BALANCE.bloodyHealthLossPercent),
        );

        return Math.min(configuredLoss, Math.max(0, currentHealth - 1));
    }

    private normalizeCount(value: number): number {
        return Number.isFinite(value)
            ? Math.max(0, Math.floor(value))
            : 0;
    }
}
