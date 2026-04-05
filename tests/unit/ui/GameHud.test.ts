import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardCollectionSnapshot } from '../../../src/domain/services/CardCollectionService';
import type { CardRewardOffer } from '../../../src/domain/services/CardDropService';
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
    'title-collection',
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
    'card-swap-overlay',
    'card-swap-new',
    'card-swap-list',
    'reward-offer-overlay',
    'reward-offer-copy',
    'reward-offer-list',
    'special-reward-overlay',
    'special-reward-title',
    'special-reward-copy',
    'special-reward-list',
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

function createRunOverlayHandlers(overrides: Partial<Parameters<GameHud['setRunOverlayHandlers']>[0]> = {}) {
    return {
        onContinueRun: vi.fn(),
        onReturnToTitle: vi.fn(),
        onStartNewRun: vi.fn(),
        onOpenCardCollection: vi.fn(),
        onCloseCardCollection: vi.fn(),
        onOpenSanctuary: vi.fn(),
        onCloseSanctuary: vi.fn(),
        onPurchaseUpgrade: vi.fn(),
        ...overrides,
    };
}

function createClosestTarget(selector: string) {
    const element = new FakeElement() as FakeElement & {
        closest: (query: string) => FakeElement | null;
    };
    element.closest = (query: string) => (query === selector ? element : null);
    return element;
}

function createRewardOffer(isDeckFull = false): CardRewardOffer & { isDeckFull?: boolean } {
    return {
        choices: [
            {
                slot: 'ARCHETYPE',
                catalogId: 'QUICK_DRAW' as never,
                card: {
                    id: 'reward-1',
                    name: 'Quick Draw',
                    type: 'SKILL',
                    archetype: 'NEUTRAL',
                    power: 0,
                    cost: 1,
                    keywords: [],
                    effectType: 'DRAW',
                    rarity: 'COMMON',
                    effectPayload: { drawCount: 2 },
                },
            },
            {
                slot: 'NEUTRAL',
                catalogId: 'VENOM_STRIKE' as never,
                card: {
                    id: 'reward-2',
                    name: 'Venom Strike',
                    type: 'ATTACK',
                    archetype: 'SHADOW_ARTS',
                    power: 4,
                    cost: 1,
                    keywords: [],
                    effectType: 'DAMAGE',
                    rarity: 'COMMON',
                    statusEffect: { type: 'POISON', duration: 3 },
                },
            },
            {
                slot: 'RANDOM',
                catalogId: 'IRON_GUARD' as never,
                card: {
                    id: 'reward-3',
                    name: 'Iron Guard',
                    type: 'GUARD',
                    archetype: 'IRON_WILL',
                    power: 10,
                    cost: 2,
                    keywords: [],
                    effectType: 'BLOCK',
                    rarity: 'COMMON',
                },
            },
        ],
        biasArchetype: 'NEUTRAL' as never,
        rarityBand: 'COMMON',
        isDeckFull,
    };
}

function createCardCollectionSnapshot(): CardCollectionSnapshot {
    return {
        totalCards: 3,
        unlockedCards: 2,
        entries: [
            {
                catalogId: 'QUICK_DRAW' as never,
                isUnlocked: true,
                card: {
                    id: 'collection-1',
                    name: 'Quick Draw',
                    type: 'SKILL',
                    archetype: 'NEUTRAL',
                    power: 0,
                    cost: 1,
                    keywords: [],
                    effectType: 'DRAW',
                    rarity: 'COMMON',
                    effectPayload: { drawCount: 2 },
                },
            },
            {
                catalogId: 'VENOM_STRIKE' as never,
                isUnlocked: true,
                card: {
                    id: 'collection-2',
                    name: 'Venom Strike',
                    type: 'ATTACK',
                    archetype: 'SHADOW_ARTS',
                    power: 4,
                    cost: 1,
                    keywords: [],
                    effectType: 'DAMAGE',
                    rarity: 'COMMON',
                    statusEffect: { type: 'POISON', duration: 3 },
                },
            },
            {
                catalogId: 'BARRICADE' as never,
                isUnlocked: false,
                card: {
                    id: 'collection-3',
                    name: 'Barricade',
                    type: 'POWER',
                    archetype: 'IRON_WILL',
                    power: 0,
                    cost: 3,
                    keywords: [],
                    effectType: 'BUFF',
                    rarity: 'RARE',
                    buff: { type: 'BLOCK_PERSIST', value: 1 },
                },
            },
        ],
    };
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

    it('renders the message log inside the docked shell layout', () => {
        // Arrange
        const { root } = createHud();

        // Assert
        expect(root.innerHTML).toContain('class="game-hud__dock"');
        expect(root.innerHTML).toContain('class="game-hud__log-shell"');
        expect(root.innerHTML).not.toContain('class="game-hud__bottom"');
    });

    it('tracks when the fixed HUD chrome should be hidden for the dedicated battle scene', () => {
        const { root, hud } = createHud();

        expect(root.dataset.viewportMode).toBe('field');

        hud.setViewportMode('battle-scene');
        expect(root.dataset.viewportMode).toBe('battle-scene');

        hud.setViewportMode('field');
        expect(root.dataset.viewportMode).toBe('field');
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

    it('enables use for bronze sigil key items and shows the special cache action', () => {
        const { root, hud } = createHud();

        hud.updateInventory({
            isOpen: true,
            items: [
                {
                    id: 'bronze-sigil',
                    instanceId: 'item-key-1',
                    name: 'Bronze Sigil',
                    type: 'KEY',
                    rarity: 'RARE',
                    icon: '?',
                    stackable: false,
                    maxStack: 1,
                    description: 'Break the seal to reveal a special cache.',
                    quantity: 1,
                    isEquipped: false,
                },
            ],
            selectedItemId: 'item-key-1',
            usedSlots: 1,
            slotCapacity: 12,
        });

        expect(root.textFor('inventory-use')).toBe('Use');
        expect(root.disabledFor('inventory-use')).toBe(false);
        expect(root.htmlFor('inventory-detail')).toContain('Break the seal to reveal a special cache.');
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
            isCardCollectionOpen: false,
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
            cardCollection: createCardCollectionSnapshot(),
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
            isCardCollectionOpen: false,
            upgrades: [],
            cardCollection: createCardCollectionSnapshot(),
        });

        // Assert
        expect(root.disabledFor('title-continue')).toBe(true);
    });

    it('handles text-node clicks on the game over return button', () => {
        // Arrange
        const { hud } = createHud();
        const handlers = createRunOverlayHandlers();
        hud.setRunOverlayHandlers(handlers);
        const buttonTarget = createClosestTarget('[data-role="gameover-return-title"]');
        const textTarget = { parentElement: buttonTarget };

        // Act
        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({
            target: textTarget,
        } as Event);

        // Assert
        expect(handlers.onReturnToTitle).toHaveBeenCalledOnce();
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

    it('renders the card collection panel on the title overlay', () => {
        const { root, hud, localization } = createHud();

        hud.updateTitleScreen({
            isOpen: true,
            totalSoulShards: 144,
            canContinueRun: true,
            isSanctuaryOpen: false,
            isCardCollectionOpen: true,
            upgrades: [],
            cardCollection: createCardCollectionSnapshot(),
        });

        expect(root.datasetFor('title-collection').open).toBe('true');
        expect(root.htmlFor('title-collection')).toContain('Card Collection');
        expect(root.htmlFor('title-collection')).toContain('Quick Draw');
        expect(root.htmlFor('title-collection')).toContain('Venom Strike');
        expect(root.htmlFor('title-collection')).toContain('Recovered 2 of 3 cards from previous descents.');
        expect(root.htmlFor('title-collection')).toContain('Draw 2 cards');
        expect(root.htmlFor('title-collection')).toContain('Locked');

        localization.setLocale('ko');

        expect(root.htmlFor('title-collection')).toContain('카드 모음집');
        expect(root.htmlFor('title-collection')).toContain('이전 하강에서 확보한 카드 2 / 3장');
        expect(root.htmlFor('title-collection')).toContain('카드 2장 뽑기');
        expect(root.htmlFor('title-collection')).toContain('잠김');
    });

    it('routes title collection open and close clicks', () => {
        const { hud } = createHud();
        const handlers = createRunOverlayHandlers();
        hud.setRunOverlayHandlers(handlers);

        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({
            target: createClosestTarget('[data-role="title-open-collection"]'),
        } as Event);
        expect(handlers.onOpenCardCollection).toHaveBeenCalledOnce();

        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({
            target: createClosestTarget('[data-role="title-close-collection"]'),
        } as Event);
        expect(handlers.onCloseCardCollection).toHaveBeenCalledOnce();
    });

    it('renders the reward offer overlay with three card choices and skip copy', () => {
        const { root, hud } = createHud();
        const callback = vi.fn();

        hud.showCardRewardOverlay(createRewardOffer(false), callback);

        expect(root.datasetFor('reward-offer-overlay').open).toBe('true');
        expect(root.textFor('reward-offer-copy')).toBe('Pick one card to add to your deck, or skip the offer.');
        expect(root.htmlFor('reward-offer-list')).toContain('Quick Draw');
        expect(root.htmlFor('reward-offer-list')).toContain('Venom Strike');
        expect(root.htmlFor('reward-offer-list')).toContain('Iron Guard');
        expect(root.htmlFor('reward-offer-list')).toContain('Cost 1 · Skill');
        expect(root.htmlFor('reward-offer-list')).toContain('Draw 2 cards');
        expect(root.htmlFor('reward-offer-list')).toContain('Deal 4 damage · Apply Poison 3');
        expect(root.htmlFor('reward-offer-list')).toContain('Gain 10 block');
    });

    it('renders deck full reward offer copy with the card effect summary', () => {
        const { root, hud, localization } = createHud();
        const callback = vi.fn();

        const offer = createRewardOffer(true);
        offer.choices = [offer.choices[0]];
        offer.choices[0] = {
            ...offer.choices[0],
            card: {
                id: 'reward-1',
                name: 'Blood Price',
                type: 'SKILL',
                archetype: 'BLOOD_OATH',
                power: 0,
                cost: 1,
                keywords: [],
                effectType: 'DRAW',
                rarity: 'UNCOMMON',
                effectPayload: { drawCount: 2, selfDamage: 4 },
            },
        };
        hud.showCardRewardOverlay(offer, callback);

        expect(root.textFor('reward-offer-copy')).toBe('Deck full. Pick a reward to enter card swap.');
        expect(root.htmlFor('reward-offer-list')).toContain('Draw 2 cards · Lose 4 HP');

        localization.setLocale('ko');

        expect(root.textFor('reward-offer-copy')).toBe('덱이 가득 찼습니다. 보상 카드를 고르면 카드 교체로 넘어갑니다.');
        expect(root.htmlFor('reward-offer-list')).toContain('코스트 1 · 스킬');
        expect(root.htmlFor('reward-offer-list')).toContain('카드 2장 뽑기 · HP 4 소모');
    });

    it('routes reward offer clicks to select and skip callbacks, then closes itself', () => {
        const { hud } = createHud();
        const callback = vi.fn();
        const offer = createRewardOffer(false);
        offer.choices = [offer.choices[0]];
        hud.showCardRewardOverlay(offer, callback);

        const rewardTarget = createClosestTarget('[data-reward-card-id]') as FakeElement & { dataset: Record<string, string> };
        rewardTarget.dataset.rewardCardId = 'reward-1';
        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({ target: rewardTarget } as Event);
        expect(callback).toHaveBeenCalledWith('reward-1');

        hud.showCardRewardOverlay(createRewardOffer(false), callback);
        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({
            target: createClosestTarget('[data-role="reward-offer-skip"]'),
        } as Event);
        expect(callback).toHaveBeenCalledWith(null);
    });

    it('renders the special reward overlay with item choices and localized copy', () => {
        const { root, hud, localization } = createHud();
        const callback = vi.fn();

        hud.showSpecialRewardOverlay([
            {
                id: 'cursed-edge',
                name: 'Cursed Edge',
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'Attack cards gain +2 power.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 7 },
                },
            },
            {
                id: 'madmans-hood',
                name: "Madman's Hood",
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '^',
                stackable: false,
                maxStack: 1,
                description: 'Opening hand cards gain +3 power.',
                equipment: {
                    slot: 'HELMET',
                    statModifier: {},
                },
            },
        ], callback);

        expect(root.datasetFor('special-reward-overlay').open).toBe('true');
        expect(root.textFor('special-reward-copy')).toBe('Pick one item from the cache, or walk away with nothing.');
        expect(root.htmlFor('special-reward-list')).toContain('Cursed Edge');
        expect(root.htmlFor('special-reward-list')).toContain('Cursed · Weapon · ATK +7');
        expect(root.htmlFor('special-reward-list')).toContain('Madman&#39;s Hood');

        localization.setLocale('ko');

        expect(root.textFor('special-reward-copy')).toBe('보관함에서 아이템 1개를 고르거나 아무것도 받지 않고 떠납니다.');
        expect(root.htmlFor('special-reward-list')).toContain('저주받은 · 무기 · ATK +7');
    });

    it('renders boss reward overlay copy when the source is a boss victory', () => {
        const { root, hud, localization } = createHud();
        const callback = vi.fn();

        hud.showSpecialRewardOverlay([
            {
                id: 'soulfire-brand',
                name: 'Soulfire Brand',
                type: 'EQUIPMENT',
                rarity: 'EPIC',
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'Start battle with Strength +2.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 6 },
                },
            },
        ], callback, 'boss');

        expect(root.textFor('special-reward-copy')).toBe('Claim one prize from the fallen boss, or leave the power untouched.');

        localization.setLocale('ko');

        expect(root.textFor('special-reward-copy')).toBe('쓰러진 보스의 전리품 중 하나를 고르거나 아무것도 받지 않고 떠납니다.');
    });

    it('routes special reward clicks to select and skip callbacks, then closes itself', () => {
        const { hud } = createHud();
        const callback = vi.fn();

        hud.showSpecialRewardOverlay([
            {
                id: 'cursed-edge',
                name: 'Cursed Edge',
                type: 'EQUIPMENT',
                rarity: 'CURSED',
                icon: '/',
                stackable: false,
                maxStack: 1,
                description: 'Attack cards gain +2 power.',
                equipment: {
                    slot: 'WEAPON',
                    statModifier: { attack: 7 },
                },
            },
        ], callback);

        const rewardTarget = createClosestTarget('[data-special-reward-item-id]') as FakeElement & {
            dataset: Record<string, string>;
        };
        rewardTarget.dataset.specialRewardItemId = 'cursed-edge';
        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({ target: rewardTarget } as Event);
        expect(callback).toHaveBeenCalledWith('cursed-edge');

        hud.showSpecialRewardOverlay([], callback);
        (hud as unknown as { handleClick: (event: Event) => void }).handleClick({
            target: createClosestTarget('[data-role="special-reward-skip"]'),
        } as Event);
        expect(callback).toHaveBeenCalledWith(null);
    });
});
