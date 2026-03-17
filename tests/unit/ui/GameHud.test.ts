import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameLocalization } from '../../../src/ui/GameLocalization';
import { GameHud } from '../../../src/ui/GameHud';

const HUD_ROLES = [
    'health',
    'exp',
    'floor',
    'turn',
    'enemies',
    'state',
    'boss-panel',
    'boss-name',
    'boss-health',
    'boss-bar',
    'log-list',
    'event-banner',
    'event-banner-text',
    'title-overlay',
    'title-soul-shards',
    'title-continue',
    'title-message',
    'title-sanctuary',
    'gameover-overlay',
    'gameover-floor',
    'gameover-kills',
    'gameover-earned',
    'gameover-total',
    'victory-overlay',
    'victory-floor',
    'victory-kills',
    'victory-boss',
    'inventory-overlay',
    'inventory-capacity',
    'inventory-list',
    'inventory-detail',
    'inventory-use',
    'inventory-drop',
] as const;

class FakeElement {
    dataset: Record<string, string> = {};
    style: Record<string, string> = {};
    textContent = '';
    disabled = false;
    scrollHeight = 0;
    scrollTop = 0;
    private markup = '';

    get innerHTML() {
        return this.markup;
    }

    set innerHTML(value: string) {
        this.markup = value;
        this.scrollHeight = value.length;
    }

    addEventListener() {
        // no-op for unit tests
    }

    querySelector<T>(): T | null {
        return null;
    }
}

class FakeRootElement extends FakeElement {
    private readonly roles = new Map<string, FakeElement>();

    override get innerHTML() {
        return super.innerHTML;
    }

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

    datasetFor(role: typeof HUD_ROLES[number]) {
        return this.roles.get(role)?.dataset ?? {};
    }

    disabledFor(role: typeof HUD_ROLES[number]) {
        return this.roles.get(role)?.disabled ?? false;
    }

    styleFor(role: typeof HUD_ROLES[number]) {
        return this.roles.get(role)?.style ?? {};
    }
}

function createHud(localization = new GameLocalization()) {
    const root = new FakeRootElement();
    const hud = new GameHud(root as unknown as HTMLElement, localization);

    return { root, hud, localization };
}

describe('GameHud', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

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

    it('keeps only the fifty most recent log entries in the message feed', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        for (let index = 1; index <= 51; index += 1) {
            hud.pushLog(`Log ${index}`, index % 2 === 0 ? 'combat' : 'system');
        }

        // Assert
        const logMarkup = root.htmlFor('log-list');
        expect(logMarkup).not.toContain('<span>Log 1</span>');
        expect(logMarkup).toContain('<span>Log 2</span>');
        expect(logMarkup).toContain('<span>Log 51</span>');
        expect(logMarkup.match(/class="game-hud__log-entry game-hud__log-entry--/g)?.length).toBe(50);
        expect(root.querySelector<FakeElement>('[data-role="log-list"]')?.scrollTop).toBe(
            root.querySelector<FakeElement>('[data-role="log-list"]')?.scrollHeight,
        );
    });

    it('renders and clears the central event banner after its duration elapses', () => {
        vi.useFakeTimers();

        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.queueEventBanner('Boss Encounter', 'danger', 2000);

        // Assert
        expect(root.datasetFor('event-banner').open).toBe('true');
        expect(root.datasetFor('event-banner').tone).toBe('danger');
        expect(root.textFor('event-banner-text')).toBe('Boss Encounter');

        // Act
        vi.advanceTimersByTime(2000);

        // Assert
        expect(root.datasetFor('event-banner').open).toBe('false');
        expect(root.textFor('event-banner-text')).toBe('');
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
        hud.updateGameOver({
            isOpen: true,
            floorNumber: 6,
            defeatedEnemies: 7,
            earnedSoulShards: 81,
            totalSoulShards: 144,
        });
        hud.clearLogs();

        // Assert
        expect(root.textFor('state')).toBe('GAME OVER');
        expect(root.dataset.state).toBe('game-over');
        expect(root.htmlFor('log-list')).toBe('');
        expect(root.datasetFor('gameover-overlay').open).toBe('true');
        expect(root.textFor('gameover-floor')).toBe('6F');
        expect(root.textFor('gameover-kills')).toBe('7');
        expect(root.textFor('gameover-earned')).toBe('81');
        expect(root.textFor('gameover-total')).toBe('144');
    });

    it('renders the boss panel with live health values', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateBoss({
            isVisible: true,
            name: 'Final Boss',
            health: 140,
            maxHealth: 200,
        });

        // Assert
        expect(root.datasetFor('boss-panel').open).toBe('true');
        expect(root.textFor('boss-name')).toBe('Final Boss');
        expect(root.textFor('boss-health')).toBe('140 / 200');
        expect(root.styleFor('boss-bar').width).toBe('70%');
    });

    it('renders the ending overlay for a victorious run', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateStatus({
            floorNumber: 100,
            floorType: 'Boss Lair',
            health: 48,
            maxHealth: 120,
            experience: 990,
            activeTurn: 'Ending',
            enemyCount: 0,
            isGameOver: false,
            runState: 'victory',
        });
        hud.updateVictory({
            isOpen: true,
            floorNumber: 100,
            defeatedEnemies: 42,
            bossName: 'Final Boss',
        });

        // Assert
        expect(root.textFor('state')).toBe('VICTORY');
        expect(root.dataset.state).toBe('victory');
        expect(root.datasetFor('victory-overlay').open).toBe('true');
        expect(root.textFor('victory-floor')).toBe('100F');
        expect(root.textFor('victory-kills')).toBe('42');
        expect(root.textFor('victory-boss')).toBe('Final Boss');
    });

    it('renders the inventory overlay with selected item details and capacity', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateInventory({
            isOpen: true,
            items: [
                {
                    id: 'small-potion',
                    instanceId: 'item-f1-1',
                    name: 'Small Potion',
                    type: 'CONSUMABLE',
                    rarity: 'COMMON',
                    icon: '!',
                    stackable: true,
                    maxStack: 5,
                    description: 'A compact tonic.',
                    consumableEffect: {
                        kind: 'heal',
                        amount: 30,
                    },
                    isEquipped: false,
                    quantity: 2,
                },
                {
                    id: 'iron-dagger',
                    instanceId: 'item-f1-2',
                    name: 'Iron Dagger',
                    type: 'EQUIPMENT',
                    rarity: 'RARE',
                    icon: '/',
                    stackable: false,
                    maxStack: 1,
                    description: 'A light blade.',
                    equipment: {
                        slot: 'WEAPON',
                        statModifier: {
                            attack: 4,
                        },
                    },
                    isEquipped: true,
                    quantity: 1,
                },
            ],
            selectedItemId: 'item-f1-2',
            usedSlots: 2,
            slotCapacity: 12,
        });

        // Assert
        expect(root.dataset.inventory).toBe('open');
        expect(root.datasetFor('inventory-overlay').open).toBe('true');
        expect(root.textFor('inventory-capacity')).toBe('2 / 12 slots');
        expect(root.htmlFor('inventory-list')).toContain('Small Potion');
        expect(root.htmlFor('inventory-list')).toContain('Iron Dagger');
        expect(root.htmlFor('inventory-list')).toContain('data-rarity="RARE"');
        expect(root.htmlFor('inventory-list')).toContain('is-selected');
        expect(root.htmlFor('inventory-detail')).toContain('A light blade suited for quick strikes.');
        expect(root.htmlFor('inventory-detail')).toContain('Rare');
        expect(root.htmlFor('inventory-detail')).toContain('Weapon ATK +4');
        expect(root.textFor('inventory-use')).toBe('Unequip');
        expect(root.disabledFor('inventory-use')).toBe(false);
        expect(root.disabledFor('inventory-drop')).toBe(true);
    });

    it('shows the empty inventory message and disables drop when no item exists', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateInventory({
            isOpen: true,
            items: [],
            usedSlots: 0,
            slotCapacity: 12,
        });

        // Assert
        expect(root.htmlFor('inventory-list')).toContain('Inventory is empty');
        expect(root.htmlFor('inventory-detail')).toContain('Nothing selected');
        expect(root.textFor('inventory-use')).toBe('Use');
        expect(root.disabledFor('inventory-use')).toBe(true);
        expect(root.disabledFor('inventory-drop')).toBe(true);
    });

    it('renders the title return overlay with the current soul shard total', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateTitleScreen({
            isOpen: true,
            totalSoulShards: 233,
            canContinueRun: true,
            isSanctuaryOpen: true,
            sanctuaryMessage: 'Need 5 more Soul Shards for Ferocity.',
            sanctuaryMessageTone: 'danger',
            upgrades: [
                {
                    key: 'maxHealth',
                    label: 'Vitality',
                    statLabel: 'HP',
                    description: 'Raise starting HP by 10.',
                    level: 1,
                    currentValue: 110,
                    nextValue: 120,
                    bonusPerLevel: 10,
                    cost: 30,
                    affordable: true,
                },
                {
                    key: 'attack',
                    label: 'Ferocity',
                    statLabel: 'ATK',
                    description: 'Raise starting attack by 2.',
                    level: 0,
                    currentValue: 10,
                    nextValue: 12,
                    bonusPerLevel: 2,
                    cost: 25,
                    affordable: false,
                },
            ],
        });

        // Assert
        expect(root.datasetFor('title-overlay').open).toBe('true');
        expect(root.textFor('title-soul-shards')).toBe('233');
        expect(root.disabledFor('title-continue')).toBe(false);
        expect(root.textFor('title-message')).toBe('Need 5 more Soul Shards for Ferocity.');
        expect(root.datasetFor('title-message').tone).toBe('danger');
        expect(root.datasetFor('title-sanctuary').open).toBe('true');
        expect(root.htmlFor('title-sanctuary')).toContain('Vitality');
        expect(root.htmlFor('title-sanctuary')).toContain('Ferocity');
        expect(root.htmlFor('title-sanctuary')).toContain('Purchase +10');
        expect(root.htmlFor('title-sanctuary')).toContain('Purchase +2');
        expect(root.htmlFor('title-sanctuary')).toContain('disabled');
    });

    it('disables continue on the title overlay when no saved run exists', () => {
        // Arrange
        const { root, hud } = createHud();

        // Act
        hud.updateTitleScreen({
            isOpen: true,
            totalSoulShards: 0,
            canContinueRun: false,
            isSanctuaryOpen: false,
            upgrades: [],
        });

        // Assert
        expect(root.disabledFor('title-continue')).toBe(true);
    });

    it('rerenders static UI copy when the locale changes', () => {
        // Arrange
        const { root, hud, localization } = createHud();
        hud.updateInventory({
            isOpen: true,
            items: [],
            usedSlots: 0,
            slotCapacity: 12,
        });

        // Act
        localization.setLocale('ko');

        // Assert
        expect(root.innerHTML).toContain('전장 HUD');
        expect(root.innerHTML).toContain('메시지 로그');
        expect(root.textFor('inventory-capacity')).toBe('0 / 12칸');
        expect(root.textFor('inventory-use')).toBe('사용');
        expect(root.htmlFor('inventory-list')).toContain('인벤토리가 비어 있습니다');
    });
});
