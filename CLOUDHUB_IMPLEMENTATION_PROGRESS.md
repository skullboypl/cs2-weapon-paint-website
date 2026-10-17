# CloudHub — postęp implementacji

## Aktualny etap

Etap 1: audyt i fundamenty, gałąź `cloudhub-foundations`, na bazie połączonego PR #1 (`6b7e432`). Oryginalna wersja CloudHub CS2 (`f02bbf1`) jest zachowana. Pełne wymagania: [docs/CLOUDHUB_REQUIREMENTS.pl.md](docs/CLOUDHUB_REQUIREMENTS.pl.md).

## Wykonano

- Audyt React/Vite, PHP, przepływu Steam OpenID i PDO/WeaponPaints. Bez dostępu do produkcji.
- Addytywna migracja 001 z wersjonowaniem/checksumą, blokadą współbieżności i bez wywołania migratora `wp_*`.
- Konta po SteamID64, profil i ustawienia prywatności, role i uprawnienia, portfel oraz statystyki inicjalizowane atomowo.
- Integracja konta po poprawnym callbacku Steam, za flagą domyślnie false; zachowanie starego logowania w przypadku awarii Core.
- Prywatne API konta, z saldem i RP tylko aktualnej sesji, odczytem ról z bazy i wyliczaniem rangi.
- Jawne nadanie pierwszego OWNER przez CLI po zweryfikowanym logowaniu Steam, z powodem, blokadą i audytem. Nie nadano rzeczywistemu użytkownikowi żadnej roli; SteamID właściciela nie jest znany.
- Fundament tabel statystyk, sezonów, rang, portfeli, ledgeru i idempotencji zdarzeń. Bez naliczania nagród, pobierania CC i blokowania skinów.
- Testy regresji, bezpieczeństwa API, migracji, zachowania wyposażenia i kont. Skrypt produkcyjnego pakowania uwzględnia katalog migracji poza publicznym rootem.

## Schemat i konfiguracja

Szczegóły tabel, decyzji, instalacji testowej, uprawnień DB i rollbacku: [docs/FOUNDATIONS.pl.md](docs/FOUNDATIONS.pl.md).

Nowe: `cloudhub_players`, `cloudhub_profiles`, `cloudhub_roles`, `cloudhub_player_roles`, `cloudhub_role_permissions`, `cloudhub_rank_config`, `cloudhub_seasons`, `cloudhub_player_stats`, `cloudhub_player_season_stats`, `cloudhub_wallets`, `cloudhub_wallet_transactions`, `cloudhub_processed_events`, `cloudhub_admin_audit_logs`, `cloudhub_schema_migrations`.

`CLOUDHUB_CORE_ENABLED=false` domyślnie. Najpierw osobno autoryzowana migracja, potem włączenie Core i ponowne logowanie Steam, następnie kontrolowany bootstrap OWNER. Sekrety i konfiguracja DB pozostają poza repozytorium. Sklep i egzekwowanie własności nie są włączalne w tym etapie. Personalizacja ma pozostać darmowa również po wdrożeniu sklepu.

## Weryfikacja — 16 października 2026

- 9/9 testów Playwright (API i przeglądarka), w izolowanej lokalnej MariaDB.
- 31 sprawdzeń fundamentów w PHP: migracje i checksumy, zachowanie `wp_*` oraz starego skina, inicjalizacja kont, trwałość danych, uprawnienia, bootstrap OWNER, nieujemne saldo i arytmetyka ledgeru.
- Lint frontendu bez błędów. Build poprawny; istniejące ostrzeżenie o opcjonalnym module 3D >500 kB pozostaje.
- Kontrola składni PHP poprawna. Bez realnego logowania Steam, gry CS2 i produkcyjnego PHP 8.5.
- Testy nie dowodzą jeszcze współbieżnych zakupów, wydajności leaderboardu ani odporności pluginu na zmiany map — te usługi nie są zaimplementowane.

## Ryzyka i możliwość połączenia

Etap nadaje się do przeglądu i połączenia jako wyłączony domyślnie fundament. Sam merge nie uruchamia migracji ani nowych funkcji na VPS. Włączenie Core bez migracji daje niedostępne API konta, ale nie powinno blokować starego logowania. Nie wdrażać jako ukończonego portalu ekonomicznego. Nie nadpisywać starego archiwum CloudHub 1.0.0 bez nadania nowej wersji przy przyszłym pakowaniu.

## Pozostałe etapy

2. CloudHub Core C#: źródła/kontrakt Match System, audyt kolizji, zaufane zdarzenia i uczestnictwo rund, antyfarm, kolejka, retry, RP/CC, testy; bez instalacji na produkcji.
3. Backend: transakcyjny ledger i zakupy, kontrole idempotencji/replay, profile, leaderboard, sezony, odznaki TOP/historyczne, role/admin, znajomi, blokowanie i komentarze.
4. Frontend: rozszerzenie aktualnej nawigacji o ranking, profile, portfel, społeczność, sklep i administrację; brak drugiej niezależnej strony.
5. Ekonomia: katalog i propozycje cen, symulacja, zatwierdzenie przez OWNER, własność bazowych skinów, bezpłatne presety/personalizacja, dry-run migracji wyposażenia. Kontrola własności także we wszystkich ścieżkach pluginu WeaponPaints, nie tylko w WWW. Żadnego automatycznego odbierania wyposażenia.
6. CS2UIKit: audyt API `v2.0.0-preview.1`, lokalny prototyp, integracja GUI i fallback, weryfikacja Workshop 3807024759 / MultiAddonManager / `mm_client_extra_addons`. Bez aktualizacji CSS/Metamod/gamedata.
7. Pełne testy systemowe, bezpieczeństwa, współbieżności, wydajności, awarii DB, zmian map i restartów w środowisku testowym. Wdrożenie, migracja produkcji i restart CS2 wymagają osobnej zgody właściciela.

## Plan zapisany po Etapie 1 (wykonany w odtworzonym Etapie 2)

Rozpocząć etap 2 od odczytu API CounterStrikeSharp i CS2UIKit oraz kontraktu z CloudHub Match System. Brakujące informacje produkcyjne opisano w instrukcji audytu; nie zgadywać wyników meczów, wersji schematu WeaponPaints 3.3a, SteamID właściciela ani istniejących komend. Nadal można lokalnie projektować i testować logikę kolejki, antyfarm i rozliczeń niezależnie od gry.

## Przyszły moduł — CloudHub Desktop (dodano 17 października 2026)

Po ukończeniu strony i backendu zaplanowano aplikację Windows, najlepiej współdzielącą obecny frontend. Tauri jest kandydatem do oceny, nie zatwierdzoną nową zależnością.

- Te same konta Steam, profile, znajomi, ranking, Cloud Coins, sklep i konfigurator WeaponPaints; wspólny backend i postęp, bez drugiej ekonomii.
- Docelowo uruchamianie/dołączanie do serwera CS2, aktualizacje aplikacji i powiadomienia.
- Na teraz wyłącznie publiczna podstrona `/download` z komunikatem „Aplikacja CloudHub — wkrótce” oraz przycisk „Pobierz CloudHub” na ekranie logowania i w panelu gracza.
- Brak instalatora, nieczynnego linku pobierania, projektu Tauri, desktopowego logowania i aktualizatora. Nie rozpoczynano implementacji aplikacji i nie zmieniano zakresu Etapu 2.

### Stan środowiska przy tym dodatku

Po odtworzeniu środowiska dostępny jest zapisany na GitHubie etap 1 (`ee256ce`, PR #2). Lokalne niewypchnięte pliki Etapu 2 z poprzedniej instancji nie zostały odtworzone i gałąź `cloudhub-core` nie istnieje na zdalnym repozytorium. Nie oznaczamy tego kodu jako zapisanego na GitHubie ani nie zastępujemy go inną implementacją. Ten stan został następnie zamknięty decyzją użytkownika o ponownej implementacji; odtworzony Etap 2 opisano poniżej. Dodatek Desktop jest odrębną gałęzią opartą na potwierdzonym `master` i nie zawiera zmian backendu, migracji ani pluginu.


## Etap 2 — ponowna implementacja zakończona do stagingu (17 października 2026)

Na podstawie master `14b1391` odtworzono CloudHub Core na `cloudhub-core-stage2`. To nowa implementacja na zlecenie użytkownika, nie odzyskane źródła. Fundamenty Etapu 1 i CloudHub Desktop zachowane.

- Plugin CSS 1.0.376 / .NET 10: obserwacja statystyk i wyników rund, asynchroniczny outbox na dysku, podpisy HMAC, ponawianie i kwarantanna.
- Backend: addytywna migracja 002, konfigurowalne RP/CC, sześć istniejących rang, antyfarm par i godzinowe limity, atomowe rozliczenia, deduplikacja zdarzenia i rundy, sezony, prywatna historia portfela.
- Automatyczna konfiguracja Codexa bez SQL i bez uruchamiania bazy/gry; pełna treść w `docs/codex-setup.sh`, zatwierdzenie/publikacja przez ustawienia środowiska. Testy używają osobnego lokalnego helpera i jednorazowej bazy.
- Moduły zapisywane i wypychane kolejno: `00ade2d` (setup), `369f41f` (backend), `85b92f5` (plugin), `0333624` (historia i staging), następnie raport końcowy.
- Wyniki: 39 asercji C#, 31 fundamentów PHP, 50 rozliczeń PHP, 13 testów API/UI; build/lint i lokalna składnia Nginx/FPM poprawne. Szczegóły: `docs/CORE_STAGE2_TEST_REPORT.md`.
- Plugin i ingestion wyłączone domyślnie. Brak zmian produkcji. Następny krok to przegląd PR i osobno uzgodniony staging zgodnie z `docs/CORE_STAGE2.pl.md`. Match System pozostaje niewpiętym adapterem, bez naliczania wyników/nagród całych meczów.
