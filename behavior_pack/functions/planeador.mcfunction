event entity @p[r=2] spidermanaddon:planeador_on
execute at @s[rx=-35,rxm=-90] run effect @s levitation 1 9 true
execute at @s[rx=5,rxm=-10] run effect @s levitation 1 2 true
execute at @s[rx=-10,rxm=-35] run effect @s levitation 1 5 true
execute at @e[r=3,type=spidermanaddon:planeador] run effect @s slow_falling 1 0 true