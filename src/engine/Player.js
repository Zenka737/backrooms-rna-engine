// ============================================================
// Player.js — игрок с рассудком и коллизиями
// ============================================================

export class Player {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle || 0;
        this.sanity = 100;
        this.sanityTimer = 0;
        this.sanityDrainRate = 0.05; // Потеря рассудка в секунду
    }
    
    updateSanity() {
        this.sanityTimer += 1 / 60;
        if (this.sanityTimer >= 1) {
            this.sanityTimer = 0;
            this.sanity = Math.max(0, this.sanity - this.sanityDrainRate);
        }
    }
    
    // Проверка, жив ли игрок
    isAlive() {
        return this.sanity > 0;
    }
    
    // Сброс рассудка
    resetSanity() {
        this.sanity = 100;
        this.sanityTimer = 0;
    }
    
    // 🔧 НОВОЕ: проверка границ
    clampPosition(mapSize) {
        const margin = 0.5;
        if (this.x < margin) this.x = margin;
        if (this.x > mapSize - margin) this.x = mapSize - margin;
        if (this.y < margin) this.y = margin;
        if (this.y > mapSize - margin) this.y = mapSize - margin;
    }
}