// ============================================================
// Game.js — главный игровой цикл (финальная версия)
// ============================================================

import { RNAEngine } from './engine/RNAEngine.js';
import { GameMap } from './engine/Map.js';
import { Player } from './engine/Player.js';
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
            this.keys[e.key] = true;
            if (e.key === 'F12') { e.preventDefault(); this.toggleFPS(); }
            if (e.key === 'Escape') {
                if (this.isLocked) document.exitPointerLock();
                this.isPaused = !this.isPaused;
            }
            if (e.key === 'Enter' && !this.isRunning) this.startGame();
        });
        
        document.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        
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
        
        this.player = new Player(startX, startY, 0);
        this.player.resetSanity();
        
        this.engine = new RNAEngine(this.canvas);
        
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
        
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) {
            dx += Math.cos(this.player.angle) * speed;
            dy += Math.sin(this.player.angle) * speed;
            this.isMoving = true;
        }
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) {
            dx -= Math.cos(this.player.angle) * speed;
            dy -= Math.sin(this.player.angle) * speed;
            this.isMoving = true;
        }
        if (this.keys['a'] || this.keys['A']) {
            dx += Math.cos(this.player.angle - Math.PI/2) * speed;
            dy += Math.sin(this.player.angle - Math.PI/2) * speed;
            this.isMoving = true;
        }
        if (this.keys['d'] || this.keys['D']) {
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
        
        if (this.isLocked) {
            const mouseSensitivity = 0.003;
            this.player.angle += this.mouseX * mouseSensitivity;
            this.mouseX = 0;
            this.mouseY = 0;
        }
        
        this.player.updateSanity();
        this.updateSanityUI();
        this.checkExit();
    }
    
    // ✅ ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ РЕНДЕРА
    render() {
        if (!this.engine || !this.map || !this.player) return;
        const levelDef = LEVELS[this.currentLevel] || LEVELS[0];
        this.engine.render(this.map, this.player, levelDef, this.isMoving);
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
        if (!this.player || !this.map) return;
        const exit = this.map.getExitPoint();
        if (!exit) return;
        
        const dist = Math.sqrt(
            Math.pow(this.player.x - exit.x, 2) +
            Math.pow(this.player.y - exit.y, 2)
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