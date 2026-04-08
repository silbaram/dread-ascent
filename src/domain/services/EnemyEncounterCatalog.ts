import type { EnemyArchetypeId } from '../entities/Enemy';
import type { FloorType } from './FloorProgressionService';
import {
    ENEMY_INTENT_PATTERN,
    type EnemyIntentPattern,
} from './EnemyIntentService';

export const ENEMY_FAMILY_ID = {
    ASH_CULT: 'ash-cult',
    MIRE_BROOD: 'mire-brood',
    NIGHT_STALKERS: 'night-stalkers',
    IRON_WARDENS: 'iron-wardens',
} as const;

export type EnemyFamilyId = (typeof ENEMY_FAMILY_ID)[keyof typeof ENEMY_FAMILY_ID];

export const ENCOUNTER_SLOT_ROLE = {
    RITUALIST: 'ritualist',
    HARASSER: 'harasser',
    AMBUSHER: 'ambusher',
    DUELIST: 'duelist',
    SENTINEL: 'sentinel',
    ANCHOR: 'anchor',
    BOSS: 'boss',
} as const;

export type EncounterSlotRole = (typeof ENCOUNTER_SLOT_ROLE)[keyof typeof ENCOUNTER_SLOT_ROLE];

export const ENCOUNTER_TARGET_LAYOUT = {
    RITUAL_BACKLINE: 'ritual-backline',
    SAPPING_SWARM: 'sapping-swarm',
    DUO_PINCER: 'duo-pincer',
    SHIELD_WALL: 'shield-wall',
    SOLO_BOSS: 'solo-boss',
} as const;

export type EncounterTargetLayout = (typeof ENCOUNTER_TARGET_LAYOUT)[keyof typeof ENCOUNTER_TARGET_LAYOUT];

export interface EnemyFamilyDefinition {
    readonly id: EnemyFamilyId;
    readonly label: string;
    readonly battleRole: string;
    readonly intentSignature: readonly EnemyIntentPattern[];
    readonly reactionRules: readonly string[];
    readonly enabledArchetypeIds: readonly EnemyArchetypeId[];
}

export interface EncounterCompositionSlot {
    readonly slotId: string;
    readonly archetypeId: EnemyArchetypeId;
    readonly role: EncounterSlotRole;
    readonly minCount: number;
    readonly maxCount: number;
}

export interface EnemyEncounterCompositionDefinition {
    readonly id: string;
    readonly label: string;
    readonly familyId: EnemyFamilyId;
    readonly floorType: Exclude<FloorType, 'safe'>;
    readonly minFloor: number;
    readonly maxFloor: number;
    readonly singleEnemyFallback: {
        readonly archetypeId: EnemyArchetypeId;
        readonly role: EncounterSlotRole;
    };
    readonly futureBattleModel: {
        readonly mode: 'multi-enemy';
        readonly targetLayout: EncounterTargetLayout;
        readonly slots: readonly EncounterCompositionSlot[];
    };
}

export interface EncounterCompositionRandomSource {
    next(): number;
}

export interface EncounterCompositionLookup {
    readonly floorNumber: number;
    readonly floorType: Exclude<FloorType, 'safe'>;
}

export const ENEMY_FAMILY_DEFINITIONS = [
    {
        id: ENEMY_FAMILY_ID.ASH_CULT,
        label: 'Ash Cult',
        battleRole: '장기전 성장과 ritual 압박으로 턴을 꼬이게 만드는 패밀리',
        intentSignature: [ENEMY_INTENT_PATTERN.STRIKE, ENEMY_INTENT_PATTERN.RITUAL],
        reactionRules: [
            'long-fight scaling spikes after ritual turns',
            'future curse/ritual followers should join from the backline',
        ],
        enabledArchetypeIds: ['ash-crawler'],
    },
    {
        id: ENEMY_FAMILY_ID.MIRE_BROOD,
        label: 'Mire Brood',
        battleRole: 'poison과 frail 누적으로 방어 계획을 서서히 무너뜨리는 패밀리',
        intentSignature: [ENEMY_INTENT_PATTERN.CURSE, ENEMY_INTENT_PATTERN.CLEANSE],
        reactionRules: [
            'poison pressure should punish slow stabilization turns',
            'cleanse-oriented brood should convert player poison plans into a tempo loss',
        ],
        enabledArchetypeIds: ['mire-broodling'],
    },
    {
        id: ENEMY_FAMILY_ID.NIGHT_STALKERS,
        label: 'Night Stalkers',
        battleRole: '빠른 strike/flurry와 숨김 위협으로 방어 타이밍을 압박하는 패밀리',
        intentSignature: [ENEMY_INTENT_PATTERN.CHARGE, ENEMY_INTENT_PATTERN.AMBUSH],
        reactionRules: [
            'burst windows should arrive through ambush-oriented lead turns',
            'future multi-enemy variants should pressure pincer targeting',
        ],
        enabledArchetypeIds: ['blade-raider'],
    },
    {
        id: ENEMY_FAMILY_ID.IRON_WARDENS,
        label: 'Iron Wardens',
        battleRole: 'guard와 counter-ready turn으로 careless flurry를 처벌하는 패밀리',
        intentSignature: [ENEMY_INTENT_PATTERN.GUARD, ENEMY_INTENT_PATTERN.STRIKE],
        reactionRules: [
            'guard turns should prepare a heavier retaliatory strike next',
            'future formation encounters should keep at least one frontline anchor',
        ],
        enabledArchetypeIds: ['dread-sentinel', 'final-boss'],
    },
] as const satisfies readonly EnemyFamilyDefinition[];

export const ENEMY_ENCOUNTER_COMPOSITIONS = [
    {
        id: 'ash-cult-rite-circle',
        label: 'Ash Cult Rite Circle',
        familyId: ENEMY_FAMILY_ID.ASH_CULT,
        floorType: 'normal',
        minFloor: 1,
        maxFloor: 45,
        singleEnemyFallback: {
            archetypeId: 'ash-crawler',
            role: ENCOUNTER_SLOT_ROLE.RITUALIST,
        },
        futureBattleModel: {
            mode: 'multi-enemy',
            targetLayout: ENCOUNTER_TARGET_LAYOUT.RITUAL_BACKLINE,
            slots: [
                {
                    slotId: 'front-ritualist',
                    archetypeId: 'ash-crawler',
                    role: ENCOUNTER_SLOT_ROLE.RITUALIST,
                    minCount: 1,
                    maxCount: 1,
                },
                {
                    slotId: 'back-harasser',
                    archetypeId: 'ash-crawler',
                    role: ENCOUNTER_SLOT_ROLE.HARASSER,
                    minCount: 1,
                    maxCount: 2,
                },
            ],
        },
    },
    {
        id: 'mire-brood-sapping-swarm',
        label: 'Mire Brood Sapping Swarm',
        familyId: ENEMY_FAMILY_ID.MIRE_BROOD,
        floorType: 'normal',
        minFloor: 40,
        maxFloor: 70,
        singleEnemyFallback: {
            archetypeId: 'mire-broodling',
            role: ENCOUNTER_SLOT_ROLE.HARASSER,
        },
        futureBattleModel: {
            mode: 'multi-enemy',
            targetLayout: ENCOUNTER_TARGET_LAYOUT.SAPPING_SWARM,
            slots: [
                {
                    slotId: 'front-broodling',
                    archetypeId: 'mire-broodling',
                    role: ENCOUNTER_SLOT_ROLE.HARASSER,
                    minCount: 1,
                    maxCount: 1,
                },
                {
                    slotId: 'rear-drainer',
                    archetypeId: 'mire-broodling',
                    role: ENCOUNTER_SLOT_ROLE.ANCHOR,
                    minCount: 1,
                    maxCount: 2,
                },
            ],
        },
    },
    {
        id: 'night-stalkers-pincer',
        label: 'Night Stalkers Pincer',
        familyId: ENEMY_FAMILY_ID.NIGHT_STALKERS,
        floorType: 'normal',
        minFloor: 20,
        maxFloor: 80,
        singleEnemyFallback: {
            archetypeId: 'blade-raider',
            role: ENCOUNTER_SLOT_ROLE.AMBUSHER,
        },
        futureBattleModel: {
            mode: 'multi-enemy',
            targetLayout: ENCOUNTER_TARGET_LAYOUT.DUO_PINCER,
            slots: [
                {
                    slotId: 'left-ambusher',
                    archetypeId: 'blade-raider',
                    role: ENCOUNTER_SLOT_ROLE.AMBUSHER,
                    minCount: 1,
                    maxCount: 1,
                },
                {
                    slotId: 'right-duelist',
                    archetypeId: 'blade-raider',
                    role: ENCOUNTER_SLOT_ROLE.DUELIST,
                    minCount: 1,
                    maxCount: 1,
                },
            ],
        },
    },
    {
        id: 'iron-wardens-shield-wall',
        label: 'Iron Wardens Shield Wall',
        familyId: ENEMY_FAMILY_ID.IRON_WARDENS,
        floorType: 'normal',
        minFloor: 50,
        maxFloor: 99,
        singleEnemyFallback: {
            archetypeId: 'dread-sentinel',
            role: ENCOUNTER_SLOT_ROLE.SENTINEL,
        },
        futureBattleModel: {
            mode: 'multi-enemy',
            targetLayout: ENCOUNTER_TARGET_LAYOUT.SHIELD_WALL,
            slots: [
                {
                    slotId: 'front-sentinel',
                    archetypeId: 'dread-sentinel',
                    role: ENCOUNTER_SLOT_ROLE.SENTINEL,
                    minCount: 1,
                    maxCount: 1,
                },
                {
                    slotId: 'back-anchor',
                    archetypeId: 'dread-sentinel',
                    role: ENCOUNTER_SLOT_ROLE.ANCHOR,
                    minCount: 1,
                    maxCount: 2,
                },
            ],
        },
    },
    {
        id: 'iron-wardens-blackout-boss',
        label: 'Iron Wardens Blackout Boss',
        familyId: ENEMY_FAMILY_ID.IRON_WARDENS,
        floorType: 'boss',
        minFloor: 1,
        maxFloor: 999,
        singleEnemyFallback: {
            archetypeId: 'final-boss',
            role: ENCOUNTER_SLOT_ROLE.BOSS,
        },
        futureBattleModel: {
            mode: 'multi-enemy',
            targetLayout: ENCOUNTER_TARGET_LAYOUT.SOLO_BOSS,
            slots: [
                {
                    slotId: 'boss-core',
                    archetypeId: 'final-boss',
                    role: ENCOUNTER_SLOT_ROLE.BOSS,
                    minCount: 1,
                    maxCount: 1,
                },
            ],
        },
    },
] as const satisfies readonly EnemyEncounterCompositionDefinition[];

export function getEnemyFamilyForArchetype(
    archetypeId: EnemyArchetypeId,
): EnemyFamilyDefinition | undefined {
    return ENEMY_FAMILY_DEFINITIONS.find((family) =>
        family.enabledArchetypeIds.some((enabledArchetypeId) => enabledArchetypeId === archetypeId),
    );
}

export function listEncounterCompositions(
    lookup: EncounterCompositionLookup,
): readonly EnemyEncounterCompositionDefinition[] {
    return ENEMY_ENCOUNTER_COMPOSITIONS.filter((composition) =>
        composition.floorType === lookup.floorType
        && lookup.floorNumber >= composition.minFloor
        && lookup.floorNumber <= composition.maxFloor,
    );
}

export function selectEncounterComposition(
    lookup: EncounterCompositionLookup,
    random: EncounterCompositionRandomSource,
): EnemyEncounterCompositionDefinition | undefined {
    const compositions = listEncounterCompositions(lookup);
    if (compositions.length === 0) {
        return undefined;
    }

    const index = Math.floor(random.next() * compositions.length);
    return compositions[Math.min(index, compositions.length - 1)];
}
