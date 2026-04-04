import { describe, expect, it } from 'vitest';
import { createCard } from '../../../../src/domain/entities/Card';
import { createCardFromCatalog } from '../../../../src/domain/entities/CardCatalog';
import {
    CARD_COLLECTION_STORAGE_KEY,
    CardCollectionService,
} from '../../../../src/domain/services/CardCollectionService';
import type { StorageLike } from '../../../../src/domain/services/SoulShardService';

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

describe('CardCollectionService', () => {
    it('records cards from the deck and exposes unlocked entries in the snapshot', () => {
        const storage = new MemoryStorage();
        const service = new CardCollectionService(storage);

        service.recordCards([
            createCardFromCatalog('QUICK_DRAW'),
            createCardFromCatalog('VENOM_STRIKE'),
        ]);

        const snapshot = service.getSnapshot();
        expect(snapshot.unlockedCards).toBe(2);
        expect(snapshot.totalCards).toBeGreaterThan(snapshot.unlockedCards);
        expect(snapshot.entries.find((entry) => entry.catalogId === 'QUICK_DRAW')?.isUnlocked).toBe(true);
        expect(snapshot.entries.find((entry) => entry.catalogId === 'VENOM_STRIKE')?.isUnlocked).toBe(true);
        expect(snapshot.entries.find((entry) => entry.catalogId === 'IRON_GUARD')?.isUnlocked).toBe(false);
    });

    it('deduplicates catalog ids and ignores cards that are not in the catalog', () => {
        const storage = new MemoryStorage();
        const service = new CardCollectionService(storage);

        service.recordCards([
            createCardFromCatalog('QUICK_DRAW'),
            createCardFromCatalog('QUICK_DRAW'),
            createCard({
                name: 'Custom Card',
                type: 'ATTACK',
                power: 99,
            }),
        ]);

        const storedValue = storage.getItem(CARD_COLLECTION_STORAGE_KEY);
        expect(storedValue).toBe(JSON.stringify(['QUICK_DRAW']));
        expect(service.getSnapshot().unlockedCards).toBe(1);
    });
});
