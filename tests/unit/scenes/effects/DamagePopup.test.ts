import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({}));

import {
    DamagePopupController,
    formatDamagePopupText,
} from '../../../../src/scenes/effects/DamagePopup';

interface FakeText {
    y: number;
    alpha: number;
    destroyed: boolean;
    setOrigin: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
}

describe('DamagePopupController', () => {
    function createFakeText(y: number): FakeText {
        const text: FakeText = {
            y,
            alpha: 1,
            destroyed: false,
            setOrigin: vi.fn().mockReturnThis(),
            destroy: vi.fn(() => {
                text.destroyed = true;
            }),
        };

        return text;
    }

    function createSceneStub() {
        const texts: FakeText[] = [];
        const addText = vi.fn((_x: number, y: number) => {
            const text = createFakeText(y);
            texts.push(text);
            return text;
        });
        const tweenAdd = vi.fn();

        return {
            scene: {
                add: {
                    text: addText,
                },
                tweens: {
                    add: tweenAdd,
                },
            } as unknown as Phaser.Scene,
            addText,
            tweenAdd,
            texts,
        };
    }

    it('formats all supported popup labels distinctly', () => {
        expect(formatDamagePopupText({ type: 'damage', value: 6 })).toBe('-6');
        expect(formatDamagePopupText({ type: 'self_damage', value: 2 })).toBe('Self -2');
        expect(formatDamagePopupText({ type: 'blocked', value: 5 })).toBe('(5 blocked)');
        expect(formatDamagePopupText({ type: 'heal', value: 4 })).toBe('+4');
        expect(formatDamagePopupText({ type: 'poison', value: 3 })).toBe('Poison 3');
        expect(formatDamagePopupText({ type: 'block_gain', value: 5 })).toBe('+5 Block');
        expect(formatDamagePopupText({ type: 'buff', value: 2 })).toBe('+2 ATK');
    });

    it('prefixes popup text with the target label when provided', () => {
        expect(formatDamagePopupText({ type: 'damage', value: 6, label: 'Ash Crawler' }))
            .toBe('Ash Crawler -6');
        expect(formatDamagePopupText({ type: 'self_damage', value: 2, label: 'Player' }))
            .toBe('Player Self -2');
        expect(formatDamagePopupText({ type: 'blocked', value: 5, label: 'Blade Raider' }))
            .toBe('Blade Raider (5 blocked)');
    });

    it('renders self-damage popups with a distinct color treatment', () => {
        const { scene, addText } = createSceneStub();
        const controller = new DamagePopupController(scene);

        controller.showBatch(
            { id: 'player-hp', x: 292, y: 248 },
            [{ type: 'self_damage', value: 4 }],
        );

        expect(addText).toHaveBeenCalledWith(
            292,
            248,
            'Self -4',
            expect.objectContaining({ color: '#ffb3a7', fontSize: '18px' }),
        );
    });

    it('stacks same-anchor popups by 20px and animates them for 800ms over 40px', () => {
        const { scene, addText, tweenAdd } = createSceneStub();
        const controller = new DamagePopupController(scene);

        controller.showBatch(
            { id: 'enemy-hp', x: 400, y: 68 },
            [
                { type: 'blocked', value: 5 },
                { type: 'damage', value: 3 },
            ],
        );

        expect(addText).toHaveBeenNthCalledWith(
            1,
            400,
            68,
            '(5 blocked)',
            expect.objectContaining({ color: '#c5cfdb', fontSize: '18px' }),
        );
        expect(addText).toHaveBeenNthCalledWith(
            2,
            400,
            88,
            '-3',
            expect.objectContaining({ color: '#ff6767', fontSize: '18px' }),
        );
        expect(tweenAdd).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                y: 28,
                alpha: 0,
                duration: 800,
            }),
        );
        expect(tweenAdd).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                y: 48,
                alpha: 0,
                duration: 800,
            }),
        );
    });
});
