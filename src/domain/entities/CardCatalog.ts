// ---------------------------------------------------------------------------
// Card Catalog — 7종 기본 카드 정의 (TASK-035)
// ---------------------------------------------------------------------------

import {
    createCard,
    type Card,
    type CreateCardParams,
} from './Card';
import {
    CARD_BALANCE_TABLE,
    CARD_CATALOG_ID,
    STARTER_DECK_COMPOSITION,
    type CardCatalogId,
} from '../services/CombatBalance';

// ---------------------------------------------------------------------------
// Card Template Definitions
// ---------------------------------------------------------------------------

export { CARD_CATALOG_ID, STARTER_DECK_COMPOSITION };
export type { CardCatalogId };

/** 카드 템플릿. createCard에 전달할 파라미터를 정의한다. */
export interface CardTemplate {
    readonly catalogId: CardCatalogId;
    readonly params: Omit<CreateCardParams, 'id'>;
}

const CARD_BALANCE_ENTRIES = Object.entries(CARD_BALANCE_TABLE) as readonly [
    CardCatalogId,
    Omit<CreateCardParams, 'id'>,
][];

/** 7종 기본 카드 템플릿. */
export const CARD_TEMPLATES: readonly CardTemplate[] = CARD_BALANCE_ENTRIES.map(
    ([catalogId, params]) => ({
        catalogId,
        params,
    }),
);

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/** 카드 카탈로그 맵 (catalogId → template). */
const CATALOG_MAP = new Map<CardCatalogId, CardTemplate>(
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
