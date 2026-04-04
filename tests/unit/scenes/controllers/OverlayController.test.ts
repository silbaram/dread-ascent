import { describe, expect, it, vi } from 'vitest';
import {
    SOUL_SHARD_STORAGE_KEY,
    SoulShardService,
    type StorageLike,
} from '../../../../src/domain/services/SoulShardService';
import { OverlayController } from '../../../../src/scenes/controllers/OverlayController';
import { GameLocalization } from '../../../../src/ui/GameLocalization';
import type { GameHud } from '../../../../src/ui/GameHud';

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    public getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

function createController() {
    const hud = {
        updateGameOver: vi.fn(),
        updateVictory: vi.fn(),
        updateTitleScreen: vi.fn(),
        updateBoss: vi.fn(),
    } as unknown as GameHud & {
        updateGameOver: ReturnType<typeof vi.fn>;
        updateVictory: ReturnType<typeof vi.fn>;
    };
    const storage = new MemoryStorage();
    storage.setItem(SOUL_SHARD_STORAGE_KEY, '144');
    const soulShardService = new SoulShardService(storage);
    const controller = new OverlayController(hud, new GameLocalization(), soulShardService);

    return { controller, hud };
}

describe('OverlayController', () => {
    it('closes the game over overlay with the last rendered summary', () => {
        const { controller, hud } = createController();

        controller.setGameOver(true);
        controller.updateGameOver(6, 7, 81);
        controller.setGameOver(false);

        expect(hud.updateGameOver).toHaveBeenLastCalledWith({
            isOpen: false,
            floorNumber: 6,
            defeatedEnemies: 7,
            earnedSoulShards: 81,
            totalSoulShards: 144,
        });
    });

    it('closes the victory overlay with the last rendered summary', () => {
        const { controller, hud } = createController();

        controller.setVictory(true);
        controller.updateVictory(100, 42, 'Final Boss');
        controller.setVictory(false);

        expect(hud.updateVictory).toHaveBeenLastCalledWith({
            isOpen: false,
            floorNumber: 100,
            defeatedEnemies: 42,
            bossName: 'Final Boss',
        });
    });
});
