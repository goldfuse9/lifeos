# Ruční test — fáze 1

Projděte na **iOS i Androidu**. Každý řádek je buď ✅, nebo zapište, co se stalo.

## A. Scénář z instrukcí (bod 17)

| # | Krok | Očekávání |
| --- | --- | --- |
| 1 | Nainstalovat a spustit | Úvod „Zdraví celé rodiny na jednom místě“ |
| 2 | Vytvořit účet (jméno, e-mail, heslo 2×) | Krok „Rychlé odemykání“ |
| 3 | Zapnout Face ID / otisk | Výzva OS, pak Přehled „Ahoj, Jano“ |
| 4 | Projít Přehled → Osa → zpět → Dokumenty → zpět → Nouzová karta → zpět → Já | Všude cesta zpět, nic nespadne |
| 5 | Osa → Záznam: Návštěva, název, místo, poznámka, Uložit | Záznam v ose u správného času |
| 6 | Upravit datum a čas na zítra 8:00 | Záznam z osy zmizí, je v Kalendáři a „Blíží se“; v ose se objeví zítra v 9:00 |
| 7 | Detail → Přidat přílohu → Vyfotit; pak Vybrat soubor (PDF) | Dvě přílohy v detailu i v ose |
| 8 | Klepnout na fotku / PDF | Fotka se zobrazí; PDF se otevře v systému |
| 9 | Kalendář → zítřek → Naplánovat → „Odběr krve“ 7:30 | Tečka v kalendáři a v „Blíží se“; v ose až hodinu po termínu |
| 10 | Upravit termín | Změna všude |
| 11 | Smazat termín | Zmizí z kalendáře, osy i Přehledu |
| 12 | Já → Vzhled → Teplé sklo; Zabezpečení → Zamknout hned | Pozadí se změní všude |
| 13 | Zavřít aplikaci (vyhodit z přepínače) | — |
| 14 | Otevřít | Výzva k Face ID / heslu |
| 15 | Odemknout | Všechna data jsou zpět, pozadí teplé |

## B. Odolnost

| Test | Očekávání |
| --- | --- |
| Režim letadlo, celý scénář A | Vše funguje |
| Restart telefonu, otevřít | Data zůstala |
| Zámek „Po 1 min“, odejít na 30 s | Neuzamkne se |
| Zámek „Po 1 min“, odejít na 2 min | Uzamkne se |
| Zámek „Hned“, nahrát fotku z galerie (Android) | Během výběru se neuzamkne |
| Přepínač aplikací | Místo obsahu jen logo |
| 5× špatné heslo | Odpočet „Zkuste to za 30 s“ |
| Zrušit Face ID výzvu | Zůstane přihlášení heslem |
| Odhlásit se (Já → Odhlásit se) | Přihlašovací obrazovka, data po přihlášení zpět |
| Změnit heslo, odhlásit, přihlásit starým / novým | Staré nejde, nové jde |
| Vypnout biometrii, zavřít, otevřít | Jen heslo, žádná výzva OS |

## C. Rodina a údaje

| Test | Očekávání |
| --- | --- |
| Já → Přidat kartu „Ema“, dítě | Přepne se na Emu, Přehled „Karta Ema“ |
| Záznam u Emy, pak „Zpět na moji kartu“ | Emin záznam není v mé ose |
| Nouzové údaje: alergie, léky, „Koho volat“ s telefonem | Nouzová karta je ukazuje, „Volat kontakt“ vytáčí |
| Lékař s telefonem | Zelené tlačítko vytáčí |
| Odebrat kartu Emy | Zmizí i její záznamy a soubory |
| Zápis: Trup → Bolest na hrudi | Červené varování a „Volat 155“ |
| Já → Sledovat cyklus zapnout | V zápisu je sekce Cyklus (jen na mé kartě) |

## D. Mrtvá tlačítka

Klepnout na **každé** tlačítko na každé obrazovce. Nic nesmí neudělat nic.
Položky „Připravujeme“ musí ukázat hlášku, že přijdou s online verzí.

## E. Smazání všeho

Já → Zabezpečení → Smazat vše → potvrdit 2× → úvodní obrazovka; nový účet
nesmí vidět nic ze starého.

## F. Cyklus

| Test | Očekávání |
| --- | --- |
| Osobní údaje → pohlaví Žena | Na Přehledu dlaždice Cyklus „Nastavit sledování“ |
| Cyklus → zadat začátek, délku, Začít sledovat | Kruh s počtem dní do menstruace, fáze, pás dní s DNES |
| Zapsat → Krvácení (síla + Tento den začala), Nálada, Bolest (síla + příznaky) → Zapsat | V ose záznam „Začátek menstruace“ s Krvácení, Příznaky, Bolest, Posun |
| Druhý den Zapsat | „Menstruace · 2. den“ |
| Záznam v ose → Upravit | Otevře se zápis cyklu, ne obecný formulář |
| Doplňující údaje → režim Těhotenství | Místo kruhu karta „Odhady pozastavené“, dlaždice „Těhotenství“ |
| Upravit cyklus → Nepravidelný | Odhad jako rozmezí |
| Upravit cyklus → Nezobrazovat na Přehledu | Dlaždice zmizí, cyklus zůstane v Já → Cyklus |
| Přestat sledovat | Zápisy v ose zůstanou |

## G. Spodní menu a nastavení

| Test | Očekávání |
| --- | --- |
| Přehled: klepnout na zelené | Vysune se oranžová (nálada) a růžová (hledání) |
| Nechat 5 s / klepnout jinam | Menu se sbalí, zůstane zelené |
| Rozbalené → znovu zelené | Otevře se Já |
| Osa, Cyklus, Dokumenty | Vpravo dole jen černé „+ Zapsat“ / „+ Nahrát“, hledání je v hlavičce |
| Já → Osobní údaje | Stav „Chybí n údajů“, BMI z výšky a váhy |
| Já → Doklady → Líc/Rub vyfotit | Kartička „Nahráno ✓“, fotka i v Dokumentech → Doklady |
| Zapsat (osa, cyklus) | Klávesnice se nevysune sama, až po klepnutí do pole; žádné pole „Den“ |
| Osa → Zapsat → „Jiný den nebo čas“ | Objeví se datum a čas pro plánování |
| Cyklus → Historie cyklů | Řádky jen ukazují, úprava je v „Upravit cyklus“ |

## H. Záloha a obnova

| Test | Očekávání |
| --- | --- |
| Já → Záloha → heslo → Vytvořit zálohu → Uložit do Souborů | Soubor `LifeOS-zaloha-<datum>.lifeos`, v Já „Naposledy …“ |
| Špatné heslo | „Heslo nesedí.“, nic nevznikne |
| Smazat vše (nebo přeinstalovat) → Obnovit ze zálohy → vybrat soubor | „Záloha z …“ |
| Špatné heslo zálohy | „Heslo nesedí, nebo je soubor poškozený.“ |
| Správné heslo | Krok „Rychlé odemykání“, pak všechny karty, záznamy, cyklus i fotky zpět |
| Vybrat jiný soubor (PDF) | „Tohle není záloha LifeOS.“ |
