import { system } from "@minecraft/server";

const ROPE_BLOCK = "spidermanaddon:web_bridge";

function getNeighbor(block, direction) {
    try {
        return block[direction](1);
    } catch {
        return undefined;
    }
}
function hasAnchor(startBlock) {

    const visited = new Set();
    const queue = [startBlock];

    while (queue.length > 0) {

        const current = queue.pop();

        if (!current) continue;

        const key =
            `${current.location.x},${current.location.y},${current.location.z}`;

        if (visited.has(key)) continue;

        visited.add(key);

        for (const side of ["north", "south", "east", "west"]) {

            const neighbor = getNeighbor(current, side);

            if (!neighbor || neighbor.isAir || neighbor.isLiquid) {
                continue;
            }

            // Encontró un bloque sólido que NO es cuerda
            if (neighbor.typeId !== ROPE_BLOCK) {
                return true;
            }

            queue.push(neighbor);
        }
    }

    return false;
}
export class fence_Manager {

	static updateFenceStates(block) {

		for (const side of ["north", "south", "east", "west"]) {

			const neighbor = getNeighbor(block, side);

			const connected =
				neighbor &&
				!neighbor.isAir &&
				!neighbor.isLiquid;

			block.setPermutation(
				block.permutation.withState(
					`spidermanaddon:${side}`,
					connected
				)
			);
		}
	}
	static collapseIfUnsupported(block) {

		if (hasAnchor(block)) {
			return;
		}

		const visited = new Set();
		const queue = [block];

		while (queue.length > 0) {

			const current = queue.pop();

			if (!current) continue;

			const key =
				`${current.location.x},${current.location.y},${current.location.z}`;

			if (visited.has(key)) continue;

			visited.add(key);

			for (const side of ["north", "south", "east", "west"]) {

				const neighbor = getNeighbor(current, side);

				if (neighbor?.typeId === ROPE_BLOCK) {
					queue.push(neighbor);
				}
			}
		}

		system.run(() => {

			for (const key of visited) {

				const [x, y, z] = key.split(",").map(Number);

				const web = block.dimension.getBlock({ x, y, z });

				if (web?.typeId === ROPE_BLOCK) {
					web.setType("minecraft:air");
				}
			}
		});
	}
    static updateFencesAround(block) {

        const blocks = [
            block,
            getNeighbor(block, "north"),
            getNeighbor(block, "south"),
            getNeighbor(block, "east"),
            getNeighbor(block, "west")
        ];

        for (const current of blocks) {

		if (current?.typeId === ROPE_BLOCK) {

			this.updateFenceStates(current);
			this.collapseIfUnsupported(current);

		}
        }
    }
}