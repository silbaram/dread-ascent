import { describe, expect, it } from 'vitest';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import {
    DREAD_RULE_ID,
    DreadRuleService,
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

    it('treats even turns as blackout turns when the rule hides intent', () => {
        const blackout = service.decideRule(createEnemy({ archetypeId: 'ash-crawler', elite: true }));

        expect(service.isBlackoutTurn(blackout, 1)).toBe(false);
        expect(service.isBlackoutTurn(blackout, 2)).toBe(true);
    });
});
