// ---------------------------------------------------------------------------
// Equipment Card Bonus Service — 장비 스탯 → 카드 파워 보너스 변환
// ---------------------------------------------------------------------------

import { CARD_TYPE, type Card } from '../entities/Card';
import { EQUIPMENT_SLOT, type InventoryItem } from '../entities/Item';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 장비로부터 추출된 카드 파워 보너스. */
export interface EquipmentCardBonus {
    /** 공격 카드에 가산되는 보너스 (무기 attack 스탯) */
    readonly attackBonus: number;
    /** 수비 카드에 가산되는 보너스 (방어구 defense 스탯) */
    readonly guardBonus: number;
}

// ---------------------------------------------------------------------------
// Pure Functions
// ---------------------------------------------------------------------------

/**
 * 인벤토리에서 장착 중인 장비의 카드 파워 보너스를 추출한다.
 * - 무기(WEAPON)의 attack 스탯 → 공격 카드 보너스
 * - 방어 장비(HELMET/BODY_ARMOR/BOOTS)의 defense 스탯 → 수비 카드 보너스
 * - 미장착 시 보너스 0
 */
export function getEquipmentCardBonus(inventory: readonly InventoryItem[]): EquipmentCardBonus {
    let attackBonus = 0;
    let guardBonus = 0;

    for (const item of inventory) {
        if (!item.isEquipped || !item.equipment) continue;

        if (item.equipment.slot === EQUIPMENT_SLOT.WEAPON) {
            attackBonus += item.equipment.statModifier.attack ?? 0;
        }

        if (
            item.equipment.slot === EQUIPMENT_SLOT.HELMET
            || item.equipment.slot === EQUIPMENT_SLOT.BODY_ARMOR
            || item.equipment.slot === EQUIPMENT_SLOT.BOOTS
            || item.equipment.slot === EQUIPMENT_SLOT.ARMOR
        ) {
            guardBonus += item.equipment.statModifier.defense ?? 0;
        }
    }

    return { attackBonus, guardBonus };
}

/**
 * 카드에 장비 보너스를 적용하여 최종 파워가 반영된 카드를 반환한다.
 * 원본 카드는 변경하지 않는다 (불변).
 */
export function applyEquipmentBonus(card: Card, bonus: EquipmentCardBonus): Card {
    const bonusValue = card.type === CARD_TYPE.ATTACK
        ? bonus.attackBonus
        : bonus.guardBonus;

    if (bonusValue === 0) {
        return card;
    }

    return {
        ...card,
        power: Math.max(0, card.power + bonusValue),
    };
}

/**
 * 카드 배열에 장비 보너스를 일괄 적용한다.
 */
export function applyEquipmentBonusToHand(
    hand: readonly Card[],
    bonus: EquipmentCardBonus,
): readonly Card[] {
    return hand.map((card) => applyEquipmentBonus(card, bonus));
}
