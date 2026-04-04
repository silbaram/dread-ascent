import { describe, expect, it } from 'vitest';
import {
    BATTLE_SCENE_LAYOUT,
    battleSceneBoundsOverlap,
} from '../../../src/scenes/battleSceneLayout';

describe('battleSceneLayout', () => {
    it('keeps sidebar panels separated from the combat lane', () => {
        const combatLanePanels = [
            BATTLE_SCENE_LAYOUT.enemyPanel,
            BATTLE_SCENE_LAYOUT.playerPanel,
            BATTLE_SCENE_LAYOUT.handPanel,
        ];
        const sidebarPanels = [
            BATTLE_SCENE_LAYOUT.logPanel,
            BATTLE_SCENE_LAYOUT.cardDetailPanel,
        ];

        combatLanePanels.forEach((combatPanel) => {
            sidebarPanels.forEach((sidebarPanel) => {
                expect(battleSceneBoundsOverlap(combatPanel, sidebarPanel)).toBe(false);
            });
        });

        expect(
            battleSceneBoundsOverlap(
                BATTLE_SCENE_LAYOUT.logPanel,
                BATTLE_SCENE_LAYOUT.cardDetailPanel,
            ),
        ).toBe(false);
    });
});
