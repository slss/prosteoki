# Monte Carlo API — weryfikacja techniczna, 2026-11-13

Realizacja zamówionego eksperymentu na istniejącym prosteoki.pl, nie nowy temat SEO. Nie wykonano analizy wolumenu i nie wyciągano wniosków o popycie z SERP. Brak nowego modelu monetyzacji i brak reklam. Wartość eksperymentu: empiryczny test odkrycia publicznego API przez zwykłego ChatGPT. Wynik biznesowy nieznany. Koszt utrzymania: Worker, limity i rotacja sekretu; brak bieżących danych rynkowych i płatnego API.

Źródła pierwotne:
- https://developers.cloudflare.com/workers/platform/limits/ : Free 10 ms CPU na żądanie, 100000 żądań dziennie. Nie traktować lokalnego benchmarku jako dowodu zgodności z limitem.
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ : limit bindingu 10 lub 60 s, przybliżony i osobny dla lokalizacji; nie globalny licznik.
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ : getRandomValues, HMAC, subtle sign/verify.
- https://developers.cloudflare.com/workers/platform/pricing/ : Free i opcje limitów CPU; bez dodawania płatnego planu.

Decyzja: 60000 kroków miesięcznych zamiast 9600000. Domyślnie 1000 ścieżek × 5 lat; 40 lat dopuszcza 125 ścieżek. Jawny kompromis jakości próby, szczególnie ogonów. API nie ukrywa faktycznej liczby scenariuszy.

Benchmark lokalny Node 26, macOS arm64, po 5 rozgrzewkach po 20 próbek na wariant, cały handler z podpisem/JSON:
- 5 lat × 1000: wall p50 2.246 ms, p95 2.618 ms; CPU procesu p50 2.511 ms, p95 4.892 ms.
- 20 lat × 250: wall p50 2.048 ms, p95 2.130 ms; CPU procesu p50 2.211 ms, p95 2.508 ms.
- 40 lat × 125: wall p50 2.150 ms, p95 2.326 ms; CPU procesu p50 2.281 ms, p95 2.760 ms.
Surowy raport w ignorowanym monte-carlo/benchmark-local.json. Zegar Workera podczas synchronicznego kodu może zwrócić 0 ms; computationMs nie jest metryką CPU.

Otwarte: zdalny benchmark workerd/Cloudflare, faktyczne limity i namespace na koncie, publiczny adres API, HMAC secret, realny test ChatGPT. Brak wdrożenia zgodnie z zamówieniem. Bez obietnicy automatycznego odkrywania API, wykonywania GET i renderowania formularza. Brak zależności od MCP lub pluginów.

Token jest kompresowany gzip przed podpisem i kodowaniem base64url, aby zmieścić cały wynik 40 lat w URL GET (limit platformy 16 KB); własny limit tokenu 12 KB. Test obejmuje weryfikację pełnego horyzontu.
