import { describe, expect, it } from 'vitest';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import {
    DREAD_RULE_ID,
    DreadRuleService,
    LATE_FLOOR_DREAD_RULE_STACK_START,
} from '../../../../src/domain/services/DreadRuleService';

function createEnemy(options?: {
    archetypeId?: 'ash-crawler' | 'mire-broodling' | 'blade-raider' | 'dread-sentinel' | 'final-boss';
    kind?: 'normal' | 'boss';
    elite?: boolean;
}) {
    return new Enemy(
        'enemy-1',
        'Enemy',
        { x: 0, y: 0 },
        {
            health: 40,
            maxHealth: 40,
            attack: 8,
            defense: 4,
            movementSpeed: 120,
        },
        12,
        options?.kind ?? 'normal',
        options?.archetypeId ?? 'ash-crawler',
        options?.elite ?? false,
    );
}

describe('DreadRuleService', () => {
    const service = new DreadRuleService();

    it('maps normal enemy archetypes onto their default dread rules', () => {
        expect(service.decideRule(createEnemy({ archetypeId: 'ash-crawler' })).id).toBe(DREAD_RULE_ID.BLOOD_MOON);
        expect(service.decideRule(createEnemy({ archetypeId: 'mire-broodling' })).id).toBe(DREAD_RULE_ID.THIN_WALL);
        expect(service.decideRule(createEnemy({ archetypeId: 'blade-raider' })).id).toBe(DREAD_RULE_ID.PANIC_ROOM);
        expect(service.decideRule(createEnemy({ archetypeId: 'dread-sentinel' })).id).toBe(DREAD_RULE_ID.SUFFOCATING_FOG);
    });

    it('promotes elite and boss encounters to blackout', () => {
        expect(service.decideRule(createEnemy({ archetypeId: 'ash-crawler', elite: true })).id).toBe(DREAD_RULE_ID.BLACKOUT);
        expect(service.decideRule(createEnemy({ archetypeId: 'final-boss', kind: 'boss' })).id).toBe(DREAD_RULE_ID.BLACKOUT);
    });

    it('stacks high-risk rules for elite and boss encounters', () => {
        expect(service.decideRule(createEnemy({ archetypeId: 'ash-crawler', elite: true }))).toMatchObject({
            id: DREAD_RULE_ID.BLACKOUT,
            effects: {
                hideEnemyIntentOnEvenTurns: true,
                firstSelfDamageStrength: 1,
            },
        });
        expect(service.decideRule(createEnemy({ archetypeId: 'final-boss', kind: 'boss' }))).toMatchObject({
            id: DREAD_RULE_ID.BLACKOUT,
            effects: {
                hideEnemyIntentOnEvenTurns: true,
                lastCardPowerBonus: 4,
                lastSkillExhausts: true,
            },
        });
    });

    it('keeps early normal encounters to a single archetype rule unless explicitly configured', () => {
        const earlyNormal = service.decideRule(
            createEnemy({ archetypeId: 'ash-crawler' }),
            { floorNumber: 1 },
        );
        const explicitStack = service.decideRule(
            createEnemy({ archetypeId: 'ash-crawler' }),
            {
                floorNumber: 1,
                explicitRuleIds: [DREAD_RULE_ID.BLACKOUT, DREAD_RULE_ID.LAST_LANTERN],
            },
        );

        expect(earlyNormal).toMatchObject({
            id: DREAD_RULE_ID.BLOOD_MOON,
            effects: {
                firstSelfDamageStrength: 1,
            },
        });
        expect(earlyNormal.name).not.toContain('+');
        expect(earlyNormal.effects.lastSkillExhausts).toBeUndefined();
        expect(explicitStack).toMatchObject({
            id: DREAD_RULE_ID.BLACKOUT,
            effects: {
                hideEnemyIntentOnEvenTurns: true,
                lastCardPowerBonus: 4,
                lastSkillExhausts: true,
            },
        });
    });

    it('limits high-risk stacked rules to late floor normal encounters', () => {
        const beforeLateFloor = service.decideRule(
            createEnemy({ archetypeId: 'mire-broodling' }),
            { floorNumber: LATE_FLOOR_DREAD_RULE_STACK_START - 1 },
        );
        const lateFloor = service.decideRule(
            createEnemy({ archetypeId: 'mire-broodling' }),
            { floorNumber: LATE_FLOOR_DREAD_RULE_STACK_START },
        );

        expect(beforeLateFloor.effects.lastSkillExhausts).toBeUndefined();
        expect(lateFloor).toMatchObject({
            id: DREAD_RULE_ID.THIN_WALL,
            effects: {
                blockRetainRatio: 0.5,
                lastCardPowerBonus: 4,
                lastSkillExhausts: true,
            },
        });
    });

    it('treats Showdown encounters as high-risk stacked rule encounters', () => {
        const showdown = service.decideRule(
            createEnemy({ archetypeId: 'dread-sentinel' }),
            { floorNumber: 20, isShowdown: true },
        );

        expect(showdown).toMatchObject({
            id: DREAD_RULE_ID.BLACKOUT,
            effects: {
                hideEnemyIntentOnEvenTurns: true,
                lastCardPowerBonus: 4,
                lastSkillExhausts: true,
            },
        });
    });

    it('treats even turns as blackout turns when the rule hides intent', () => {
        const blackout = service.decideRule(createEnemy({ archetypeId: 'ash-crawler', elite: true }));

        expect(service.isBlackoutTurn(blackout, 1)).toBe(false);
        expect(service.isBlackoutTurn(blackout, 2)).toBe(true);
    });

    it('defines Last Lantern as a playable dread rule option', () => {
        expect(service.getRule(DREAD_RULE_ID.LAST_LANTERN)).toMatchObject({
            name: 'Last Lantern',
            effects: {
                lastCardPowerBonus: 4,
                lastSkillExhausts: true,
            },
        });
    });
});
