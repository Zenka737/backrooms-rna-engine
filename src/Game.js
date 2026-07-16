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
    this.state = 'menu'; // menu | playing | transition | gameover
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
    const map = {
      'KeyW': 'forward', 'ArrowUp': 'forward',
      'KeyS': 'backward', 'ArrowDown': 'backward',
      'KeyA': 'strafeL',
      'KeyD': 'strafeR',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
    };
    window.addEventListener('keydown', e => {
      if (map[e.code]) { this.input[map[e.code]] = true; e.preventDefault(); }
      if (e.code === 'Escape' && this.state === 'playing') this._pauseMenu();
      if (e.code === 'Enter' && this.state === 'menu') this.startLevel(this.currentLevelId);
    });
    window.addEventListener('keyup', e => {
      if (map[e.code]) this.input[map[e.code]] = false;
    });

    // Pointer lock for mouse look
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.canvas.requestPointerLock();
      else if (this.state === 'menu') this.startLevel(this.currentLevelId);
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
    this.transitionDir = -1; // fade in
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
      this.transitionDir = 1; // fade out
    }
  }

  _draw() {
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height;

    if (this.state === 'menu') {
      this._drawMenu(ctx, W, H);
      return;
    }
    if (this.state === 'gameover') {
      this._drawGameOver(ctx, W, H);
      return;
    }

    // Render 3D scene
    this.engine.render(this.map, this.player, this.levelDef);

    // Draw exit marker on minimap
    this._drawMinimap(ctx, W, H);

    // Transition fade
    if (this.transitionAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.transitionAlpha})`;
      ctx.fillRect(0, 0, W, H);
      if (this.state === 'transition' && this.transitionAlpha > 0.5) {
        ctx.fillStyle = `rgba(255,220,120,${(this.transitionAlpha - 0.5) * 2})`;
        ctx.font = `${H * 0.05}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(getLevelDef(this.nextLevelId || 0).name, W/2, H/2);
        ctx.font = `${H * 0.025}px monospace`;
        ctx.fillText(getLevelDef(this.nextLevelId || 0).description, W/2, H/2 + H*0.07);
        ctx.textAlign = 'left';
      }
    }
  }

  _drawMinimap(ctx, W, H) {
    const scale = 3;
    const mw = this.map.width * scale;
    const mh = this.map.height * scale;
    const ox = W - mw - 10;
    const oy = 10;

    ctx.globalAlpha = 0.5;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const cell = this.map.getCell(x, y);
        ctx.fillStyle = cell === 0 ? '#443300' : '#000000';
        ctx.fillRect(ox + x*scale, oy + y*scale, scale, scale);
      }
    }
    // Player dot
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(
      ox + this.player.x * scale - 1,
      oy + this.player.y * scale - 1,
      3, 3
    );
    // Exit dot
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(
      ox + this.exitX * scale - 1,
      oy + this.exitY * scale - 1,
      3, 3
    );
    ctx.globalAlpha = 1;
  }

  _drawMenu(ctx, W, H) {
    ctx.fillStyle = '#0a0800';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#c8a000';
    ctx.font = `bold ${Math.min(72, W * 0.08)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('BACKROOMS', W/2, H * 0.3);

    ctx.fillStyle = '#666644';
    ctx.font = `${Math.min(24, W * 0.027)}px monospace`;
    ctx.fillText('RNA ENGINE', W/2, H * 0.38);

    ctx.fillStyle = '#887755';
    ctx.font = `${Math.min(18, W * 0.02)}px monospace`;
    ctx.fillText('You have noclipped out of reality.', W/2, H * 0.52);
    ctx.fillText('Find the exit on each level to advance.', W/2, H * 0.58);

    ctx.fillStyle = '#ffcc00';
    ctx.font = `${Math.min(20, W * 0.022)}px monospace`;
    const blink = Date.now() % 1200 < 600;
    if (blink) ctx.fillText('[CLICK or ENTER to begin]', W/2, H * 0.72);

    ctx.fillStyle = '#554433';
    ctx.font = `${Math.min(14, W * 0.016)}px monospace`;
    ctx.fillText('WASD / Arrows: move   Mouse: look   ESC: pause', W/2, H * 0.88);
    ctx.textAlign = 'left';
  }

  _drawGameOver(ctx, W, H) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#440000';
    ctx.font = `bold ${Math.min(60, W * 0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU HAVE BEEN LOST', W/2, H * 0.4);
    ctx.fillStyle = '#553333';
    ctx.font = `${Math.min(20, W * 0.022)}px monospace`;
    ctx.fillText('Your sanity could not hold.', W/2, H * 0.55);
    ctx.fillStyle = '#997766';
    ctx.font = `${Math.min(16, W * 0.018)}px monospace`;
    const blink = Date.now() % 1200 < 600;
    if (blink) ctx.fillText('[CLICK or ENTER to restart]', W/2, H * 0.7);
    ctx.textAlign = 'left';
    this.canvas.addEventListener('click', () => {
      if (this.state === 'gameover') { this.state = 'menu'; }
    }, { once: true });
  }
}
