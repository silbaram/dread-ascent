import { describe, expect, it } from 'vitest';
import { GameHud } from '../../../src/ui/GameHud';

const HUD_ROLES = ['health', 'exp', 'floor', 'turn', 'enemies', 'state', 'log-list'] as const;

class FakeElement {
    dataset: Record<string, string> = {};
    textContent = '';
    private markup = '';

    get innerHTML() {
        return this.markup;
    }

    set innerHTML(value: string) {
        this.markup = value;
    }

    querySelector<T>(): T | null {
        return null;
    }
}

class FakeRootElement extends FakeElement {
    private readonly roles = new Map<string, FakeElement>();

    override set innerHTML(value: string) {
        super.innerHTML = value;

        if (value.includes('data-role="floor"')) {
            for (const role of HUD_ROLES) {
                if (!this.roles.has(role)) {
                    this.roles.set(role, new FakeElement());
                }
            }
        }
    }

    override querySelector<T>(selector: string): T | null {
        const role = selector.match(/\[data-role="([^"]+)"\]/)?.[1];
        if (!role) {
            return null;
        }

        return (this.roles.get(role) ?? null) as T | null;
    }

    textFor(role: typeof HUD_ROLES[number]) {
        return this.roles.get(role)?.textContent ?? '';
    }

    htmlFor(role: typeof HUD_ROLES[number]) {
        return this.roles.get(role)?.innerHTML ?? '';
    }
}

function createHud() {
    const root = new FakeRootElement();
    const hud = new GameHud(root as unknown as HTMLElement);

    return { root, hud };
}

describe('GameHud', () => {
    it('renders the current top overlay status snapshot', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateStatus({
            floorNumber: 3,
            floorType: 'Safe Zone',
            health: 28,
            maxHealth: 40,
            experience: 95,
            activeTurn: 'Round 4 · Player',
            enemyCount: 0,
            isGameOver: false,
        });

        // Assert
        expect(root.textFor('floor')).toBe('3F · Safe Zone');
        expect(root.textFor('health')).toBe('28 / 40');
        expect(root.textFor('exp')).toBe('95 EXP');
        expect(root.textFor('turn')).toBe('Round 4 · Player');
        expect(root.textFor('enemies')).toBe('0');
        expect(root.textFor('state')).toBe('PLAYING');
        expect(root.dataset.state).toBe('playing');
    });

    it('keeps only the six most recent log entries in the message feed', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.pushLog('Log 1', 'system');
        hud.pushLog('Log 2', 'combat');
        hud.pushLog('Log 3', 'danger');
        hud.pushLog('Log 4', 'item');
        hud.pushLog('Log 5', 'travel');
        hud.pushLog('Log 6', 'system');
        hud.pushLog('Log 7', 'combat');

        // Assert
        const logMarkup = root.htmlFor('log-list');
        expect(logMarkup).not.toContain('Log 1');
        expect(logMarkup).toContain('Log 2');
        expect(logMarkup).toContain('Log 7');
        expect(logMarkup.match(/class="game-hud__log-entry game-hud__log-entry--/g)?.length).toBe(6);
        expect(logMarkup).toContain('game-hud__log-entry--danger');
        expect(logMarkup).toContain('game-hud__log-entry--item');
        expect(logMarkup).toContain('game-hud__log-entry--travel');
    });

    it('marks the HUD as game over and clears rendered logs on reset', () => {
        // Arrange
        const { root, hud } = createHud();
        hud.pushLog('Player hits Enemy 1 for 5 damage.', 'combat');

        // Act
        hud.updateStatus({
            floorNumber: 6,
            floorType: 'Normal',
            health: 0,
            maxHealth: 40,
            experience: 120,
            activeTurn: 'Game Over',
            enemyCount: 2,
            isGameOver: true,
        });
        hud.clearLogs();

        // Assert
        expect(root.textFor('state')).toBe('GAME OVER');
        expect(root.dataset.state).toBe('game-over');
        expect(root.htmlFor('log-list')).toBe('');
    });
});
