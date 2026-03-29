import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InputController, type InputDelegate } from '../../../../src/scenes/controllers/InputController';

vi.mock('phaser', () => ({}));

function createMockDelegate(overrides: Partial<InputDelegate> = {}): InputDelegate {
    return {
        onMove: vi.fn(),
        onToggleInventory: vi.fn(),
        onCloseInventory: vi.fn(),
        onCloseSanctuary: vi.fn(),
        isTitleScreenOpen: vi.fn(() => false),
        isSanctuaryOpen: vi.fn(() => false),
        isInventoryOpen: vi.fn(() => false),
        isPlayerTurn: vi.fn(() => true),
        ...overrides,
    };
}

function createMockScene(): Phaser.Scene {
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    return {
        input: {
            keyboard: {
                on: vi.fn((eventName: string, handler: (event: KeyboardEvent) => void) => {
                    listeners.set(eventName, handler);
                }),
            },
        },
        __listeners: listeners,
    } as unknown as Phaser.Scene;
}

function dispatchKey(scene: Phaser.Scene, code: string): void {
    const listeners = (scene as unknown as { __listeners: Map<string, (e: KeyboardEvent) => void> }).__listeners;
    const handler = listeners.get('keydown');
    if (handler) {
        handler({ code, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    }
}

describe('InputController', () => {
    describe('animation lock integration', () => {
        let delegate: InputDelegate;
        let scene: Phaser.Scene;

        beforeEach(() => {
            delegate = createMockDelegate();
            scene = createMockScene();
            const controller = new InputController(scene, delegate);
            controller.setupInput();
        });

        it('ignores movement input when isPlayerTurn returns false (animation lock)', () => {
            // Arrange - simulate animation in progress via isPlayerTurn returning false
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);

            // Act
            dispatchKey(scene, 'ArrowLeft');
            dispatchKey(scene, 'ArrowRight');
            dispatchKey(scene, 'KeyW');
            dispatchKey(scene, 'KeyS');

            // Assert
            expect(delegate.onMove).not.toHaveBeenCalled();
        });

        it('allows movement input when isPlayerTurn returns true', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'ArrowLeft');

            // Assert
            expect(delegate.onMove).toHaveBeenCalledWith(-1, 0);
        });

        it('allows inventory toggle regardless of isPlayerTurn state', () => {
            // Arrange - animation in progress
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);

            // Act
            dispatchKey(scene, 'KeyI');

            // Assert
            expect(delegate.onToggleInventory).toHaveBeenCalledOnce();
        });

        it('allows Tab to toggle inventory regardless of isPlayerTurn state', () => {
            // Arrange - animation in progress
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);

            // Act
            dispatchKey(scene, 'Tab');

            // Assert
            expect(delegate.onToggleInventory).toHaveBeenCalledOnce();
        });

        it('allows Escape to close inventory regardless of isPlayerTurn state', () => {
            // Arrange - animation in progress, inventory open
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);
            vi.mocked(delegate.isInventoryOpen).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'Escape');

            // Assert
            expect(delegate.onCloseInventory).toHaveBeenCalledOnce();
        });

        it('re-allows movement input after isPlayerTurn returns true again', () => {
            // Arrange - start with animation lock
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);
            dispatchKey(scene, 'ArrowUp');
            expect(delegate.onMove).not.toHaveBeenCalled();

            // Act - animation completes, turn returns to player
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(true);
            dispatchKey(scene, 'ArrowUp');

            // Assert
            expect(delegate.onMove).toHaveBeenCalledWith(0, -1);
        });
    });
});
