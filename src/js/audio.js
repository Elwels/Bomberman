/* Gestor de Audio para Menú, Juego y Derrota */

class AudioManager {
    constructor() {
        this.pistas = {
            Title: new Audio('./src/sounds/Title.mp3'),
            Map: new Audio('./src/sounds/Map.mp3'),
            GameOver: new Audio('./src/sounds/GameOver.mp3'),
            Explotion: new Audio('./src/sounds/Explotion.mp3'),
            Win:  new Audio('./src/sounds/Win.mp3'),
        };

        // Configurar bucles y volúmenes
        this.pistas.Title.loop = true;
        this.pistas.Title.volume = 0.4;

        this.pistas.Map.loop = true;
        this.pistas.Map.volume = 0.35;

        this.pistas.GameOver.loop = false;
        this.pistas.GameOver.volume = 0.5;
        
        this.pistas.Explotion.loop = false;
        this.pistas.Explotion.volume = 0.5;

        this.pistas.Win.loop = false;
        this.pistas.Win.volume = 0.4;

        this.pistaActual = null;
    }

    reproducir(nombre) {
        const nuevaPista = this.pistas[nombre];
        if (!nuevaPista || this.pistaActual === nuevaPista) return;

        this.detenerTodo();
        this.pistaActual = nuevaPista;
        this.pistaActual.currentTime = 0;

        // El catch evita errores en consola si el usuario aún no hace clic en la página
        this.pistaActual.play().catch(() => {
            console.warn(`Esperando interacción del usuario para reproducir: ${nombre}`);
        });
    }

    pausar() {
        if (this.pistaActual) {
            this.pistaActual.pause();
        }
    }

    reanudar() {
        if (this.pistaActual) {
            this.pistaActual.play().catch(() => {});
        }
    }

    detenerTodo() {
        Object.values(this.pistas).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.pistaActual = null;
    }
    reproducirEfecto(nombre) {
        const sfx = this.pistas[nombre];
        if (sfx) {
            const clonSfx = sfx.cloneNode(); // Permite reproducir varias explosiones a la vez si hay varias bombas
            clonSfx.volume = sfx.volume;
            clonSfx.play().catch(() => {});
        }
    }
}

export const audioManager = new AudioManager();