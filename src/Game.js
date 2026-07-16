// ============================================================
// Game.js — главный игровой цикл
// ============================================================

import { RNAEngine } from './engine/RNAEngine.js';
import { Map } from './engine/Map.js';
import { Player } from './engine/Player.js';
import { LEVELS } from './levels/LevelDefs.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Настройки
        this.isRunning = false;
        this.isPaused = false;
        this.currentLevel = 0;
        
        // Компоненты
        this.map = null;
        this.player = null;
        this.engine = null;
        
        // FPS
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 0;
        
        // Загрузка
        this.isLoading = false;
        
        // Управление
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.isLocked = false;
        
        // Размеры
        this.resize();
        
        // События
        this.setupEvents();
        
        // FPS элемент
        this.fpsElement = document.getElementById('fps-counter');
        this.fpsValue = document.getElementById('fps-value');
        this.fpsVisible = false;
        
        // Индикатор загрузки
        this.loadingElement = document.getElementById('loading');
    }
    
    // ===== FPS =====
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            if (this.fpsValue) {
                this.fpsValue.textContent = this.currentFps;
            }
        }
    }
    
    toggleFPS() {
        this.fpsVisible = !this.fpsVisible;
        if (this.fpsElement) {
            this.fpsElement.classList.toggle('visible', this.fpsVisible);
        }
    }
    
    // ===== ЗАГРУЗКА =====
    showLoading() {
        this.isLoading = true;
        if (this.loadingElement) {
            this.loadingElement.style.display = 'block';
        }
    }
    
    hideLoading() {
        this.isLoading = false;
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
    }
    
    // ===== РАЗМЕРЫ =====
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
    }
    
    // ===== СОБЫТИЯ =====
    setupEvents() {
        // Resize
        window.addEventListener('resize', () => {
            this.resize();
            if (this.engine) {
                this.engine.resize(this.canvas.width, this.canvas.height);
            }
        });
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // F12 — FPS
            if (e.key === 'F12') {
                e.preventDefault();
                this.toggleFPS();
            }
            
            // ESC — пауза / выход из pointer lock
            if (e.key === 'Escape') {
                if (this.isLocked) {
                    document.exitPointerLock();
                }
                this.isPaused = !this.isPaused;
            }
            
            // Enter — начать игру
            if (e.key === 'Enter' && !this.isRunning) {
                this.startGame();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        // Mouse
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.mouseX += e.movementX;
                this.mouseY += e.movementY;
            }
        });
        
        // Pointer Lock
        this.canvas.addEventListener('click', () => {
            if (!this.isLocked && this.isRunning) {
                this.canvas.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        });
    }
    
    // ===== СТАРТ =====
    start() {
        if (this.isRunning) return;
        
        this.showLoading();
        this.isRunning = true;
        
        // Инициализация первого уровня
        this.loadLevel(this.currentLevel);
        
        // Запуск цикла
        this.gameLoop();
        
        // Скрываем загрузку после первого кадра
        setTimeout(() => this.hideLoading(), 500);
    }
    
    // ===== ЗАГРУЗКА УРОВНЯ =====
    loadLevel(levelIndex) {
        this.showLoading();
        
        const levelDef = LEVELS[levelIndex] || LEVELS[0];
        this.currentLevel = levelIndex;
        
        // Обновляем информацию об уровне
        const levelInfo = document.getElementById('level-info');
        if (levelInfo) {
            levelInfo.textContent = `Уровень ${levelIndex}: ${levelDef.name}`;
        }
        
        // Создаём карту
        const mapSize = 40 + Math.floor(Math.random() * 20);
        this.map = new Map(mapSize, levelDef);
        this.map.generate();
        
        // Создаём игрока (с проверкой границ)
        const mapData = this.map.getData();
        let startX = 1, startY = 1;
        for (let y = 1; y < mapData.length - 1; y++) {
            for (let x = 1; x < mapData[y].length - 1; x++) {
                if (mapData[y][x] === 0) {
                    startX = x + 0.5;
                    startY = y + 0.5;
                    break;
                }
            }
        }
        
        this.player = new Player(startX, startY, 0);
        
        // 🔧 ИСПРАВЛЕНИЕ: сбрасываем рассудок при переходе
        this.player.sanity = 100;
        
        // Создаём движок
        this.engine = new RNAEngine(
            this.canvas,
            this.ctx,
            this.map,
            this.player
        );
        
        // Обновляем индикатор рассудка
        this.updateSanityUI();
        
        // Находим выход на карте
        const exit = this.map.getExit();
        if (exit) {
            // Сохраняем позицию выхода для проверки
            this.exitX = exit.x;
            this.exitY = exit.y;
        }
        
        setTimeout(() => this.hideLoading(), 300);
    }
    
    // ===== ИГРОВОЙ ЦИКЛ =====
    gameLoop() {
        if (!this.isRunning) return;
        
        // Обновление
        this.update();
        
        // Рендер
        this.render();
        
        // FPS
        this.updateFPS();
        
        // Следующий кадр
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        if (this.isPaused || !this.isRunning || !this.player || !this.map) return;
        
        // Движение
        const speed = 2.5 * (1 / 60);
        const rotSpeed = 3.0 * (1 / 60);
        
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) {
            dx += Math.cos(this.player.angle) * speed;
            dy += Math.sin(this.player.angle) * speed;
        }
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) {
            dx -= Math.cos(this.player.angle) * speed;
            dy -= Math.sin(this.player.angle) * speed;
        }
        if (this.keys['a'] || this.keys['A']) {
            dx += Math.cos(this.player.angle - Math.PI/2) * speed;
            dy += Math.sin(this.player.angle - Math.PI/2) * speed;
        }
        if (this.keys['d'] || this.keys['D']) {
            dx += Math.cos(this.player.angle + Math.PI/2) * speed;
            dy += Math.sin(this.player.angle + Math.PI/2) * speed;
        }
        
        // 🔧 ИСПРАВЛЕНИЕ: проверка границ карты
        const mapData = this.map.getData();
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        const mapSize = mapData.length;
        
        if (newX >= 0 && newX < mapSize && newY >= 0 && newY < mapSize) {
            // Проверка столкновений
            const cellX = Math.floor(newX);
            const cellY = Math.floor(newY);
            if (cellY >= 0 && cellY < mapData.length && 
                cellX >= 0 && cellX < mapData[cellY].length &&
                mapData[cellY][cellX] === 0) {
                this.player.x = newX;
                this.player.y = newY;
            }
        }
        
        // Поворот (клавиши)
        const rotSpeedKey = 2.5 * (1 / 60);
        if (this.keys['ArrowLeft']) {
            this.player.angle -= rotSpeedKey;
        }
        if (this.keys['ArrowRight']) {
            this.player.angle += rotSpeedKey;
        }
        
        // Поворот (мышь)
        if (this.isLocked) {
            const mouseSensitivity = 0.003;
            this.player.angle += this.mouseX * mouseSensitivity;
            this.mouseX = 0;
            this.mouseY = 0;
        }
        
        // Обновление рассудка
        this.player.updateSanity();
        this.updateSanityUI();
        
        // Проверка выхода
        this.checkExit();
    }
    
    render() {
        if (!this.engine) return;
        this.engine.render();
    }
    
    // ===== ИНТЕРФЕЙС =====
    updateSanityUI() {
        const fill = document.getElementById('sanity-fill');
        if (fill && this.player) {
            const sanity = Math.max(0, Math.min(100, this.player.sanity));
            fill.style.width = sanity + '%';
            
            // Меняем цвет
            if (sanity > 60) {
                fill.style.background = '#4CAF50';
            } else if (sanity > 30) {
                fill.style.background = '#FFC107';
            } else {
                fill.style.background = '#f44336';
            }
        }
    }
    
    // ===== ВЫХОД =====
    checkExit() {
        if (!this.player || !this.map) return;
        
        const exit = this.map.getExit();
        if (!exit) return;
        
        const dist = Math.sqrt(
            Math.pow(this.player.x - exit.x, 2) +
            Math.pow(this.player.y - exit.y, 2)
        );
        
        // Если игрок коснулся выхода (зелёная точка)
        if (dist < 0.8) {
            this.nextLevel();
        }
    }
    
    // ===== СЛЕДУЮЩИЙ УРОВЕНЬ =====
    nextLevel() {
        const nextIndex = this.currentLevel + 1;
        if (nextIndex < LEVELS.length) {
            this.showLoading();
            // 🔧 ИСПРАВЛЕНИЕ: сброс рассудка при переходе
            this.loadLevel(nextIndex);
            setTimeout(() => this.hideLoading(), 400);
        } else {
            // Все уровни пройдены
            alert('Поздравляем! Вы прошли все уровни!');
        }
    }
}