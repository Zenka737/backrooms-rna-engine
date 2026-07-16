export class Player {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle || 0;
        this.sanity = 100;
        this.sanityTimer = 0;
        this.sanityDrainRate = 0.05;

        this.hearts = 3;
        this.maxHearts = 3;
        this.invincible = 0; // кадры неуязвимости после удара
    }

    updateSanity() {
        this.sanityTimer += 1 / 60;
        if (this.sanityTimer >= 1) {
            this.sanityTimer = 0;
            this.sanity = Math.max(0, this.sanity - this.sanityDrainRate);
        }
    }

    takeDamage() {
        if (this.invincible > 0) return;
        this.hearts = Math.max(0, this.hearts - 1);
        this.invincible = 120; // 2 секунды при 60fps
    }

    isAlive() {
        return this.hearts > 0;
    }

    resetSanity() {
        this.sanity = 100;
        this.sanityTimer = 0;
    }

    resetHearts() {
        this.hearts = this.maxHearts;
        this.invincible = 0;
    }

    clampPosition(mapSize) {
        const margin = 0.5;
        if (this.x < margin) this.x = margin;
        if (this.x > mapSize - margin) this.x = mapSize - margin;
        if (this.y < margin) this.y = margin;
        if (this.y > mapSize - margin) this.y = mapSize - margin;
    }
}
