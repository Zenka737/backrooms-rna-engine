export class Monster {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 0.018;
        this.alive = true;
        this.damageCooldown = 0;
    }

    // Возвращает true если нанёс урон
    update(player, map) {
        if (!this.alive) return false;
        if (this.damageCooldown > 0) this.damageCooldown--;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Касание — урон
        if (dist < 0.65) {
            if (this.damageCooldown <= 0) {
                this.damageCooldown = 100;
                return true;
            }
            return false;
        }

        // Преследование в радиусе 14 клеток
        if (dist < 14) {
            const nx = this.x + (dx / dist) * this.speed;
            const ny = this.y + (dy / dist) * this.speed;
            if (map.getCell(Math.floor(nx), Math.floor(this.y)) === 0) this.x = nx;
            if (map.getCell(Math.floor(this.x), Math.floor(ny)) === 0) this.y = ny;
        }
        return false;
    }

    getColor(shade) {
        const r = Math.floor(210 * shade);
        const g = Math.floor(15 * shade);
        const b = Math.floor(15 * shade);
        return `rgb(${r},${g},${b})`;
    }
}
