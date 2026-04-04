// ---------------------------------------------------------------------------
// 카드 배틀 통합 테스트 — DeckService + CardBattleService + CardBattleResolver
// 런 시작 → 덱 초기화 → 드로우 → 적 카드 풀 → 상성 판정 흐름 검증
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import { CARD_TYPE, resetCardSequence } from '../../../src/domain/entities/Card';
import {
    CARD_CATALOG_ID,
    STARTER_DECK_COMPOSITION,
    createCardFromCatalog,
} from '../../../src/domain/entities/CardCatalog';
import { resolveCardClash } from '../../../src/domain/services/CardBattleResolver';
import {
    CardBattleService,
    HAND_SIZE,
    type BattleRandomSource,
} from '../../../src/domain/services/CardBattleService';
import { DeckService } from '../../../src/domain/services/DeckService';
import {
    RunPersistenceService,
    type RunPersistenceSnapshot,
} from '../../../src/domain/services/RunPersistenceService';
import type { StorageLike } from '../../../src/domain/services/SoulShardService';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

class FixedRandom implements BattleRandomSource {
    constructor(private readonly value: number) {}
    next(): number { return this.value; }
}

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();
    getItem(key: string) { return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
}

const STARTER_DECK_SIZE = STARTER_DECK_COMPOSITION.reduce((sum, e) => sum + e.count, 0);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Card Battle Integration', () => {
    let deckService: DeckService;
    let cardBattleService: CardBattleService;

    beforeEach(() => {
        resetCardSequence();
        deckService = new DeckService();
        cardBattleService = new CardBattleService(new FixedRandom(0.5));
    });

    // -----------------------------------------------------------------------
    // Cycle 3: 새 런 시작 시 기본 덱 7장 (Strike x4 + Fortify x3) 자동 지급
    // -----------------------------------------------------------------------

    describe('starter deck initialization on new run', () => {
        it('provides starter cards (Strike x4 + Fortify x3) after initializeStarterDeck', () => {
            const snapshot = deckService.initializeStarterDeck();

            expect(snapshot.size).toBe(STARTER_DECK_SIZE);

            const cards = deckService.getCards();
            const strikes = cards.filter((c) => c.name === 'Strike');
            const fortifies = cards.filter((c) => c.name === 'Fortify');
            expect(strikes).toHaveLength(4);
            expect(fortifies).toHaveLength(3);

            for (const card of strikes) {
                expect(card.power).toBe(6);
                expect(card.cost).toBe(1);
            }
            for (const card of fortifies) {
                expect(card.power).toBe(5);
                expect(card.cost).toBe(1);
            }
        });
    });

    // -----------------------------------------------------------------------
    // 덱 저장/복원 흐름
    // -----------------------------------------------------------------------

    describe('deck persistence round-trip', () => {
        it('saves and restores deck through RunPersistenceService', () => {
            deckService.initializeStarterDeck();
            const originalCards = [...deckService.getCards()];

            const storage = new MemoryStorage();
            const persistence = new RunPersistenceService(storage);

            const snapshot: RunPersistenceSnapshot = {
                status: 'active',
                floor: { number: 1, type: 'normal' },
                player: { stats: { health: 100, maxHealth: 100, attack: 10, defense: 5 }, experience: 0 },
                inventory: [],
                deck: [...originalCards],
                defeatedEnemyCount: 0,
            };

            persistence.save(snapshot);
            const loaded = persistence.load();

            expect(loaded).toBeDefined();
            expect(loaded!.deck).toHaveLength(originalCards.length);
            expect(loaded!.deck).toEqual(originalCards);

            const newDeckService = new DeckService();
            newDeckService.restoreDeck(loaded!.deck);
            expect(newDeckService.getCards()).toEqual(originalCards);
        });

        it('loads empty deck from legacy saves without deck field', () => {
            const storage = new MemoryStorage();
            const legacyData = JSON.stringify({
                status: 'active',
                floor: { number: 1, type: 'normal' },
                player: { stats: { health: 100, maxHealth: 100, attack: 10, defense: 5 }, experience: 0 },
                inventory: [],
                defeatedEnemyCount: 0,
            });
            storage.setItem('dread-ascent.run-state', legacyData);

            const persistence = new RunPersistenceService(storage);
            const loaded = persistence.load();

            expect(loaded).toBeDefined();
            expect(loaded!.deck).toEqual([]);
        });

        it('round-trips expanded cards without losing derived fields', () => {
            const expandedDeck = [
                createCardFromCatalog(CARD_CATALOG_ID.SHADOW_CLOAK),
                createCardFromCatalog(CARD_CATALOG_ID.BLOOD_PRICE),
                createCardFromCatalog(CARD_CATALOG_ID.BARRICADE),
            ];
            const storage = new MemoryStorage();
            const persistence = new RunPersistenceService(storage);

            const snapshot: RunPersistenceSnapshot = {
                status: 'active',
                floor: { number: 3, type: 'normal' },
                player: {
                    stats: { health: 84, maxHealth: 100, attack: 10, defense: 5, movementSpeed: 100 },
                    experience: 12,
                },
                inventory: [],
                deck: expandedDeck,
                defeatedEnemyCount: 4,
            };

            persistence.save(snapshot);
            const loaded = persistence.load();

            expect(loaded?.deck).toEqual(expandedDeck);
            expect(loaded?.deck[0]).toMatchObject({ drawCount: 1 });
            expect(loaded?.deck[1]).toMatchObject({ selfDamage: 4, drawCount: 2 });
            expect(loaded?.deck[2]).toMatchObject({
                buff: { type: 'BLOCK_PERSIST', value: 1, target: 'SELF' },
            });
        });
    });

    // -----------------------------------------------------------------------
    // 배틀 진입 시 드로우 흐름 (레거시 CardBattleService.drawHand 호환)
    // -----------------------------------------------------------------------

    describe('battle entry draw flow', () => {
        it('draws 3 cards from starter deck on battle entry', () => {
            deckService.initializeStarterDeck();
            const deckCards = deckService.getCards();

            const drawResult = cardBattleService.drawHand(deckCards);

            expect(drawResult.hand).toHaveLength(HAND_SIZE);
            expect(drawResult.deckSize).toBe(STARTER_DECK_SIZE);

            for (const card of drawResult.hand) {
                expect(deckCards.some((d) => d.id === card.id)).toBe(true);
            }

            const ids = drawResult.hand.map((c) => c.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('draws all remaining cards when deck has fewer than 3', () => {
            deckService.initializeStarterDeck();
            const cards = deckService.getCards();
            // 덱을 2장만 남김
            for (let i = 0; i < STARTER_DECK_SIZE - 2; i++) {
                deckService.removeCard(cards[i].id);
            }
            expect(deckService.getCards()).toHaveLength(2);

            const drawResult = cardBattleService.drawHand(deckService.getCards());

            expect(drawResult.hand).toHaveLength(2);
        });

        it('generates enemy card pool based on enemy kind', () => {
            const normalPool = cardBattleService.generateEnemyCardPool('normal', false);
            const elitePool = cardBattleService.generateEnemyCardPool('normal', true);
            const bossPool = cardBattleService.generateEnemyCardPool('boss', false);

            expect(normalPool).toHaveLength(3); // 2 attack + 1 guard
            expect(elitePool).toHaveLength(5);  // 3 attack + 2 guard
            expect(bossPool).toHaveLength(7);   // 4 attack + 3 guard
        });
    });

    // -----------------------------------------------------------------------
    // 드로우 → 적 카드 선택 → 상성 판정 end-to-end
    // -----------------------------------------------------------------------

    describe('draw to clash resolution', () => {
        it('resolves a full draw → enemy select → clash cycle', () => {
            deckService.initializeStarterDeck();
            const deckCards = deckService.getCards();

            const drawResult = cardBattleService.drawHand(deckCards);
            expect(drawResult.hand.length).toBeGreaterThan(0);

            const enemyPool = cardBattleService.generateEnemyCardPool('normal', false);
            const enemyCard = cardBattleService.selectEnemyCard(enemyPool);

            const playerCard = drawResult.hand[0];
            const clashResult = resolveCardClash(playerCard, enemyCard);

            expect(clashResult.playerDamage).toBeGreaterThanOrEqual(0);
            expect(clashResult.enemyDamage).toBeGreaterThanOrEqual(0);
            expect(clashResult.playerCard).toBe(playerCard);
            expect(clashResult.enemyCard).toBe(enemyCard);
            expect(['ATTACK_VS_GUARD', 'ATTACK_VS_ATTACK', 'GUARD_VS_GUARD']).toContain(clashResult.matchup);
            expect(clashResult.description).toBeTruthy();
        });
    });
});
