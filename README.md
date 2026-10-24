# Moje finanse

Prosta aplikacja do budżetu domowego działająca w przeglądarce (także na iPadzie, offline).

**Kategorie:** czynsz, prąd, jedzenie, kot, rośliny, wyjścia, raty, oszczędności, leki, kosmetyki.
**Dochód:** osobno od rodziców i z pracy.

## Co potrafi
- **Miesiąc** – dochód, plan (budżet) na każdą kategorię, ile wydano i ile zostało.
- **Wydatki** – lista zakupów z podziałem na dni, filtr po kategorii, edycja i usuwanie.
- **Wykresy** – wydatki vs plan w kategoriach oraz dochód vs wydatki z ostatnich 6 miesięcy.
- **Cel** – cel oszczędnościowy z terminem; liczą się wydatki z kategorii „Oszczędności”.
- **Ustawienia** – stałe opłaty co miesiąc (dopisują się same), kopia zapasowa (eksport/import), motyw.

Nowy miesiąc kopiuje dochód i plan z poprzedniego.

## Dane
Wszystko zapisuje się **tylko w przeglądarce na tym urządzeniu** (localStorage) – nic nie trafia do repozytorium ani na serwer.
Co jakiś czas zrób kopię: *Ustawienia → Eksportuj kopię*.

## Uruchomienie na iPadzie (GitHub Pages)
1. Na GitHubie: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, wybierz gałąź `main` i folder `/ (root)`, zapisz.
2. Po minucie strona będzie pod adresem `https://<twoja-nazwa>.github.io/finanse-/`.
3. Otwórz ją w Safari na iPadzie → przycisk **Udostępnij → Do ekranu początkowego**. Aplikacja otworzy się jak zwykła apka i zadziała też bez internetu.

Uwaga: dane z Safari i z ikony na ekranie początkowym są osobne – używaj zawsze jednego z nich.

## Pliki
`index.html`, `style.css`, `app.js` – aplikacja (bez bibliotek, bez budowania); `sw.js` – tryb offline; `manifest.webmanifest` i ikony.
