// ---------------------------------------------------------------------------
// Card Entity & Deck Data Model
// ---------------------------------------------------------------------------

export const CARD_TYPE = {
    ATTACK: 'ATTACK',
    GUARD: 'GUARD',
    SKILL: 'SKILL',
    POWER: 'POWER',
    CURSE: 'CURSE',
} as const;

export type CardType = (typeof CARD_TYPE)[keyof typeof CARD_TYPE];

export const CARD_ARCHETYPE = {
    NEUTRAL: 'NEUTRAL',
    BLOOD_OATH: 'BLOOD_OATH',
    SHADOW_ARTS: 'SHADOW_ARTS',
    IRON_WILL: 'IRON_WILL',
    SMUGGLER: 'SMUGGLER',
    CURSE: 'CURSE',
} as const;

export type CardArchetype = (typeof CARD_ARCHETYPE)[keyof typeof CARD_ARCHETYPE];

// ---------------------------------------------------------------------------
// Card Keywords
// ---------------------------------------------------------------------------

export const CARD_KEYWORD = {
    BLOCK: 'BLOCK',
    EXHAUST: 'EXHAUST',
    RETAIN: 'RETAIN',
    INNATE: 'INNATE',
    ETHEREAL: 'ETHEREAL',
    UNPLAYABLE: 'UNPLAYABLE',
} as const;

export type CardKeyword = (typeof CARD_KEYWORD)[keyof typeof CARD_KEYWORD];

// ---------------------------------------------------------------------------
// Card Effect Types
// ---------------------------------------------------------------------------

export const CARD_EFFECT_TYPE = {
    DAMAGE: 'DAMAGE',
    BLOCK: 'BLOCK',
    STATUS_EFFECT: 'STATUS_EFFECT',
    FLEE: 'FLEE',
    DRAW: 'DRAW',
    HEAL: 'HEAL',
    MULTI_HIT: 'MULTI_HIT',
    DAMAGE_BLOCK: 'DAMAGE_BLOCK',
    BUFF: 'BUFF',
    DISCARD_EFFECT: 'DISCARD_EFFECT',
    CONDITIONAL: 'CONDITIONAL',
} as const;

export type CardEffectType = (typeof CARD_EFFECT_TYPE)[keyof typeof CARD_EFFECT_TYPE];

// ---------------------------------------------------------------------------
// Card Rarity
// ---------------------------------------------------------------------------

export const CARD_RARITY = {
    COMMON: 'COMMON',
    UNCOMMON: 'UNCOMMON',
    RARE: 'RARE',
} as const;

export type CardRarity = (typeof CARD_RARITY)[keyof typeof CARD_RARITY];

export interface CardStatusEffect {
    readonly type: string;
    readonly duration?: number;
    readonly stacks?: number;
    readonly amount?: number;
}

export interface CardBuffEffect {
    readonly type: string;
    readonly value: number;
    readonly duration?: number;
    readonly target?: 'SELF' | 'TARGET';
}

export const CARD_DISCARD_STRATEGY = {
    FIRST: 'FIRST',
    HIGHEST_COST: 'HIGHEST_COST',
    SELECTED: 'SELECTED',
} as const;

export type CardDiscardStrategy = (typeof CARD_DISCARD_STRATEGY)[keyof typeof CARD_DISCARD_STRATEGY];

export interface CardScalingEffect {
    readonly source: string;
    readonly multiplier: number;
    readonly baseValue?: number;
}

export interface CardCondition {
    readonly type: string;
    readonly value: number;
}

export const CARD_INSCRIPTION_ID = {
    SHADOW_EXPOSE: 'SHADOW_EXPOSE',
    IRON_ENTRENCH: 'IRON_ENTRENCH',
} as const;

export type CardInscriptionId = (typeof CARD_INSCRIPTION_ID)[keyof typeof CARD_INSCRIPTION_ID];

export const CARD_INSCRIPTION_TRIGGER = {
    TARGET_DEBUFF_THRESHOLD: 'TARGET_DEBUFF_THRESHOLD',
    CARD_RETAINED: 'CARD_RETAINED',
} as const;

export type CardInscriptionTrigger =
    (typeof CARD_INSCRIPTION_TRIGGER)[keyof typeof CARD_INSCRIPTION_TRIGGER];

export const CARD_INSCRIPTION_PAYOFF_TYPE = {
    DAMAGE_BONUS: 'DAMAGE_BONUS',
    BLOCK_BONUS: 'BLOCK_BONUS',
} as const;

export type CardInscriptionPayoffType =
    (typeof CARD_INSCRIPTION_PAYOFF_TYPE)[keyof typeof CARD_INSCRIPTION_PAYOFF_TYPE];

export const CARD_INSCRIPTION_PAYOFF_WINDOW = {
    CURRENT_TURN: 'CURRENT_TURN',
    NEXT_TURN: 'NEXT_TURN',
} as const;

export type CardInscriptionPayoffWindow =
    (typeof CARD_INSCRIPTION_PAYOFF_WINDOW)[keyof typeof CARD_INSCRIPTION_PAYOFF_WINDOW];

export interface CardInscriptionPayoffDefinition {
    readonly type: CardInscriptionPayoffType;
    readonly label: string;
    readonly amount: number;
    readonly window: CardInscriptionPayoffWindow;
}

export interface CardInscription {
    readonly id: CardInscriptionId;
    readonly label: string;
    readonly trigger: CardInscriptionTrigger;
    readonly payoff: CardInscriptionPayoffDefinition;
    readonly targetDebuffThreshold?: number;
    readonly triggerStatusTypes?: readonly string[];
    readonly exposedDamageBonus?: number;
}

export const CARD_TARGET_SCOPE = {
    CURRENT_ENEMY: 'CURRENT_ENEMY',
    ALL_ENEMIES: 'ALL_ENEMIES',
    SELF: 'SELF',
} as const;

export type CardTargetScope = (typeof CARD_TARGET_SCOPE)[keyof typeof CARD_TARGET_SCOPE];

export interface CardEffectPayload {
    readonly drawCount?: number;
    readonly healAmount?: number;
    readonly blockAmount?: number;
    readonly hitCount?: number;
    readonly discardCount?: number;
    readonly discardStrategy?: CardDiscardStrategy;
    readonly selfDamage?: number;
    readonly energyChange?: number;
    readonly costWhenConditionMet?: number;
    readonly healOnKillPercent?: number;
    readonly perfectVanish?: boolean;
    readonly perfectVanishAfterDiscard?: boolean;
    readonly buff?: CardBuffEffect;
    readonly scaling?: CardScalingEffect;
    readonly statusEffects?: readonly CardStatusEffect[];
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export interface Card {
    readonly id: string;
    readonly name: string;
    readonly type: CardType;
    readonly archetype: CardArchetype;
    readonly power: number;
    readonly cost: number;
    readonly keywords: readonly CardKeyword[];
    readonly effectType: CardEffectType;
    readonly rarity: CardRarity;
    readonly statusEffect?: CardStatusEffect;
    readonly statusEffects?: readonly CardStatusEffect[];
    readonly condition?: CardCondition;
    readonly secondaryPower?: number;
    readonly drawCount?: number;
    readonly healAmount?: number;
    readonly hitCount?: number;
    readonly discardCount?: number;
    readonly selfDamage?: number;
    readonly buff?: CardBuffEffect;
    readonly inscription?: CardInscription;
    readonly targetScope?: CardTargetScope;
    readonly effectPayload?: CardEffectPayload;
}

// ---------------------------------------------------------------------------
// Card Factory
// ---------------------------------------------------------------------------

let nextCardSequence = 0;

export interface CreateCardParams {
    readonly name: string;
    readonly type: CardType;
    readonly power: number;
    readonly id?: string;
    readonly archetype?: CardArchetype;
    readonly cost?: number;
    readonly keywords?: readonly CardKeyword[];
    readonly effectType?: CardEffectType;
    readonly rarity?: CardRarity;
    readonly statusEffect?: CardStatusEffect;
    readonly statusEffects?: readonly CardStatusEffect[];
    readonly condition?: CardCondition;
    readonly secondaryPower?: number;
    readonly drawCount?: number;
    readonly healAmount?: number;
    readonly hitCount?: number;
    readonly discardCount?: number;
    readonly selfDamage?: number;
    readonly buff?: CardBuffEffect;
    readonly inscription?: CardInscription;
    readonly targetScope?: CardTargetScope;
    readonly effectPayload?: CardEffectPayload;
}

function getDefaultEffectType(type: CardType): CardEffectType {
    if (type === CARD_TYPE.GUARD) {
        return CARD_EFFECT_TYPE.BLOCK;
    }

    if (type === CARD_TYPE.POWER) {
        return CARD_EFFECT_TYPE.BUFF;
    }

    if (type === CARD_TYPE.SKILL) {
        return CARD_EFFECT_TYPE.DRAW;
    }

    if (type === CARD_TYPE.CURSE) {
        return CARD_EFFECT_TYPE.CONDITIONAL;
    }

    return CARD_EFFECT_TYPE.DAMAGE;
}

function cloneStatusEffect(statusEffect?: CardStatusEffect): CardStatusEffect | undefined {
    return statusEffect
        ? { ...statusEffect }
        : undefined;
}

function cloneStatusEffects(statusEffects?: readonly CardStatusEffect[]): readonly CardStatusEffect[] | undefined {
    return statusEffects
        ? statusEffects.map((status) => ({ ...status }))
        : undefined;
}

function cloneBuff(buff?: CardBuffEffect): CardBuffEffect | undefined {
    return buff
        ? { ...buff }
        : undefined;
}

function cloneInscription(inscription?: CardInscription): CardInscription | undefined {
    return inscription
        ? {
            ...inscription,
            payoff: { ...inscription.payoff },
            triggerStatusTypes: inscription.triggerStatusTypes
                ? [...inscription.triggerStatusTypes]
                : undefined,
        }
        : undefined;
}

function cloneEffectPayload(effectPayload?: CardEffectPayload): CardEffectPayload | undefined {
    if (!effectPayload) {
        return undefined;
    }

    return {
        drawCount: effectPayload.drawCount,
        healAmount: effectPayload.healAmount,
        blockAmount: effectPayload.blockAmount,
        hitCount: effectPayload.hitCount,
        discardCount: effectPayload.discardCount,
        discardStrategy: effectPayload.discardStrategy,
        selfDamage: effectPayload.selfDamage,
        energyChange: effectPayload.energyChange,
        costWhenConditionMet: effectPayload.costWhenConditionMet,
        healOnKillPercent: effectPayload.healOnKillPercent,
        perfectVanish: effectPayload.perfectVanish,
        perfectVanishAfterDiscard: effectPayload.perfectVanishAfterDiscard,
        buff: cloneBuff(effectPayload.buff),
        scaling: effectPayload.scaling
            ? { ...effectPayload.scaling }
            : undefined,
        statusEffects: cloneStatusEffects(effectPayload.statusEffects),
    };
}

export function createCard(params: CreateCardParams): Card {
    const id = params.id ?? `card-${++nextCardSequence}`;
    const normalizedStatusEffects = cloneStatusEffects(
        params.statusEffects ?? params.effectPayload?.statusEffects,
    );
    const primaryStatusEffect = cloneStatusEffect(params.statusEffect)
        ?? cloneStatusEffect(normalizedStatusEffects?.[0]);
    const normalizedBuff = cloneBuff(params.buff ?? params.effectPayload?.buff);
    const drawCount = params.drawCount ?? params.effectPayload?.drawCount;
    const healAmount = params.healAmount ?? params.effectPayload?.healAmount;
    const hitCount = params.hitCount ?? params.effectPayload?.hitCount;
    const discardCount = params.discardCount ?? params.effectPayload?.discardCount;
    const discardStrategy = params.effectPayload?.discardStrategy;
    const selfDamage = params.selfDamage ?? params.effectPayload?.selfDamage;
    const energyChange = params.effectPayload?.energyChange;
    const costWhenConditionMet = params.effectPayload?.costWhenConditionMet;
    const healOnKillPercent = params.effectPayload?.healOnKillPercent;
    const perfectVanish = params.effectPayload?.perfectVanish;
    const perfectVanishAfterDiscard = params.effectPayload?.perfectVanishAfterDiscard;
    const secondaryPower = params.secondaryPower ?? params.effectPayload?.blockAmount;
    const inscription = cloneInscription(params.inscription);
    const targetScope = params.targetScope;
    const normalizedEffectPayload = cloneEffectPayload(params.effectPayload) ?? {
        drawCount,
        healAmount,
        hitCount,
        discardCount,
        discardStrategy,
        selfDamage,
        energyChange,
        costWhenConditionMet,
        healOnKillPercent,
        perfectVanish,
        perfectVanishAfterDiscard,
        buff: normalizedBuff,
        statusEffects: normalizedStatusEffects,
    };

    return {
        id,
        name: params.name,
        type: params.type,
        archetype: params.archetype ?? CARD_ARCHETYPE.NEUTRAL,
        power: Math.max(0, Math.floor(params.power)),
        cost: params.cost ?? 0,
        keywords: params.keywords ? [...params.keywords] : [],
        effectType: params.effectType ?? getDefaultEffectType(params.type),
        rarity: params.rarity ?? CARD_RARITY.COMMON,
        statusEffect: primaryStatusEffect,
        statusEffects: normalizedStatusEffects,
        condition: params.condition ? { ...params.condition } : undefined,
        secondaryPower,
        drawCount,
        healAmount,
        hitCount,
        discardCount,
        selfDamage,
        buff: normalizedBuff,
        inscription,
        targetScope,
        effectPayload: normalizedEffectPayload,
    };
}

export function resetCardSequence(): void {
    nextCardSequence = 0;
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

export const DECK_MAX_SIZE = 20;

export interface Deck {
    readonly cards: readonly Card[];
    readonly maxSize: number;
}

export function createDeck(maxSize: number = DECK_MAX_SIZE): Deck {
    return { cards: [], maxSize };
}

export function addCardToDeck(deck: Deck, card: Card): { deck: Deck; added: boolean } {
    if (deck.cards.length >= deck.maxSize) {
        return { deck, added: false };
    }
    return {
        deck: { ...deck, cards: [...deck.cards, card] },
        added: true,
    };
}

export function removeCardFromDeck(deck: Deck, cardId: string): { deck: Deck; removed: boolean } {
    const index = deck.cards.findIndex((card) => card.id === cardId);
    if (index === -1) {
        return { deck, removed: false };
    }

    const nextCards = [...deck.cards.slice(0, index), ...deck.cards.slice(index + 1)];
    return {
        deck: { ...deck, cards: nextCards },
        removed: true,
    };
}

export function isDeckFull(deck: Deck): boolean {
    return deck.cards.length >= deck.maxSize;
}

export function getDeckSize(deck: Deck): number {
    return deck.cards.length;
}
