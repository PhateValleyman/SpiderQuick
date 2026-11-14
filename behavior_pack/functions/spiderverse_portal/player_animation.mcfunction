camera @s fade time 0 0.5 0.5 color 255 255 255
tp @s ~ ~300 ~
tag @s add player_tp_portal
event entity @s spiderverse:portal
playanimation @s animation.player.spiderverse_portal.on
summon spidermanaddon:spiderverse_portal_cinematic ~ ~ ~ ~ ~