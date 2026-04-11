// ---------------------------------------------------------------------------
// Card Drop Service — 적 처치 시 카드 보상 오퍼 및 덱 교체 (순수 도메인 로직)
// ---------------------------------------------------------------------------

import {
    CARD_ARCHETYPE,
    CARD_RARITY,
    type Card,
    type CardArchetype,
    type CardRarity,
} from '../entities/Card';
import {
    ARCHETYPE_CARD_IDS,
    createCardFromCatalog,
    getCardTemplate,
    type CardCatalogId,
} from '../entities/CardCatalog';
import type { EnemyKind } from '../entities/Enemy';
import type { DeckService } from './DeckService';

// ---------------------------------------------------------------------------
// Random Source (DI for testing)
// ---------------------------------------------------------------------------

export interface DropRandomSource {
    /** 0 이상 1 미만의 난수를 반환한다. */
    next(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 일반 적 카드 드롭 확률 */
export const NORMAL_DROP_RATE = 0.3;

/** 엘리트 적 카드 드롭 확률 */
export const ELITE_DROP_RATE = 0.6;

/** 보스 카드 드롭 확률 */
export const BOSS_DROP_RATE = 1.0;

const BUILD_ARCHETYPES = [
    CARD_ARCHETYPE.BLOOD_OATH,
    CARD_ARCHETYPE.SHADOW_ARTS,
    CARD_ARCHETYPE.IRON_WILL,
    CARD_ARCHETYPE.SMUGGLER,
] as const satisfies readonly CardArchetype[];

const RARITY_FALLBACK_ORDER = {
    [CARD_RARITY.COMMON]: [CARD_RARITY.COMMON, CARD_RARITY.UNCOMMON, CARD_RARITY.RARE],
    [CARD_RARITY.UNCOMMON]: [CARD_RARITY.UNCOMMON, CARD_RARITY.COMMON, CARD_RARITY.RARE],
    [CARD_RARITY.RARE]: [CARD_RARITY.RARE, CARD_RARITY.UNCOMMON, CARD_RARITY.COMMON],
} as const satisfies Record<CardRarity, readonly CardRarity[]>;

const RARITY_FLOOR_BAND_SIZE = 4;
const COMMON_WEIGHT_STEP = 5;
const RARE_WEIGHT_STEP = 2;
const MIN_COMMON_WEIGHT = 40;
const MAX_RARE_WEIGHT = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const CARD_REWARD_SLOT = {
    ARCHETYPE: 'ARCHETYPE',
    NEUTRAL: 'NEUTRAL',
    RANDOM: 'RANDOM',
} as const;

export type CardRewardSlot = (typeof CARD_REWARD_SLOT)[keyof typeof CARD_REWARD_SLOT];

export interface CardRewardChoice {
    readonly slot: CardRewardSlot;
    readonly card: Card;
    readonly catalogId: CardCatalogId;
}

export interface CardRewardOffer {
    readonly choices: readonly CardRewardChoice[];
    readonly biasArchetype: CardArchetype;
    readonly rarityBand: CardRarity;
}

/** 카드 드롭 판정 결과 */
export type CardDropResult =
    | { readonly dropped: false }
    | {
          readonly dropped: true;
          readonly offer: CardRewardOffer;
      };

/** 덱이 가득 찼을 때 교체 처리 결과 */
export type CardSwapResult =
    | { readonly swapped: true; readonly removedCard: Card; readonly addedCard: Card }
    | { readonly swapped: false; readonly reason: 'card-not-found' | 'cancelled' };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * 적 처치 시 카드 드롭 확률 판정 및 3장 보상 오퍼 생성을 담당한다.
 * 도메인 순수 로직으로, Phaser 의존 없음.
 */
export class CardDropService {
    private readonly random: DropRandomSource;

    constructor(random?: DropRandomSource) {
        this.random = random ?? { next: () => Math.random() };
    }

    /**
     * 적 처치 시 카드 드롭을 판정한다.
     *
     * @param enemyKind 적 종류 (normal / boss)
     * @param isElite 엘리트 여부
     * @param floorNumber 현재 층 번호
     * @param deckCards 현재 덱 카드 목록
     * @returns 드롭 결과
     */
    rollCardDrop(
        enemyKind: EnemyKind,
        isElite: boolean,
        floorNumber: number,
        deckCards: readonly Card[],
    ): CardDropResult {
        const dropRate = this.getDropRate(enemyKind, isElite);
        const roll = this.random.next();

        if (roll >= dropRate) {
            return { dropped: false };
        }

        return {
            dropped: true,
            offer: this.generateRewardOffer(floorNumber, deckCards),
        };
    }

    /**
     * 현재 덱 방향과 층수에 맞는 카드 보상 오퍼를 생성한다.
     */
    generateRewardOffer(floorNumber: number, deckCards: readonly Card[]): CardRewardOffer {
        const biasArchetype = this.detectBiasArchetype(deckCards);
        const rarityBand = this.rollRewardRarity(floorNumber);
        const excludedCatalogIds = new Set<CardCatalogId>();

        const choices: CardRewardChoice[] = [
            this.createChoice(
                CARD_REWARD_SLOT.ARCHETYPE,
                ARCHETYPE_CARD_IDS[biasArchetype],
                rarityBand,
                excludedCatalogIds,
            ),
            this.createChoice(
                CARD_REWARD_SLOT.NEUTRAL,
                ARCHETYPE_CARD_IDS[CARD_ARCHETYPE.NEUTRAL],
                rarityBand,
                excludedCatalogIds,
            ),
            this.createChoice(
                CARD_REWARD_SLOT.RANDOM,
                this.getRandomSlotCatalogIds(biasArchetype),
                rarityBand,
                excludedCatalogIds,
            ),
        ];

        return {
            choices,
            biasArchetype,
            rarityBand,
        };
    }

    /**
     * 현재 덱의 방향성을 감지한다. 방향성이 없으면 빌드 아키타입 중 하나를 시드로 선택한다.
     */
    detectBiasArchetype(deckCards: readonly Card[]): CardArchetype {
        const counts = new Map<CardArchetype, number>(
            BUILD_ARCHETYPES.map((archetype) => [archetype, 0]),
        );

        for (const card of deckCards) {
            if (!counts.has(card.archetype)) {
                continue;
            }
            counts.set(card.archetype, (counts.get(card.archetype) ?? 0) + 1);
        }

        const dominant = BUILD_ARCHETYPES.reduce<{
            archetype: CardArchetype;
            count: number;
        } | null>((current, archetype) => {
            const nextCount = counts.get(archetype) ?? 0;
            if (!current || nextCount > current.count) {
                return { archetype, count: nextCount };
            }
            return current;
        }, null);

        if (dominant && dominant.count > 0) {
            return dominant.archetype;
        }

        return this.pickRandom(BUILD_ARCHETYPES);
    }

    /**
     * 층수에 따른 희귀도 가중치를 계산한다.
     */
    getRewardRarityWeights(floorNumber: number): Record<CardRarity, number> {
        const band = Math.max(0, Math.floor((Math.max(1, floorNumber) - 1) / RARITY_FLOOR_BAND_SIZE));
        const common = Math.max(MIN_COMMON_WEIGHT, 60 - (band * COMMON_WEIGHT_STEP));
        const rare = Math.min(MAX_RARE_WEIGHT, 10 + (band * RARE_WEIGHT_STEP));
        const uncommon = 100 - common - rare;

        return {
            [CARD_RARITY.COMMON]: common,
            [CARD_RARITY.UNCOMMON]: uncommon,
            [CARD_RARITY.RARE]: rare,
        };
    }

    /**
     * 덱이 가득 찬 상태에서 기존 카드를 교체한다.
     *
     * @param removeCardId 제거할 기존 카드 ID
     * @param newCard 추가할 새 카드
     * @param deckService 플레이어 덱 서비스
     * @returns 교체 결과
     */
    swapCard(
        removeCardId: string,
        newCard: Card,
        deckService: DeckService,
    ): CardSwapResult {
        const existingCard = deckService.findCard(removeCardId);
        if (!existingCard) {
            return { swapped: false, reason: 'card-not-found' };
        }

        const removedCard: Card = { ...existingCard };
        deckService.removeCard(removeCardId);
        deckService.addCard(newCard);

        return {
            swapped: true,
            removedCard,
            addedCard: newCard,
        };
    }

    /**
     * 적 종류에 따른 드롭 확률을 반환한다.
     */
    getDropRate(enemyKind: EnemyKind, isElite: boolean): number {
        if (enemyKind === 'boss') {
            return BOSS_DROP_RATE;
        }
        if (isElite) {
            return ELITE_DROP_RATE;
        }
        return NORMAL_DROP_RATE;
    }

    private rollRewardRarity(floorNumber: number): CardRarity {
        const weights = this.getRewardRarityWeights(floorNumber);
        const roll = this.random.next() * 100;

        if (roll < weights[CARD_RARITY.COMMON]) {
            return CARD_RARITY.COMMON;
        }

        if (roll < weights[CARD_RARITY.COMMON] + weights[CARD_RARITY.UNCOMMON]) {
            return CARD_RARITY.UNCOMMON;
        }

        return CARD_RARITY.RARE;
    }

    private createChoice(
        slot: CardRewardSlot,
        preferredCatalogIds: readonly CardCatalogId[],
        rarityBand: CardRarity,
        excludedCatalogIds: Set<CardCatalogId>,
    ): CardRewardChoice {
        const catalogId = this.selectCatalogId(preferredCatalogIds, rarityBand, excludedCatalogIds);
        excludedCatalogIds.add(catalogId);

        return {
            slot,
            catalogId,
            card: createCardFromCatalog(catalogId),
        };
    }

    private selectCatalogId(
        preferredCatalogIds: readonly CardCatalogId[],
        rarityBand: CardRarity,
        excludedCatalogIds: ReadonlySet<CardCatalogId>,
    ): CardCatalogId {
        for (const fallbackRarity of RARITY_FALLBACK_ORDER[rarityBand]) {
            const candidates = this.filterCatalogIds(preferredCatalogIds, excludedCatalogIds, fallbackRarity);
            if (candidates.length > 0) {
                return this.pickRandom(candidates);
            }
        }

        const anyPreferred = this.filterCatalogIds(preferredCatalogIds, excludedCatalogIds);
        if (anyPreferred.length > 0) {
            return this.pickRandom(anyPreferred);
        }

        const anyDroppable = this.filterCatalogIds(
            [...new Set(Object.values(ARCHETYPE_CARD_IDS).flat())],
            excludedCatalogIds,
        );
        if (anyDroppable.length > 0) {
            return this.pickRandom(anyDroppable);
        }

        throw new Error('No available card reward candidates.');
    }

    private filterCatalogIds(
        catalogIds: readonly CardCatalogId[],
        excludedCatalogIds: ReadonlySet<CardCatalogId>,
        rarityBand?: CardRarity,
    ): CardCatalogId[] {
        return catalogIds.filter((catalogId) => {
            if (excludedCatalogIds.has(catalogId)) {
                return false;
            }

            const template = getCardTemplate(catalogId);
            if (!template) {
                return false;
            }

            if (rarityBand && template.params.rarity !== rarityBand) {
                return false;
            }

            return template.params.archetype !== CARD_ARCHETYPE.CURSE;
        });
    }

    private getRandomSlotCatalogIds(biasArchetype: CardArchetype): readonly CardCatalogId[] {
        const preferredArchetypes = BUILD_ARCHETYPES.filter((archetype) => archetype !== biasArchetype);
        if (preferredArchetypes.length > 0) {
            return preferredArchetypes.flatMap((archetype) => ARCHETYPE_CARD_IDS[archetype]);
        }

        return BUILD_ARCHETYPES.flatMap((archetype) => ARCHETYPE_CARD_IDS[archetype]);
    }

    private pickRandom<T>(values: readonly T[]): T {
        const index = Math.min(values.length - 1, Math.floor(this.random.next() * values.length));
        return values[index];
    }
}
