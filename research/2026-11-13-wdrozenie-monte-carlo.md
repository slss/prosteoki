# Wdrożenie Monte Carlo — 2026-11-13

Użytkownik zlecił dokończenie konfiguracji i publikacji przez zalogowane Cloudflare, następnie zatwierdził ograniczoną autoryzację Wrangler w przeglądarce. Konto 6493b73870cd666293bc34b5ff95664a. Brak zmiany planu lub zakupu.

API: https://prosteoki-monte-carlo.marcin-649.workers.dev . Wersja wdrożenia 3aca8e02-402b-4cd5-a025-53958c114426. Sekret HMAC wygenerowany niezależnie i przesłany bezpośrednio do secret storage Workera; nie trafił do kodu, URL ani frontendu. CORS dopuszcza produkcyjny origin https://prosteoki.pl. Lokalne originy pozostają tylko w ignorowanym .dev.vars. Limiter 10 żądań / minutę, namespace 1001.

GitHub slss/prosteoki: variable MONTE_CARLO_API_URL ustawiona na powyższy origin. Workflow zachowuje osobne tokeny analityki i Search Console. Przed publikacją: 72 testy, TypeScript i build, kontrola 115 HTML przechodzą.

Smoke test publiczny 17:23 UTC na hipotetycznych danych:
- health 200, manifest 1.0.0, OpenAPI 3.1.0;
- nowe ID: 330b6d92-dec2-4e29-b557-162a3f7f1662 i cd14a9c9-e699-45ad-a84b-6f7c4112eef8; różne mediany;
- 1000 wykonanych ścieżek, pełny payload potwierdzony przez verify;
- 40 lat × 125 ścieżek: token 6730 znaków, weryfikacja poprawna;
- Cache-Control no-store, CORS https://prosteoki.pl;
- 400 dla years=41 i zmodyfikowanego tokenu.
Surowe podsumowanie bez sekretów w ignorowanym output/production-smoke.json.

Nowy hostname miał negatywny cache w lokalnym resolverze. Google DNS zwracał 188.114.97.12 i 188.114.96.12; test wykonano na pierwszym adresie z poprawną weryfikacją certyfikatu i hostname, bez wyłączania TLS.

Zastany problem TLS prosteoki.pl: Pages https_enforced=false, https_certificate.state=authorization_created, rzeczywisty certyfikat nie zawiera domeny. Publiczny DNS ma cztery właściwe A GitHub oraz www CNAME slss.github.io, bez AAAA. Wznowiono provisioning przez usunięcie i natychmiastowe ponowne przypisanie tej samej domeny w Pages. Bez zmiany DNS. Źródło procedury: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https . Stan końcowy zostanie dopisany po workflow i kontroli publicznej strony.
