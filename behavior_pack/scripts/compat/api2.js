import { system } from '@minecraft/server';

/**
 * Preserve the old Promise-returning runCommandAsync call shape on Script API 2.0.
 * The replacement runCommand is synchronous and is forbidden in restricted execution,
 * so schedule it through system.run and resolve/reject with its result/error.
 */
export function runCommandAsyncCompat(target, command) {
    // Callers historically fire-and-forget this helper; never leak an unhandled rejection.
    return new Promise((resolve) => {
        const reportError = (error) => {
            console.warn('SpiderQuick command failed: ' + command + ' (' + error + ')');
            resolve(undefined);
        };

        try {
            system.run(() => {
                try {
                    resolve(target.runCommand(command));
                } catch (error) {
                    reportError(error);
                }
            });
        } catch (error) {
            reportError(error);
        }
    });
}

/** Convert the API 1.x knockback signature to API 2.x horizontal force + vertical strength. */
export function applyKnockbackCompat(target, directionX, directionZ, horizontalStrength, verticalStrength) {
    const x = Number(directionX);
    const z = Number(directionZ);
    const length = Math.hypot(x, z);
    const strength = Number(horizontalStrength);
    const horizontalForce = length > 0 && Number.isFinite(length)
        ? { x: (x / length) * strength, z: (z / length) * strength }
        : { x: 0, z: 0 };

    return target.applyKnockback(horizontalForce, verticalStrength);
}
