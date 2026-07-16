import { RNAEngine } from './engine/RNAEngine.js';
import { GameMap } from './engine/Map.js';
import { Player } from './engine/Player.js';
import { getLevelDef } from './levels/LevelDefs.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new RNAEngine(canvas);
    this.input = {
      forward: false, backward: false,
      left: false, right: false,
      strafeL: false, strafeR: false,
      mouseDx: 0,
    };

    this.currentLevelId = 0;
    this.seed = Date.now() & 0xffffffff;
    this.state = 'menu';
    this.transitionAlpha = 0;
    this.transitionDir = 1;
    this.nextLevelId = null;
    this.lastTime = 0;

    this._bindInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.engine.resize(this.canvas.width, this.canvas.height);
  }

  _bindInput() {
    const keyMap = {
      'KeyW': 'forward', 'ArrowUp': 'forward',
      'KeyS': 'backward', 'ArrowDown': 'backward',
      'KeyA': 'strafeL', 'KeyD': 'strafeR',
      'ArrowLeft': 'left', 'ArrowRight': 'right',
    };
    window.addEventListener('keydown', e => {
      if (keyMap[e.code]) { this.input[keyMap[e.code]] = true; e.preventDefault(); }
      if (e.code === 'KeyF' && this.state === 'playing') {
        this.engine.toggleFlashlight();
      }
      if (e.code === 'Enter' && this.state === 'menu') this.startLevel(this.currentLevelId);
      if (e.code === 'Enter' && this.state === 'gameover') this.state = 'menu';
    });
    window.addEventListener('keyup', e => {
      if (keyMap[e.code]) this.input[keyMap[e.code]] = false;
    });

    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.canvas.requestPointerLock();
      else if (this.state === 'menu') this.startLevel(this.currentLevelId);
      else if (this.state === 'gameover') this.state = 'menu';
    });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === this.canvas && this.state === 'playing') {
        this.input.mouseDx = (this.input.mouseDx || 0) + e.movementX;
      }
    });
  }

  startLevel(levelId) {
    const def = getLevelDef(levelId);
    this.levelDef = def;
    this.map = new GameMap(def.mapSize.w, def.mapSize.h);
    this.map.generateBackrooms(this.seed + levelId * 1000, levelId);
    const spawn = this.map.getSpawnPoint();
    this.player = new Player(spawn.x, spawn.y);
    const exit = this.map.getExitPoint();
    this.exitX = exit.x;
    this.exitY = exit.y;
    this.currentLevelId = levelId;
    this.state = 'playing';
    this.transitionAlpha = 1;
    this.transitionDir = -1;
    // Reset flashlight on new level
    this.engine.flashlightOn = true;
    this.engine.flashlightBattery = 100;
  }

  start() {
    this.state = 'menu';
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loop(timestamp) {
    const dt = Math.min(3, (timestamp - this.lastTime) / 16.67);
    this.lastTime = timestamp;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _update(dt) {
    if (this.state === 'playing') {
      this.player.update(this.input, this.map, dt);
      this._checkExit();
    }
    if (this.state === 'transition' || (this.state === 'playing' && this.transitionAlpha > 0)) {
      this.transitionAlpha = Math.max(0, Math.min(1, this.transitionAlpha + this.transitionDir * 0.04 * dt));
      if (this.state === 'transition' && this.transitionAlpha >= 1) {
        this.startLevel(this.nextLevelId);
      }
    }
    if (this.state === 'playing' && this.player.sanity <= 0) {
      this.state = 'gameover';
    }
  }

  _checkExit() {
    const dx = this.player.x - this.exitX;
    const dy = this.player.y - this.exitY;
    if (dx*dx + dy*dy < 1.5*1.5) {
      this.nextLevelId = this.levelDef.nextLevel;
      this.state = 'transition';
      this.transitionAlpha = 0;
      this.transitionDir = 1;
    }
  }

  _draw() {
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height;

    if (this.state === 'menu') { this._drawMenu(ctx, W, H); return; }
    if (this.state === 'gameover') { this._drawGameOver(ctx, W, H); return; }

    this.engine.render(this.map, this.player, this.levelDef, this.player.isMoving);

    this._drawMinimap(ctx, W, H);

    if (this.transitionAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.transitionAlpha})`;
      ctx.fillRect(0, 0, W, H);
      if (this.state === 'transition' && this.transitionAlpha > 0.5) {
        const a = (this.transitionAlpha - 0.5) * 2;
        const def = getLevelDef(this.nextLevelId || 0);
        ctx.fillStyle = `rgba(255,220,120,${a})`;
        ctx.font = `${H * 0.05}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(def.name, W/2, H/2);
        ctx.font = `${H * 0.025}px monospace`;
        ctx.fillText(def.description, W/2, H/2 + H*0.07);
        ctx.textAlign = 'left';
      }
    }
  }

  _drawMinimap(ctx, W, H) {
    const scale = 3;
    const ox = W - this.map.width * scale - 10;
    const oy = 10;
    ctx.globalAlpha = 0.45;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) {
        ctx.fillStyle = this.map.getCell(x, y) === 0 ? '#443300' : '#000000';
        ctx.fillRect(ox + x*scale, oy + y*scale, scale, scale);
      }
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(ox + this.player.x*scale - 1, oy + this.player.y*scale - 1, 3, 3);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(ox + this.exitX*scale - 1, oy + this.exitY*scale - 1, 3, 3);
    ctx.globalAlpha = 1;
  }

  _drawMenu(ctx, W, H) {
    ctx.fillStyle = '#0a0800';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c8a000';
    ctx.font = `bold ${Math.min(72, W*0.08)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('BACKROOMS', W/2, H*0.28);
    ctx.fillStyle = '#666644';
    ctx.font = `${Math.min(22, W*0.025)}px monospace`;
    ctx.fillText('RNA ENGINE  v2', W/2, H*0.36);
    ctx.fillStyle = '#887755';
    ctx.font = `${Math.min(16, W*0.018)}px monospace`;
    ctx.fillText('You have noclipped out of reality.', W/2, H*0.50);
    ctx.fillText('Find the exit on each level to advance.', W/2, H*0.56);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${Math.min(14, W*0.015)}px monospace`;
    ctx.fillText('WASD — move    Mouse — look    F — flashlight', W/2, H*0.64);
    ctx.fillText('Green dot on minimap = exit', W/2, H*0.70);
    ctx.fillStyle = '#ffcc00';
    ctx.font = `${Math.min(20, W*0.022)}px monospace`;
    if (Date.now() % 1200 < 600) ctx.fillText('[CLICK or ENTER to begin]', W/2, H*0.82);
    ctx.textAlign = 'left';
  }

  _drawGameOver(ctx, W, H) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#440000';
    ctx.font = `bold ${Math.min(60, W*0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU HAVE BEEN LOST', W/2, H*0.4);
    ctx.fillStyle = '#553333';
    ctx.font = `${Math.min(20, W*0.022)}px monospace`;
    ctx.fillText('Your sanity could not hold.', W/2, H*0.55);
    ctx.fillStyle = '#997766';
    ctx.font = `${Math.min(16, W*0.018)}px monospace`;
    if (Date.now() % 1200 < 600) ctx.fillText('[CLICK or ENTER to restart]', W/2, H*0.7);
    ctx.textAlign = 'left';
  }
}
