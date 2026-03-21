// ---------------------------------------------------------------------------
// 카드 배틀 통합 테스트 — DeckService + CardBattleService + CardBattleResolver
// 런 시작 → 덱 초기화 → 드로우 → 적 카드 풀 → 상성 판정 흐름 검증
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import { CARD_TYPE, resetCardSequence } from '../../../src/domain/entities/Card';
import { resolveCardClash } from '../../../src/domain/services/CardBattleResolver';
import {
    CardBattleService,
    HAND_SIZE,
    type BattleRandomSource,
} from '../../../src/domain/services/CardBattleService';
import {
    DeckService,
    DEFAULT_ATTACK_CARD_COUNT,
    DEFAULT_ATTACK_CARD_POWER,
    DEFAULT_GUARD_CARD_COUNT,
    DEFAULT_GUARD_CARD_POWER,
} from '../../../src/domain/services/DeckService';
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
    // TASK-023: 새 런 시작 시 기본 덱 5장 자동 지급
    // -----------------------------------------------------------------------

    describe('starter deck initialization on new run', () => {
        it('provides 5 starter cards (3 attack + 2 guard) after initializeStarterDeck', () => {
            // Act — 새 런 시작 시 호출되는 초기화
            const snapshot = deckService.initializeStarterDeck();

            // Assert
            expect(snapshot.size).toBe(DEFAULT_ATTACK_CARD_COUNT + DEFAULT_GUARD_CARD_COUNT);

            const cards = deckService.getCards();
            const attacks = cards.filter((c) => c.type === CARD_TYPE.ATTACK);
            const guards = cards.filter((c) => c.type === CARD_TYPE.GUARD);
            expect(attacks).toHaveLength(DEFAULT_ATTACK_CARD_COUNT);
            expect(guards).toHaveLength(DEFAULT_GUARD_CARD_COUNT);

            for (const card of attacks) expect(card.power).toBe(DEFAULT_ATTACK_CARD_POWER);
            for (const card of guards) expect(card.power).toBe(DEFAULT_GUARD_CARD_POWER);
        });
    });

    // -----------------------------------------------------------------------
    // TASK-023: 덱 저장/복원 흐름
    // -----------------------------------------------------------------------

    describe('deck persistence round-trip', () => {
        it('saves and restores deck through RunPersistenceService', () => {
            // Arrange
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

            // Act — save and reload
            persistence.save(snapshot);
            const loaded = persistence.load();

            // Assert
            expect(loaded).toBeDefined();
            expect(loaded!.deck).toHaveLength(originalCards.length);
            expect(loaded!.deck).toEqual(originalCards);

            // Restore into a new DeckService
            const newDeckService = new DeckService();
            newDeckService.restoreDeck(loaded!.deck);
            expect(newDeckService.getCards()).toEqual(originalCards);
        });

        it('loads empty deck from legacy saves without deck field', () => {
            // Arrange — 이전 저장 형식 (deck 필드 없음)
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

            // Act
            const loaded = persistence.load();

            // Assert — 이전 데이터와 호환, 빈 덱으로 처리
            expect(loaded).toBeDefined();
            expect(loaded!.deck).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // TASK-024: 배틀 진입 시 드로우 흐름
    // -----------------------------------------------------------------------

    describe('battle entry draw flow', () => {
        it('draws 3 cards from starter deck on battle entry', () => {
            // Arrange — 새 런 시작
            deckService.initializeStarterDeck();
            const deckCards = deckService.getCards();

            // Act — 배틀 진입 시 드로우
            const drawResult = cardBattleService.drawHand(deckCards);

            // Assert
            expect(drawResult.hand).toHaveLength(HAND_SIZE);
            expect(drawResult.deckSize).toBe(5);

            // 드로우된 카드는 모두 덱에 존재하는 카드
            for (const card of drawResult.hand) {
                expect(deckCards.some((d) => d.id === card.id)).toBe(true);
            }

            // 중복 없음
            const ids = drawResult.hand.map((c) => c.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('draws all remaining cards when deck has fewer than 3', () => {
            // Arrange — 2장만 있는 덱
            deckService.initializeStarterDeck();
            // 3장 제거해서 2장만 남김
            const cards = deckService.getCards();
            deckService.removeCard(cards[0].id);
            deckService.removeCard(cards[1].id);
            deckService.removeCard(cards[2].id);
            expect(deckService.getCards()).toHaveLength(2);

            // Act
            const drawResult = cardBattleService.drawHand(deckService.getCards());

            // Assert
            expect(drawResult.hand).toHaveLength(2);
        });

        it('generates enemy card pool based on enemy kind', () => {
            // Act
            const normalPool = cardBattleService.generateEnemyCardPool('normal', false);
            const elitePool = cardBattleService.generateEnemyCardPool('normal', true);
            const bossPool = cardBattleService.generateEnemyCardPool('boss', false);

            // Assert
            expect(normalPool).toHaveLength(3); // 2 attack + 1 guard
            expect(elitePool).toHaveLength(5);  // 3 attack + 2 guard
            expect(bossPool).toHaveLength(7);   // 4 attack + 3 guard
        });
    });

    // -----------------------------------------------------------------------
    // TASK-024 + TASK-025: 드로우 → 적 카드 선택 → 상성 판정 end-to-end
    // -----------------------------------------------------------------------

    describe('draw to clash resolution', () => {
        it('resolves a full draw → enemy select → clash cycle', () => {
            // Arrange — 새 런
            deckService.initializeStarterDeck();
            const deckCards = deckService.getCards();

            // Act — 드로우
            const drawResult = cardBattleService.drawHand(deckCards);
            expect(drawResult.hand.length).toBeGreaterThan(0);

            // 적 카드 풀 생성 및 적 카드 선택
            const enemyPool = cardBattleService.generateEnemyCardPool('normal', false);
            const enemyCard = cardBattleService.selectEnemyCard(enemyPool);

            // 상성 판정
            const playerCard = drawResult.hand[0];
            const clashResult = resolveCardClash(playerCard, enemyCard);

            // Assert — 결과가 유효한 값을 가짐
            expect(clashResult.playerDamage).toBeGreaterThanOrEqual(0);
            expect(clashResult.enemyDamage).toBeGreaterThanOrEqual(0);
            expect(clashResult.playerCard).toBe(playerCard);
            expect(clashResult.enemyCard).toBe(enemyCard);
            expect(['ATTACK_VS_GUARD', 'ATTACK_VS_ATTACK', 'GUARD_VS_GUARD']).toContain(clashResult.matchup);
            expect(clashResult.description).toBeTruthy();
        });
    });
});
