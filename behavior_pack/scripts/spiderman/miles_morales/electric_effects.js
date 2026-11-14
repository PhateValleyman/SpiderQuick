import { system, world, TicksPerSecond, EntityDamageCause } from "@minecraft/server";

const DAMAGE_INTERVAL = 5; // 20 ticks = 1 second
const DAMAGE_DURATION = 20 * DAMAGE_INTERVAL; // 5 seconds in ticks

const PARTICLES = [
  "spidermanaddon:yellow_electric_hit",
  "spidermanaddon:yellow_electric_hit2",
  "spidermanaddon:yellow_electric_hit3",
  "spidermanaddon:yellow_electric_chispas"
];
const activeEntities = new Map();

system.runInterval(() => {
  const dimension = world.getDimension("overworld");
  const entities = dimension.getEntities({ tags: ["miles_electric_effect"] });

  for (const entity of entities) {
    const id = entity.id;

    if (!activeEntities.has(id)) {
      activeEntities.set(id, 0);
    }

    let tickCount = activeEntities.get(id);

    if (tickCount % DAMAGE_INTERVAL === 0) {
      // Apply damage
      entity.applyDamage(2, { cause: EntityDamageCause.magic });

      // Spawn particles
      const location = entity.location;
      for (const particle of PARTICLES) {
        dimension.spawnParticle(particle, location);
      }
    }

    tickCount++;

    if (tickCount >= DAMAGE_DURATION) {
      entity.removeTag("miles_electric_effect");
      activeEntities.delete(id);
    } else {
      activeEntities.set(id, tickCount);
    }
  }
}, 1);