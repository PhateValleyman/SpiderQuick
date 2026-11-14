# SpiderQuick — kompatibilita Minecraft Bedrock a Script API

## Cílová verze

SpiderQuick cílí na Minecraft Bedrock **1.21.80+** a stabilní `@minecraft/server` **2.0.0** / `@minecraft/server-ui` **2.0.0**, jak vyžaduje původní QuickCraft. Zvýšení hlavní verze API může měnit signatury i chování; viz Microsoft [Script Module Versioning](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/versioning?view=minecraft-bedrock-stable) a [Scripting V2 Overview](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/v2-overview?view=minecraft-bedrock-stable).

## Provedené převody

Spider-Man `Dimension.runCommandAsync` je převedeno na `runCommand`, knockback používá vektor X/Z a vertikální sílu API 2.0 a `Entity.isValid()` je nahrazeno vlastností. Staré world-initialize události jsou přesunuté na `system.beforeEvents.startup` nebo `world.afterEvents.worldLoad`. Událost `playerLeave` používá `event.player.id`; `entityRemove` používá `removedEntityId` a `typeId` a odstraněnou entitu vyhledá v lokální cache. Tyto změny odpovídají verzovaným referencím Microsoftu pro [Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable) a [Dimension](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable).

QuickCraft builder UI bylo převedeno na options podle přesných TypeScript deklarací `@minecraft/server-ui@2.0.0`: textové pole a toggle používají `defaultValue`, dropdown `defaultValueIndex` a slider `valueStep`/`defaultValue`. Viz třídu [ModalFormData](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/modalformdata?view=minecraft-bedrock-stable); typecheck byl proveden proti konkrétnímu balíčku 2.0.0, nikoli pouze proti aktuálnímu „stable“ aliasu dokumentace. Starý `world.beforeEvents.chatSend` shortcut byl odstraněn; zůstalo otevření předmětem SpiderQuick nebo `/scriptevent qc:menu`. Item lock používá `ItemLockMode.none` a vybraný slot `selectedSlotIndex`.

Spider-Man selfie hook používá pole `player` a `newButtonState`. API 2.0 stabilně nabízí tlačítka Jump/Sneak, nikoli Use/Interact, takže tento guarded hook na ně nereaguje; standardní item-use cesta zůstává aktivní. Portálová dynamic properties se před použitím kontrolují jako `Vector3` nebo string a teleportace používá `Vector2` bez třetí osy. Přímé nastavování velocity ve Spider-Man climb soft-gravity není v tomto stabilním API podporované, proto se tato dílčí větev přeskočí s jednorázovým varováním. Volitelné `super_slingshot_*` globální handlery jsou chráněné: pokud chybí, odpovídající efekt se přeskočí bez pádu skriptu. Kontrola potvrdila, že aktivní `ammo` parametr ve swing cestě přichází z existující scoreboard logiky; nebyla přidána žádná odhadnutá náhrada.

## Propojení packů

[Pack Manifest reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable) popisuje UUID dependencies, ale nepopisuje běhové chování vzájemné aktivace. SpiderQuick používá obousměrné **BP ↔ RP** dependencies podle výslovného požadavku; stejný vzorec byl přítomen v původním Spider-Man Bedrock zdroji. Oba pack UUID a verze 1.0.2 jsou v dependencies zrcadlené a statický validator kontroluje obě strany. Zda cílový Minecraft klient při aktivaci kteréhokoli packu automaticky zapne druhý, nebylo otestováno.

## Ošetření asynchronních příkazů a správce staveb

Volání `runCommandAsyncCompat` jsou v původních Spider-Man modulech používána jako fire-and-forget. Synchronní `try/catch` u těchto volání nezachytí pozdější odmítnutí Promise. Kompatibilní wrapper proto nyní zachytává chybu uvnitř naplánovaného callbacku, vypíše varování a Promise bezpečně dokončí hodnotou `undefined`; úspěšný výsledek příkazu zůstává zachován. Tím se odstraní neobsloužená odmítnutí u existujících volajících, aniž by se musely měnit všechny herní moduly.

Správce staveb již nemaže původní oblast při zahájení přesunu. Nová cílová oblast se před umístěním kontroluje v celém objemu stavby a musí být prázdná (s výjimkou dočasného ovládacího kamene v počátku). Teprve po úspěšném načtení nové instance a nastavení jejího ovládacího kamene se vyčistí původní oblast. Pokud se její vyčištění nepodaří, nová stavba zůstane evidovaná a původní oblast zůstane jako kopie. Přesun lze před umístěním zrušit bez odstranění původní stavby.

Odstranění stavby nyní vyžaduje druhé potvrzení a upozorňuje, že se maže celý kvádr včetně hráčských úprav. Toto potvrzení samo o sobě neznamená možnost obnovy; před destruktivním odstraněním je stále vhodné zálohovat svět.

## Statické ověření a limity

Všechny aktivní skripty prošly neemitujícím typecheckem proti přesným `@minecraft/server@2.0.0` a `@minecraft/server-ui@2.0.0` bez chyb. Projektový validator kontroluje JSONC, unikátní UUID, pack dependencies, custom texture atlas, item ikonky a shodu pack ikon. Kontrola skriptů potvrzuje syntax a relativní importy; Node test ověřuje bezpečnou větev při chybějícím optional handleru. Jde o statické testy, nikoli o běh hry. Minecraft klient nebyl spuštěn, takže import a gameplay musí být ještě vyzkoušeny v Bedrock 1.21.80 nebo novějším.
