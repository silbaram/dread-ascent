import 'phaser';
import { MainScene } from './scenes/MainScene';
import { GameHud } from './ui/GameHud';
import './ui/gameHud.css';

const hudRoot = document.getElementById('hud-root');
if (!hudRoot) {
    throw new Error('HUD root element not found.');
}

const hud = new GameHud(hudRoot);

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000',
    scene: [new MainScene(hud)],
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    }
};

new Phaser.Game(config);
