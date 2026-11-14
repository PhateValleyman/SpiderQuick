# SpiderQuick — Minecraft Bedrock / PE (česká verze)

SpiderQuick spojuje Spider-Man obsah pro Bedrock s katalogem staveb QuickCraft. Tato česká verze je samostatným výstupem; předchozí SpiderQuick a původní zdrojové projekty zůstávají beze změny.

**Autor uvedený v manifestech:** PhateValleyman <Jonas.Ned@outlook.com>  
**Verze addonu:** 1.0.2  
**Hra:** Minecraft Bedrock / PE 1.21.80 nebo novější  
**Script API:** stabilní `@minecraft/server` 2.0.0 a `@minecraft/server-ui` 2.0.0

## Instalace a použití

1. Otevřete `SpiderQuick-CZ-1.0.2.mcaddon` v Minecraftu Bedrock/PE a počkejte na import.
2. Ve světě aktivujte **oba** balíčky SpiderQuick: balíček chování i balíček prostředků. Manifesty mají vzájemné závislosti, jejich automatická aktivace ale nebyla ověřena v herním klientovi.
3. Povolte cheaty/příkazy — QuickCraft staví struktury pomocí příkazů Minecraftu.
4. Otevřete **SpiderQuick — stavební menu** nebo spusťte `/scriptevent qc:menu`. Identifikátor `qc:menu` je záměrně zachován. Zkratka `!qc` v chatu není k dispozici, protože stará chatová událost není součástí stabilního Script API 2.0.
5. Obsah Spider-Mana se používá prostřednictvím původních herních předmětů a interních identifikátorů.

## Český překlad

Přeložil jsem obecné hráčům viditelné texty Spider-Mana i QuickCraftu: český locale, popisky schopností a akční lišty, hlášení misí, formuláře, nabídky, 18 kategorií a 257 názvů staveb. Vlastní názvy postav, filmů, zavedených schopností a značek, herní dimenze a technické identifikátory zůstávají zachované. Český locale obsahuje všech 1 519 anglických klíčů; 93 hodnot, které jsou shodné s angličtinou, jsou vlastní názvy nebo zavedené herní výrazy. Klíče, placeholdery a barevné kódy jsou zachovány a české duplicity odstraněny. Jediný osamocený řádek bez klíče je také v původním anglickém locale; jeho text je přeložen a jeho klíč nebyl domýšlen.

## Ověření a omezení

Manifesty cílí na Bedrock 1.21.80+ a Script API 2.0.0. Závěrečné statické kontroly prošly: 2 671 JSON/JSONC souborů, 5 jedinečných UUID, 531 struktur, 1 519 českých locale klíčů s kontrolou placeholderů a barev, 210 JavaScript souborů, 340 relativních importů a 342 JSON payloadů v příkazech `tellraw`/`titleraw`. Aktivní síť skriptů prošla typecheckem pro API 2.0.0 a test bezpečného chování při chybějícím volitelném handleru; archivy byly zkontrolovány na poškození.

**Minecraft klient ani herní svět nebyl při přípravě této verze spuštěn.** Import, automatickou aktivaci packů a chování ve hře je proto nutné ověřit ručně v podporované verzi Minecraft Bedrock.

Známá omezení zůstávají zachována: přímé nastavování rychlosti, které stabilní Script API 2.0 nenabízí, bylo v části Spider-Man lezení nahrazeno vypnutou soft-gravity funkcí; chybějící volitelné `super_slingshot_*` handlery se bezpečně přeskočí. Podrobnosti jsou v [API_COMPATIBILITY.md](API_COMPATIBILITY.md).

## Sestavení ze zdrojů

Požadavky: `make`, Python 3 a Node.js. Z kořene repozitáře spusťte `make`; cílový balíček vznikne jako `dist/SpiderQuick-CZ-1.0.2.mcaddon`. `make check` spustí statickou validaci packů a kontrolu syntaxe skriptů, `make source-archive` vytvoří samostatný zdrojový archiv. ZIP metadata jsou normalizovaná, takže stejné zdroje a nástroje vytvoří reprodukovatelné výstupy.

Recept `packaging/SpiderQuick/Makefile` používá rozdělení cílů `check`, `prepare`, `build`, `install` a `package` inspirované recepty zdrojového stromu FFP 0.7. Samotný addon zůstává běžným Minecraft Bedrock `.mcaddon`; FFP není pro sestavení potřeba. Přesné vstupní archivy, provenance, patch a recept jsou v `packaging/SpiderQuick/` a jsou zahrnuté také do zdrojového archivu.

## Ikona, původ a šíření

Behavior pack a resource pack používají jeden a tentýž soubor `pack_icon.png`. Viditelná značka je **SpiderQuick**; interní UUID a `qc:` identifikátory zůstávají zachované.

**Oznámení o šíření:** Obsah je volně šiřitelný. Nejde o prohlášení o konkrétní standardní licenci.
