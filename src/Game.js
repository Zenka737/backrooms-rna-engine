// ============================================================
// Game.js — главный игровой цикл (финальная версия)
// ============================================================

import { RNAEngine } from './engine/RNAEngine.js';
import { GameMap } from './engine/Map.js';
import { Player } from './engine/Player.js';
import { Monster } from './engine/Monster.js';
import { LEVELS } from './levels/LevelDefs.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.isRunning = false;
        this.isPaused = false;
        this.currentLevel = 0;
        this.seed = 42;
        this.mapSize = 40;
        
        this.map = null;
        this.player = null;
        this.engine = null;
        
        // FPS
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 0;
        
        this.isLoading = false;
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.isLocked = false;
        this.isMoving = false;
        
        this.resize();
        this.setupEvents();
        
        this.fpsElement = document.getElementById('fps-counter');
        this.fpsValue = document.getElementById('fps-value');
        this.fpsVisible = false;
        this.loadingElement = document.getElementById('loading');
    }
    
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            if (this.fpsValue) this.fpsValue.textContent = this.currentFps;
        }
    }
    
    toggleFPS() {
        this.fpsVisible = !this.fpsVisible;
        if (this.fpsElement) {
            this.fpsElement.classList.toggle('visible', this.fpsVisible);
        }
    }
    
    showLoading() {
        this.isLoading = true;
        if (this.loadingElement) this.loadingElement.style.display = 'block';
    }
    
    hideLoading() {
        this.isLoading = false;
        if (this.loadingElement) this.loadingElement.style.display = 'none';
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
    }
    
    setupEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            if (this.engine) this.engine.resize(this.canvas.width, this.canvas.height);
        });
        
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'F12') { e.preventDefault(); this.toggleFPS(); }
            if (e.code === 'Escape') {
                if (this.isLocked) document.exitPointerLock();
                this.isPaused = !this.isPaused;
            }
        });

        document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.mouseX += e.movementX;
                this.mouseY += e.movementY;
            }
        });
        
        this.canvas.addEventListener('click', () => {
            if (!this.isLocked && this.isRunning) this.canvas.requestPointerLock();
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        });
    }
    
    start() {
        if (this.isRunning) return;
        this.showLoading();
        this.isRunning = true;
        this.loadLevel(this.currentLevel);
        this.gameLoop();
        setTimeout(() => this.hideLoading(), 500);
    }
    
    loadLevel(levelIndex) {
        this.showLoading();
        
        const levelDef = LEVELS[levelIndex] || LEVELS[0];
        this.currentLevel = levelIndex;
        
        const levelInfo = document.getElementById('level-info');
        if (levelInfo) levelInfo.textContent = `Уровень ${levelIndex}: ${levelDef.name}`;
        
        this.mapSize = 40 + Math.floor(Math.random() * 20);
        this.map = new GameMap(this.mapSize, this.mapSize);
        this.map.generateBackrooms(this.seed, levelIndex);
        
        const spawn = this.map.getSpawnPoint();
        const startX = spawn.x + 0.5;
        const startY = spawn.y + 0.5;

        const exit = this.map.getExitPoint();
        this.exitPoint = exit ? { x: exit.x + 0.5, y: exit.y + 0.5 } : null;
        
        this.player = new Player(startX, startY, 0);
        this.player.resetSanity();
        this.player.resetHearts();

        this.engine = new RNAEngine(this.canvas);

        // Спавн монстров
        this.monsters = [];
        const monsterCount = levelDef.monsterCount || 0;
        let spawned = 0;
        for (let attempt = 0; spawned < monsterCount && attempt < 500; attempt++) {
            const mx = 1 + Math.floor(Math.random() * (this.mapSize - 2));
            const my = 1 + Math.floor(Math.random() * (this.mapSize - 2));
            const dx = mx - startX, dy = my - startY;
            if (this.map.getCell(mx, my) === 0 && dx*dx + dy*dy > 25) {
                this.monsters.push(new Monster(mx + 0.5, my + 0.5));
                spawned++;
            }
        }

        // Расстановка ламп на потолке в свободных клетках
        levelDef.lights = [];
        const interval = levelDef.lightInterval || 6;
        for (let y = 0; y < this.mapSize; y += interval) {
            for (let x = 0; x < this.mapSize; x += interval) {
                if (this.map.getCell(x, y) === 0) {
                    levelDef.lights.push({ x: x + 0.5, y: y + 0.5 });
                }
            }
        }

        // Передаём монстров в level.entities для рендера спрайтов
        levelDef.entities = this.monsters.filter(m => m.alive);

        this.updateSanityUI();
        setTimeout(() => this.hideLoading(), 300);
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        this.update();
        this.render();
        this.updateFPS();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        if (this.isPaused || !this.isRunning || !this.player || !this.map) return;
        
        const speed = 2.5 * (1 / 60);
        const rotSpeed = 3.0 * (1 / 60);
        
        let dx = 0, dy = 0;
        this.isMoving = false;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            dx += Math.cos(this.player.angle) * speed;
            dy += Math.sin(this.player.angle) * speed;
            this.isMoving = true;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            dx -= Math.cos(this.player.angle) * speed;
            dy -= Math.sin(this.player.angle) * speed;
            this.isMoving = true;
        }
        if (this.keys['KeyA']) {
            dx += Math.cos(this.player.angle - Math.PI/2) * speed;
            dy += Math.sin(this.player.angle - Math.PI/2) * speed;
            this.isMoving = true;
        }
        if (this.keys['KeyD']) {
            dx += Math.cos(this.player.angle + Math.PI/2) * speed;
            dy += Math.sin(this.player.angle + Math.PI/2) * speed;
            this.isMoving = true;
        }
        
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        if (newX >= 0 && newX < this.mapSize && newY >= 0 && newY < this.mapSize) {
            const cellX = Math.floor(newX);
            const cellY = Math.floor(newY);
            if (this.map.getCell(cellX, cellY) === 0) {
                this.player.x = newX;
                this.player.y = newY;
            }
        }
        
        this.player.clampPosition(this.mapSize);
        
        const rotSpeedKey = 2.5 * (1 / 60);
        if (this.keys['ArrowLeft']) this.player.angle -= rotSpeedKey;
        if (this.keys['ArrowRight']) this.player.angle += rotSpeedKey;
        if (this.keys['KeyQ']) this.player.angle -= rotSpeedKey;
        if (this.keys['KeyE']) this.player.angle += rotSpeedKey;
        
        if (this.isLocked) {
            const mouseSensitivity = 0.003;
            this.player.angle += this.mouseX * mouseSensitivity;
            this.mouseX = 0;
            this.mouseY = 0;
        }
        
        this.player.updateSanity();
        if (this.player.invincible > 0) this.player.invincible--;

        // Обновление монстров
        if (this.monsters) {
            const levelDef = LEVELS[this.currentLevel] || LEVELS[0];
            for (const monster of this.monsters) {
                const hit = monster.update(this.player, this.map);
                if (hit) this.player.takeDamage();
            }
            // Синхронизируем живых монстров в entities для рендера
            levelDef.entities = this.monsters.filter(m => m.alive);
        }

        // Смерть игрока
        if (!this.player.isAlive()) {
            this._onPlayerDead();
            return;
        }

        this.updateSanityUI();
        this.checkExit();
    }

    _onPlayerDead() {
        this.isRunning = false;
        const ctx = this.canvas.getContext('2d');
        const W = this.canvas.width, H = this.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#cc2222';
        ctx.font = `bold ${Math.floor(H * 0.07)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('ВЫ ПОГИБЛИ', W / 2, H * 0.42);
        ctx.fillStyle = '#884444';
        ctx.font = `${Math.floor(H * 0.025)}px monospace`;
        ctx.fillText('Нажмите Enter чтобы начать заново', W / 2, H * 0.56);
        ctx.textAlign = 'left';

        const restart = (e) => {
            if (e.code === 'Enter') {
                document.removeEventListener('keydown', restart);
                this.isRunning = true;
                this.loadLevel(0);
                this.gameLoop();
            }
        };
        document.addEventListener('keydown', restart);
    }
    
    render() {
        if (!this.engine || !this.map || !this.player) return;
        const levelDef = LEVELS[this.currentLevel] || LEVELS[0];
        this.engine.render(this.map, this.player, levelDef, this.isMoving);
        this._drawMinimap();
    }

    _drawMinimap() {
        const ctx = this.canvas.getContext('2d');
        const W = this.canvas.width, H = this.canvas.height;
        const scale = 3;
        const ox = W - this.mapSize * scale - 10;
        const oy = 10;

        ctx.globalAlpha = 0.5;
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                ctx.fillStyle = this.map.getCell(x, y) === 0 ? '#443300' : '#000000';
                ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
            }
        }

        // Выход (зелёная точка)
        if (this.exitPoint) {
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(ox + this.exitPoint.x * scale - 2, oy + this.exitPoint.y * scale - 2, 4, 4);
        }

        // Монстры (красные точки — только живые)
        if (this.monsters && this.monsters.length > 0) {
            ctx.fillStyle = '#ff2222';
            for (const m of this.monsters) {
                if (m.alive) ctx.fillRect(ox + m.x * scale - 1, oy + m.y * scale - 1, 3, 3);
            }
        }

        // Игрок (жёлтая точка)
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(ox + this.player.x * scale - 2, oy + this.player.y * scale - 2, 4, 4);

        // Направление взгляда
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + this.player.x * scale, oy + this.player.y * scale);
        ctx.lineTo(
            ox + (this.player.x + Math.cos(this.player.angle) * 3) * scale,
            oy + (this.player.y + Math.sin(this.player.angle) * 3) * scale
        );
        ctx.stroke();

        ctx.globalAlpha = 1;
    }
    
    updateSanityUI() {
        const fill = document.getElementById('sanity-fill');
        if (fill && this.player) {
            const sanity = Math.max(0, Math.min(100, this.player.sanity));
            fill.style.width = sanity + '%';
            fill.style.background = sanity > 60 ? '#4CAF50' : sanity > 30 ? '#FFC107' : '#f44336';
        }
    }
    
    checkExit() {
        if (!this.player || !this.exitPoint) return;
        const dist = Math.sqrt(
            Math.pow(this.player.x - this.exitPoint.x, 2) +
            Math.pow(this.player.y - this.exitPoint.y, 2)
        );
        if (dist < 0.8) this.nextLevel();
    }
    
    nextLevel() {
        const nextIndex = this.currentLevel + 1;
        if (nextIndex < LEVELS.length) {
            this.showLoading();
            this.loadLevel(nextIndex);
            setTimeout(() => this.hideLoading(), 400);
        } else {
            alert('Поздравляем! Вы прошли все уровни!');
        }
    }
}