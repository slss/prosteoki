# Monte Carlo — proof of concept (2026-11-13)

Dodatek do prosteoki.pl. Frontend statyczny w `/monte-carlo/`, niezależny backend Workers TypeScript. Brak MCP, WebMCP, Apps SDK i autoryzacji dla tego eksperymentu (zgodnie z zamówieniem, wyjątek od wspólnych zasad kalkulatorów OKI). Dotychczasowe kalkulatory pozostają lokalne. Losowe wyniki stanowią również świadomy wyjątek od deterministycznych kalkulatorów OKI; ten moduł nie oblicza podatku OKI.

## Struktura

- `web/`: HTML, CSS, JS wyświetlający dane z API; statyczna dokumentacja i jawny przykład odpowiedzi.
- `worker/src/model.ts`: walidacja, GBM, kryptograficzne losowanie, percentyle, histogram.
- `worker/src/signature.ts`: HMAC i stateless token.
- `worker/src/contract.ts`: manifest i OpenAPI 3.1.
- `worker/src/index.ts`: routing, CORS, limiter, błędy i nagłówki.
- `worker/wrangler.toml`: osobne wdrożenie API.
- `test/`: testy modelu, HTTP, podpisów i benchmark.
- `../scripts/build-monte-carlo.mjs`: integracja z istniejącym buildem Pages; bez zmian w przypiętym vendor.

## Lokalnie

Node 24+ (test wykonano na Node 26). Z katalogu repozytorium `oki/serwisy/prosteoki`:

```sh
npm test
npm run benchmark
cd monte-carlo/worker
npm ci
npm run check
```

Utwórz lokalny, ignorowany plik `monte-carlo/worker/.dev.vars` z `HMAC_SECRET="..."` — losowy sekret minimum 32 znaki; nie używaj klucza przykładowego JSON. Możesz wygenerować wartość przez `openssl rand -hex 32`. Plik zostaje tylko lokalnie; nie dodawaj go do Git.

```sh
# terminal 1, katalog monte-carlo/worker
npm run dev
# terminal 2, katalog główny repozytorium prosteoki
MONTE_CARLO_API_URL=http://localhost:8787 npm run build
npm run check
npm run dev
```

Otwórz http://localhost:8781/monte-carlo/ . W obu URL używaj localhost (nie mieszaj hostów). Wrangler uruchamia rzeczywisty kod Workera lokalnie w workerd. Jego lokalne czasy nie gwarantują CPU Cloudflare. Bez URL API build nadal przechodzi, ale formularz jest zablokowany i wyjaśnia brak konfiguracji. Bez sekretu lub limitera API odmawia obliczeń kodem 503. `/health` potwierdza dostępność procesu, nie kompletność konfiguracji obliczeń.

## Konfiguracja wdrożenia — dopiero po zgodzie właściciela

Użytkownik zatwierdził konfigurację i publikację 2026-11-13. Worker wdrożony: https://prosteoki-monte-carlo.marcin-649.workers.dev . Produkcyjny sekret HMAC ustawiono wyłącznie w Cloudflare. W repozytorium GitHub ustawiono MONTE_CARLO_API_URL. Aktualny status publikacji i TLS opisuje research/2026-11-13-wdrozenie-monte-carlo.md.

1. Cloudflare: sprawdź konto/plan, limit CPU, wolny namespace limitera `1001` (zmień jeśli zajęty), nazwę Workera oraz `ALLOWED_ORIGINS`. Pozostaw wyłącznie właściwe originy produkcyjne; dla project Pages dodaj origin hosta github.io, bez ścieżki.
2. Z katalogu `monte-carlo/worker`: `npx wrangler login`, następnie `npx wrangler secret put HMAC_SECRET` — wklej niezależny losowy sekret. To operacja na koncie; nie wpisuj sekretu do komendy, URL ani kodu.
3. Po zgodzie: `npm run deploy`. HTTPS workers.dev jest punktem startowym, własny host API jest opcjonalny i wymaga odrębnej konfiguracji DNS/TLS. Ten projekt nie przejmuje root `/api` domeny na GitHub Pages.
4. Sprawdź publiczne `/health`, `/api/manifest`, `/openapi.json`, dwa obliczenia i ich tokeny przez `/api/verify`; potwierdź różne ID, zgodność wyników, no-store, CORS, 400 i 429. Nie wklejaj testowych prywatnych kwot.
5. GitHub repo `slss/prosteoki`: ustaw **variable** `MONTE_CARLO_API_URL` na faktyczny origin HTTPS bez ścieżki; istniejący workflow przekazuje ją podczas budowania. Nie jest sekretem. Konfiguracje analityki pozostają właściwe dla tej witryny; nowa strona kalkulatora nie ładuje beacona.
6. Przed zatwierdzoną publikacją sprawdź benchmark na izolowanym Workerze testowym i CPU w panelu Workers/metrykach. Następnie workflow Pages, publiczny HTML (statyczne linki do prawdziwego API), formularz, podpis, sitemap, canonical i HTTPS. Sama konfiguracja nie dowodzi działającego wdrożenia.

Frontend i API mają niezależny deployment. Brak automatycznej publikacji API w GitHub Actions jest celowy: sekret i konto muszą być skonfigurowane osobno.

## Reguły i ograniczenia

Efektywny oczekiwany zwrot roczny r jest przeliczany do miesięcznego log-zwrotu `(ln(1+r)−σ²/2)/12 + σ/√12 × Z`. Dzięki temu oczekiwany roczny mnożnik bez dopłat wynosi `1+r`. Roczna zmienność jest parametrem dyfuzji GBM. Z: niezależny standardowy rozkład normalny, transformacja Boxa–Mullera, uniformy z `crypto.getRandomValues`, bez publicznego seeda. Każdy miesiąc to zwrot, potem wpłata. Percentyle: liniowa interpolacja `(n−1)p`. Realna wartość: dzielenie przez `(1+inflacja)^rok`. Cel i strata względem wpłat nominalnie na koniec okresu. Brak podatków, kosztów, aktualnych danych rynkowych i gwarancji. Źródłem wyniku jest własny model z założeniami użytkownika, nie prognoza instytucji.

Darmowy plan Cloudflare ma limit 10 ms CPU. Zamiast 20000 × 480 zastosowano limit 60000 miesięcznych aktualizacji. Zakres 100–1000 ścieżek, 5–40 lat; 1000 ścieżek przez 5 lat domyślnie. Przy 20 latach maks. 250, przy 40 maks. 125. Niewielkie próby, szczególnie ogony, są niestabilne. Przekroczenie zwraca 400, bez cichej zmiany parametrów. Limit pracy jest deterministyczny, nie próbuje mierzyć CPU zamrożonym zegarem Workera. Nie dodano `limits.cpu_ms` dla darmowego planu — obowiązuje platformowe 10 ms. Przed zwiększeniem budżetu wymagane pomiary. Benchmark lokalny nie potwierdza zmieszczenia się w darmowym limicie.

`computationMs` mierzy tylko silnik, nie podpis, serializację i sieć. Workers może nie przesuwać zegara podczas synchronicznego obliczenia, więc możliwe jest 0 ms. Do pomiaru CPU służą metryki platformy. Limit bindingu: 10 wywołań calculate/verify wspólnie na IP / 60 s, przybliżony, osobny w lokalizacjach Cloudflare; nie jest globalnym limitem konta. Ruch rozproszony nadal może wyczerpać dzienną pulę darmowego konta. CORS nie blokuje zewnętrznych klientów HTTP. GET nie wprowadza zakupu ani operacji finansowej.

HMAC-SHA256 podpisuje zakodowany JSON zawierający ID, czas, wersję, parametry i pełne wyniki. Token nie wygasa, nie jest szyfrowany ani zapisywany; jego weryfikacja zależy od obecnego klucza. Rotacja unieważnia wcześniejsze wyniki. Endpoint verify używa Web Crypto verify. Frontend porównuje cały podpisany payload z odpowiedzią. To poświadczenie pochodzenia od tego API, a nie niezależny audyt. GET i tokeny mogą pozostać w historii/logach; stosuj hipotetyczne kwoty. Brak bazy i zewnętrznych źródeł danych.

## Eksperyment ChatGPT

1. Nowa zwykła rozmowa ChatGPT, sam publiczny URL `/monte-carlo/`, bez dodatkowego promptu.
2. Zapisz klienta/model, datę, rozpoznanie kalkulatora i publicznego API; brak odkrycia też jest wynikiem eksperymentu.
3. Poproś o interaktywny formularz (może nie być dostępny w danym kliencie).
4. Podaj parametry mieszczące się w limicie, np. domyślne; zażądaj rzeczywistego obliczenia.
5. Sprawdź dostępny ślad narzędzi/źródła: czy klient wykonał GET `/api/calculate`? Jeśli narzędzie nie może wykonać GET, zapisz ograniczenie zamiast uznawać liczby za wynik.
6. Porównaj calculationId, parametry, statystyki i resultSignature z odpowiedzią API. Nie porównuj dwóch niezależnych wywołań jako tego samego losowania.
7. Pobierz `/api/verify?token=...` i porównaj cały podpisany payload, łącznie z parametrami i medianą.
8. Zmień parametr i powtórz: wymagane nowe ID oraz nowy autentyczny wynik. Cel testu nie obejmuje automatycznej gwarancji formularza przez sam URL.

**Sukces:** asystent podał wynik rzeczywiście pobrany z API, ID i token przechodzą verify, a wszystkie liczby i parametry zgadzają się z podpisanym payload. Same prawdopodobne liczby, fikcyjny podpis lub link do endpointu bez pobrania nie zaliczają testu. Test rozmowy ChatGPT wymaga publicznego wdrożenia i nie został jeszcze przeprowadzony.

## Źródła techniczne (sprawdzone 2026-11-13)

- https://developers.cloudflare.com/workers/platform/limits/ — limit CPU i dzienna pula.
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ — składnia bindingu i przybliżone lokalne limity.
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ — HMAC i kryptografia runtime.
- https://developers.cloudflare.com/workers/platform/pricing/ — darmowy plan i limity kosztów.

## Wynik weryfikacji lokalnej (2026-11-13)

72 testy przechodzą (w tym istniejące modele OKI). TypeScript `tsc --noEmit`, build i kontrola 115 plików HTML przechodzą. Test w przeglądarce z lokalnym Wranglerem: formularz pobrał wynik, oba wykresy zostały wyrenderowane, endpoint verify potwierdził podpis i ID. HTTP po dodaniu gzip: obliczono 1000 scenariuszy, token 1716 znaków, verify authentic=true. Kontrola 390 px: scrollWidth=390, brak poziomego przewijania; pola mają etykiety. Artefakty QA w ignorowanym `output/playwright/`. Lokalnie limiter zwracał również 429 po serii prób. Nie potwierdzono CPU w chmurze ani wyniku eksperymentu zwykłego ChatGPT. Sekret deweloperski wygenerowano tylko w ignorowanym `.dev.vars`; nie jest konfiguracją produkcji.

Publiczny smoke test 2026-11-13: manifest i OpenAPI 3.1, dwie nowe losowe realizacje i ID, pełna zgodność payload z verify, 40 lat × 125 ścieżek z tokenem 6730 znaków i poprawnym podpisem, CORS https://prosteoki.pl, no-store, błędy 400 dla nieprawidłowych parametrów i zmodyfikowanego tokenu. Weryfikacja TLS była włączona. Początkowy negatywny cache DNS lokalnego resolvera pominięto adresem zwróconym przez Google DNS.
