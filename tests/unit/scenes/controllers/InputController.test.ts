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
        isAnimating: vi.fn(() => false),
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

        it('ignores movement input when isPlayerTurn returns false', () => {
            // Arrange
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
            vi.mocked(delegate.isAnimating).mockReturnValue(false);

            // Act
            dispatchKey(scene, 'ArrowLeft');

            // Assert
            expect(delegate.onMove).toHaveBeenCalledWith(-1, 0);
        });

        it('ignores movement input when isAnimating returns true', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(true);
            vi.mocked(delegate.isAnimating).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'ArrowLeft');

            // Assert
            expect(delegate.onMove).not.toHaveBeenCalled();
        });

        it('allows inventory toggle regardless of turn or animation state', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);
            vi.mocked(delegate.isAnimating).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'KeyI');

            // Assert
            expect(delegate.onToggleInventory).toHaveBeenCalledOnce();
        });

        it('allows Tab to toggle inventory regardless of turn or animation state', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);
            vi.mocked(delegate.isAnimating).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'Tab');

            // Assert
            expect(delegate.onToggleInventory).toHaveBeenCalledOnce();
        });

        it('allows Escape to close inventory regardless of turn or animation state', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(false);
            vi.mocked(delegate.isInventoryOpen).mockReturnValue(true);
            vi.mocked(delegate.isAnimating).mockReturnValue(true);

            // Act
            dispatchKey(scene, 'Escape');

            // Assert
            expect(delegate.onCloseInventory).toHaveBeenCalledOnce();
        });

        it('re-allows movement input after animation finishes', () => {
            // Arrange
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(true);
            vi.mocked(delegate.isAnimating).mockReturnValue(true);
            dispatchKey(scene, 'ArrowUp');
            expect(delegate.onMove).not.toHaveBeenCalled();

            // Act
            vi.mocked(delegate.isPlayerTurn).mockReturnValue(true);
            vi.mocked(delegate.isAnimating).mockReturnValue(false);
            dispatchKey(scene, 'ArrowUp');

            // Assert
            expect(delegate.onMove).toHaveBeenCalledWith(0, -1);
        });
    });
});
