import { beforeEach, describe, expect, it } from 'vitest';
import {
    getEquipmentCardBonus,
    applyEquipmentBonus,
    applyEquipmentBonusToHand,
    type EquipmentCardBonus,
} from '../../../../src/domain/services/EquipmentCardBonusService';
import { CARD_TYPE, createCard, resetCardSequence, type Card } from '../../../../src/domain/entities/Card';
import {
    EQUIPMENT_SLOT,
    ITEM_TYPE,
    ITEM_RARITY,
    type InventoryItem,
} from '../../../../src/domain/entities/Item';
import { resolveCardClash } from '../../../../src/domain/services/CardBattleResolver';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createEquipmentItem(overrides: {
    slot: 'WEAPON' | 'HELMET' | 'BODY_ARMOR' | 'BOOTS';
    attack?: number;
    defense?: number;
    isEquipped?: boolean;
}): InventoryItem {
    const idBySlot = {
        WEAPON: 'iron-dagger',
        HELMET: 'iron-helm',
        BODY_ARMOR: 'leather-vest',
        BOOTS: 'iron-boots',
    } as const;

    return {
        id: idBySlot[overrides.slot],
        instanceId: `inst-${overrides.slot.toLowerCase()}-${Math.random()}`,
        name: `Test ${overrides.slot}`,
        type: ITEM_TYPE.EQUIPMENT,
        rarity: ITEM_RARITY.COMMON,
        icon: '⚔️',
        stackable: false,
        maxStack: 1,
        quantity: 1,
        description: 'Test equipment',
        isEquipped: overrides.isEquipped ?? true,
        equipment: {
            slot: EQUIPMENT_SLOT[overrides.slot],
            statModifier: {
                attack: overrides.attack,
                defense: overrides.defense,
            },
        },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EquipmentCardBonusService', () => {
    beforeEach(() => {
        resetCardSequence();
    });

    describe('getEquipmentCardBonus', () => {
        it('장착된 무기의 attack 스탯을 attackBonus로 추출한다', () => {
            const inventory: InventoryItem[] = [
                createEquipmentItem({ slot: 'WEAPON', attack: 5 }),
            ];

            const bonus = getEquipmentCardBonus(inventory);

            expect(bonus.attackBonus).toBe(5);
            expect(bonus.guardBonus).toBe(0);
        });

        it('장착된 방어 장비의 defense 스탯을 guardBonus로 추출한다', () => {
            const inventory: InventoryItem[] = [
                createEquipmentItem({ slot: 'BODY_ARMOR', defense: 3 }),
            ];

            const bonus = getEquipmentCardBonus(inventory);

            expect(bonus.attackBonus).toBe(0);
            expect(bonus.guardBonus).toBe(3);
        });

        it('무기와 여러 방어 슬롯을 함께 장착하면 보너스를 합산한다', () => {
            const inventory: InventoryItem[] = [
                createEquipmentItem({ slot: 'WEAPON', attack: 5 }),
                createEquipmentItem({ slot: 'HELMET', defense: 1 }),
                createEquipmentItem({ slot: 'BODY_ARMOR', defense: 3 }),
                createEquipmentItem({ slot: 'BOOTS', defense: 1 }),
            ];

            const bonus = getEquipmentCardBonus(inventory);

            expect(bonus.attackBonus).toBe(5);
            expect(bonus.guardBonus).toBe(5);
        });

        it('장비 미장착 시 보너스는 0이다', () => {
            const inventory: InventoryItem[] = [
                createEquipmentItem({ slot: 'WEAPON', attack: 5, isEquipped: false }),
                createEquipmentItem({ slot: 'BODY_ARMOR', defense: 3, isEquipped: false }),
            ];

            const bonus = getEquipmentCardBonus(inventory);

            expect(bonus.attackBonus).toBe(0);
            expect(bonus.guardBonus).toBe(0);
        });

        it('빈 인벤토리 시 보너스는 0이다', () => {
            const bonus = getEquipmentCardBonus([]);

            expect(bonus.attackBonus).toBe(0);
            expect(bonus.guardBonus).toBe(0);
        });

        it('소모품 아이템은 무시한다', () => {
            const consumable: InventoryItem = {
                id: 'small-potion',
                instanceId: 'inst-potion',
                name: 'Small Potion',
                type: ITEM_TYPE.CONSUMABLE,
                rarity: ITEM_RARITY.COMMON,
                icon: '🧪',
                stackable: true,
                maxStack: 5,
                quantity: 1,
                description: 'A potion',
                isEquipped: false,
                consumableEffect: { kind: 'heal', amount: 20 },
            };

            const bonus = getEquipmentCardBonus([consumable]);

            expect(bonus.attackBonus).toBe(0);
            expect(bonus.guardBonus).toBe(0);
        });
    });

    describe('applyEquipmentBonus', () => {
        it('공격 카드에 attackBonus를 적용한다', () => {
            const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });
            const bonus: EquipmentCardBonus = { attackBonus: 5, guardBonus: 3 };

            const boosted = applyEquipmentBonus(card, bonus);

            expect(boosted.power).toBe(13); // 8 + 5
            expect(boosted.type).toBe(CARD_TYPE.ATTACK);
            expect(boosted.name).toBe('Slash');
        });

        it('수비 카드에 guardBonus를 적용한다', () => {
            const card = createCard({ name: 'Shield', type: CARD_TYPE.GUARD, power: 5 });
            const bonus: EquipmentCardBonus = { attackBonus: 5, guardBonus: 3 };

            const boosted = applyEquipmentBonus(card, bonus);

            expect(boosted.power).toBe(8); // 5 + 3
            expect(boosted.type).toBe(CARD_TYPE.GUARD);
        });

        it('보너스가 0이면 원본 카드를 그대로 반환한다', () => {
            const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });
            const bonus: EquipmentCardBonus = { attackBonus: 0, guardBonus: 0 };

            const result = applyEquipmentBonus(card, bonus);

            expect(result).toBe(card); // 동일 참조 (불필요한 복사 없음)
        });

        it('파워는 0 미만이 되지 않는다', () => {
            const card = createCard({ name: 'Weak', type: CARD_TYPE.ATTACK, power: 2 });
            // 음수 보너스 시나리오 (디버프 등 향후 확장)
            const bonus: EquipmentCardBonus = { attackBonus: -5, guardBonus: 0 };

            const boosted = applyEquipmentBonus(card, bonus);

            expect(boosted.power).toBe(0);
        });

        it('원본 카드를 변경하지 않는다 (불변)', () => {
            const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });
            const bonus: EquipmentCardBonus = { attackBonus: 5, guardBonus: 0 };

            applyEquipmentBonus(card, bonus);

            expect(card.power).toBe(8); // 원본 유지
        });
    });

    describe('applyEquipmentBonusToHand', () => {
        it('손패의 모든 카드에 보너스를 적용한다', () => {
            const hand: Card[] = [
                createCard({ name: 'Attack 1', type: CARD_TYPE.ATTACK, power: 8 }),
                createCard({ name: 'Guard 1', type: CARD_TYPE.GUARD, power: 5 }),
                createCard({ name: 'Attack 2', type: CARD_TYPE.ATTACK, power: 6 }),
            ];
            const bonus: EquipmentCardBonus = { attackBonus: 3, guardBonus: 2 };

            const boosted = applyEquipmentBonusToHand(hand, bonus);

            expect(boosted[0].power).toBe(11); // 8 + 3
            expect(boosted[1].power).toBe(7);  // 5 + 2
            expect(boosted[2].power).toBe(9);  // 6 + 3
        });

        it('빈 손패에 대해 빈 배열을 반환한다', () => {
            const bonus: EquipmentCardBonus = { attackBonus: 5, guardBonus: 3 };

            const result = applyEquipmentBonusToHand([], bonus);

            expect(result).toHaveLength(0);
        });
    });

    describe('장비 보너스에 의한 데미지 차이 검증', () => {
        it('무기 장착 시 공격 카드의 판정 데미지가 증가한다', () => {
            // 카드 파워 8 vs 적 수비 파워 6
            // 장비 미장착: 8 - 6 = 2 데미지
            // 무기 +5 장착: (8+5) - 6 = 7 데미지
            const card = createCard({ name: 'Slash', type: CARD_TYPE.ATTACK, power: 8 });
            const noBonusCard = applyEquipmentBonus(card, { attackBonus: 0, guardBonus: 0 });
            const withBonusCard = applyEquipmentBonus(card, { attackBonus: 5, guardBonus: 0 });

            // resolveCardClash를 직접 사용하여 데미지 차이 검증
            // resolveCardClash imported at top level
            const enemyGuard = createCard({ name: 'Block', type: CARD_TYPE.GUARD, power: 6 });

            const noBonusResult = resolveCardClash(noBonusCard, enemyGuard);
            const withBonusResult = resolveCardClash(withBonusCard, enemyGuard);

            expect(noBonusResult.enemyDamage).toBe(2);
            expect(withBonusResult.enemyDamage).toBe(7);
            expect(withBonusResult.enemyDamage).toBeGreaterThan(noBonusResult.enemyDamage);
        });

        it('방어구 장착 시 수비 카드의 방어력이 증가한다', () => {
            // 적 공격 파워 10 vs 카드 수비 파워 5
            // 장비 미장착: 10 - 5 = 5 피해
            // 방어구 +4 장착: 10 - (5+4) = 1 피해
            const card = createCard({ name: 'Shield', type: CARD_TYPE.GUARD, power: 5 });
            const noBonusCard = applyEquipmentBonus(card, { attackBonus: 0, guardBonus: 0 });
            const withBonusCard = applyEquipmentBonus(card, { attackBonus: 0, guardBonus: 4 });

            // resolveCardClash imported at top level
            const enemyAttack = createCard({ name: 'Strike', type: CARD_TYPE.ATTACK, power: 10 });

            const noBonusResult = resolveCardClash(noBonusCard, enemyAttack);
            const withBonusResult = resolveCardClash(withBonusCard, enemyAttack);

            expect(noBonusResult.playerDamage).toBe(5);
            expect(withBonusResult.playerDamage).toBe(1);
            expect(withBonusResult.playerDamage).toBeLessThan(noBonusResult.playerDamage);
        });
    });
});
