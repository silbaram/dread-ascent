// ---------------------------------------------------------------------------
// Card Catalog — 7종 기본 카드 정의 (TASK-035)
// ---------------------------------------------------------------------------

import {
    CARD_EFFECT_TYPE,
    CARD_KEYWORD,
    CARD_RARITY,
    CARD_TYPE,
    createCard,
    type Card,
    type CreateCardParams,
} from './Card';

// ---------------------------------------------------------------------------
// Card Template Definitions
// ---------------------------------------------------------------------------

/** 카드 카탈로그 ID. 카드 인스턴스의 식별자와는 별개의 정의 ID. */
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

/** 카드 템플릿. createCard에 전달할 파라미터를 정의한다. */
export interface CardTemplate {
    readonly catalogId: CardCatalogId;
    readonly params: Omit<CreateCardParams, 'id'>;
}

/** 7종 기본 카드 템플릿. */
export const CARD_TEMPLATES: readonly CardTemplate[] = [
    {
        catalogId: CARD_CATALOG_ID.STRIKE,
        params: {
            name: 'Strike',
            type: CARD_TYPE.ATTACK,
            power: 6,
            cost: 1,
            keywords: [],
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
        },
    },
    {
        catalogId: CARD_CATALOG_ID.FORTIFY,
        params: {
            name: 'Fortify',
            type: CARD_TYPE.GUARD,
            power: 5,
            cost: 1,
            keywords: [],
            effectType: CARD_EFFECT_TYPE.BLOCK,
            rarity: CARD_RARITY.COMMON,
        },
    },
    {
        catalogId: CARD_CATALOG_ID.WEAKEN,
        params: {
            name: 'Weaken',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 1,
            keywords: [],
            effectType: CARD_EFFECT_TYPE.STATUS_EFFECT,
            rarity: CARD_RARITY.COMMON,
            statusEffect: { type: 'VULNERABLE', duration: 2 },
        },
    },
    {
        catalogId: CARD_CATALOG_ID.BLOODRUSH,
        params: {
            name: 'Bloodrush',
            type: CARD_TYPE.ATTACK,
            power: 18,
            cost: 2,
            keywords: [CARD_KEYWORD.EXHAUST],
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
        },
    },
    {
        catalogId: CARD_CATALOG_ID.SHADOW_STEP,
        params: {
            name: 'Shadow Step',
            type: CARD_TYPE.ATTACK,
            power: 0,
            cost: 0,
            keywords: [CARD_KEYWORD.EXHAUST],
            effectType: CARD_EFFECT_TYPE.FLEE,
            rarity: CARD_RARITY.RARE,
        },
    },
    {
        catalogId: CARD_CATALOG_ID.LAST_STAND,
        params: {
            name: 'Last Stand',
            type: CARD_TYPE.ATTACK,
            power: 30,
            cost: 3,
            keywords: [CARD_KEYWORD.RETAIN],
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.RARE,
            condition: { type: 'HP_THRESHOLD', value: 5 },
        },
    },
    {
        catalogId: CARD_CATALOG_ID.SHOCKWAVE,
        params: {
            name: 'Shockwave',
            type: CARD_TYPE.ATTACK,
            power: 8,
            cost: 2,
            keywords: [],
            effectType: CARD_EFFECT_TYPE.DAMAGE,
            rarity: CARD_RARITY.COMMON,
        },
    },
] as const;

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/** 카드 카탈로그 맵 (catalogId → template). */
const CATALOG_MAP = new Map<string, CardTemplate>(
    CARD_TEMPLATES.map((t) => [t.catalogId, t]),
);

/** 카탈로그 ID로 카드 인스턴스를 생성한다. */
export function createCardFromCatalog(catalogId: CardCatalogId): Card {
    const template = CATALOG_MAP.get(catalogId);
    if (!template) {
        throw new Error(`Unknown card catalog ID: ${catalogId}`);
    }
    return createCard(template.params);
}

/** 카탈로그 ID로 카드 템플릿을 조회한다. */
export function getCardTemplate(catalogId: CardCatalogId): CardTemplate | undefined {
    return CATALOG_MAP.get(catalogId);
}

// ---------------------------------------------------------------------------
// Starter Deck (Cycle 3)
// ---------------------------------------------------------------------------

/** Cycle 3 시작 덱 구성. */
export const STARTER_DECK_COMPOSITION: readonly { catalogId: CardCatalogId; count: number }[] = [
    { catalogId: CARD_CATALOG_ID.STRIKE, count: 4 },
    { catalogId: CARD_CATALOG_ID.FORTIFY, count: 3 },
];

/** 시작 덱 카드를 생성한다. */
export function createStarterDeckCards(): Card[] {
    const cards: Card[] = [];
    for (const entry of STARTER_DECK_COMPOSITION) {
        for (let i = 0; i < entry.count; i++) {
            cards.push(createCardFromCatalog(entry.catalogId));
        }
    }
    return cards;
}

// ---------------------------------------------------------------------------
// Card Drop Pool (Cycle 3)
// ---------------------------------------------------------------------------

/** 드랍 가능한 카드 목록 (시작 덱 제외 희귀카드 포함). */
export const DROPPABLE_CARD_IDS: readonly CardCatalogId[] = [
    CARD_CATALOG_ID.STRIKE,
    CARD_CATALOG_ID.FORTIFY,
    CARD_CATALOG_ID.WEAKEN,
    CARD_CATALOG_ID.BLOODRUSH,
    CARD_CATALOG_ID.SHOCKWAVE,
    CARD_CATALOG_ID.SHADOW_STEP,
    CARD_CATALOG_ID.LAST_STAND,
];

// ---------------------------------------------------------------------------
// Condition Checking (Last Stand HP threshold)
// ---------------------------------------------------------------------------

/** 카드 사용 조건을 확인한다. 조건이 없으면 항상 true. */
export function checkCardCondition(card: Card, playerHealth: number): boolean {
    if (!card.condition) {
        return true;
    }

    if (card.condition.type === 'HP_THRESHOLD') {
        return playerHealth <= card.condition.value;
    }

    return true;
}
