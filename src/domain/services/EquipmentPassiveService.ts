import type {
    EquipmentPassive,
    EquipmentPassiveKind,
    InventoryItem,
} from '../entities/Item';

export function getEquippedItems(inventory: readonly InventoryItem[]): readonly InventoryItem[] {
    return inventory.filter((item) => item.isEquipped && item.equipment);
}

export function getEquippedPassives(
    inventory: readonly InventoryItem[],
): readonly EquipmentPassive[] {
    return getEquippedItems(inventory).flatMap((item) => item.equipment?.passives ?? []);
}

export function getPassivesByKind(
    passives: readonly EquipmentPassive[],
    kind: EquipmentPassiveKind,
): readonly EquipmentPassive[] {
    return passives.filter((entry) => entry.kind === kind);
}

export function sumPassiveValues(
    passives: readonly EquipmentPassive[],
    kind: EquipmentPassiveKind,
): number {
    return getPassivesByKind(passives, kind).reduce(
        (sum, entry) => sum + (entry.value ?? 0),
        0,
    );
}
