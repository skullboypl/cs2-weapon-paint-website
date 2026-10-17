# CloudHub Core — Etap 2 (0.2.0, staging)

Odtworzona implementacja na `cloudhub-core-stage2`, oparta na master po PR #2 i #3. Nie jest odzyskanym kodem poprzedniej instancji. Nie zmienia konfiguratora ani strony Desktop. Plugin i endpoint domyślnie wyłączone. Nie wykonywano żadnych operacji na VPS ani serwerze CS2.

## Co działa

- C# / .NET 10, przypięty CounterStrikeSharp.API 1.0.376, MinimumApiVersion(376). Obserwacja `round_freeze_end`, `player_death`, `weapon_fire`, `player_spawn`, rozłączeń i `round_end`; próbkowanie pozycji/kąta widzenia co sekundę. Wyłącznie odczyt gry, bez komend, menu, zmian ekwipunku, cvarów i plików innych pluginów.
- Zabójstwa, zgony, asysty, headshoty, aktywność i wyniki **rund**. Identyfikacja przez AuthorizedSteamID, bez traktowania bota jako gracza. Wpis z gry daje wyłącznie PLAYER, nie potwierdza logowania Steam.
- Konfiguracja nagród w `cloudhub_reward_rules`, RP w statystykach, CC w oddzielnym portfelu. Rangi z fundamentów: Bronze 0, Silver 500, Gold 1200, Platinum 2500, Diamond 4500, Master 7500; administrator może później zmienić progi w prywatnej bazie.
- Pełna atomowa transakcja: statystyki, historia walk, saldo, księga, identyfikator zdarzenia i potwierdzenie rundy. Wykorzystuje InnoDB, prepared statements, blokadę rozliczeń na bazę, `FOR UPDATE` portfela, unikatowe klucze oraz CHECK salda. Nie zmienia tabel `wp_*`.
- Prywatne `GET /api/cloudhub.php?action=history` zwraca do 50 wpisów własnego portfela; `before` to kursor ID. SteamID pochodzi wyłącznie z sesji. Brak publicznego endpointu do przyznawania waluty. Rankingi i konto nadal odczytują RP/rangi z fundamentów.
- Statystyki bieżącego sezonu tylko dla jednej jawnie aktywowanej pozycji obejmującej czas końca rundy. Nakładające się sezony blokują transakcję. Brak automatycznego sezonu lub resetu portfela.

## Domyślne reguły i antyfarm

Minimum 4 uczestników, którzy pozostali do końca rundy; minimum 30 sekund rundy. Do premii za rundę wymagane 10 sekund aktywności albo udział jako zabójca/asystujący. Bierne zgony nie aktywują premii. Rozłączony gracz nie odzyskuje statusu ukończenia po ponownym wejściu.

| Zdarzenie | RP | CC |
|---|---:|---:|
| Zabójstwo przeciwnika | 10 | 2 |
| Dodatkowo headshot | 3 | 1 |
| Asysta | 4 | 1 |
| Zgon od przeciwnika | -2 | 0 |
| Teamkill | -20 | 0 |
| Aktywne ukończenie rundy | 1 | 1 |
| Dodatkowo wygrana runda | 5 | 2 |

RP nigdy nie spada poniżej zera; samobójstwo/zgon od świata nie daje zabójstwa ani premii bojowej. Ponad 3 zabójstwa tej samej ofiary przez tego samego sprawcę w oknie 600 sekund nie dają premii bojowych (także headshot/asysta), lecz statystyki pozostają prawdziwe. Dodatkowe limity na gracza: 500 dodatnich netto RP i 100 CC w oknie godzinowym. Ujemne RP nie zwalniają limitu wcześniejszych nagród. Kontrola obejmuje wszystkie skonfigurowane serwery we wspólnej bazie. Okna są sprawdzane w obie strony od czasu zdarzenia, żeby spóźniona kolejka nie omijała już zapisanych wyników; może to konserwatywnie ograniczyć nagrody przy przestawionej kolejności.

Warmup, bot w aktywnym zespole, zmiana drużyny, spóźnione dołączenie, respawn po zgonie, restart/mapa i luka próbkowania >5 s unieważniają obserwowaną rundę. Tylko potwierdzone standardowe powody końca rundy (1/7/8/9/11/12/13) zgodne ze zwycięską drużyną. Nie wspiera deathmatch/niestandardowych trybów. To ograniczenia ekonomii, nie pełny system wykrywania zmów wielu kont; potrzebne monitorowanie na stagingu.

## Protokół i kolejka

`POST /api/ingest.php`, HTTPS, JSON <=64 KiB. Nagłówki `X-CloudHub-Server`, `X-CloudHub-Timestamp` (sekundy Unix), `X-CloudHub-Signature` (małe znaki hex). Podpis:

```
HMAC-SHA256(key, "v1\n" + server + "\n" + timestamp + "\n" + SHA256(raw_body).lower_hex)
```

Dopuszczalna różnica zegara 300 s; zdarzenia do 7 dni wstecz i 60 s w przyszłość. Czas podpisu odświeżany przy każdej próbie, treść i UUID niezmienne. PHP i C# sprawdzane wspólnym wektorem UTF-8 w `tests/protocol-vector.json` (klucz wyłącznie testowy). Przykład struktury: `RoundEvent` w `server/CloudHub.Core/RoundTracker.cs`. Backend oblicza nagrody sam, nie przyjmuje kwot od pluginu ani przeglądarki.

Dwa identyfikatory: unikatowy `(server,event_id)` z hashem treści oraz `(server,round_id)`. Powtórka identycznego zdarzenia zwraca `duplicate`, zmieniona treść lub ta sama runda pod nowym event_id: 409. Potwierdzenie `applied`/`duplicate` wydawane po zatwierdzeniu bazy. Zdarzeń nie usuwać z tabel deduplikacji podczas eksploatacji bez osobnego projektu retencji.

Kolejka ma 128 miejsc RAM, niezależny zapis na dysk i wysyłkę HTTP. Zapis do `.tmp`, flush na dysk, atomowa zmiana nazwy na `.json`; kompletne przerwane zapisy odzyskiwane po restarcie, niepełne zachowane w kwarantannie. Limit około 10 000 plików (w tym kwarantanna), 64 KiB na zdarzenie. Plik blokady wyklucza dwóch aktywnych właścicieli tego samego outbox. Timeout HTTP 15 s, rosnący odstęp do 30 s z jitterem, bez przekierowań. 409/422 przenosi rekord do `.rejected`; inne błędy, również 401/404/429/5xx, zachowują plik do ponowienia. Nie loguje podpisów, sekretów ani payloadów.

**Granica trwałości:** przyjęcie do RAM nie jest potwierdzeniem zapisu na dysk. Awaria procesu przed flush może utracić oczekujące zdarzenie. Przepełnienie RAM jest jawnie logowane i odrzuca nową rundę. Błąd dysku zatrzymuje zapis i powoduje presję na kolejkę; nie ogłasza sukcesu. Normalny unload drenuje writer asynchronicznie; gwałtowne zatrzymanie nie gwarantuje drenażu. Gorący reload przed zwolnieniem blokady wyłączy nową instancję — preferować kontrolowany restart na stagingu. Nigdy nie usuwać kolejki przy aktualizacji. Monitorować zajętość, wolne miejsce, kwarantannę, opóźnienie, logi i synchronizację zegarów.

## Match System

`IMatchResultAdapter` jest wyłącznie kontraktem przyszłej integracji. Nie ma implementacji wywołującej nagrody meczowe. `matches_won` i `matches_lost` pozostają nietknięte. Podłączenie wymaga źródeł lub wiarygodnego kontraktu CloudHub Match System v0.3.2 i osobnych testów.

## Bezpieczne przygotowanie Codexa

`docs/codex-setup.sh` zawiera pełny skrypt do zatwierdzenia. Instaluje narzędzia w `/workspace/.cloud-tools`, pobiera paczki APT bez instalowania usług do systemu, weryfikuje SHA-512 .NET SDK, instaluje zależności z lockfile i sprawdza wersje. Nie tworzy bazy, nie wykonuje SQL, nie uruchamia PHP aplikacji, CS2 ani migracji. Ignoruje odziedziczone DB_* / CLOUDHUB_CONFIG. Restore C# tylko dla istniejących projektów. Nie wdraża niczego i nie resetuje Git.

Testy bazy są **osobną, świadomą operacją**: jednorazowa lokalna MariaDB z `--skip-networking`, socket pod `/workspace`, losowa baza `cloudhub_test_*`. Harness generuje własną konfigurację i klucz testowy; nie czyta produkcyjnego config.php. Patrz `docs/TESTING.md` oraz sekcja poniżej.

## Wdrożenie — wyłącznie późniejsze, ręczne staging

1. Najpierw osobny staging CS2/WWW/MariaDB. Nie kopiować niczego do istniejącego produkcyjnego dysku gry podczas tej pracy. Potwierdzić CSS 1.0.376 / .NET 10 z jego wydania; nie aktualizować automatycznie CSS, MetaMod, WeaponPaints, CS2UIKit ani gamedata. Kompilacja nie potwierdza zgodności natywnej z konkretną instalacją gry.
2. Backup wybranej **stagingowej** bazy i konfiguracji. Osobny użytkownik migracyjny, osobny użytkownik www, osobny `cloudhub_ingest`. Migracje jawnie uruchamiane przez administratora: `CLOUDHUB_CONFIG=/ścieżka/do/staging-migration.php php bin/cloudhub-migrate.php --apply`. Nigdy z automatycznego setupu; sprawdzić host i nazwę bazy przed wykonaniem. `002` jest addytywne; nie modyfikować `001`.
3. Konto ingestion: SELECT na regułach i sezonach; SELECT/INSERT/UPDATE na cloudhub_players, cloudhub_profiles, cloudhub_wallets, cloudhub_player_stats, cloudhub_player_season_stats; INSERT/SELECT na cloudhub_player_roles, cloudhub_wallet_transactions, cloudhub_processed_events, cloudhub_round_receipts, cloudhub_round_awards, cloudhub_combat_history. Bez DDL, DELETE, GRANT, zapisu rank_config/reward_rules i bez dostępu do `wp_*`. Konto WWW nie powinno móc zapisywać sald/statystyk/księgi poza tworzeniem pustego konta wymaganym przez Etap 1. Rozdzielenie pełnego provisioningu kont w osobną usługę jest dalszym utwardzeniem; samo odseparowanie klucza HMAC nie usuwa istniejących uprawnień SQL WWW.
4. Prywatny `/etc/cloudhub/ingest.php`, root:cloudhub-ingest, 0640, katalog nieczytelny dla użytkownika WWW. Zdefiniować stałe DB_* dla stagingu, `DB_AUTO_MIGRATE=false` (z warunkiem `if (!defined(...))`), `CLOUDHUB_CORE_ENABLED=true`, początkowo `CLOUDHUB_INGEST_ENABLED=false`, `CLOUDHUB_INGEST_KEYS` jako mapa potwierdzonego ServerId do losowego sekretu >=32 bajtów. Nie wpisywać sekretu do repo, JSON pluginu, PR ani chatu. Nie przekazywać konfiguracji ingestion do zwykłej puli PHP.
5. Domyślny `deployment/nginx.conf` zwraca 404 dla ingestion. Dopiero po sprawdzeniu osobnej puli `deployment/php-fpm-ingest.conf`, zastąpić ten dokładny location przez opcjonalny `deployment/nginx-ingest.conf`. Zdefiniować limit_req_zone w http{}, potwierdzić egress IP gry i ograniczyć ACL. Nie pozostawiać dwóch location dla tego samego URI. Własne certyfikaty i istniejące ścieżki Certbota zachować. `nginx -t` i `php-fpm8.5 -t` przed świadomym reloadem przez administratora. Wszystko początkowo tylko na stagingu.
6. Zbudować `dotnet build server/CloudHub.Plugin -c Release`. Skopiować do nowego katalogu pluginu stagingowego tylko `CloudHub.Plugin.dll`, `CloudHub.Core.dll`, `CloudHub.Plugin.deps.json` (nie podmieniać CounterStrikeSharp.API.dll). Domyślny wygenerowany config ma Enabled=false. Nadać pluginowi osobny zapisywalny katalog outbox, zachowywany przy aktualizacjach. Sekret dostarczyć prywatną zmienną środowiska `CLOUDHUB_EVENT_KEY` procesu stagingowego CS2. Kod pluginów we wspólnym procesie gry należy traktować jako zaufany.
7. Sprawdzić endpoint wyłączony (404), poprawne TLS/ACL, osobną bazę i klucze. Następnie jawnie włączyć oba przełączniki wyłącznie w stagingu. Sprawdzić prawdziwą rundę czterech graczy, bota, warmup, AFK, reconnect, zmianę mapy, runda anulowana, łączność, restart kolejki, współdziałanie z WeaponPaints i Match System. Porównać salda, ledger i statystyki. Nie naliczać zwycięstw całych meczów.
8. Rollback: wyłączyć Enabled i CLOUDHUB_INGEST_ENABLED, przywrócić nginx 404. Zachować outbox i addytywne tabele, nie usuwać transakcji ani deduplikacji. Ewentualne korekty ekonomii wymagają osobnej audytowanej operacji, nie ręcznego kasowania historii.

PHP zweryfikowane lokalnie na 8.4; docelowe PHP 8.5, HTTPS przez Nginx/FPM i prawdziwe zdarzenia gry wymagają stagingu. Nie wykonano testów na produkcji.
