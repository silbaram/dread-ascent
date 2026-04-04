import type { Card } from '../entities/Card';
import {
    CARD_TEMPLATES,
    createCardFromCatalog,
    resolveCardCatalogId,
    type CardCatalogId,
} from '../entities/CardCatalog';
import type { StorageLike } from './SoulShardService';

export interface CardCollectionEntry {
    readonly catalogId: CardCatalogId;
    readonly card: Card;
    readonly isUnlocked: boolean;
}

export interface CardCollectionSnapshot {
    readonly totalCards: number;
    readonly unlockedCards: number;
    readonly entries: readonly CardCollectionEntry[];
}

export const CARD_COLLECTION_STORAGE_KEY = 'dread-ascent.card-collection';

export class CardCollectionService {
    constructor(
        private readonly storage: StorageLike | undefined = globalThis.localStorage,
        private readonly storageKey = CARD_COLLECTION_STORAGE_KEY,
    ) {}

    getSnapshot(): CardCollectionSnapshot {
        const unlockedCatalogIds = new Set(this.getStoredCatalogIds());
        const entries = CARD_TEMPLATES.map((template) => ({
            catalogId: template.catalogId,
            card: createCardFromCatalog(template.catalogId),
            isUnlocked: unlockedCatalogIds.has(template.catalogId),
        }));

        return {
            totalCards: entries.length,
            unlockedCards: entries.filter((entry) => entry.isUnlocked).length,
            entries,
        };
    }

    recordCards(cards: readonly Card[]): CardCollectionSnapshot {
        const nextCatalogIds = cards
            .map((card) => resolveCardCatalogId(card))
            .filter((catalogId): catalogId is CardCatalogId => !!catalogId);

        return this.recordCatalogIds(nextCatalogIds);
    }

    recordCatalogIds(catalogIds: readonly CardCatalogId[]): CardCollectionSnapshot {
        if (catalogIds.length === 0) {
            return this.getSnapshot();
        }

        const nextCatalogIdSet = new Set([
            ...this.getStoredCatalogIds(),
            ...catalogIds,
        ]);
        const nextCatalogIdList = CARD_TEMPLATES
            .map((template) => template.catalogId)
            .filter((catalogId) => nextCatalogIdSet.has(catalogId));

        this.persistCatalogIds(nextCatalogIdList);
        return this.getSnapshot();
    }

    private getStoredCatalogIds(): CardCatalogId[] {
        if (!this.storage) {
            return [];
        }

        const rawValue = this.storage.getItem(this.storageKey);
        if (!rawValue) {
            return [];
        }

        try {
            const parsedValue = JSON.parse(rawValue);
            if (!Array.isArray(parsedValue)) {
                return [];
            }

            const validCatalogIds = new Set(CARD_TEMPLATES.map((template) => template.catalogId));
            return parsedValue.filter((catalogId): catalogId is CardCatalogId =>
                typeof catalogId === 'string' && validCatalogIds.has(catalogId as CardCatalogId),
            );
        } catch {
            return [];
        }
    }

    private persistCatalogIds(catalogIds: readonly CardCatalogId[]): void {
        this.storage?.setItem(this.storageKey, JSON.stringify(catalogIds));
    }
}
