import { beforeEach, describe, expect, it } from 'vitest';
import {
    CardBattleLoopService,
    BATTLE_PHASE,
    type BattleLoopResult,
} from '../../../../src/domain/services/CardBattleLoopService';
import { CardBattleService, type BattleRandomSource } from '../../../../src/domain/services/CardBattleService';
import { CARD_TYPE, createCard, resetCardSequence, type Card } from '../../../../src/domain/entities/Card';

// ---------------------------------------------------------------------------
// Deterministic random for testing
// ---------------------------------------------------------------------------

class SequentialRandom implements BattleRandomSource {
    private index = 0;

    constructor(private readonly values: number[]) {}

    next(): number {
        const value = this.values[this.index % this.values.length];
        this.index++;
        return value;
    }
}

class FixedRandom implements BattleRandomSource {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestDeck(cards: Array<{ type: 'ATTACK' | 'GUARD'; power: number }>): readonly Card[] {
    return cards.map((c, i) => createCard({
        name: c.type === 'ATTACK' ? `Attack ${i + 1}` : `Guard ${i + 1}`,
        type: CARD_TYPE[c.type],
        power: c.power,
    }));
}

function createEnemyPool(cards: Array<{ type: 'ATTACK' | 'GUARD'; power: number }>): readonly Card[] {
    return cards.map((c, i) => createCard({
        name: c.type === 'ATTACK' ? `Enemy Strike ${i + 1}` : `Enemy Block ${i + 1}`,
        type: CARD_TYPE[c.type],
        power: c.power,
    }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CardBattleLoopService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    describe('runFullBattle', () => {
        it('1라운드에서 적이 사망하면 즉시 종료되고 플레이어 승리를 반환한다', () => {
            // Arrange: 강한 공격 카드로 적 HP 5를 한 방에 처치
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 8 },
                { type: 'GUARD', power: 5 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'GUARD', power: 3 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 5,
                enemyMaxHp: 5,
            });

            // Assert
            expect(result.outcome).toBe('player-win');
            expect(result.totalRounds).toBe(1);
            expect(result.finalEnemyHp).toBe(0);
            expect(result.finalPlayerHp).toBe(50);
        });

        it('2라운드 전투 시나리오를 올바르게 처리한다', () => {
            // Arrange: 공격 파워 6, 적 HP 10, 적 수비 3 → 라운드당 3 데미지 → 4라운드 필요
            // 하지만 적도 공격(파워 4)을 섞어서 반격
            // 라운드1: 플레이어 공격(6) vs 적 수비(3) → 적에게 3 데미지 (적 HP 7)
            // 라운드2: 플레이어 공격(6) vs 적 공격(5) → 양측 피해 (적 -6, 플 -5) → 적 HP 1, 플 HP 45
            // 라운드3: 플레이어 공격(6) vs 적 수비(3) → 적에게 3 데미지 → 적 HP 0
            // random: drawHand에서 셔플용 (고정 0→첫카드 선택), selectEnemyCard에서 선택용
            // drawHand uses Fisher-Yates: need enough random values
            // Pool has 2 cards (index 0=attack, 1=guard): selectEnemyCard picks by random
            const randomValues = [
                // Round 1: drawHand shuffle (3 cards, 2 swaps) + selectEnemyCard (pick guard=index 1)
                0, 0, 0.99, // drawHand shuffle indices (pick first cards)
                0.99,       // selectEnemyCard → index 1 (guard)
                // Round 2: drawHand shuffle + selectEnemyCard (pick attack=index 0)
                0, 0, 0,
                0,          // selectEnemyCard → index 0 (attack)
                // Round 3: drawHand shuffle + selectEnemyCard (pick guard=index 1)
                0, 0, 0,
                0.99,       // selectEnemyCard → index 1 (guard)
            ];
            const random = new SequentialRandom(randomValues);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 6 },
                { type: 'ATTACK', power: 6 },
                { type: 'ATTACK', power: 6 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 5 },
                { type: 'GUARD', power: 3 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 10,
                enemyMaxHp: 10,
            });

            // Assert
            expect(result.outcome).toBe('player-win');
            expect(result.totalRounds).toBeGreaterThanOrEqual(2);
            expect(result.finalEnemyHp).toBe(0);
            expect(result.finalPlayerHp).toBeGreaterThan(0);

            // 모든 라운드가 올바른 순번을 가지는지 확인
            result.rounds.forEach((round, index) => {
                expect(round.round).toBe(index + 1);
            });
        });

        it('플레이어가 사망하면 player-lose를 반환한다', () => {
            // Arrange: 약한 플레이어, 강한 적
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'GUARD', power: 2 },
                { type: 'GUARD', power: 2 },
                { type: 'GUARD', power: 2 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 15 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 10,
                playerMaxHp: 10,
                enemyHp: 100,
                enemyMaxHp: 100,
            });

            // Assert
            expect(result.outcome).toBe('player-lose');
            expect(result.finalPlayerHp).toBe(0);
            expect(result.finalEnemyHp).toBeGreaterThan(0);
        });

        it('동시 사망 시 플레이어 승리로 처리한다', () => {
            // Arrange: 양쪽 모두 공격 카드, 동일 HP → 동시 사망
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 10 },
            ]);

            // Act: 양쪽 HP 10, 공격 파워 10 → 1라운드에 양쪽 모두 HP 0
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 10,
                playerMaxHp: 10,
                enemyHp: 10,
                enemyMaxHp: 10,
            });

            // Assert
            expect(result.outcome).toBe('player-win');
            expect(result.finalPlayerHp).toBe(0);
            expect(result.finalEnemyHp).toBe(0);
            expect(result.totalRounds).toBe(1);
        });

        it('다중 라운드 동시 사망도 플레이어 승리로 처리한다', () => {
            // Arrange: 양쪽 HP 20, 공격 파워 10 → 2라운드에 동시 사망
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 10 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 20,
                playerMaxHp: 20,
                enemyHp: 20,
                enemyMaxHp: 20,
            });

            // Assert
            expect(result.outcome).toBe('player-win');
            expect(result.finalPlayerHp).toBe(0);
            expect(result.finalEnemyHp).toBe(0);
            expect(result.totalRounds).toBe(2);
        });

        it('매 라운드마다 HP가 정확하게 추적된다', () => {
            // Arrange: 플레이어 공격(8) vs 적 공격(5) → 양측 피해
            // 플레이어 HP: 50→45→40... , 적 HP: 30→22→14→6→0
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 8 },
                { type: 'ATTACK', power: 8 },
                { type: 'ATTACK', power: 8 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 5 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 30,
                enemyMaxHp: 30,
            });

            // Assert: 라운드별 HP 감소 추적
            expect(result.rounds.length).toBeGreaterThanOrEqual(2);

            // 첫 라운드: 적 -8 (22), 플 -5 (45)
            expect(result.rounds[0].playerHpAfter).toBe(45);
            expect(result.rounds[0].enemyHpAfter).toBe(22);

            // 각 라운드의 HP는 이전 라운드보다 같거나 줄어야 함
            for (let i = 1; i < result.rounds.length; i++) {
                expect(result.rounds[i].playerHpAfter).toBeLessThanOrEqual(result.rounds[i - 1].playerHpAfter);
                expect(result.rounds[i].enemyHpAfter).toBeLessThanOrEqual(result.rounds[i - 1].enemyHpAfter);
            }

            expect(result.outcome).toBe('player-win');
        });

        it('수비 vs 수비 라운드는 데미지 없이 진행된다', () => {
            // Arrange: 양쪽 수비 → 데미지 없음, 하지만 루프는 계속
            // 안전장치: MAX_ROUNDS로 종료될 것임
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'GUARD', power: 5 },
                { type: 'GUARD', power: 5 },
                { type: 'GUARD', power: 5 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'GUARD', power: 5 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 10,
                playerMaxHp: 10,
                enemyHp: 10,
                enemyMaxHp: 10,
            });

            // Assert: 100라운드까지 돌아도 데미지 없음
            expect(result.totalRounds).toBe(100); // MAX_ROUNDS
            expect(result.finalPlayerHp).toBe(10);
            expect(result.finalEnemyHp).toBe(10);

            // 양쪽 HP가 0이 안 됐으므로 → 적이 살아있으므로 player-lose
            expect(result.outcome).toBe('player-lose');
        });

        it('빈 덱이면 0라운드로 즉시 종료한다', () => {
            // Arrange
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const emptyDeck: readonly Card[] = [];
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 10 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck: emptyDeck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 30,
                enemyMaxHp: 30,
            });

            // Assert
            expect(result.totalRounds).toBe(0);
            expect(result.rounds).toHaveLength(0);
            expect(result.finalPlayerHp).toBe(50);
            expect(result.finalEnemyHp).toBe(30);
            // 적이 안 죽었으므로 player-lose
            expect(result.outcome).toBe('player-lose');
        });

        it('커스텀 카드 선택 전략을 사용할 수 있다', () => {
            // Arrange: 가장 강한 카드를 선택하는 전략
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'GUARD', power: 2 },
                { type: 'ATTACK', power: 15 },
                { type: 'ATTACK', power: 5 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'GUARD', power: 3 },
            ]);

            const selectStrongest = (hand: readonly Card[]): Card => {
                return [...hand].sort((a, b) => b.power - a.power)[0];
            };

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 10,
                enemyMaxHp: 10,
                selectPlayerCard: selectStrongest,
            });

            // Assert
            expect(result.outcome).toBe('player-win');
            // 가장 강한 카드(15)를 선택했으므로 1라운드에 끝남
            expect(result.totalRounds).toBe(1);
            expect(result.rounds[0].playerCard.power).toBe(15);
        });

        it('라운드 결과에 올바른 상성 정보가 기록된다', () => {
            // Arrange
            const random = new FixedRandom(0);
            const service = new CardBattleLoopService(new CardBattleService(random));

            const deck = createTestDeck([
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
                { type: 'ATTACK', power: 10 },
            ]);
            const enemyPool = createEnemyPool([
                { type: 'GUARD', power: 3 },
            ]);

            // Act
            const result = service.runFullBattle({
                deck,
                enemyCardPool: enemyPool,
                playerHp: 50,
                playerMaxHp: 50,
                enemyHp: 5,
                enemyMaxHp: 5,
            });

            // Assert
            expect(result.rounds[0].clashResult.matchup).toBe('ATTACK_VS_GUARD');
            expect(result.rounds[0].clashResult.enemyDamage).toBe(7);
            expect(result.rounds[0].clashResult.playerDamage).toBe(0);
        });
    });

    describe('createBattleState', () => {
        it('IDLE 상태의 초기 배틀 상태를 생성한다', () => {
            // Arrange
            const service = new CardBattleLoopService(new CardBattleService());
            const enemyPool = createEnemyPool([
                { type: 'ATTACK', power: 6 },
            ]);

            // Act
            const state = service.createBattleState({
                deck: [],
                enemyCardPool: enemyPool,
                playerHp: 100,
                playerMaxHp: 100,
                enemyHp: 50,
                enemyMaxHp: 50,
            });

            // Assert
            expect(state.phase).toBe(BATTLE_PHASE.IDLE);
            expect(state.round).toBe(0);
            expect(state.playerHp).toBe(100);
            expect(state.playerMaxHp).toBe(100);
            expect(state.enemyHp).toBe(50);
            expect(state.enemyMaxHp).toBe(50);
            expect(state.playerHand).toHaveLength(0);
            expect(state.rounds).toHaveLength(0);
        });
    });
});
