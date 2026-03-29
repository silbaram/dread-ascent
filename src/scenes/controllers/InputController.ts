import 'phaser';

export interface InputDelegate {
    onMove: (dx: number, dy: number) => void;
    onToggleInventory: () => void;
    onCloseInventory: () => void;
    onCloseSanctuary: () => void;
    isTitleScreenOpen: () => boolean;
    isSanctuaryOpen: () => boolean;
    isInventoryOpen: () => boolean;
    isPlayerTurn: () => boolean;
    isAnimating: () => boolean;
}

export class InputController {
    constructor(
        private readonly scene: Phaser.Scene,
        private readonly delegate: InputDelegate,
    ) {}

    public setupInput() {
        if (!this.scene.input.keyboard) return;

        this.scene.input.keyboard.on('keydown', (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        });
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.code === 'Tab') {
            event.preventDefault();
        }

        if (this.delegate.isTitleScreenOpen()) {
            if (event.code === 'Escape' && this.delegate.isSanctuaryOpen()) {
                this.delegate.onCloseSanctuary();
            }
            return;
        }

        if (event.code === 'KeyI' || event.code === 'Tab') {
            this.delegate.onToggleInventory();
            return;
        }

        if (event.code === 'Escape' && this.delegate.isInventoryOpen()) {
            this.delegate.onCloseInventory();
            return;
        }

        if (this.delegate.isInventoryOpen() || !this.delegate.isPlayerTurn() || this.delegate.isAnimating()) return;

        let dx = 0;
        let dy = 0;

        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                dx = -1;
                break;
            case 'ArrowRight':
            case 'KeyD':
                dx = 1;
                break;
            case 'ArrowUp':
            case 'KeyW':
                dy = -1;
                break;
            case 'ArrowDown':
            case 'KeyS':
                dy = 1;
                break;
        }

        if (dx !== 0 || dy !== 0) {
            this.delegate.onMove(dx, dy);
        }
    }
}
