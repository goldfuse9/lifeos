# LifeOS — prototyp do telefonu

Offline aplikace na iPhone. Žádný server, žádný cloud.

**Obrazovky se sem nepřepisovaly.** Jsou to desky z plátna „Časová osa dne",
spuštěné tak, jak jsou. Když desku na plátně změníte, stáhnete ji sem
znovu a je hotovo — není co rozejít.

## Co to není

Není to HumanCare. Bezpečnostní model — RLS, `sec.decide`, řetězený audit,
krypto-shredding — žije v PostgreSQL a tady z něj není ani řádek. Desky
mají vlastní ukázková data v paměti. Je to prototyp rozhraní: na osahání
a na ukázání lidem ano, na skutečnou dokumentaci dítěte ne.

## Jak to dostat do iPhonu

Potřebujete jedno https místo, odkud se to jednou načte. Bez https Safari
nespustí service worker, takže přes `http://192.168…` z notebooku to
nepůjde. GitHub Pages stačí a není to server — je to složka se soubory.

1. Nový repozitář, nahrát do něj obsah téhle složky.
2. **Settings → Pages → Deploy from a branch**, větev `main`, složka
   `/ (root)`.
3. Na iPhonu otevřít vzniklou adresu **v Safari** (jen Safari umí přidat
   na plochu).
4. **Sdílet → Přidat na plochu.**
5. Zapnout letadlo a spustit ikonu.

První načtení potřebuje síť kvůli písmu Plus Jakarta Sans; pak si ho
service worker uloží. Když se nestáhne, použije se systémové písmo.

## Obrazovky

| Deska | Co v ní je |
| --- | --- |
| `Prehled.dc.html` | rozcestník — rodina, lékaři, blíží se, naposledy, tři kulatá tlačítka |
| `Mix.dc.html` | časová osa dne |
| `Nouze.dc.html` | nouzová karta s kódem a odpočtem |
| `Dokumenty.dc.html` | dokumenty |

Přehled je vstupní obrazovka a vede z něj na zbylé tři; odevšad vede
zpátky. `Main.dc.html` je starší verze osy, na kterou nic nevede, a do
aplikace nepatří.

Sekce „Já", zprávy, nálada a vyhledávání jsou vrstvy **uvnitř Přehledu** —
tak, jak je má plátno.

### Školka (dětská karta 3–7 let)

Na kartě dítěte od 3 do 7 let, které chodí do školky (v ukázce Oliver), je
jako první dlaždice **Školka** s jeho značkou ze šatny. Otevře vrstvu, kde je:

- co školka právě hlásí (teplota, potíže, úraz) a tlačítka **Přijedu pro
  něj**, Zavolat, Napsat školce,
- **Dnes ve školce** — příchod, svačina, zápisy učitelek,
- **Pro školku** — omluvenka, kdo dnes vyzvedne (jen pověřené osoby)
  a **Co školka vidí** (přepínače: alergie, kontakty, pověřené osoby,
  očkování, anamnéza; zprávy a zbytek karty se nesdílí nikdy).

Prosba školky o vyzvednutí visí jako banner na každé kartě a je i ve
zvonečku, dokud rodič neodpoví. Protistrana pro učitelky je samostatný
repozitář [lifeos-skolka](https://github.com/goldfuse9/lifeos-skolka).

## Jak to funguje

```
index.html    skořápka, nic víc
dc.js         mini-runtime pro .dc.html
shell.js      přepínání desek a odchyt odkazů mezi nimi
*.dc.html     obrazovky z plátna, beze změny
sw.js         offline
```

`dc.js` umí přesně to, co desky používají, a nic navíc: `sc-if`, `sc-for`
(vnořené až 3×), `{{holes}}` v textu i atributech, `onClick`/`onChange`/
`onScroll`, `ref`, `helmet` a odkazy mezi deskami. Vykresluje se celé
znovu při každém `setState`; ohnisko v poli a pozice rolování se obnovují,
takže vyhledávání při psaní nevypadne.

Desky jsou nakreslené na 390×844. `index.html` jim přebíjí ty dva rozměry
na velikost displeje — vnitřek je flexibilní, takže se roztáhne sám.

### Aktualizace desky z plátna

Stáhnout nový `.dc.html`, přepsat soubor, **zvednout `VERZE` v `sw.js`**
(jinak si telefon nechá starou verzi z cache) a nahrát.

## Úložiště

Desky si drží stav v paměti — po zavření aplikace se vrátí do výchozího
stavu. Trvalé úložiště zatím nemají; až bude potřeba, přidá se IndexedDB
po jedné desce.

Aplikace si při startu řekne o `navigator.storage.persist()`, aby Safari
nemazalo cache podle „nejdéle nepoužité".
