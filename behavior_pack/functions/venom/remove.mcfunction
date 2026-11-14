scoreboard players set @s venom_avatar 0
execute if entity @s[has_property={arathnido:skins=0}] run particle spidermanaddon:venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=1}] run particle spidermanaddon:venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=2}] run particle spidermanaddon:blue_venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=3}] run particle spidermanaddon:venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=4}] run particle spidermanaddon:ultimate_venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=5}] run particle spidermanaddon:ultimate_venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=6}] run particle spidermanaddon:venom_2099_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=7}] run particle spidermanaddon:venom_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=8}] run particle spidermanaddon:venom_snow_particle ~ ~2.25 ~
execute if entity @s[has_property={arathnido:skins=0}] run particle spidermanaddon:venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=1}] run particle spidermanaddon:venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=2}] run particle spidermanaddon:blue_venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=3}] run particle spidermanaddon:venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=4}] run particle spidermanaddon:ultimate_venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=5}] run particle spidermanaddon:ultimate_venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=6}] run particle spidermanaddon:venom_2099_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=7}] run particle spidermanaddon:venom_particle ~ ~1.25 ~
execute if entity @s[has_property={arathnido:skins=8}] run particle spidermanaddon:venom_snow_particle ~ ~1.25 ~
playsound spiderman_effects.venom_off @a[r=20]
clear @s spidermanaddon:capsule 0 1
give @s spidermanaddon:symbiote_capsule 1