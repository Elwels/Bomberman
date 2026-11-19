/* Cargador de Texturas y Modelos 3D (MagicaVoxel OBJ/MTL) */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const textureLoader = new THREE.TextureLoader();

function cargarTextura(ruta) {
    const tex = textureLoader.load(ruta);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export const MATERIALES_TEXTURIZADOS = {
    piso: new THREE.MeshStandardMaterial({ 
        map: cargarTextura('./src/img/Grass.png'),
        roughness: 0.8 
    }),
    paredIndestructible: new THREE.MeshStandardMaterial({ 
        map: cargarTextura('./src/img/Wall.png'),
        roughness: 0.5 
    }),
    bloqueDestructible: new THREE.MeshStandardMaterial({ 
        map: cargarTextura('./src/img/Obstacle.png'),
        roughness: 0.6 
    }),
    // Conservamos materiales de efectos/objetos secundarios
    bomba: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }),
    fuego: new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffb703, emissiveIntensity: 0.8 }),
    salida: new THREE.MeshStandardMaterial({ color: 0x52b788, transparent: true, opacity: 0.8 })
};

// 2. Función auxiliar para cargar modelos de MagicaVoxel (.mtl + .obj)
function cargarModeloVoxel(rutaBase, escala = 0.08) {
    return new Promise((resolve, reject) => {
        const mtlLoader = new MTLLoader();
        mtlLoader.load(`${rutaBase}.mtl`, (materiales) => {
            materiales.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materiales);
            objLoader.load(`${rutaBase}.obj`, (objeto) => {
                // Centrar el pivote del modelo de MagicaVoxel y ajustar escala
                const caja = new THREE.Box3().setFromObject(objeto);
                const centro = caja.getCenter(new THREE.Vector3());
                
                objeto.children.forEach(mesh => {
                    mesh.position.x -= centro.x;
                    mesh.position.z -= centro.z;
                    mesh.position.y -= caja.min.y; // Apoyar base en Y = 0
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                });

                objeto.scale.set(escala, escala, escala);
                resolve(objeto);
            }, undefined, reject);
        }, undefined, reject);
    });
}

export const MODELOS = {
    jugador: null,
   // enemigo: null
};

export async function precargarAssets() {
    try {
        const [modJugador, /*modEnemigo*/] = await Promise.all([
            cargarModeloVoxel('./src/models/jugador', 0.5),
         //   cargarModeloVoxel('./src/models/enemigo', 0.06)
        ]);
        MODELOS.jugador = modJugador;
       // MODELOS.enemigo = modEnemigo;
    } catch (error) {
        console.error("Error cargando modelos de MagicaVoxel (se usarán primitivas de respaldo):", error);
    }
}