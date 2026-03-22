import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    type CreateCardParams,
} from '../entities/Card';

export const CARD_CATALOG_ID = {
    STRIKE: 'STRIKE',
    FORTIFY: 'FORTIFY',
    WEAKEN: 'WEAKEN',
    BLOODRUSH: 'BLOODRUSH',
    SHADOW_STEP: 'SHADOW_STEP',
    LAST_STAND: 'LAST_STAND',
    SHOCKWAVE: 'SHOCKWAVE',
} as const;

export type CardCatalogId = (typeof CARD_CATALOG_ID)[keyof typeof CARD_CATALOG_ID];

export interface StarterDeckEntry {
    readonly catalogId: CardCatalogId;
    readonly count: number;
}

export interface EnemyIntentWeights {
    readonly attack: number;
    readonly defend: number;
    readonly buff: number;
}

export type EnemyIntentProfile = 'normal' | 'elite' | 'boss';

type CardBalanceParams = Omit<CreateCardParams, 'id'>;

export const CARD_BALANCE_TABLE = {
    [CARD_CATALOG_ID.STRIKE]: {
        name: 'Strike',
        type: CARD_TYPE.ATTACK,
        power: 6,
        cost: 1,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
    },
    [CARD_CATALOG_ID.FORTIFY]: {
        name: 'Fortify',
        type: CARD_TYPE.GUARD,
        power: 5,
        cost: 1,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.COMMON,
    },
    [CARD_CATALOG_ID.WEAKEN]: {
        name: 'Weaken',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 1,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
        rarity: CARD_RARITY.COMMON,
        statusEffect: { type: 'VULNERABLE', duration: 2 },
    },
    [CARD_CATALOG_ID.BLOODRUSH]: {
        name: 'Bloodrush',
        type: CARD_TYPE.ATTACK,
        power: 18,
        cost: 2,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
    },
    [CARD_CATALOG_ID.SHADOW_STEP]: {
        name: 'Shadow Step',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.FLEE,
        rarity: CARD_RARITY.RARE,
    },
    [CARD_CATALOG_ID.LAST_STAND]: {
        name: 'Last Stand',
        type: CARD_TYPE.ATTACK,
        power: 30,
        cost: 3,
        keywords: [CARD_KEYWORD.RETAIN],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.RARE,
        condition: { type: 'HP_THRESHOLD', value: 5 },
    },
    [CARD_CATALOG_ID.SHOCKWAVE]: {
        name: 'Shockwave',
        type: CARD_TYPE.ATTACK,
        power: 8,
        cost: 2,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
    },
} as const satisfies Record<CardCatalogId, CardBalanceParams>;

export const STARTER_DECK_COMPOSITION = [
    { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
    { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
] as const satisfies readonly StarterDeckEntry[];

export const COMBAT_RESOURCE_BALANCE = {
    maxEnergy: 3,
    cardsPerTurn: 5,
} as const;

export const STATUS_EFFECT_BALANCE = {
    durationDecayPerTurn: 1,
    vulnerableDamageMultiplier: 1.5,
    weakDamageMultiplier: 0.75,
    poison: {
        damagePerStack: 1,
        stackDecayPerTurn: 1,
    },
} as const;

export const ENEMY_INTENT_BALANCE = {
    lowHealthThreshold: 0.35,
    highHealthThreshold: 0.8,
    baseWeights: {
        normal: { attack: 5, defend: 3, buff: 1 },
        elite: { attack: 6, defend: 2, buff: 2 },
        boss: { attack: 5, defend: 2, buff: 4 },
    },
    lowHealthAdjustment: {
        attack: -1,
        defend: 4,
        buff: 0,
    },
    highHealthBuffBonus: {
        normal: 1,
        elite: 1,
        boss: 2,
    },
    buffAmount: {
        normal: 2,
        elite: 3,
        boss: 4,
    },
    floorScaling: {
        floorBandSize: 10,
        perBand: {
            normal: { attack: 1, defend: 0, buff: 0 },
            elite: { attack: 1, defend: 0, buff: 1 },
            boss: { attack: 1, defend: 0, buff: 1 },
        },
    },
} as const satisfies {
    readonly lowHealthThreshold: number;
    readonly highHealthThreshold: number;
    readonly baseWeights: Record<EnemyIntentProfile, EnemyIntentWeights>;
    readonly lowHealthAdjustment: EnemyIntentWeights;
    readonly highHealthBuffBonus: Record<EnemyIntentProfile, number>;
    readonly buffAmount: Record<EnemyIntentProfile, number>;
    readonly floorScaling: {
        readonly floorBandSize: number;
        readonly perBand: Record<EnemyIntentProfile, EnemyIntentWeights>;
    };
};

export const COMBAT_BALANCE = {
    resources: COMBAT_RESOURCE_BALANCE,
    statusEffects: STATUS_EFFECT_BALANCE,
    cards: CARD_BALANCE_TABLE,
    starterDeck: STARTER_DECK_COMPOSITION,
    enemyIntent: ENEMY_INTENT_BALANCE,
} as const;
