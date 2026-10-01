# HumanCare — mobilní aplikace (fáze 1)

Funkční prototyp pro iOS a Android. Expo SDK 57 / React Native 0.86, TypeScript.
Data jsou jen v telefonu, zašifrovaná, aplikace funguje bez internetu.

Vzhled vychází z desek plátna v kořeni repozitáře (`../*.dc.html`) —
barvy, písmo, rozměry, ikony i texty jsou převzaté odtamtud.

## Co funguje

| Oblast | Stav |
| --- | --- |
| Registrace, přihlášení e-mailem a heslem | ✅ lokální účet, heslo se nikde neukládá |
| Face ID / Touch ID / otisk na Androidu | ✅ klíč za biometrickou bránou Keychainu/Keystore |
| Automatický zámek po odchodu z aplikace | ✅ hned / 1 / 5 / 15 min, obsah skrytý v přepínači aplikací |
| Přehled | ✅ Blíží se (týden), Naposledy, dlaždice, nouzová karta — ze skutečných dat |
| Časová osa | ✅ dny, čára „Teď“, hledání, filtr typů a příloh, postupné načítání |
| Záznamy | ✅ vytvořit / otevřít / upravit / smazat, typ, datum, čas, celý den, místo, poznámka |
| Zápis nálady a příznaků | ✅ obličeje, oblasti těla, intenzita bolesti, varování 155 |
| Přílohy | ✅ vyfotit, z fotek, soubor; víc příloh u záznamu; otevřít, sdílet, smazat |
| Dokumenty | ✅ všechny přílohy karty, filtr, hledání, nahrání |
| Kalendář | ✅ měsíc, tečky, den, naplánovat / zapsat — stejná data jako osa |
| Karty rodiny | ✅ přidat, upravit, odebrat, přepínat |
| Osobní a nouzové údaje, lékaři | ✅ ukládají se, nouzová karta je zobrazuje, lékaři jdou volat |
| Vzhled | ✅ 4 pozadí a barva tlačítka „já“ z plátna |
| Export dat | ✅ JSON přes systémové sdílení |
| Notifikace, zprávy, sdílení, „Kdo se mi díval“, kód pro záchranáře, registr lékařů | ⏳ označeno „Připravujeme“ — potřebují server (fáze 2) |

## Spuštění

Aplikace používá nativní moduly, které **Expo Go neobsahuje** (SQLCipher,
biometrická brána SecureStore). Potřebuje vlastní build.

### Android — instalovatelný APK bez Android Studia (doporučeno pro testery)

```bash
npm install
npx eas-cli@latest login          # bezplatný účet Expo
npx eas-cli@latest build --profile preview --platform android
```

Po dokončení EAS vypíše odkaz/QR kód na `.apk`. Na telefonu ho otevřete a
povolte instalaci z neznámých zdrojů.

### Android — lokálně (Android Studio + emulátor nebo telefon přes USB)

```bash
npm install
npx expo run:android
```

### iOS

- **Simulátor (Mac + Xcode):** `npx expo run:ios`
- **Vlastní iPhone (Mac + Xcode):** `npx expo run:ios --device`
- **Testeři bez Macu:** potřeba Apple Developer účet (99 USD/rok), pak
  `npx eas-cli@latest build --profile preview --platform ios` (iPhony je
  nutné předem zaregistrovat přes `eas device:create`) nebo TestFlight přes
  `--profile production` + `eas submit`.

## Kontroly

```bash
npm run typecheck   # TypeScript
npx eslint src      # lint (pravidla React Compileru)
npm test            # doména, datová vrstva, přihlášení — 22 testů v Node
```

Ruční test na telefonu: [docs/QA.md](docs/QA.md).

## Architektura

```
src/app/            obrazovky (Expo Router) — jen UI
src/ui/             komponenty, téma a ikony převzaté z desek
src/state/          relace (odemknutí, zámek, aktuální karta), načítání dat
src/services/       přihlášení a šifrování, přílohy, export, HcData (vstup k datům)
src/data/           SQL: rozhraní ovladače, migrace, repozitáře
src/domain/         typy, typy záznamů, datumy v češtině, osa — čisté funkce
src/platform/       expo-sqlite (SQLCipher), SecureStore, souborový sandbox
```

**Jeden model pro osu i kalendář.** `records` je jediná tabulka událostí;
kalendář i osa jsou dva pohledy na tytéž řádky. Typ `event` (Termín) je
nový — kalendář potřeboval obecnou plánovanou událost.

**Bezpečnost.** Při registraci vznikne náhodný 256bitový klíč databáze.
Ten se zašifruje klíčem odvozeným z hesla (scrypt N=2¹⁴, AES-256-GCM) a
uloží do Keychainu/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Databáze je
SQLCipher. Biometrie ukládá stejný klíč za biometrickou bránu OS. Po 5
chybných heslech se přihlášení zpomaluje (30 s, pak dvojnásobně, max 15 min).
Android záloha je vypnutá (`allowBackup: false`).

**Připraveno na fázi 2.**
- Všechno jde přes `SqlDriver` → repozitáře → `HcData`. Cloudová
  synchronizace se přidá jako další vrstva vedle, obrazovky se nemění.
- Každý řádek má UUID, `createdAt`, `updatedAt` a měkké mazání `deletedAt`
  — to synchronizace potřebuje.
- `metadata` záznamu je JSON — klinický model, FHIR odkazy a další typy se
  přidají bez změny schématu.
- Schéma má číslované migrace (`PRAGMA user_version`).

## Známá omezení prototypu

- Smazáním aplikace nebo ztrátou telefonu data zmizí — není záloha ani
  synchronizace. Export (JSON) je jediná cesta ven.
- Zapomenuté heslo bez zapnuté biometrie = data nejdou otevřít (důsledek
  lokálního šifrování, aplikace to říká při registraci).
- Přílohy jsou v soukromé složce aplikace a chrání je šifrování telefonu;
  aplikace je zvlášť nešifruje. Na iOS se složka zálohuje do iCloudu.
- Odvození klíče ze hesla běží v JS — na starších telefonech může
  přihlášení heslem trvat 1–3 s.
- Hledání používá `LIKE`; pro tisíce záznamů na kartu bude potřeba FTS5.
