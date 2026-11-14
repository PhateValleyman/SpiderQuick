execute if block ~ ~ ~-0.02 air unless block ~ ~ ~0.02 air run particle spidermanaddon:laser_hole0 ~ ~ ~-0.02
execute if block ~ ~ ~0.02 air unless block ~ ~ ~-0.02 air run particle spidermanaddon:laser_hole0 ~ ~ ~0.02
execute if block ~ ~0.15 ~ air unless block ~ ~-0.1 ~ air run particle spidermanaddon:laser_hole1
execute if block ~ ~-0.15 ~ air unless block ~ ~0.1 ~ air run particle spidermanaddon:laser_hole1 ~ ~-0.02 ~
execute if block ~0.02 ~ ~ air unless block ~-0.02 ~ ~ air run particle spidermanaddon:laser_hole2 ~0.02 ~ ~
execute if block ~-0.02 ~ ~ air unless block ~0.02 ~ ~ air run particle spidermanaddon:laser_hole2 ~ ~ ~0.1
particle spidermanaddon:green_goblin_laser_impact ~-0.1 ~ ~-0.1
particle spidermanaddon:green_goblin_laser_impact ~0.1 ~ ~0.1
playsound gun.impact @a[r=10] ~ ~ ~