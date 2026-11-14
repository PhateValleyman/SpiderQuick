event entity @s spiderman:balanceo.off
effect @s slow_falling 0 0 true
playsound web_shooter_sounds.balancing_stop @s
playsound spiderman_effects.reflexes @s
stopsound @s web_shooter_sounds.balancing_loop
tag @s remove spiderman_web
tag @s remove spiderman_web_down