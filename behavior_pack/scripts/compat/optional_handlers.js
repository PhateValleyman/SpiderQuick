const missingWarnings = new Set();

/**
 * Invoke an optional legacy global callback without letting a missing implementation
 * throw from a periodic Bedrock event handler.
 * @param {string} name
 * @param {unknown} target
 * @returns {boolean} true if a callback existed and was invoked
 */
export function runOptionalGlobalHandler(name, target) {
	const globals = /** @type {Record<string, unknown>} */ (globalThis);
	const candidate = globals[name];
	if (typeof candidate === "function") {
		candidate(target);
		return true;
	}

	if (!missingWarnings.has(name)) {
		missingWarnings.add(name);
		console.warn(`[Spider-Man] Optional handler '${name}' is missing; the tagged effect is skipped.`);
	}
	return false;
}
