// ---------------------------------------------------------------------------
// Card Catalog — 카드 확장 카탈로그 정의
// ---------------------------------------------------------------------------

import {
    CARD_ARCHETYPE,
    CARD_RARITY,
    createCard,
    type Card,
    type CardArchetype,
    type CardRarity,
    type CreateCardParams,
} from './Card';
import {
    CARD_BALANCE_TABLE,
    CARD_CATALOG_ID,
    STARTER_DECK_COMPOSITION,
    type CardCatalogId,
} from '../services/CombatBalance';

export { CARD_CATALOG_ID, STARTER_DECK_COMPOSITION };
export type { CardCatalogId };

export interface CardTemplate {
    readonly catalogId: CardCatalogId;
    readonly params: Omit<CreateCardParams, 'id'>;
}

const CARD_BALANCE_ENTRIES = Object.entries(CARD_BALANCE_TABLE) as readonly [
    CardCatalogId,
    Omit<CreateCardParams, 'id'>,
][];

export const CARD_TEMPLATES: readonly CardTemplate[] = CARD_BALANCE_ENTRIES.map(
    ([catalogId, params]) => ({
        catalogId,
        params,
    }),
);

const CATALOG_MAP = new Map<CardCatalogId, CardTemplate>(
    CARD_TEMPLATES.map((template) => [template.catalogId, template]),
);

export function createCardFromCatalog(catalogId: CardCatalogId): Card {
    const template = CATALOG_MAP.get(catalogId);
    if (!template) {
        throw new Error(`Unknown card catalog ID: ${catalogId}`);
    }

    return createCard(template.params);
}

export function getCardTemplate(catalogId: CardCatalogId): CardTemplate | undefined {
    return CATALOG_MAP.get(catalogId);
}

function getCardSignature(card: Card): string {
    return JSON.stringify({
        name: card.name,
        type: card.type,
        archetype: card.archetype,
        power: card.power,
        cost: card.cost,
        keywords: [...card.keywords],
        effectType: card.effectType,
        rarity: card.rarity,
        statusEffect: card.statusEffect
            ? { ...card.statusEffect }
            : undefined,
        statusEffects: card.statusEffects
            ? card.statusEffects.map((statusEffect) => ({ ...statusEffect }))
            : undefined,
        condition: card.condition
            ? { ...card.condition }
            : undefined,
        secondaryPower: card.secondaryPower,
        drawCount: card.drawCount,
        healAmount: card.healAmount,
        hitCount: card.hitCount,
        discardCount: card.discardCount,
        selfDamage: card.selfDamage,
        buff: card.buff
            ? { ...card.buff }
            : undefined,
        inscription: card.inscription
            ? { ...card.inscription }
            : undefined,
        effectPayload: card.effectPayload
            ? {
                ...card.effectPayload,
                buff: card.effectPayload.buff
                    ? { ...card.effectPayload.buff }
                    : undefined,
                scaling: card.effectPayload.scaling
                    ? { ...card.effectPayload.scaling }
                    : undefined,
                statusEffects: card.effectPayload.statusEffects
                    ? card.effectPayload.statusEffects.map((statusEffect) => ({ ...statusEffect }))
                    : undefined,
            }
            : undefined,
    });
}

const CATALOG_SIGNATURE_MAP = new Map<CardCatalogId, string>(
    CARD_TEMPLATES.map((template) => [template.catalogId, getCardSignature(createCard(template.params))]),
);

export function resolveCardCatalogId(card: Card): CardCatalogId | undefined {
    const signature = getCardSignature(card);

    return CARD_TEMPLATES.find(
        (template) => CATALOG_SIGNATURE_MAP.get(template.catalogId) === signature,
    )?.catalogId;
}

export function createStarterDeckCards(): Card[] {
    const cards: Card[] = [];
    for (const entry of STARTER_DECK_COMPOSITION) {
        for (let count = 0; count < entry.count; count += 1) {
            cards.push(createCardFromCatalog(entry.catalogId));
        }
    }
    return cards;
}

export const ARCHETYPE_CARD_IDS = {
    [CARD_ARCHETYPE.NEUTRAL]: [
        CARD_CATALOG_ID.STRIKE,
        CARD_CATALOG_ID.FORTIFY,
        CARD_CATALOG_ID.QUICK_DRAW,
        CARD_CATALOG_ID.HEAVY_STRIKE,
        CARD_CATALOG_ID.SHOCKWAVE,
        CARD_CATALOG_ID.ADRENALINE,
        CARD_CATALOG_ID.SECOND_WIND,
    ],
    [CARD_ARCHETYPE.BLOOD_OATH]: [
        CARD_CATALOG_ID.BLOOD_PRICE,
        CARD_CATALOG_ID.ADRENALINE_RUSH,
        CARD_CATALOG_ID.CRIMSON_PACT,
        CARD_CATALOG_ID.BLOOD_SHIELD,
        CARD_CATALOG_ID.DEATH_WISH,
        CARD_CATALOG_ID.RECKLESS_FURY,
        CARD_CATALOG_ID.BLOODRUSH,
        CARD_CATALOG_ID.LAST_STAND,
        CARD_CATALOG_ID.BERSERKER_RAGE,
    ],
    [CARD_ARCHETYPE.SHADOW_ARTS]: [
        CARD_CATALOG_ID.VENOM_STRIKE,
        CARD_CATALOG_ID.WEAKEN,
        CARD_CATALOG_ID.MIASMA,
        CARD_CATALOG_ID.SMOKE_SCREEN,
        CARD_CATALOG_ID.SHADOW_CLOAK,
        CARD_CATALOG_ID.EXPLOIT_WEAKNESS,
        CARD_CATALOG_ID.CRIPPLING_BLOW,
        CARD_CATALOG_ID.MARK_THE_VEIN,
        CARD_CATALOG_ID.TOXIC_BURST,
        CARD_CATALOG_ID.NOXIOUS_AURA,
        CARD_CATALOG_ID.PLAGUE_FINALE,
    ],
    [CARD_ARCHETYPE.IRON_WILL]: [
        CARD_CATALOG_ID.IRON_GUARD,
        CARD_CATALOG_ID.SHIELD_BASH,
        CARD_CATALOG_ID.REINFORCE,
        CARD_CATALOG_ID.BRACE,
        CARD_CATALOG_ID.COUNTER_STRIKE,
        CARD_CATALOG_ID.TAUNT,
        CARD_CATALOG_ID.BARRICADE,
        CARD_CATALOG_ID.CITADEL_CRUSH,
    ],
    [CARD_ARCHETYPE.SMUGGLER]: [
        CARD_CATALOG_ID.SHADOW_STEP,
        CARD_CATALOG_ID.RECYCLE,
        CARD_CATALOG_ID.CHEAP_SHOT,
        CARD_CATALOG_ID.BACKDOOR_EXIT,
        CARD_CATALOG_ID.LOADED_DICE,
    ],
    [CARD_ARCHETYPE.CURSE]: [
        CARD_CATALOG_ID.HEMORRHAGE,
        CARD_CATALOG_ID.DREAD,
    ],
} as const satisfies Record<CardArchetype, readonly CardCatalogId[]>;

export const RARITY_CARD_IDS = {
    [CARD_RARITY.COMMON]: CARD_TEMPLATES
        .filter((template) => template.params.rarity === CARD_RARITY.COMMON)
        .map((template) => template.catalogId),
    [CARD_RARITY.UNCOMMON]: CARD_TEMPLATES
        .filter((template) => template.params.rarity === CARD_RARITY.UNCOMMON)
        .map((template) => template.catalogId),
    [CARD_RARITY.RARE]: CARD_TEMPLATES
        .filter((template) => template.params.rarity === CARD_RARITY.RARE)
        .map((template) => template.catalogId),
} as const satisfies Record<CardRarity, readonly CardCatalogId[]>;

export const DROPPABLE_CARD_IDS: readonly CardCatalogId[] = CARD_TEMPLATES
    .filter((template) => template.params.archetype !== CARD_ARCHETYPE.CURSE)
    .map((template) => template.catalogId);

export interface CardConditionContext {
    readonly playerMaxHealth?: number;
    readonly playerBlock?: number;
    readonly turnDamageTaken?: number;
    readonly cardsDiscardedThisTurn?: number;
    readonly enemyIntentType?: string;
    readonly enemyIntentDamage?: number;
    readonly targetDebuffCount?: number;
}

function isCardConditionMet(
    card: Card,
    playerHealth: number,
    context: CardConditionContext = {},
): boolean {
    if (!card.condition) {
        return true;
    }

    if (card.condition.type === 'HP_THRESHOLD') {
        return playerHealth <= card.condition.value;
    }

    if (card.condition.type === 'HP_PERCENT_THRESHOLD') {
        const playerMaxHealth = context.playerMaxHealth ?? playerHealth;
        if (playerMaxHealth <= 0) {
            return false;
        }

        return (playerHealth / playerMaxHealth) * 100 <= card.condition.value;
    }

    if (card.condition.type === 'TURN_DAMAGE_TAKEN_AT_LEAST') {
        return (context.turnDamageTaken ?? 0) >= card.condition.value;
    }

    if (card.condition.type === 'COUNTER_WINDOW_READY') {
        return (context.turnDamageTaken ?? 0) >= card.condition.value
            || (
                context.enemyIntentType === 'attack'
                && (context.enemyIntentDamage ?? 0) > 0
                && (context.playerBlock ?? 0) >= card.condition.value
            );
    }

    if (card.condition.type === 'TARGET_DEBUFF_COUNT_AT_LEAST') {
        return (context.targetDebuffCount ?? 0) >= card.condition.value;
    }

    if (card.condition.type === 'MISSING_HEALTH_DAMAGE') {
        return true;
    }

    return true;
}

export function checkCardCondition(
    card: Card,
    playerHealth: number,
    context: CardConditionContext = {},
): boolean {
    if (card.effectPayload?.costWhenConditionMet !== undefined) {
        return true;
    }

    return isCardConditionMet(card, playerHealth, context);
}

export function resolveCardCost(
    card: Card,
    playerHealth: number,
    context: CardConditionContext = {},
): number {
    const conditionalCost = card.effectPayload?.costWhenConditionMet;
    if (conditionalCost === undefined || !card.condition) {
        return card.cost;
    }

    return isCardConditionMet(card, playerHealth, context)
        ? conditionalCost
        : card.cost;
}
