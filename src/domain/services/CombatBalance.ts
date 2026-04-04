import {
    CARD_ARCHETYPE,
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    type CreateCardParams,
} from '../entities/Card';

export const CARD_CATALOG_ID = {
    STRIKE: 'STRIKE',
    FORTIFY: 'FORTIFY',
    QUICK_DRAW: 'QUICK_DRAW',
    HEAVY_STRIKE: 'HEAVY_STRIKE',
    IRON_GUARD: 'IRON_GUARD',
    VENOM_STRIKE: 'VENOM_STRIKE',
    WEAKEN: 'WEAKEN',
    BLOOD_PRICE: 'BLOOD_PRICE',
    CRIMSON_PACT: 'CRIMSON_PACT',
    BLOOD_SHIELD: 'BLOOD_SHIELD',
    DEATH_WISH: 'DEATH_WISH',
    RECKLESS_FURY: 'RECKLESS_FURY',
    MIASMA: 'MIASMA',
    SMOKE_SCREEN: 'SMOKE_SCREEN',
    SHADOW_CLOAK: 'SHADOW_CLOAK',
    EXPLOIT_WEAKNESS: 'EXPLOIT_WEAKNESS',
    CRIPPLING_BLOW: 'CRIPPLING_BLOW',
    SHIELD_BASH: 'SHIELD_BASH',
    REINFORCE: 'REINFORCE',
    BRACE: 'BRACE',
    COUNTER_STRIKE: 'COUNTER_STRIKE',
    TAUNT: 'TAUNT',
    BLOODRUSH: 'BLOODRUSH',
    LAST_STAND: 'LAST_STAND',
    BERSERKER_RAGE: 'BERSERKER_RAGE',
    TOXIC_BURST: 'TOXIC_BURST',
    NOXIOUS_AURA: 'NOXIOUS_AURA',
    BARRICADE: 'BARRICADE',
    SHOCKWAVE: 'SHOCKWAVE',
    SHADOW_STEP: 'SHADOW_STEP',
    ADRENALINE: 'ADRENALINE',
    RECYCLE: 'RECYCLE',
    SECOND_WIND: 'SECOND_WIND',
    HEMORRHAGE: 'HEMORRHAGE',
    DREAD: 'DREAD',
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

function createCardEntry(params: CardBalanceParams): CardBalanceParams {
    return params;
}

export const CARD_BALANCE_TABLE = {
    [CARD_CATALOG_ID.STRIKE]: createCardEntry({
        name: 'Strike',
        type: CARD_TYPE.ATTACK,
        power: 6,
        cost: 1,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
    }),
    [CARD_CATALOG_ID.FORTIFY]: createCardEntry({
        name: 'Fortify',
        type: CARD_TYPE.GUARD,
        power: 5,
        cost: 1,
        keywords: [],
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
    }),
    [CARD_CATALOG_ID.QUICK_DRAW]: createCardEntry({
        name: 'Quick Draw',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.DRAW,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
        effectPayload: { drawCount: 2 },
    }),
    [CARD_CATALOG_ID.HEAVY_STRIKE]: createCardEntry({
        name: 'Heavy Strike',
        type: CARD_TYPE.ATTACK,
        power: 12,
        cost: 2,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
    }),
    [CARD_CATALOG_ID.IRON_GUARD]: createCardEntry({
        name: 'Iron Guard',
        type: CARD_TYPE.GUARD,
        power: 10,
        cost: 2,
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
    }),
    [CARD_CATALOG_ID.VENOM_STRIKE]: createCardEntry({
        name: 'Venom Strike',
        type: CARD_TYPE.ATTACK,
        power: 4,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        statusEffect: { type: 'POISON', duration: 3 },
    }),
    [CARD_CATALOG_ID.WEAKEN]: createCardEntry({
        name: 'Weaken',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        statusEffect: { type: 'VULNERABLE', duration: 2 },
    }),
    [CARD_CATALOG_ID.BLOOD_PRICE]: createCardEntry({
        name: 'Blood Price',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.DRAW,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: { drawCount: 2, selfDamage: 4 },
    }),
    [CARD_CATALOG_ID.CRIMSON_PACT]: createCardEntry({
        name: 'Crimson Pact',
        type: CARD_TYPE.POWER,
        power: 0,
        cost: 1,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: {
            selfDamage: 3,
            buff: { type: 'STRENGTH', value: 1, target: 'SELF' },
        },
    }),
    [CARD_CATALOG_ID.BLOOD_SHIELD]: createCardEntry({
        name: 'Blood Shield',
        type: CARD_TYPE.GUARD,
        power: 12,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: { selfDamage: 3 },
    }),
    [CARD_CATALOG_ID.DEATH_WISH]: createCardEntry({
        name: 'Death Wish',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: {
            scaling: { source: 'MISSING_HEALTH', multiplier: 1 },
        },
    }),
    [CARD_CATALOG_ID.RECKLESS_FURY]: createCardEntry({
        name: 'Reckless Fury',
        type: CARD_TYPE.ATTACK,
        power: 5,
        cost: 0,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: { selfDamage: 2 },
    }),
    [CARD_CATALOG_ID.MIASMA]: createCardEntry({
        name: 'Miasma',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 1,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        statusEffect: { type: 'POISON', duration: 5 },
    }),
    [CARD_CATALOG_ID.SMOKE_SCREEN]: createCardEntry({
        name: 'Smoke Screen',
        type: CARD_TYPE.GUARD,
        power: 4,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        statusEffect: { type: 'WEAK', duration: 1 },
    }),
    [CARD_CATALOG_ID.SHADOW_CLOAK]: createCardEntry({
        name: 'Shadow Cloak',
        type: CARD_TYPE.GUARD,
        power: 6,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        effectPayload: { drawCount: 1 },
    }),
    [CARD_CATALOG_ID.EXPLOIT_WEAKNESS]: createCardEntry({
        name: 'Exploit Weakness',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        effectPayload: {
            scaling: { source: 'TARGET_DEBUFF_COUNT', multiplier: 4 },
        },
    }),
    [CARD_CATALOG_ID.CRIPPLING_BLOW]: createCardEntry({
        name: 'Crippling Blow',
        type: CARD_TYPE.ATTACK,
        power: 8,
        cost: 2,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        statusEffects: [
            { type: 'WEAK', duration: 1 },
            { type: 'FRAIL', duration: 1 },
        ],
    }),
    [CARD_CATALOG_ID.SHIELD_BASH]: createCardEntry({
        name: 'Shield Bash',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 2,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        effectPayload: {
            scaling: { source: 'USER_BLOCK', multiplier: 1 },
        },
    }),
    [CARD_CATALOG_ID.REINFORCE]: createCardEntry({
        name: 'Reinforce',
        type: CARD_TYPE.GUARD,
        power: 5,
        cost: 1,
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        effectPayload: {
            buff: { type: 'THORNS', value: 2, duration: 2, target: 'SELF' },
        },
    }),
    [CARD_CATALOG_ID.BRACE]: createCardEntry({
        name: 'Brace',
        type: CARD_TYPE.GUARD,
        power: 4,
        cost: 1,
        keywords: [CARD_KEYWORD.RETAIN],
        effectType: CARD_EFFECT_TYPE.BLOCK,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        effectPayload: {
            buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
        },
    }),
    [CARD_CATALOG_ID.COUNTER_STRIKE]: createCardEntry({
        name: 'Counter Strike',
        type: CARD_TYPE.ATTACK,
        power: 0,
        cost: 1,
        keywords: [CARD_KEYWORD.RETAIN],
        effectType: CARD_EFFECT_TYPE.CONDITIONAL,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        condition: { type: 'TURN_DAMAGE_TAKEN_AT_LEAST', value: 1 },
        effectPayload: {
            scaling: { source: 'TURN_DAMAGE_TAKEN', multiplier: 1 },
        },
    }),
    [CARD_CATALOG_ID.TAUNT]: createCardEntry({
        name: 'Taunt',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        effectPayload: {
            buff: { type: 'ENEMY_ATTACK_DOWN', value: 3, duration: 1, target: 'TARGET' },
        },
    }),
    [CARD_CATALOG_ID.BLOODRUSH]: createCardEntry({
        name: 'Bloodrush',
        type: CARD_TYPE.ATTACK,
        power: 18,
        cost: 2,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
    }),
    [CARD_CATALOG_ID.LAST_STAND]: createCardEntry({
        name: 'Last Stand',
        type: CARD_TYPE.ATTACK,
        power: 30,
        cost: 3,
        keywords: [CARD_KEYWORD.RETAIN],
        effectType: CARD_EFFECT_TYPE.CONDITIONAL,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        condition: { type: 'HP_THRESHOLD', value: 5 },
    }),
    [CARD_CATALOG_ID.BERSERKER_RAGE]: createCardEntry({
        name: 'Berserker Rage',
        type: CARD_TYPE.POWER,
        power: 0,
        cost: 2,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.BLOOD_OATH,
        effectPayload: {
            buff: { type: 'STRENGTH_ON_SELF_DAMAGE', value: 1, target: 'SELF' },
        },
    }),
    [CARD_CATALOG_ID.TOXIC_BURST]: createCardEntry({
        name: 'Toxic Burst',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 1,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        effectPayload: {
            buff: { type: 'POISON_MULTIPLIER', value: 2, target: 'TARGET' },
        },
    }),
    [CARD_CATALOG_ID.NOXIOUS_AURA]: createCardEntry({
        name: 'Noxious Aura',
        type: CARD_TYPE.POWER,
        power: 0,
        cost: 2,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.SHADOW_ARTS,
        effectPayload: {
            buff: { type: 'APPLY_POISON_PER_TURN', value: 2, target: 'TARGET' },
        },
    }),
    [CARD_CATALOG_ID.BARRICADE]: createCardEntry({
        name: 'Barricade',
        type: CARD_TYPE.POWER,
        power: 0,
        cost: 3,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.BUFF,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.IRON_WILL,
        effectPayload: {
            buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
        },
    }),
    [CARD_CATALOG_ID.SHOCKWAVE]: createCardEntry({
        name: 'Shockwave',
        type: CARD_TYPE.ATTACK,
        power: 8,
        cost: 2,
        effectType: CARD_EFFECT_TYPE.DAMAGE,
        rarity: CARD_RARITY.COMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
    }),
    [CARD_CATALOG_ID.SHADOW_STEP]: createCardEntry({
        name: 'Shadow Step',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.FLEE,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.NEUTRAL,
    }),
    [CARD_CATALOG_ID.ADRENALINE]: createCardEntry({
        name: 'Adrenaline',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.DRAW,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
        effectPayload: { drawCount: 1, energyChange: 1 },
    }),
    [CARD_CATALOG_ID.RECYCLE]: createCardEntry({
        name: 'Recycle',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 0,
        effectType: CARD_EFFECT_TYPE.DISCARD_EFFECT,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
        effectPayload: { discardCount: 1, drawCount: 2 },
    }),
    [CARD_CATALOG_ID.SECOND_WIND]: createCardEntry({
        name: 'Second Wind',
        type: CARD_TYPE.SKILL,
        power: 0,
        cost: 1,
        keywords: [CARD_KEYWORD.EXHAUST],
        effectType: CARD_EFFECT_TYPE.HEAL,
        rarity: CARD_RARITY.UNCOMMON,
        archetype: CARD_ARCHETYPE.NEUTRAL,
        effectPayload: { healAmount: 6 },
    }),
    [CARD_CATALOG_ID.HEMORRHAGE]: createCardEntry({
        name: 'Hemorrhage',
        type: CARD_TYPE.CURSE,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.UNPLAYABLE],
        effectType: CARD_EFFECT_TYPE.CONDITIONAL,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.CURSE,
        effectPayload: { selfDamage: 1 },
    }),
    [CARD_CATALOG_ID.DREAD]: createCardEntry({
        name: 'Dread',
        type: CARD_TYPE.CURSE,
        power: 0,
        cost: 0,
        keywords: [CARD_KEYWORD.UNPLAYABLE, CARD_KEYWORD.ETHEREAL],
        effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
        rarity: CARD_RARITY.RARE,
        archetype: CARD_ARCHETYPE.CURSE,
    }),
} as const satisfies Record<CardCatalogId, CardBalanceParams>;

export const STARTER_DECK_COMPOSITION = [
    { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
    { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
] as const satisfies readonly StarterDeckEntry[];

export const COMBAT_RESOURCE_BALANCE = {
    maxEnergy: 3,
    cardsPerTurn: 5,
    maxHandSize: 10,
    rewardOfferSize: 3,
} as const;

export const STATUS_EFFECT_BALANCE = {
    durationDecayPerTurn: 1,
    vulnerableDamageMultiplier: 1.5,
    weakDamageMultiplier: 0.75,
    frailBlockMultiplier: 0.75,
    poison: {
        damagePerStack: 1,
        stackDecayPerTurn: 1,
    },
    regeneration: {
        healPerStack: 1,
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
