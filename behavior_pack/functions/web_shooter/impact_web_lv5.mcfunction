execute if block ~ ~ ~-0.02 air unless block ~ ~ ~0.02 air run particle spidermanaddon:web0 ~ ~ ~-0.02
execute if block ~ ~ ~0.02 air unless block ~ ~ ~-0.02 air run particle spidermanaddon:web0 ~ ~ ~0.02
execute if block ~ ~0.15 ~ air unless block ~ ~-0.1 ~ air run particle spidermanaddon:web1
execute if block ~ ~-0.15 ~ air unless block ~ ~0.1 ~ air run particle spidermanaddon:web1 ~ ~-0.02 ~
execute if block ~0.02 ~ ~ air unless block ~-0.02 ~ ~ air run particle spidermanaddon:web2 ~0.02 ~ ~
execute if block ~-0.02 ~ ~ air unless block ~0.02 ~ ~ air run particle spidermanaddon:web2 ~ ~ ~0.1
summon spidermanaddon:impact_web_invoke ~ ~ ~
summon spidermanaddon:impact_web_punch ~ ~1 ~ ~ ~ spidermanaddon:level5
effect @e[r=3] slowness 3 2
playsound web_shooter_sounds.shoot @a[r=10] ~ ~1 ~
particle spidermanaddon:web_explotion ~ ~1 ~
tag @e[r=5, c=1, type=!player, type=!item, type=!xp_orb, type=!spidermanaddon:impact_web, type=!spidermanaddon:impact_web_invoke, type=!spidermanaddon:impact_web_punch] add impact_web_punch