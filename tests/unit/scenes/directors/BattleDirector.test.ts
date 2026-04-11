import { describe, expect, it, vi } from 'vitest';
import { Enemy } from '../../../../src/domain/entities/Enemy';
import { Player } from '../../../../src/domain/entities/Player';
import { CombatService } from '../../../../src/domain/services/CombatService';
import type { TurnActor } from '../../../../src/domain/services/TurnQueueService';
import type { MapData } from '../../../../src/infra/rot/MapGenerator';
import { BattleDirector } from '../../../../src/scenes/directors/BattleDirector';
import type { FloorDirector } from '../../../../src/scenes/directors/FloorDirector';
import type { RenderSynchronizer } from '../../../../src/scenes/synchronizers/RenderSynchronizer';
import { WORLD_TILE } from '../../../../src/shared/types/WorldTiles';
import { GameLocalization } from '../../../../src/ui/GameLocalization';

function createMapData(): MapData {
    return {
        width: 3,
        height: 3,
        tiles: [
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
            [WORLD_TILE.FLOOR, WORLD_TILE.FLOOR, WORLD_TILE.FLOOR],
        ],
        rooms: [],
        playerSpawn: { x: 2, y: 2 },
        stairsPosition: { x: 2, y: 2 },
        restPoints: [],
        floorType: 'normal',
    };
}

function createEnemy(position = { x: 0, y: 0 }) {
    return new Enemy(
        'enemy-1',
        'Enemy 1',
        { ...position },
        { health: 20, maxHealth: 20, attack: 5, defense: 1 },
        10,
    );
}

function createBattleDirector(
    enemy: Enemy,
    renderSynchronizer: RenderSynchronizer,
    options: {
        readonly combatService?: CombatService;
    } = {},
) {
    const floorDirector = {
        getEnemyById: (enemyId: string) => (enemyId === enemy.id ? enemy : undefined),
        getEnemyEntities: () => [enemy],
    } as unknown as FloorDirector;

    return new BattleDirector(
        options.combatService ?? new CombatService(),
        new GameLocalization(),
        renderSynchronizer,
        floorDirector,
    );
}

describe('BattleDirector', () => {
    it('does not crash when enemy vision checks tiles outside the map bounds', () => {
        // Arrange
        const enemy = createEnemy({ x: 0, y: 0 });
        const player = new Player({ x: 2, y: 2 });
        const renderSynchronizer = {
            spawnFloatingDamage: vi.fn(),
            synchronizeEnemies: vi.fn().mockReturnValue(Promise.resolve()),
        } as unknown as RenderSynchronizer;
        const director = createBattleDirector(enemy, renderSynchronizer);
        const enemyTurn: TurnActor = {
            id: enemy.id,
            kind: 'enemy',
            label: 'Enemy 1',
        };

        // Act
        const outcome = director.resolveEnemyTurn(enemyTurn, player, createMapData());

        // Assert
        expect(outcome.type).toBe('none');
        expect(outcome.logs).toHaveLength(1);
        expect(outcome.logs[0]?.tone).toBe('travel');
        expect(enemy.position.x + enemy.position.y).toBe(1);
    });

    it('returns animationPromise from synchronizeEnemies when enemy moves', () => {
        // Arrange
        const animationDone = Promise.resolve();
        const enemy = createEnemy({ x: 0, y: 0 });
        const player = new Player({ x: 2, y: 2 });
        const renderSynchronizer = {
            spawnFloatingDamage: vi.fn(),
            synchronizeEnemies: vi.fn().mockReturnValue(animationDone),
        } as unknown as RenderSynchronizer;
        const director = createBattleDirector(enemy, renderSynchronizer);
        const enemyTurn: TurnActor = {
            id: enemy.id,
            kind: 'enemy',
            label: 'Enemy 1',
        };

        // Act
        const outcome = director.resolveEnemyTurn(enemyTurn, player, createMapData());

        // Assert
        expect(outcome.animationPromise).toBe(animationDone);
    });

    it('does not set animationPromise when enemy attacks', () => {
        // Arrange: place enemy adjacent to player so it attacks
        const enemy = createEnemy({ x: 1, y: 1 });
        const player = new Player({ x: 1, y: 0 });
        const renderSynchronizer = {
            spawnFloatingDamage: vi.fn(),
            synchronizeEnemies: vi.fn().mockReturnValue(Promise.resolve()),
        } as unknown as RenderSynchronizer;
        const director = createBattleDirector(enemy, renderSynchronizer);
        const enemyTurn: TurnActor = {
            id: enemy.id,
            kind: 'enemy',
            label: 'Enemy 1',
        };

        // Act
        const outcome = director.resolveEnemyTurn(enemyTurn, player, createMapData());

        // Assert
        expect(outcome.animationPromise).toBeUndefined();
        expect(outcome.logs[0]?.tone).toBe('danger');
    });
});
