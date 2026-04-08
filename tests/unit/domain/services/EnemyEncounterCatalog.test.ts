import { describe, expect, it } from 'vitest';
import {
    ENEMY_FAMILY_DEFINITIONS,
    ENEMY_FAMILY_ID,
    ENEMY_ENCOUNTER_COMPOSITIONS,
    getEnemyFamilyForArchetype,
    listEncounterCompositions,
    selectEncounterComposition,
} from '../../../../src/domain/services/EnemyEncounterCatalog';

class FixedRandom {
    constructor(private readonly value: number) {}

    next(): number {
        return this.value;
    }
}

describe('EnemyEncounterCatalog', () => {
    it('defines at least three enemy families with intent signatures and reaction rules', () => {
        expect(ENEMY_FAMILY_DEFINITIONS).toHaveLength(4);

        expect(ENEMY_FAMILY_DEFINITIONS).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: ENEMY_FAMILY_ID.ASH_CULT,
                intentSignature: expect.arrayContaining(['strike', 'ritual']),
                reactionRules: expect.arrayContaining([
                    expect.stringContaining('long-fight'),
                ]),
            }),
            expect.objectContaining({
                id: ENEMY_FAMILY_ID.MIRE_BROOD,
                intentSignature: expect.arrayContaining(['curse', 'cleanse']),
            }),
            expect.objectContaining({
                id: ENEMY_FAMILY_ID.NIGHT_STALKERS,
                intentSignature: expect.arrayContaining(['charge', 'ambush']),
            }),
            expect.objectContaining({
                id: ENEMY_FAMILY_ID.IRON_WARDENS,
                intentSignature: expect.arrayContaining(['guard', 'strike']),
            }),
        ]));
    });

    it('groups encounter compositions by family and keeps a future multi-enemy slot model', () => {
        const normalCompositions = ENEMY_ENCOUNTER_COMPOSITIONS.filter((composition) =>
            composition.floorType === 'normal',
        );

        expect(normalCompositions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                familyId: ENEMY_FAMILY_ID.ASH_CULT,
                futureBattleModel: expect.objectContaining({
                    mode: 'multi-enemy',
                    slots: expect.arrayContaining([
                        expect.objectContaining({ minCount: 1 }),
                    ]),
                }),
            }),
            expect.objectContaining({ familyId: ENEMY_FAMILY_ID.MIRE_BROOD }),
            expect.objectContaining({ familyId: ENEMY_FAMILY_ID.NIGHT_STALKERS }),
            expect.objectContaining({ familyId: ENEMY_FAMILY_ID.IRON_WARDENS }),
        ]));
        expect(normalCompositions.every((composition) => composition.futureBattleModel.slots.length >= 2)).toBe(true);
    });

    it('returns floor-appropriate encounter pools for the current single-enemy model', () => {
        const lowFloorCompositions = listEncounterCompositions({ floorNumber: 5, floorType: 'normal' });
        const midFloorCompositions = listEncounterCompositions({ floorNumber: 35, floorType: 'normal' });
        const mireFloorCompositions = listEncounterCompositions({ floorNumber: 55, floorType: 'normal' });
        const highFloorCompositions = listEncounterCompositions({ floorNumber: 75, floorType: 'normal' });

        expect(lowFloorCompositions.map((composition) => composition.id)).toEqual(['ash-cult-rite-circle']);
        expect(midFloorCompositions.map((composition) => composition.id)).toEqual([
            'ash-cult-rite-circle',
            'night-stalkers-pincer',
        ]);
        expect(mireFloorCompositions.map((composition) => composition.id)).toEqual([
            'mire-brood-sapping-swarm',
            'night-stalkers-pincer',
            'iron-wardens-shield-wall',
        ]);
        expect(highFloorCompositions.map((composition) => composition.id)).toEqual([
            'night-stalkers-pincer',
            'iron-wardens-shield-wall',
        ]);
    });

    it('selects a composition whose fallback archetype belongs to the same family', () => {
        const composition = selectEncounterComposition(
            { floorNumber: 55, floorType: 'normal' },
            new FixedRandom(0.1),
        );

        expect(composition?.id).toBe('mire-brood-sapping-swarm');
        expect(getEnemyFamilyForArchetype(composition?.singleEnemyFallback.archetypeId ?? 'ash-crawler')?.id)
            .toBe(composition?.familyId);
    });

    it('keeps a dedicated boss composition for future showdown routing', () => {
        const composition = selectEncounterComposition(
            { floorNumber: 100, floorType: 'boss' },
            new FixedRandom(0),
        );

        expect(composition).toEqual(expect.objectContaining({
            id: 'iron-wardens-blackout-boss',
            singleEnemyFallback: expect.objectContaining({
                archetypeId: 'final-boss',
            }),
        }));
    });
});
