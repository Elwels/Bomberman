import * as THREE from 'three';
import { audioManager } from './audio.js';
import { MATERIALES_TEXTURIZADOS, MODELOS, precargarAssets } from './assets.js';

const CONFIG = {
    VEL_JUGADOR: 5,
    TIEMPO_BOMBA: 2.0,      
    DURACION_FUEGO: 0.5,    
    ALCANCE_BOMBA: 2,      
    VIDAS_INICIALES: 3,
    TIEMPO_NIVEL: 300,
    VEL_ENEMIGO: 2.5,
    TIEMPO_INVULNERABLE: 2.0
};

/*
   # : Pared indestructible (Piedra)
   B : Bloque destructible (Ladrillo/Madera)
   P : Posición inicial del Jugador
   E : Enemigo
   F : Puerta de salida (Victoria)
   ' ' : Espacio vacío
*/
const MAPA_NIVEL = [
    "#############",
    "#P B   B B  #",
    "# #B# #B# # #",
    "# B E B B B #",
    "# # # # #B# #",
    "#B B B E  B #",
    "# #B# # # # #",
    "# B   B  B F#",
    "#############"
];

let scene, camera, renderer;
let estadoJuego = 'INICIO'; 
let tiempoRestante = CONFIG.TIEMPO_NIVEL;
let puntos = 0;
let vidas = CONFIG.VIDAS_INICIALES;
let reloj = new THREE.Clock();
let tiempoInvulnerable = 0;

let mapaGrilla = [];
let altoMapa = MAPA_NIVEL.length;
let anchoMapa = MAPA_NIVEL[0].length;
let grupoNivel = null;

let jugadorMesh;
let jugadorPos = { x: 1, z: 1 };
let bombas = [];
let explosiones = [];
let enemigos = [];
let puertaSalida = null;

const teclas = {};

// Materiales primitivos de respaldo (se usan solo si no cargan las texturas/modelos)
const MATERIALES_RESPALDO = {
    jugador: new THREE.MeshStandardMaterial({ color: 0x0077b6, roughness: 0.2 }),
    enemigo: new THREE.MeshStandardMaterial({ color: 0xd90429 })
};

const GEO_BLOQUE = new THREE.BoxGeometry(1, 1, 1);
const GEO_JUGADOR = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
const GEO_ENEMIGO = new THREE.SphereGeometry(0.35, 16, 16);
const GEO_BOMBA = new THREE.SphereGeometry(0.4, 16, 16);
const GEO_PUERTA = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);

const uiVidas = document.getElementById('hud-vidas');
const uiPuntos = document.getElementById('hud-puntos');
const uiTiempo = document.getElementById('hud-tiempo');
const pantallaInicio = document.getElementById('pantalla-inicio');
const pantallaPausa = document.getElementById('pantalla-pausa');
const pantallaFin = document.getElementById('pantalla-fin');
const pantallaVictoria = document.getElementById('pantalla-victoria');

inicializar();
async function inicializar() {
    await precargarAssets();


    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(anchoMapa / 2, 12, altoMapa + 4);
    camera.lookAt(anchoMapa / 2, 0, altoMapa / 2);

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(luzAmbiente);

    const luzDireccional = new THREE.DirectionalLight(0xffffff, 1.2);
    luzDireccional.position.set(anchoMapa / 2, 15, altoMapa / 2 - 5);
    luzDireccional.castShadow = true;
    scene.add(luzDireccional);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    window.addEventListener('keydown', (e) => {
        teclas[e.code] = true;
        if (e.code === 'KeyP' && (estadoJuego === 'JUGANDO' || estadoJuego === 'PAUSA')) {
            alternarPausa();
        }
        if (e.code === 'Space' && estadoJuego === 'JUGANDO') {
            colocarBomba();
        }
    });

    window.addEventListener('keyup', (e) => {
        teclas[e.code] = false;
    });

    window.addEventListener('resize', enRedimensionar);

    pantallaInicio.addEventListener('click', (e) => {
        if (e.target.id !== 'btn-jugar' && estadoJuego === 'INICIO') {
            audioManager.reproducir('Title');
        }
    }, { once: true });

    document.getElementById('btn-jugar').addEventListener('click', iniciarJuego);
    document.getElementById('btn-reiniciar').addEventListener('click', iniciarJuego);
    document.getElementById('btn-reiniciar-victoria').addEventListener('click', iniciarJuego);

    renderer.setAnimationLoop(buclePrincipal);
}

function iniciarJuego() {
    estadoJuego = 'JUGANDO';
    vidas = CONFIG.VIDAS_INICIALES;
    puntos = 0;
    tiempoRestante = CONFIG.TIEMPO_NIVEL;
    tiempoInvulnerable = 0;

    audioManager.reproducir('Map');

    actualizarHUD();
    ocultarPantallas();
    construirNivel();

    reloj.start();
}

function construirNivel() {
    if (grupoNivel) scene.remove(grupoNivel);

    grupoNivel = new THREE.Group();
    scene.add(grupoNivel);

    mapaGrilla = Array(altoMapa).fill(null).map(() => Array(anchoMapa).fill(null));
    bombas = [];
    explosiones = [];
    enemigos = [];

    const geoPiso = new THREE.PlaneGeometry(anchoMapa, altoMapa);
    const piso = new THREE.Mesh(geoPiso, MATERIALES_TEXTURIZADOS.piso);
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(anchoMapa / 2, 0, altoMapa / 2);
    piso.receiveShadow = true;
    grupoNivel.add(piso);

    for (let z = 0; z < altoMapa; z++) {
        for (let x = 0; x < anchoMapa; x++) {
            const char = MAPA_NIVEL[z][x];

            if (char === '#') {
                const pared = new THREE.Mesh(GEO_BLOQUE, MATERIALES_TEXTURIZADOS.paredIndestructible);
                pared.position.set(x + 0.5, 0.5, z + 0.5);
                pared.castShadow = true;
                pared.receiveShadow = true;
                grupoNivel.add(pared);
                mapaGrilla[z][x] = 'PARED';
            } else if (char === 'B') {
                const bloque = new THREE.Mesh(GEO_BLOQUE, MATERIALES_TEXTURIZADOS.bloqueDestructible);
                bloque.position.set(x + 0.5, 0.5, z + 0.5);
                bloque.castShadow = true;
                bloque.receiveShadow = true;
                grupoNivel.add(bloque);
                mapaGrilla[z][x] = { tipo: 'BLOQUE', mesh: bloque };
            } else if (char === 'P') {
                jugadorPos = { x: x + 0.5, z: z + 0.5 };
            } else if (char === 'E') {
                crearEnemigo(x + 0.5, z + 0.5);
            } else if (char === 'F') {
                puertaSalida = new THREE.Mesh(GEO_PUERTA, MATERIALES_TEXTURIZADOS.salida);
                puertaSalida.position.set(x + 0.5, 0.05, z + 0.5);
                grupoNivel.add(puertaSalida);
                mapaGrilla[z][x] = 'SALIDA';
            }
        }
    }

    if (!jugadorMesh) {
        if (MODELOS.jugador) {
            jugadorMesh = MODELOS.jugador.clone();
        } else {
            jugadorMesh = new THREE.Mesh(GEO_JUGADOR, MATERIALES_RESPALDO.jugador);
        }
    }
    const alturaJugador = MODELOS.jugador ? 0 : 0.4;
    jugadorMesh.position.set(jugadorPos.x, alturaJugador, jugadorPos.z);
    grupoNivel.add(jugadorMesh);
}

function crearEnemigo(x, z) {
    let mesh;
    // 6. Clonar modelo MagicaVoxel del enemigo para cada enemigo en el mapa
    if (MODELOS.enemigo) {
        mesh = MODELOS.enemigo.clone();
        mesh.position.set(x, 0, z);
    } else {
        mesh = new THREE.Mesh(GEO_ENEMIGO, MATERIALES_RESPALDO.enemigo);
        mesh.position.set(x, 0.35, z);
    }
    grupoNivel.add(mesh);

    const dirAleatoria = [
        { x: 1, z: 0 }, { x: -1, z: 0 },
        { x: 0, z: 1 }, { x: 0, z: -1 }
    ][Math.floor(Math.random() * 4)];

    enemigos.push({
        mesh: mesh,
        dir: dirAleatoria,
        x: x,
        z: z
    });
}

function colocarBomba() {
    const gx = Math.floor(jugadorMesh.position.x);
    const gz = Math.floor(jugadorMesh.position.z);

    if (bombas.some(b => b.gx === gx && b.gz === gz)) return;

    const bombaMesh = new THREE.Mesh(GEO_BOMBA, MATERIALES_TEXTURIZADOS.bomba);
    bombaMesh.position.set(gx + 0.5, 0.4, gz + 0.5);
    bombaMesh.castShadow = true;
    grupoNivel.add(bombaMesh);

    bombas.push({
        mesh: bombaMesh,
        gx: gx,
        gz: gz,
        tiempo: CONFIG.TIEMPO_BOMBA
    });
}

function buclePrincipal() {
    const delta = reloj.getDelta();

    if (estadoJuego === 'JUGANDO') {
        actualizarJugador(delta);
        actualizarBombas(delta);
        actualizarExplosiones(delta);
        actualizarEnemigos(delta);
        actualizarTiempo(delta);
    }

    renderer.render(scene, camera);
}

function actualizarJugador(delta) {
    let dx = 0;
    let dz = 0;

    if (teclas['KeyW'] || teclas['ArrowUp']) dz -= 1;
    if (teclas['KeyS'] || teclas['ArrowDown']) dz += 1;
    if (teclas['KeyA'] || teclas['ArrowLeft']) dx -= 1;
    if (teclas['KeyD'] || teclas['ArrowRight']) dx += 1;

    if (dx !== 0 || dz !== 0) {
        // Rotar el modelo 3D hacia la dirección en la que camina
        jugadorMesh.rotation.y = Math.atan2(dx, dz);

        const mag = Math.hypot(dx, dz);
        dx = (dx / mag) * CONFIG.VEL_JUGADOR * delta;
        dz = (dz / mag) * CONFIG.VEL_JUGADOR * delta;

        const nuevaX = jugadorMesh.position.x + dx;
        const nuevaZ = jugadorMesh.position.z + dz;

        if (!esColision(nuevaX, jugadorMesh.position.z, 0.3)) {
            jugadorMesh.position.x = nuevaX;
        }
        if (!esColision(jugadorMesh.position.x, nuevaZ, 0.3)) {
            jugadorMesh.position.z = nuevaZ;
        }
    }

    if (tiempoInvulnerable > 0) {
        tiempoInvulnerable -= delta;
        jugadorMesh.visible = Math.floor(tiempoInvulnerable * 10) % 2 === 0;
    } else {
        jugadorMesh.visible = true;
    }

    const gx = Math.floor(jugadorMesh.position.x);
    const gz = Math.floor(jugadorMesh.position.z);
    if (MAPA_NIVEL[gz] && MAPA_NIVEL[gz][gx] === 'F') {
        ganarJuego();
    }
}

function esColision(x, z, radio) {
    const minX = Math.floor(x - radio);
    const maxX = Math.floor(x + radio);
    const minZ = Math.floor(z - radio);
    const maxZ = Math.floor(z + radio);

    for (let gz = minZ; gz <= maxZ; gz++) {
        for (let gx = minX; gx <= maxX; gx++) {
            if (gz < 0 || gz >= altoMapa || gx < 0 || gx >= anchoMapa) return true;
            const celda = mapaGrilla[gz][gx];

            if (celda === 'PARED' || (celda && celda.tipo === 'BLOQUE')) {
                return true;
            }

            if (bombas.some(b => b.gx === gx && b.gz === gz)) {
                const centroBombaX = gx + 0.5;
                const centroBombaZ = gz + 0.5;
                if (Math.hypot(jugadorMesh.position.x - centroBombaX, jugadorMesh.position.z - centroBombaZ) > 0.9) {
                    return true;
                }
            }
        }
    }
    return false;
}

function actualizarBombas(delta) {
    for (let i = bombas.length - 1; i >= 0; i--) {
        const b = bombas[i];
        b.tiempo -= delta;

        const escala = 1 + Math.sin(b.tiempo * 12) * 0.08;
        b.mesh.scale.set(escala, escala, escala);

        if (b.tiempo <= 0) {
            explotarBomba(b);
            grupoNivel.remove(b.mesh);
            bombas.splice(i, 1);
        }
    }
}

function explotarBomba(bomba) {
    audioManager.reproducirEfecto('Explotion');
    const direcciones = [
        { x: 0, z: 0 },
        { x: 1, z: 0 }, { x: -1, z: 0 },
        { x: 0, z: 1 }, { x: 0, z: -1 }
    ];

    direcciones.forEach(d => {
        for (let i = (d.x === 0 && d.z === 0 ? 0 : 1); i <= CONFIG.ALCANCE_BOMBA; i++) {
            const gx = bomba.gx + d.x * i;
            const gz = bomba.gz + d.z * i;

            if (gx < 0 || gx >= anchoMapa || gz < 0 || gz >= altoMapa) break;

            const celda = mapaGrilla[gz][gx];

            if (celda === 'PARED') {
                break; 
            }

            const fuegoMesh = new THREE.Mesh(GEO_BLOQUE, MATERIALES_TEXTURIZADOS.fuego);
            fuegoMesh.position.set(gx + 0.5, 0.4, gz + 0.5);
            fuegoMesh.scale.set(0.9, 0.8, 0.9);
            grupoNivel.add(fuegoMesh);

            explosiones.push({ mesh: fuegoMesh, tiempo: CONFIG.DURACION_FUEGO, gx: gx, gz: gz });

            if (celda && celda.tipo === 'BLOQUE') {
                grupoNivel.remove(celda.mesh);
                mapaGrilla[gz][gx] = null;
                puntos += 50;
                actualizarHUD();
                break; 
            }
        }
    });
}

function actualizarExplosiones(delta) {
    for (let i = explosiones.length - 1; i >= 0; i--) {
        const exp = explosiones[i];
        exp.tiempo -= delta;

        if (tiempoInvulnerable <= 0) {
            const jgx = Math.floor(jugadorMesh.position.x);
            const jgz = Math.floor(jugadorMesh.position.z);
            if (jgx === exp.gx && jgz === exp.gz) {
                recibirDano();
            }
        }

        for (let j = enemigos.length - 1; j >= 0; j--) {
            const ene = enemigos[j];
            const egx = Math.floor(ene.mesh.position.x);
            const egz = Math.floor(ene.mesh.position.z);
            if (egx === exp.gx && egz === exp.gz) {
                grupoNivel.remove(ene.mesh);
                enemigos.splice(j, 1);
                puntos += 100;
                actualizarHUD();
            }
        }

        if (exp.tiempo <= 0) {
            grupoNivel.remove(exp.mesh);
            explosiones.splice(i, 1);
        }
    }
}

function actualizarEnemigos(delta) {
    enemigos.forEach(ene => {
        const pasoX = ene.dir.x * CONFIG.VEL_ENEMIGO * delta;
        const pasoZ = ene.dir.z * CONFIG.VEL_ENEMIGO * delta;

        const proxX = ene.mesh.position.x + pasoX;
        const proxZ = ene.mesh.position.z + pasoZ;

        if (!esColision(proxX, proxZ, 0.35)) {
            ene.mesh.position.x = proxX;
            ene.mesh.position.z = proxZ;
            ene.mesh.rotation.y = Math.atan2(ene.dir.x, ene.dir.z);
        } else {
            const dirs = [
                { x: 1, z: 0 }, { x: -1, z: 0 },
                { x: 0, z: 1 }, { x: 0, z: -1 }
            ];
            ene.dir = dirs[Math.floor(Math.random() * dirs.length)];
        }

        if (tiempoInvulnerable <= 0) {
            const dist = Math.hypot(jugadorMesh.position.x - ene.mesh.position.x, jugadorMesh.position.z - ene.mesh.position.z);
            if (dist < 0.6) {
                recibirDano();
            }
        }
    });
}

function recibirDano() {
    vidas--;
    actualizarHUD();
    tiempoInvulnerable = CONFIG.TIEMPO_INVULNERABLE;

    if (vidas <= 0) {
        perderJuego();
    }
}

function actualizarTiempo(delta) {
    tiempoRestante -= delta;
    if (tiempoRestante <= 0) {
        tiempoRestante = 0;
        perderJuego();
    }
    uiTiempo.textContent = Math.ceil(tiempoRestante);
}

function actualizarHUD() {
    uiVidas.textContent = vidas;
    uiPuntos.textContent = puntos;
    uiTiempo.textContent = Math.ceil(tiempoRestante);
}

function alternarPausa() {
    if (estadoJuego === 'JUGANDO') {
        estadoJuego = 'PAUSA';
        pantallaPausa.classList.remove('oculto');
        audioManager.pausar();
    } else if (estadoJuego === 'PAUSA') {
        estadoJuego = 'JUGANDO';
        pantallaPausa.classList.add('oculto');
        audioManager.reanudar();
        reloj.start();
    }
}

function perderJuego() {
    estadoJuego = 'DERROTA';
    pantallaFin.classList.remove('oculto');
    audioManager.reproducir('GameOver');
}

function ganarJuego() {
    estadoJuego = 'VICTORIA';
    pantallaVictoria.classList.remove('oculto');
    audioManager.reproducir('Win');
}

function ocultarPantallas() {
    pantallaInicio.classList.add('oculto');
    pantallaPausa.classList.add('oculto');
    pantallaFin.classList.add('oculto');
    pantallaVictoria.classList.add('oculto');
}

function enRedimensionar() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}