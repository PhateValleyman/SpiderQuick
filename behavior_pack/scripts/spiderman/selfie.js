import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

import { ActionFormData } from "@minecraft/server-ui";

const CAMERA_ITEM = "spidermanaddon:uncle_ben_camera";

const MODE_SELFIE = "selfie";
const MODE_FREE = "free";

const CAMERA_CLEAR_COMMAND = "camera @s clear";
const POSE_OFF_ANIMATION = "animation.player.gizmo_camera_mode.animation.off";
const SELFIE_ANIMATION = "animation.player.spiderman.selfie";

const UI_TITLE = "gui.uncle_ben_camera.title";
const UI_MAIN_BODY = "gui.uncle_ben_camera.body";
const UI_CAMERA_BUTTON = "gui.uncle_ben_camera.camera";
const UI_POSES_BUTTON = "gui.uncle_ben_camera.poses";
const UI_CAMERA_MENU_TITLE = "gui.uncle_ben_camera.camera.title";
const UI_CAMERA_MENU_BODY = "gui.uncle_ben_camera.camera.body";
const UI_FREE_CAMERA_BUTTON = "gui.uncle_ben_camera.camera.free";
const UI_SELFIE_BUTTON = "gui.uncle_ben_camera.camera.selfie";
const UI_POSES_MENU_TITLE = "gui.uncle_ben_camera.poses.title";
const UI_POSES_MENU_BODY = "gui.uncle_ben_camera.poses.body";
const UI_DISABLE_POSES_BUTTON = "gui.uncle_ben_camera.poses.disable";
const UI_POSE_BUTTON_PREFIX = "gui.uncle_ben_camera.poses.pose";

// Ruta base de los 17 iconos del menú de poses.
// Archivos esperados:
// textures/ui/poses/pose1.png ... textures/ui/poses/pose17.png
const UI_POSE_ICON_PREFIX = "textures/ui/poses/pose";

const FREE_CAMERA_DISTANCE = 4.5;
const FREE_CAMERA_EASE = 0.2;

// Cámara selfie. Se calcula con coordenadas absolutas para ignorar la inclinación
// vertical del jugador y evitar que la cámara suba/baje al mirar arriba/abajo.
const SELFIE_EASE = 0.1;

// === POSICIÓN DE CÁMARA SELFIE ===
// Cambia estos 3 valores para ajustar la posición de la cámara:
// SELFIE_FORWARD_DISTANCE: distancia al frente del jugador.
// SELFIE_SIDE_DISTANCE: negativo = izquierda, positivo = derecha.
// SELFIE_HEIGHT: altura de la cámara.
const SELFIE_FORWARD_DISTANCE = 1.25;
const SELFIE_SIDE_DISTANCE = -0.25;
const SELFIE_HEIGHT = 1.5;

// === ROTACIÓN DE CÁMARA SELFIE ===
// La cámara inclina su ángulo: si miras arriba, la cámara apunta abajo;
// si miras abajo, la cámara apunta arriba.
const SELFIE_PITCH_SCALE = 1.0;
const SELFIE_MIN_PITCH = -45;
const SELFIE_MAX_PITCH = 45;

// === MOVIMIENTO VERTICAL DE CÁMARA SELFIE ===
// Cuando el jugador mira arriba, la cámara sube un poco.
// Cuando el jugador mira abajo, la cámara baja un poco.
// Ajusta estos valores para controlar hasta cuánto puede subir/bajar.
const SELFIE_VERTICAL_POSITION_SCALE = 0.05;
const SELFIE_MAX_UP_OFFSET = 1;
const SELFIE_MAX_DOWN_OFFSET = 1;

// === CÁMARA MÁS BAJA AL AGACHARSE ===
// Negativo baja la cámara. Ajusta este valor si quieres que baje más o menos.
const SELFIE_SNEAK_Y_OFFSET = -0.45;

// === ACERCAMIENTO AL MIRAR ARRIBA ===
// Cuando el jugador mira hacia arriba entre 45° y 60°, la cámara se acerca
// suavemente al jugador reduciendo la distancia frontal.
// SELFIE_UP_CLOSE_START_PITCH: grados donde empieza el acercamiento.
// SELFIE_UP_CLOSE_END_PITCH: grados donde llega al acercamiento máximo.
// SELFIE_UP_CLOSE_DISTANCE: cuánto se acerca la cámara al llegar al máximo.
// SELFIE_MIN_FORWARD_DISTANCE: distancia mínima para evitar que la cámara entre demasiado al jugador.
const SELFIE_UP_CLOSE_START_PITCH = 35;
const SELFIE_UP_CLOSE_END_PITCH = 45;
const SELFIE_UP_CLOSE_DISTANCE = 0.35;
const SELFIE_MIN_FORWARD_DISTANCE = 0.65;

const CHECK_INTERVAL = 1;
const SELFIE_LOOP_INTERVAL = 1;
const SELFIE_ANIMATION_LOOP_INTERVAL = 20;
const POSE_LOOP_INTERVAL = 20;
const MENU_COOLDOWN_TICKS = 10;

const equippedMap = new Map();
const modeMap = new Map();
const poseMap = new Map();
const lastSelfieTick = new Map();
const lastSelfieAnimationTick = new Map();
const lastPoseTick = new Map();
const lastMenuTick = new Map();
const menuOpen = new Set();
const sneakingMenuPressed = new Map();
const lastLookMap = new Map();

const POSE_ANIMATIONS = Array.from({ length: 18 }, (_, index) => {
    return `animation.player.gizmo_camera_mode.animation.${index + 1}`;
});

// Funciona cuando el juego dispara el evento de uso.
world.afterEvents.itemUse.subscribe((event) => {
    tryOpenCameraMenu(event.source);
});

world.afterEvents.playerInteractWithBlock?.subscribe((event) => {
    tryOpenCameraMenu(event.player);
});

world.beforeEvents.playerInteractWithBlock?.subscribe((event) => {
    system.run(() => {
        tryOpenCameraMenu(event.player);
    });
});

world.afterEvents.playerInteractWithEntity?.subscribe((event) => {
    tryOpenCameraMenu(event.player);
});

world.beforeEvents.playerInteractWithEntity?.subscribe((event) => {
    system.run(() => {
        tryOpenCameraMenu(event.player);
    });
});

// The stable input event only exposes Jump/Sneak, not Use/Interact.
// Keep a guarded compatibility hook for runtimes that add a use-like button.
world.afterEvents.playerButtonInput?.subscribe((event) => {
	const button = String(event.button).toLowerCase();
	const pressed = String(event.newButtonState).toLowerCase().includes("pressed");
	if (!pressed || !/(use|interact|place)/.test(button)) return;
	tryOpenCameraMenu(event.player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        rememberLastLook(player);
        updateCameraState(player);
        runSelfieLoop(player);
        runSelfieAnimationLoop(player);
        runPoseLoop(player);
    }
}, CHECK_INTERVAL);

function runSneakMenuFallback(player) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) {
        sneakingMenuPressed.delete(player.id);
        return;
    }

    const wasSneaking = sneakingMenuPressed.get(player.id) ?? false;
    const isSneaking = player.isSneaking;

    if (isSneaking && !wasSneaking) {
        sneakingMenuPressed.set(player.id, true);
        tryOpenCameraMenu(player);
        return;
    }

    if (!isSneaking && wasSneaking) {
        sneakingMenuPressed.set(player.id, false);
    }
}

function tryOpenCameraMenu(player) {
    if (!isValid(player)) return;
    if (player.isSneaking) return;
    if (menuOpen.has(player.id)) return;

    const hasOffhandCamera = hasCameraInOffhand(player);
    const hasMainhandCamera = hasCameraInMainhand(player);
    const offhandEmpty = isOffhandEmpty(player);

    // Si la cámara está en segunda mano, el menú puede abrirse sin importar
    // qué objeto tenga el jugador en la mano principal.
    const canOpenWithOffhandCamera = hasOffhandCamera;

    // Si la cámara está en mano principal, la segunda mano todavía debe estar
    // vacía para poder mover la cámara hacia ese slot al elegir un modo.
    const canOpenWithMainhandCamera =
        !hasOffhandCamera &&
        hasMainhandCamera &&
        offhandEmpty;

    if (!canOpenWithOffhandCamera && !canOpenWithMainhandCamera) return;

    const last = lastMenuTick.get(player.id) ?? -999999;
    if (system.currentTick - last < MENU_COOLDOWN_TICKS) return;

    lastMenuTick.set(player.id, system.currentTick);

    system.run(() => {
        openCameraMainMenu(player, canOpenWithMainhandCamera);
    });
}

function updateCameraState(player) {
    if (!isValid(player)) return;

    const hasCamera = hasCameraInOffhand(player);
    const wasEquipped = equippedMap.get(player.id) ?? false;

    if (hasCamera && !wasEquipped) {
        equippedMap.set(player.id, true);
        setCameraMode(player, MODE_SELFIE);
        return;
    }

    if (!hasCamera && wasEquipped) {
        equippedMap.set(player.id, false);
        cleanupCameraPlayer(player);
    }
}

function setCameraMode(player, mode) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) return;

    const previousMode = modeMap.get(player.id);

    modeMap.set(player.id, mode);

    if (mode === MODE_SELFIE) {
        clearPoseAnimation(player, true);
        runSelfieCommand(player);
        playSelfieAnimation(player);
        return;
    }

    if (mode === MODE_FREE) {
        if (previousMode === MODE_SELFIE) {
            lastSelfieAnimationTick.delete(player.id);
            playAnimation(player, POSE_OFF_ANIMATION);
        }

        setFreeCamera(player);
    }
}

function runSelfieLoop(player) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) return;
    if (modeMap.get(player.id) !== MODE_SELFIE) return;
    if (menuOpen.has(player.id)) return;

    const last = lastSelfieTick.get(player.id) ?? -999999;
    if (system.currentTick - last < SELFIE_LOOP_INTERVAL) return;

    lastSelfieTick.set(player.id, system.currentTick);
    runSelfieCommand(player);
}

function runSelfieAnimationLoop(player) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) return;
    if (modeMap.get(player.id) !== MODE_SELFIE) return;

    const last = lastSelfieAnimationTick.get(player.id) ?? -999999;
    if (system.currentTick - last < SELFIE_ANIMATION_LOOP_INTERVAL) return;

    lastSelfieAnimationTick.set(player.id, system.currentTick);
    playSelfieAnimation(player);
}

function playSelfieAnimation(player) {
    playAnimation(player, SELFIE_ANIMATION);
}

function runPoseLoop(player) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) return;
    if (modeMap.get(player.id) !== MODE_FREE) return;

    const animation = poseMap.get(player.id);
    if (!animation) return;

    const last = lastPoseTick.get(player.id) ?? -999999;
    if (system.currentTick - last < POSE_LOOP_INTERVAL) return;

    lastPoseTick.set(player.id, system.currentTick);
    playAnimation(player, animation);
}

function openCameraMainMenu(player, moveMainhandOnModeSelect = false) {
    if (!isValid(player)) return;
    if (player.isSneaking) return;
    if (menuOpen.has(player.id)) return;

    if (moveMainhandOnModeSelect) {
        if (!hasCameraInMainhand(player)) return;
        if (!isOffhandEmpty(player)) return;
    } else {
        // Con la cámara en segunda mano ya no importa qué objeto
        // esté equipado en la mano principal.
        if (!hasCameraInOffhand(player)) return;
    }

    const currentMode = modeMap.get(player.id) ?? MODE_SELFIE;
    const buttons = ["camera"];

    // Si la cámara todavía está en mano principal, solo mostramos Cámara.
    // Las poses aparecen únicamente cuando la cámara ya está en segunda mano
    // y el modo actual es cámara libre.
    if (!moveMainhandOnModeSelect && currentMode === MODE_FREE) {
        buttons.push("poses");
    }

    const form = new ActionFormData()
        .title({ translate: UI_TITLE })
        .body({ translate: UI_MAIN_BODY })
        .button({ translate: UI_CAMERA_BUTTON });

    if (!moveMainhandOnModeSelect && currentMode === MODE_FREE) {
        form.button({ translate: UI_POSES_BUTTON });
    }

    menuOpen.add(player.id);

    form.show(player)
        .then((response) => {
            menuOpen.delete(player.id);

            if (response.canceled) return;

            if (moveMainhandOnModeSelect) {
                if (!hasCameraInMainhand(player)) return;
                if (!isOffhandEmpty(player)) return;
            } else if (!hasCameraInOffhand(player)) {
                return;
            }

            const action = buttons[response.selection];

            if (action === "camera") {
                system.run(() => openCameraModeMenu(player, moveMainhandOnModeSelect));
                return;
            }

            if (action === "poses") {
                system.run(() => openPoseMenu(player));
            }
        })
        .catch(() => {
            menuOpen.delete(player.id);
        });
}

function openCameraModeMenu(player, moveMainhandOnModeSelect = false) {
    if (!isValid(player)) return;
    if (menuOpen.has(player.id)) return;

    if (moveMainhandOnModeSelect) {
        if (!hasCameraInMainhand(player)) return;
        if (!isOffhandEmpty(player)) return;
    } else if (!hasCameraInOffhand(player)) {
        return;
    }

    menuOpen.add(player.id);

    new ActionFormData()
        .title({ translate: UI_CAMERA_MENU_TITLE })
        .body({ translate: UI_CAMERA_MENU_BODY })
        .button({ translate: UI_FREE_CAMERA_BUTTON })
        .button({ translate: UI_SELFIE_BUTTON })
        .show(player)
        .then((response) => {
            menuOpen.delete(player.id);

            if (response.canceled) return;

            const mode = response.selection === 0 ? MODE_FREE : MODE_SELFIE;
            activateCameraModeFromMenu(player, mode, moveMainhandOnModeSelect);
        })
        .catch(() => {
            menuOpen.delete(player.id);
        });
}

function activateCameraModeFromMenu(player, mode, moveMainhandOnModeSelect = false) {
    if (!isValid(player)) return;

    if (moveMainhandOnModeSelect) {
        if (!moveMainhandCameraToOffhand(player)) return;

        // Evita que updateCameraState detecte la cámara nueva en segunda mano
        // y fuerce automáticamente el modo selfie después de elegir cámara libre.
        equippedMap.set(player.id, true);
    }

    if (!hasCameraInOffhand(player)) return;

    setCameraMode(player, mode);
}

function moveMainhandCameraToOffhand(player) {
    if (!isValid(player)) return false;
    if (!hasCameraInMainhand(player)) return false;
    if (!isOffhandEmpty(player)) return false;

    try {
        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) return false;

        const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand);
        if (mainhand?.typeId !== CAMERA_ITEM) return false;

        equippable.setEquipment(EquipmentSlot.Offhand, mainhand);
        equippable.setEquipment(EquipmentSlot.Mainhand, undefined);

        return hasCameraInOffhand(player);
    } catch {
        return false;
    }
}

function openPoseMenu(player) {
    if (!isValid(player)) return;
    if (!hasCameraInOffhand(player)) return;
    if (modeMap.get(player.id) !== MODE_FREE) return;
    if (menuOpen.has(player.id)) return;

    menuOpen.add(player.id);

    const form = new ActionFormData()
        .title({ translate: UI_POSES_MENU_TITLE })
        .body({ translate: UI_POSES_MENU_BODY })
        .button({ translate: UI_DISABLE_POSES_BUTTON });

    for (let i = 0; i < POSE_ANIMATIONS.length; i++) {
        const poseNumber = i + 1;
        const poseIcon =
            `${UI_POSE_ICON_PREFIX}${poseNumber}`;

        form.button(
            {
                rawtext: [
                    {
                        translate:
                            UI_POSE_BUTTON_PREFIX
                    },
                    {
                        text:
                            ` ${poseNumber}`
                    }
                ]
            },
            poseIcon
        );
    }

    form.show(player)
        .then((response) => {
            menuOpen.delete(player.id);

            if (response.canceled) return;
            if (!hasCameraInOffhand(player)) return;
            if (modeMap.get(player.id) !== MODE_FREE) return;

            if (response.selection === 0) {
                clearPoseAnimation(player, true);
                return;
            }

            const animation = POSE_ANIMATIONS[response.selection - 1];
            if (!animation) return;

            poseMap.set(player.id, animation);
            lastPoseTick.set(player.id, system.currentTick);
            playAnimation(player, animation);
        })
        .catch(() => {
            menuOpen.delete(player.id);
        });
}

function setFreeCamera(player) {
    const head = player.getHeadLocation();
    const look = getLastLook(player);

    const pos = {
        x: head.x,
        y: head.y,
        z: head.z
    };

    try {
        runCommandAsyncCompat(player, `camera @s set minecraft:free ease ${FREE_CAMERA_EASE} linear pos ${formatNumber(pos.x)} ${formatNumber(pos.y)} ${formatNumber(pos.z)} rot ${formatNumber(look.pitch)} ${formatNumber(look.yaw)}`);
    } catch {}
}

function runSelfieCommand(player) {
    const loc = player.location;
    const yaw = getYaw(player);
    const yawRad = yaw * Math.PI / 180;

    const forward = {
        x: -Math.sin(yawRad),
        z: Math.cos(yawRad)
    };

    const right = {
        x: Math.cos(yawRad),
        z: Math.sin(yawRad)
    };

    const pitch = getPitch(player);
    const cameraPitch = clamp(
        -pitch * SELFIE_PITCH_SCALE,
        SELFIE_MIN_PITCH,
        SELFIE_MAX_PITCH
    );
    const cameraYaw = normalizeYaw(yaw + 180);
    const verticalOffset = clamp(
        -pitch * SELFIE_VERTICAL_POSITION_SCALE,
        -SELFIE_MAX_DOWN_OFFSET,
        SELFIE_MAX_UP_OFFSET
    );
    const sneakOffset = player.isSneaking ? SELFIE_SNEAK_Y_OFFSET : 0;

    // En Bedrock, mirar hacia arriba normalmente da pitch negativo.
    // Convertimos eso a grados positivos para activar el acercamiento solo
    // cuando el jugador mira arriba entre 45° y 60°.
    const lookUpAngle = clamp(-pitch, 0, 90);
    const closeFactor = clamp(
        (lookUpAngle - SELFIE_UP_CLOSE_START_PITCH) /
            Math.max(1, SELFIE_UP_CLOSE_END_PITCH - SELFIE_UP_CLOSE_START_PITCH),
        0,
        1
    );
    const selfieForwardDistance = Math.max(
        SELFIE_MIN_FORWARD_DISTANCE,
        SELFIE_FORWARD_DISTANCE - closeFactor * SELFIE_UP_CLOSE_DISTANCE
    );

    const pos = {
        x:
            loc.x +
            forward.x * selfieForwardDistance +
            right.x * SELFIE_SIDE_DISTANCE,
        y: loc.y + SELFIE_HEIGHT + verticalOffset + sneakOffset,
        z:
            loc.z +
            forward.z * selfieForwardDistance +
            right.z * SELFIE_SIDE_DISTANCE
    };

    try {
        runCommandAsyncCompat(player, `camera @s set minecraft:free ease ${SELFIE_EASE} linear pos ${formatNumber(pos.x)} ${formatNumber(pos.y)} ${formatNumber(pos.z)} rot ${formatNumber(cameraPitch)} ${formatNumber(cameraYaw)}`);
    } catch {}
}

function clearPoseAnimation(player, playOff = true) {
    const hadPose = poseMap.has(player.id);

    poseMap.delete(player.id);
    lastPoseTick.delete(player.id);

    if (playOff && hadPose) {
        playAnimation(player, POSE_OFF_ANIMATION);
    }
}

function cleanupCameraPlayer(player) {
    modeMap.delete(player.id);
    poseMap.delete(player.id);
    lastSelfieTick.delete(player.id);
    lastSelfieAnimationTick.delete(player.id);
    lastPoseTick.delete(player.id);
    lastMenuTick.delete(player.id);
    menuOpen.delete(player.id);
    sneakingMenuPressed.delete(player.id);
    lastLookMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, CAMERA_CLEAR_COMMAND);
    } catch {}

    playAnimation(player, POSE_OFF_ANIMATION);
}

function playAnimation(player, animation) {
    try {
        runCommandAsyncCompat(player, `playanimation @s ${animation}`);
    } catch {}
}

function hasCameraInOffhand(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);

        return offhand?.typeId === CAMERA_ITEM;
    } catch {
        return false;
    }
}

function hasCameraInMainhand(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment(EquipmentSlot.Mainhand);

        if (mainhand?.typeId === CAMERA_ITEM) return true;

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) return false;

        const slot = getHeldSlot(player);
        const item = inventory.getItem(slot);

        return item?.typeId === CAMERA_ITEM;
    } catch {
        return false;
    }
}

function isOffhandEmpty(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);

        return !offhand;
    } catch {
        return false;
    }
}

function isMainhandEmpty(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment(EquipmentSlot.Mainhand);

        if (mainhand) return false;

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) return true;

        const slot = getHeldSlot(player);
        const item = inventory.getItem(slot);

        return !item;
    } catch {
        return true;
    }
}

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function rememberLastLook(player) {
    if (!isValid(player)) return;

    lastLookMap.set(player.id, {
        pitch: getPitch(player),
        yaw: getYaw(player)
    });
}

function getLastLook(player) {
    return lastLookMap.get(player.id) ?? {
        pitch: getPitch(player),
        yaw: getYaw(player)
    };
}

function getYaw(player) {
    try {
        return player.getRotation().y;
    } catch {
        return 0;
    }
}

function getPitch(player) {
    try {
        return player.getRotation().x;
    } catch {
        return 0;
    }
}

function normalizeYaw(yaw) {
    let value = yaw;

    while (value > 180) value -= 360;
    while (value < -180) value += 360;

    return value;
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
    return Number(value).toFixed(3);
}
