import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

let expression = {};
system.runInterval(() => {
    let players = world.getAllPlayers();
    players.forEach((player) => {
    if (player.hasTag("suitsForm")){
        suitsForm(player);
    }
});
});
function suitsForm(player) {
	player.runCommand('tag @s remove suitsForm');
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:spiderman_classic_suit', 'textures/ui/spiderman_classic_suit')
	gui.button('item.spiderverse:human_spider_suit', 'textures/items/suits/human_spider_suit')
	gui.button('item.spiderverse:spiderman_raimi_suit', 'textures/items/suits/spiderman_raimi_suit')
	gui.button('item.spiderverse:the_amazing_spiderman_1_suit', 'textures/items/suits/the_amazing_spiderman_1_suit')
	gui.button('item.spiderverse:miles_morales_suit', 'textures/items/suits/spiderman_miles_morales_suit')
	gui.button('item.spiderverse:anti_ock_suit', 'textures/ui/anti_ock_suit')
	gui.button('item.spiderverse:iron_spider_suit', 'textures/ui/iron_spider_suit')
	gui.button('item.spiderverse:miles_morales_wolverine_suit', 'textures/ui/miles_morales_wolverine_suit')
	gui.button('item.spiderverse:aracnido_jr_suit', 'textures/items/suits/aracnido_jr_suit')
	gui.button('item.spiderverse:ezekiel_sims_suit', 'textures/items/suits/ezekiel_sims_suit')
	gui.button('item.spiderverse:ghost_spider_suit', 'textures/items/suits/ghost_spider_suit')
	gui.button('item.spiderverse:iron_spider_ucm_suit', 'textures/items/suits/iron_spider_ucm_suit')
	gui.button('item.spiderverse:miles_morales_into_the_spiderverse_suit', 'textures/items/suits/miles_morales_into_the_spiderverse_suit')
	gui.button('item.spiderverse:miles_morales_across_the_spiderverse_suit', 'textures/items/suits/miles_morales_across_the_spiderverse_suit')
	gui.button('item.spiderverse:miles_morales_10th_suit', 'textures/ui/miles_morales_10th_suit')
	gui.button('item.spiderverse:miles_morales_bodega_cat_suit', 'textures/ui/miles_morales_bodega_cat_suit')
	gui.button('item.spiderverse:miles_morales_gold_suit', 'textures/items/suits/spiderman_miles_morales_gold_suit')
	gui.button('item.spiderverse:scarlet_spider_suit', 'textures/ui/scarlet_spider_suit')
	gui.button('item.spiderverse:scarlet_spider_across_the_spiderverse_suit', 'textures/items/suits/scarlet_spider_across_the_spiderverse_suit')
	gui.button('item.spiderverse:spectacular_spiderman_suit', 'textures/items/suits/spectacular_spiderman_suit')
	gui.button('item.spiderverse:spectacular_spiderman_black_suit', 'textures/items/suits/spectacular_spiderman_black_suit')
	gui.button('item.spiderverse:spectacular_spiderman_black_suit_2', 'textures/items/suits/spectacular_spiderman_black_suit_2')
	gui.button('item.spiderverse:spectacular_spiderman_black_suit_3', 'textures/items/suits/spectacular_spiderman_black_suit_3')
	gui.button('item.spiderverse:spider_punk_suit', 'textures/items/suits/spider_punk_suit')
	gui.button('item.spiderverse:spiderman_67_suit', 'textures/items/suits/spiderman_67_suit')
	gui.button('item.spiderverse:spiderman_90_suit', 'textures/items/suits/spiderman_90_suit')
	gui.button('item.spiderverse:spiderman_90_black_suit', 'textures/items/suits/spiderman_90_black_suit')
	gui.button('item.spiderverse:spiderman_90_black_suit_1', 'textures/items/suits/spiderman_90_black_suit_1')
	gui.button('item.spiderverse:spiderman_2099_suit', 'textures/ui/spiderman_2099_suit')
	gui.button('item.spiderverse:spiderman_2099_across_the_spiderverse_suit', 'textures/items/suits/spiderman_2099_across_the_spiderverse_suit')
	gui.button('item.spiderverse:spiderman_2099_across_the_spiderverse_suit_1', 'textures/items/suits/spiderman_2099_across_the_spiderverse_suit_1')
	gui.button('item.spiderverse:spiderman_antivenom_suit', 'textures/items/suits/spiderman_antivenom_suit')
	gui.button('item.spiderverse:spiderman_cero_suit', 'textures/items/suits/spiderman_cero_suit')
	gui.button('item.spiderverse:spiderman_classic_black_suit', 'textures/items/suits/spiderman_classic_black_suit')
	gui.button('item.spiderverse:spiderman_homemade_suit', 'textures/items/suits/spiderman_homemade_suit')
	gui.button('item.spiderverse:spiderman_homecoming_suit', 'textures/items/suits/spiderman_homecoming_suit')
	gui.button('item.spiderverse:spiderman_far_from_home_suit', 'textures/items/suits/spiderman_far_from_home_suit')
	gui.button('item.spiderverse:spiderman_future_foundation_suit', 'textures/items/suits/spiderman_future_foundation_suit')
	gui.button('item.spiderverse:spiderman_india_suit', 'textures/items/suits/spiderman_india_suit')
	gui.button('item.spiderverse:spiderman_last_stand_suit', 'textures/items/suits/spiderman_last_stand_suit')
	gui.button('item.spiderverse:spiderman_negative_suit', 'textures/items/suits/spiderman_negative_suit')
	gui.button('item.spiderverse:spiderman_no_way_home_suit', 'textures/items/suits/spiderman_no_way_home_suit')
	gui.button('item.spiderverse:spiderman_noir_into_the_spiderverse_suit', 'textures/items/suits/spiderman_noir_into_the_spiderverse_suit')
	gui.button('item.spiderverse:spiderman_ps4_suit', 'textures/items/suits/spiderman_ps4_suit')
	gui.button('item.spiderverse:spiderman_ps5_suit', 'textures/ui/spiderman_ps5_suit')
	gui.button('item.spiderverse:spiderman_ps4_black_suit', 'textures/items/suits/spiderman_ps4_black_suit')
	gui.button('item.spiderverse:spiderman_ps5_symbiote_suit', 'textures/items/suits/spiderman_ps5_symbiote_suit')
	gui.button('item.spiderverse:spiderman_raimi_black_suit', 'textures/items/suits/spiderman_raimi_black_suit')
	gui.button('item.spiderverse:spiderman_secret_wars_civil_war_suit', 'textures/items/suits/spiderman_secret_wars_civil_war_suit')
	gui.button('item.spiderverse:spiderman_stealth_suit', 'textures/items/suits/spiderman_stealth_suit')
	gui.button('item.spiderverse:spiderman_steve_ditko_suit', 'textures/items/suits/spiderman_steve_ditko_suit')
	gui.button('item.spiderverse:spiderman_unlimited_suit', 'textures/items/suits/spiderman_unlimited_suit')
	gui.button('item.spiderverse:spiderman_velocity_suit', 'textures/items/suits/spiderman_velocity_suit')
	gui.button('item.spiderverse:spiderman_web_of_shadows_suit', 'textures/items/suits/spiderman_web_of_shadows_suit')
	gui.button('item.spiderverse:spiderman_web_of_shadows_black_suit', 'textures/items/suits/spiderman_web_of_shadows_black_suit')
	gui.button('item.spiderverse:spiderman_what_if_suit', 'textures/items/suits/spiderman_what_if_suit')
	gui.button('item.spiderverse:spiderman_what_if_animated_suit', 'textures/items/suits/spiderman_what_if_animated_suit')
	gui.button('item.spiderverse:spiderman_wrestler_suit', 'textures/items/suits/spiderman_wrestler_suit')
	gui.button('item.spiderverse:spirit_spider_suit', 'textures/items/suits/spirit_spider_suit')
	gui.button('item.spiderverse:superior_spiderman_suit', 'textures/ui/superior_spiderman_suit')
	gui.button('item.spiderverse:superior_spiderman_black_suit', 'textures/items/suits/superior_spiderman_black_suit')
	gui.button('item.spiderverse:the_amazing_spiderman_2_suit', 'textures/items/suits/the_amazing_spiderman_2_suit')
	gui.button('item.spiderverse:the_amazing_spiderman_belt_suit', 'textures/items/suits/the_amazing_spiderman_belt_suit')
	gui.button('item.spiderverse:the_amazing_spiderman_black_suit', 'textures/items/suits/the_amazing_spiderman_black_suit')
	gui.button('item.spiderverse:ultimate_spiderman_suit', 'textures/items/suits/ultimate_spiderman_suit')
	gui.button('item.spiderverse:ultimate_spiderman_black_suit', 'textures/items/suits/ultimate_spiderman_black_suit')
	gui.button('item.spiderverse:ultimate_spiderman_ucm_suit', 'textures/items/suits/ultimate_spiderman_ucm_suit')
	gui.button('item.spiderverse:yfn_spiderman_casero_suit', 'textures/items/suits/yfn_spiderman_casero_suit')
	gui.button('item.spiderverse:venom_spiderman3', 'textures/items/suits/venom_spiderman3')
	gui.button('item.spiderverse:into_the_spiderverse_sb_suit', 'textures/items/suits/into_the_spiderverse_sb_suit')
	gui.button('item.spiderverse:spiderman_miles_morales_leap_of_faith_suit', 'textures/items/suits/spiderman_miles_morales_leap_of_faith_suit')
	gui.button('item.spiderverse:spiderman_bombastic_bag_man_suit', 'textures/items/suits/spiderman_bombastic_bag_man_suit')
	gui.button('item.spiderverse:yfn_spiderman_suit', 'textures/items/suits/yfn_spiderman_suit')
	gui.button('item.spiderverse:yfn_spiderman_oscorp_suit', 'textures/items/suits/yfn_spiderman_oscorp_suit')
	gui.button('item.spiderverse:spiderman_new_blue_suit', 'textures/items/suits/spiderman_new_blue_suit')
	gui.button('item.spiderverse:the_amazing_spiderman_casero_suit', 'textures/items/suits/the_amazing_spiderman_casero_suit')
	gui.button('item.spiderverse:silk_suit', 'textures/items/suits/silk_suit')
    gui.show(player).then(result => {
        if (result.selection === 0) { spiderman_classic_suit(player) }
		if (result.selection === 1) { human_spider_suit(player) }
		if (result.selection === 2) { spiderman_raimi_suit(player) }
		if (result.selection === 3) { the_amazing_spiderman_1_suit(player) }
		if (result.selection === 4) { spiderman_miles_morales_suit(player) }
		if (result.selection === 5) { anti_ock_suit(player) }
		if (result.selection === 6) { iron_spider_suit(player) }
		if (result.selection === 7) { miles_morales_wolverine_suit(player) }
		if (result.selection === 8) { aracnido_jr_suit(player) }
		if (result.selection === 9) { ezekiel_sims_suit(player) }
		if (result.selection === 10) { ghost_spider_suit(player) }
		if (result.selection === 11) { iron_spider_ucm_suit(player) }
		if (result.selection === 12) { miles_morales_into_the_spiderverse_suit(player) }
		if (result.selection === 13) { miles_morales_across_the_spiderverse_suit(player) }
		if (result.selection === 14) { miles_morales_10th_suit(player) }
		if (result.selection === 15) { miles_morales_bodega_cat_suit(player) }
		if (result.selection === 16) { miles_morales_gold_suit(player) }
		if (result.selection === 17) { scarlet_spider_suit(player) }
		if (result.selection === 18) { scarlet_spider_across_the_spiderverse_suit(player) }
		if (result.selection === 19) { spectacular_spiderman_suit(player) }
		if (result.selection === 20) { spectacular_spiderman_black_suit(player) }
		if (result.selection === 21) { spectacular_spiderman_black_suit_2(player) }
		if (result.selection === 22) { spectacular_spiderman_black_suit_3(player) }
		if (result.selection === 23) { spider_punk_suit(player) }
		if (result.selection === 24) { spiderman_67_suit(player) }
		if (result.selection === 25) { spiderman_90_suit(player) }
		if (result.selection === 26) { spiderman_90_black_suit(player) }
		if (result.selection === 27) { spiderman_90_black_suit_1(player) }
		if (result.selection === 28) { spiderman_2099_suit(player) }
		if (result.selection === 29) { spiderman_2099_across_the_spiderverse_suit(player) }
		if (result.selection === 30) { spiderman_2099_across_the_spiderverse_suit_1(player) }
		if (result.selection === 31) { spiderman_antivenom_suit(player) }
		if (result.selection === 32) { spiderman_cero_suit(player) }
		if (result.selection === 33) { spiderman_classic_black_suit(player) }
		if (result.selection === 34) { spiderman_homemade_suit(player) }
		if (result.selection === 35) { spiderman_homecoming_suit(player) }
		if (result.selection === 36) { spiderman_far_from_home_suit(player) }
		if (result.selection === 37) { spiderman_future_foundation_suit(player) }
		if (result.selection === 38) { spiderman_india_suit(player) }
		if (result.selection === 39) { spiderman_last_stand_suit(player) }
		if (result.selection === 40) { spiderman_negative_suit(player) }
		if (result.selection === 41) { spiderman_no_way_home_suit(player) }
		if (result.selection === 42) { spiderman_noir_into_the_spiderverse_suit(player) }
		if (result.selection === 43) { spiderman_ps4_suit(player) }
		if (result.selection === 44) { spiderman_ps5_suit(player) }
		if (result.selection === 45) { spiderman_ps4_black_suit(player) }
		if (result.selection === 46) { spiderman_ps5_symbiote_suit(player) }
		if (result.selection === 47) { spiderman_raimi_black_suit(player) }
		if (result.selection === 48) { spiderman_secret_wars_civil_war_suit(player) }
		if (result.selection === 49) { spiderman_stealth_suit(player) }
		if (result.selection === 50) { spiderman_steve_ditko_suit(player) }
		if (result.selection === 51) { spiderman_unlimited_suit(player) }
		if (result.selection === 52) { spiderman_velocity_suit(player) }
		if (result.selection === 53) { spiderman_web_of_shadows_suit(player) }
		if (result.selection === 54) { spiderman_web_of_shadows_black_suit(player) }
		if (result.selection === 55) { spiderman_what_if_suit(player) }
		if (result.selection === 56) { spiderman_what_if_animated_suit(player) }
		if (result.selection === 57) { spiderman_wrestler_suit(player) }
		if (result.selection === 58) { spirit_spider_suit(player) }
		if (result.selection === 59) { superior_spiderman_suit(player) }
		if (result.selection === 60) { superior_spiderman_black_suit(player) }
		if (result.selection === 61) { the_amazing_spiderman_2_suit(player) }
		if (result.selection === 62) { the_amazing_spiderman_belt_suit(player) }
		if (result.selection === 63) { the_amazing_spiderman_black_suit(player) }
		if (result.selection === 64) { ultimate_spiderman_suit(player) }
		if (result.selection === 65) { ultimate_spiderman_black_suit(player) }
		if (result.selection === 66) { ultimate_spiderman_ucm_suit(player) }
		if (result.selection === 67) { yfn_spiderman_casero_suit(player) }
		if (result.selection === 68) { venom_spiderman3(player) }
		if (result.selection === 69) { into_the_spiderverse_sb_suit(player) }
		if (result.selection === 70) { spiderman_miles_morales_leap_of_faith_suit(player) }
		if (result.selection === 71) { spiderman_bombastic_bag_man_suit(player) }
		if (result.selection === 72) { yfn_spiderman_suit(player) }
		if (result.selection === 73) { yfn_spiderman_oscorp_suit(player) }
		if (result.selection === 74) { spiderman_new_blue_suit(player) }
		if (result.selection === 75) { the_amazing_spiderman_casero_suit(player) }
		if (result.selection === 76) { silk_suit(player) }
    })
}
function silk_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:silk_suit');
}
function the_amazing_spiderman_casero_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:the_amazing_spiderman_casero_suit');
}
function spiderman_new_blue_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_new_blue_suit');
}
function yfn_spiderman_oscorp_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:yfn_spiderman_oscorp_suit');
}
function yfn_spiderman_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:yfn_spiderman_suit');
}
function spiderman_bombastic_bag_man_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_bombastic_bag_man_suit');
}
function spiderman_miles_morales_leap_of_faith_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_miles_morales_leap_of_faith_suit');
}
function into_the_spiderverse_sb_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:into_the_spiderverse_sb_suit');
}
function venom_spiderman3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:venom_spiderman3');
}
function yfn_spiderman_casero_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:yfn_spiderman_casero_suit');
}
function ultimate_spiderman_ucm_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:ultimate_spiderman_ucm_suit');
}
function ultimate_spiderman_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:ultimate_spiderman_black_suit');
}
function ultimate_spiderman_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:ultimate_spiderman_suit');
}
function the_amazing_spiderman_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:the_amazing_spiderman_black_suit');
}
function the_amazing_spiderman_belt_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:the_amazing_spiderman_belt_suit');
}
function the_amazing_spiderman_2_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:the_amazing_spiderman_2_suit');
}
function superior_spiderman_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:superior_spiderman_black_suit');
}
function superior_spiderman_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:superior_spiderman_suit', 'textures/items/suits/superior_spiderman_suit')
	gui.button('item.spiderverse:superior_spiderman_suit_1', 'textures/items/suits/superior_spiderman_suit_1')
	gui.button('item.spiderverse:superior_spiderman_suit_2', 'textures/items/suits/superior_spiderman_suit_2')
	gui.button('item.spiderverse:superior_spiderman_suit_3', 'textures/items/suits/superior_spiderman_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            superior_spiderman_suit0(player)
        }
        if (result.selection === 1) {
            superior_spiderman_suit1(player)
        }
        if (result.selection === 2) {
            superior_spiderman_suit2(player)
        }
        if (result.selection === 3) {
            superior_spiderman_suit3(player)
        }
    })
}
function superior_spiderman_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:superior_spiderman_suit');
}
function superior_spiderman_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:superior_spiderman_suit_1');
}
function superior_spiderman_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:superior_spiderman_suit_2');
}
function superior_spiderman_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:superior_spiderman_suit_3');
}
function spirit_spider_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spirit_spider_suit');
}
function spiderman_wrestler_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_wrestler_suit');
}
function spiderman_what_if_animated_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_what_if_animated_suit');
}
function spiderman_what_if_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_what_if_suit');
}
function spiderman_web_of_shadows_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_web_of_shadows_black_suit');
}
function spiderman_web_of_shadows_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_web_of_shadows_suit');
}
function spiderman_velocity_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_velocity_suit');
}
function spiderman_unlimited_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_unlimited_suit');
}
function spiderman_steve_ditko_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_steve_ditko_suit');
}
function spiderman_stealth_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_stealth_suit');
}
function spiderman_secret_wars_civil_war_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_secret_wars_civil_war_suit');
}
function spiderman_raimi_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_raimi_black_suit');
}
function spiderman_ps5_symbiote_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps5_symbiote_suit');
}
function spiderman_ps4_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps4_black_suit');
}
function spiderman_ps5_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:spiderman_ps5_suit', 'textures/items/suits/spiderman_ps5_suit')
	gui.button('item.spiderverse:spiderman_ps5_suit_1', 'textures/items/suits/spiderman_ps5_suit_1')
	gui.button('item.spiderverse:spiderman_ps5_suit_2', 'textures/items/suits/spiderman_ps5_suit_2')
	gui.button('item.spiderverse:spiderman_ps5_suit_3', 'textures/items/suits/spiderman_ps5_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            spiderman_ps5_suit0(player)
        }
        if (result.selection === 1) {
            spiderman_ps5_suit1(player)
        }
        if (result.selection === 2) {
            spiderman_ps5_suit2(player)
        }
        if (result.selection === 3) {
            spiderman_ps5_suit3(player)
        }
    })
}
function spiderman_ps5_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps5_suit');
}
function spiderman_ps5_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps5_suit_1');
}
function spiderman_ps5_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps5_suit_2');
}
function spiderman_ps5_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps5_suit_3');
}
function spiderman_ps4_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_ps4_suit');
}
function spiderman_noir_into_the_spiderverse_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_noir_into_the_spiderverse_suit');
}
function spiderman_no_way_home_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_no_way_home_suit');
}
function spiderman_negative_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_negative_suit');
}
function spiderman_last_stand_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_last_stand_suit');
}
function spiderman_india_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_india_suit');
}
function spiderman_future_foundation_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_future_foundation_suit');
}
function spiderman_far_from_home_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_far_from_home_suit');
}
function spiderman_homecoming_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_homecoming_suit');
}
function spiderman_homemade_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_homemade_suit');
}
function spiderman_classic_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_classic_black_suit');
}
function spiderman_cero_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_cero_suit');
}
function spiderman_antivenom_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_antivenom_suit');
}
function spiderman_2099_across_the_spiderverse_suit_1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_across_the_spiderverse_suit_1');
}
function spiderman_2099_across_the_spiderverse_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_across_the_spiderverse_suit');
}
function spiderman_2099_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:spiderman_2099_suit', 'textures/items/suits/spiderman_2099_suit')
	gui.button('item.spiderverse:spiderman_2099_suit_1', 'textures/items/suits/spiderman_2099_suit_1')
	gui.button('item.spiderverse:spiderman_2099_suit_2', 'textures/items/suits/spiderman_2099_suit_2')
	gui.button('item.spiderverse:spiderman_2099_suit_3', 'textures/items/suits/spiderman_2099_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            spiderman_2099_suit0(player)
        }
        if (result.selection === 1) {
            spiderman_2099_suit1(player)
        }
        if (result.selection === 2) {
            spiderman_2099_suit2(player)
        }
        if (result.selection === 3) {
            spiderman_2099_suit3(player)
        }
    })
}
function spiderman_2099_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_suit');
}
function spiderman_2099_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_suit_1');
}
function spiderman_2099_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_suit_2');
}
function spiderman_2099_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_2099_suit_3');
}
function spiderman_90_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_90_suit');
}
function spiderman_90_black_suit_1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_90_black_suit_1');
}
function spiderman_90_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_90_black_suit');
}
function spiderman_67_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_67_suit');
}
function spectacular_spiderman_black_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spectacular_spiderman_black_suit');
}
function spectacular_spiderman_black_suit_2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spectacular_spiderman_black_suit_2');
}
function spectacular_spiderman_black_suit_3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spectacular_spiderman_black_suit_3');
}
function spider_punk_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spider_punk_suit');
}
function scarlet_spider_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:scarlet_spider_suit_3');
}
function scarlet_spider_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:scarlet_spider_suit_2');
}
function scarlet_spider_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:scarlet_spider_suit_1');
}
function scarlet_spider_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:scarlet_spider_suit');
}
function scarlet_spider_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:scarlet_spider_suit', 'textures/items/suits/scarlet_spider_suit')
	gui.button('item.spiderverse:scarlet_spider_suit_1', 'textures/items/suits/scarlet_spider_suit_1')
	gui.button('item.spiderverse:scarlet_spider_suit_2', 'textures/items/suits/scarlet_spider_suit_2')
	gui.button('item.spiderverse:scarlet_spider_suit_3', 'textures/items/suits/scarlet_spider_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            scarlet_spider_suit0(player)
        }
        if (result.selection === 1) {
            scarlet_spider_suit1(player)
        }
        if (result.selection === 2) {
            scarlet_spider_suit2(player)
        }
        if (result.selection === 3) {
            scarlet_spider_suit3(player)
        }
    })
}
function scarlet_spider_across_the_spiderverse_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:scarlet_spider_across_the_spiderverse_suit');
}
function spectacular_spiderman_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spectacular_spiderman_suit');
}
function miles_morales_gold_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_gold_suit');
}
function miles_morales_bodega_cat_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_bodega_cat_suit');
}
function miles_morales_bodega_cat_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_bodega_cat_suit_1');
}
function miles_morales_bodega_cat_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_bodega_cat_suit_2');
}
function miles_morales_bodega_cat_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_bodega_cat_suit_3');
}
function miles_morales_bodega_cat_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:miles_morales_bodega_cat_suit', 'textures/items/suits/miles_morales_bodega_cat_suit')
	gui.button('item.spiderverse:miles_morales_bodega_cat_suit_1', 'textures/items/suits/miles_morales_bodega_cat_suit_1')
	gui.button('item.spiderverse:miles_morales_bodega_cat_suit_2', 'textures/items/suits/miles_morales_bodega_cat_suit_2')
	gui.button('item.spiderverse:miles_morales_bodega_cat_suit_3', 'textures/items/suits/miles_morales_bodega_cat_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            miles_morales_bodega_cat_suit0(player)
        }
        if (result.selection === 1) {
            miles_morales_bodega_cat_suit1(player)
        }
        if (result.selection === 2) {
            miles_morales_bodega_cat_suit2(player)
        }
        if (result.selection === 3) {
            miles_morales_bodega_cat_suit3(player)
        }
    })
}
function miles_morales_10th_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_10th_suit');
}
function miles_morales_10th_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_10th_suit_1');
}
function miles_morales_10th_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_10th_suit_2');
}
function miles_morales_10th_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_10th_suit_3');
}
function miles_morales_10th_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:miles_morales_10th_suit', 'textures/items/suits/miles_morales_10th_suit')
	gui.button('item.spiderverse:miles_morales_10th_suit_1', 'textures/items/suits/miles_morales_10th_suit_1')
	gui.button('item.spiderverse:miles_morales_10th_suit_2', 'textures/items/suits/miles_morales_10th_suit_2')
	gui.button('item.spiderverse:miles_morales_10th_suit_3', 'textures/items/suits/miles_morales_10th_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            miles_morales_10th_suit0(player)
        }
        if (result.selection === 1) {
            miles_morales_10th_suit1(player)
        }
        if (result.selection === 2) {
            miles_morales_10th_suit2(player)
        }
        if (result.selection === 3) {
            miles_morales_10th_suit3(player)
        }
    })
}
function miles_morales_into_the_spiderverse_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_into_the_spiderverse_suit');
}
function miles_morales_across_the_spiderverse_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_across_the_spiderverse_suit');
}
function iron_spider_ucm_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:iron_spider_ucm_suit');
}
function ghost_spider_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:ghost_spider_suit');
}
function ezekiel_sims_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:ezekiel_sims_suit');
}
function aracnido_jr_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:aracnido_jr_suit');
}
function miles_morales_wolverine_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:miles_morales_wolverine_suit', 'textures/items/suits/miles_morales_wolverine_suit')
	gui.button('item.spiderverse:miles_morales_wolverine_suit_1', 'textures/items/suits/miles_morales_wolverine_suit_1')
	gui.button('item.spiderverse:miles_morales_wolverine_suit_2', 'textures/items/suits/miles_morales_wolverine_suit_2')
	gui.button('item.spiderverse:miles_morales_wolverine_suit_3', 'textures/items/suits/miles_morales_wolverine_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            miles_morales_wolverine_suit0(player)
        }
        if (result.selection === 1) {
            miles_morales_wolverine_suit1(player)
        }
        if (result.selection === 2) {
            miles_morales_wolverine_suit2(player)
        }
        if (result.selection === 3) {
            miles_morales_wolverine_suit3(player)
        }
    })
}
function iron_spider_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:iron_spider_suit', 'textures/items/suits/iron_spider_suit')
	gui.button('item.spiderverse:iron_spider_suit_1', 'textures/items/suits/iron_spider_suit_1')
	gui.button('item.spiderverse:iron_spider_suit_2', 'textures/items/suits/iron_spider_suit_2')
	gui.button('item.spiderverse:iron_spider_suit_3', 'textures/items/suits/iron_spider_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            iron_spider_suit0(player)
        }
        if (result.selection === 1) {
            iron_spider_suit1(player)
        }
        if (result.selection === 2) {
            iron_spider_suit2(player)
        }
        if (result.selection === 3) {
            iron_spider_suit3(player)
        }
    })
}
function anti_ock_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:anti_ock_suit', 'textures/items/suits/anti_ock_suit')
	gui.button('item.spiderverse:anti_ock_suit_1', 'textures/items/suits/anti_ock_suit_1')
	gui.button('item.spiderverse:anti_ock_suit_2', 'textures/items/suits/anti_ock_suit_2')
	gui.button('item.spiderverse:anti_ock_suit_3', 'textures/items/suits/anti_ock_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            anti_ock_suit0(player)
        }
        if (result.selection === 1) {
            anti_ock_suit1(player)
        }
        if (result.selection === 2) {
            anti_ock_suit2(player)
        }
        if (result.selection === 3) {
            anti_ock_suit3(player)
        }
    })
}
function spiderman_miles_morales_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_miles_morales_suit');
}
function human_spider_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:human_spider_suit');
}
function spiderman_raimi_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_raimi_suit');
}
function the_amazing_spiderman_1_suit(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:the_amazing_spiderman_1_suit');
}
function spiderman_classic_suit(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.suitsForm')
    gui.button('item.spiderverse:spiderman_classic_suit', 'textures/items/suits/spiderman_classic_suit')
	gui.button('item.spiderverse:spiderman_classic_suit_1', 'textures/items/suits/spiderman_classic_suit_1')
	gui.button('item.spiderverse:spiderman_classic_suit_2', 'textures/items/suits/spiderman_classic_suit_2')
	gui.button('item.spiderverse:spiderman_classic_suit_3', 'textures/items/suits/spiderman_classic_suit_3')
    gui.show(player).then(result => {
        if (result.selection === 0) {
            spiderman_classic_suit0(player)
        }
        if (result.selection === 1) {
            spiderman_classic_suit1(player)
        }
        if (result.selection === 2) {
            spiderman_classic_suit2(player)
        }
        if (result.selection === 3) {
            spiderman_classic_suit3(player)
        }
    })
}
function spiderman_classic_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_classic_suit');
}
function spiderman_classic_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_classic_suit_1');
}
function spiderman_classic_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_classic_suit_2');
}
function spiderman_classic_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:spiderman_classic_suit_3');
}

function anti_ock_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:anti_ock_suit');
}
function anti_ock_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:anti_ock_suit_1');
}
function anti_ock_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:anti_ock_suit_2');
}
function anti_ock_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:anti_ock_suit_3');
}

function iron_spider_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:iron_spider_suit');
}
function iron_spider_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:iron_spider_suit_1');
}
function iron_spider_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:iron_spider_suit_2');
}
function iron_spider_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:iron_spider_suit_3');
}

function miles_morales_wolverine_suit0(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_wolverine_suit');
}
function miles_morales_wolverine_suit1(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_wolverine_suit_1');
}
function miles_morales_wolverine_suit2(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_wolverine_suit_2');
}
function miles_morales_wolverine_suit3(player) {
   player.runCommand('/execute as @e[type=spidermanaddon:suits_machine, c=1, r=5] run event entity @s suits:miles_morales_wolverine_suit_3');
}