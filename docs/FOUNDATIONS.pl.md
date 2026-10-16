# Etap 1 — audyt i fundamenty CloudHub

## Stan audytu

Kod strony: `/workspace/cs2-weapon-paint-website`, baza zmian `f02bbf1`, fork `RubLud/cs2-weapon-paint-website`. Frontend to React 19/Vite, istniejący panel znajduje się w `frontend/src/pages/Page.jsx`, konfigurator w `components/Weapons.jsx` i `WeaponCustomiser.jsx`. Nie wymieniamy frontendu ani frameworka.

`backend/steamauth/steamlogin.php` tworzy jednorazowy stan logowania; `SteamOpenID.php` sprawdza powrót, nonce, podpisane pola i potwierdza odpowiedź na stałym endpointcie Steam przez HTTPS. Tożsamość jest zapisywana w sesji po weryfikacji, z regeneracją identyfikatora sesji. Nowe konto powstaje tylko po tej weryfikacji, jeśli świadomie włączono Core. Błąd inicjalizacji Core nie blokuje starego logowania ani konfiguratora. Endpoint Core zwróci w takim przypadku 409 i poprosi o ponowne logowanie.

Backend PHP używa PDO MySQL z prepared statements. `Database.php` zawiera istniejący schemat WeaponPaints. `skins.php`, `knife.php` i `loadouts.php` zapisują ustawienia gracza w tabelach `wp_*` i istniejących tabelach zestawów. Zabezpieczenia POST/CSRF i sesji pozostają. Test regresji weryfikuje zachowanie przykładowego istniejącego skina oraz struktur `wp_*` po nowej migracji.

Produkcji nie odczytywano. Nazwa `cscloud_weaponpaints`, wersja WeaponPaints 3.3a i wersje komponentów CS2 pochodzą z wymagań właściciela, nie z pomiaru serwera. Lokalny audyt schematu nie potwierdza schematu produkcji. Brak źródeł CloudHub Match System i pozostałych prywatnych modyfikacji uniemożliwia obecnie potwierdzenie wyników meczów i kolizji komend.

## Decyzje architektoniczne

- Jedna tożsamość: SteamID64 jako 17-znakowy ciąg ASCII; bez konwersji na JavaScript Number. Nick jest aktualizowalnym opisem konta.
- Wszystkie nowe dane używają prefiksu `cloudhub_`. Brak zmian w `wp_*`, odbierania skinów, importu danych produkcyjnych czy resetu RP/CC.
- Konto, profil, role, RP, statystyki i portfel są rozdzielone. Wallet i RP startują od zera. Nie generujemy przykładowego rankingu.
- Role: PLAYER, MODERATOR, ADMIN, OWNER. Domyślnie moderator moderuje, administrator może dodatkowo czytać graczy; uprawnienia walutowe nie są nadawane automatycznie. OWNER ma pełną kontrolę. Każda przyszła operacja musi sprawdzać `CloudHubAccounts::can()` na serwerze, bez ufania rolom z przeglądarki lub cache sesji.
- Nadanie pierwszego OWNER wyłącznie lokalnym CLI, z podwójnym podaniem SteamID64, powodem i logiem audytowym. Wymaga istniejącego konta z potwierdzonym logowaniem Steam. Kolejne wywołanie jest odrzucane. Nie ma endpointu do samodzielnego nadawania ról.
- Schemat portfela przechowuje saldo całkowite, ledger z unikalnym kluczem operacji, źródłem, powodem i saldem przed/po. Ograniczenia SQL chronią nieujemne saldo i arytmetykę wpisu. **Nie jest to jeszcze usługa transakcyjna**: zapis ledgeru i salda w jednej transakcji, blokady i obsługa konkurencji powstaną w następnym etapie. Żaden endpoint obecnie nie przyznaje ani nie wydaje CC.
- Idempotencję zdarzeń przygotowuje klucz `(server_id,event_id)` z hashem payloadu. Transport serwerowy, podpisy i ochrona przed replay pozostają do wdrożenia przed odbieraniem zdarzeń.
- Rangi Bronze–Master są seedowane zgodnie z wymaganiami. RP nie spada poniżej zera. Progi i RP zwracane są jako ciągi dziesiętne. Bieżąca i następna ranga wynikają z RP.
- Sezony mają jawny stan i politykę JSON. Migracja nie tworzy aktywnego sezonu i nie uruchamia automatycznych resetów. Docelowe remisy: RP malejąco, zabójstwa malejąco, SteamID64 rosnąco; próg aktywności i pełna klasyfikacja zostaną wdrożone razem z leaderboardem. Teraz nie zwracamy fikcyjnej pozycji ani odznaki TOP.
- CS2 Core będzie osobnym pluginem, wysyłającym uwierzytelnione zdarzenia przez kolejkę poza głównym wątkiem. Przeglądarka nigdy nie deklaruje zdobytych CC/RP. Wyniki meczów wymagają kontraktu z Match System. Nie dodajemy hooków ani komend bez audytu kolizji.
- Zakup dotyczy wyłącznie trwałego bazowego skina, noża lub rękawic. Personalizacja i presety zawsze kosztują 0 CC. Zakupy oraz kontrola własności są wyłączone, nie ma jeszcze kodu odblokowującego je flagą.
- CS2UIKit, Workshop 3807024759 i MultiAddonManager to etap 6. Nie instalowano bibliotek ani pluginów na VPS; `mm_client_extra_addons`, poprawka gamedata i kompatybilność wymagają osobnej weryfikacji.

## Schemat 001

`cloudhub_players`, `cloudhub_profiles`, `cloudhub_roles`, `cloudhub_player_roles`, `cloudhub_role_permissions`, `cloudhub_rank_config`, `cloudhub_seasons`, `cloudhub_player_stats`, `cloudhub_player_season_stats`, `cloudhub_wallets`, `cloudhub_wallet_transactions`, `cloudhub_processed_events`, `cloudhub_admin_audit_logs` oraz rejestr `cloudhub_schema_migrations`.

Schemat zawiera indeksy pod nick/aktywność, klasyfikację globalną i sezonową, historię portfela i audyt. Używa InnoDB, FK, CHECK i utf8mb4. Profil domyślnie publiczny, lecz kolekcja i aktywność prywatne, komentarze wyłączone. Nie istnieje jeszcze publiczne API profili. Tabele sklepu, własności, presetów, znajomych, komentarzy i odznak pojawią się z odpowiadającymi im usługami oraz testami, zamiast nieużywanych atrap.

Migrator jest wyłącznie CLI, blokuje równoległe uruchomienia przez GET_LOCK i zapisuje checksumę wersji. MariaDB auto-commituje DDL, więc migracja jest addytywna i powtarzalna po przerwaniu, a nie pozornie transakcyjna. Zmiana już zastosowanego pliku jest odrzucana. Seed INSERT IGNORE nie nadpisuje wartości edytowanych przez właściciela. Przyszłe modyfikacje schematu wymagają następnego pliku migracji. Nie edytować 001 po wdrożeniu.

## API etapu 1

`GET /api/cloudhub.php` — prywatne konto aktualnej sesji: SteamID64, nick, avatar, role, RP, saldo, bieżąca/następna ranga. Saldo nie jest publikowane innym użytkownikom. Parametry `steamid`, `role`, `balance` nie sterują tożsamością ani zapisem. POST zwraca 405; anonimowy odczyt 401; wyłączony Core 404. Odpowiedź jest `no-store`. `features.shop_purchases` i `features.ownership_enforcement` są zawsze false.

## Bezpieczna instalacja testowa / późniejsze wdrożenie

Te polecenia są instrukcją, a nie zgodą na produkcyjne wykonanie. Nie wykonano ich na VPS.

1. Zrób backup i zweryfikuj schemat docelowej bazy. Użyj konta migracyjnego z uprawnieniami CREATE/INDEX/REFERENCES i DML do nowych tabel. Konto WWW nie powinno posiadać uprawnień DDL. Użyj prywatnego pliku konfiguracyjnego, nigdy flagi z hasłem w terminalu. Wszystkie czasy bazy i procesu utrzymuj w UTC.
2. Zachowaj `CLOUDHUB_CORE_ENABLED=false`, przygotuj wydanie wraz z `migrations/` poza publicznym rootem. Skrypt pakowania uwzględnia ten katalog.
3. Po autoryzacji właściciela uruchom:

   ```bash
   CLOUDHUB_CONFIG=/etc/cloudhub/migration.php php bin/cloudhub-migrate.php --apply
   ```

   Skrypt wymusza wyłączenie automatycznych migracji WeaponPaints. Konfiguracja powinna respektować istniejącą stałą `DB_AUTO_MIGRATE` (jak config.sample.php).
4. Konto WWW otrzymuje SELECT na tabele rang/ról/uprawnień oraz potrzebne prawa SELECT/INSERT/UPDATE na konta, profile, statystyki i portfele. Nie nadawaj mu zapisu do audytu, konfiguracji ról, ledgeru lub uprawnień, zanim odpowiadające usługi i endpointy nie będą gotowe. Obecny register dodaje wyłącznie rolę PLAYER, więc potrzebuje INSERT do `cloudhub_player_roles`; kod nie przyjmuje nazwy roli od klienta.
5. Zaktualizuj whitelistę Nginx o `cloudhub.php` z załączonej konfiguracji. `nginx -t` i kontrola konfiguracji PHP-FPM przed osobno zatwierdzonym reloadem.
6. W prywatnej konfiguracji ustaw `define('CLOUDHUB_CORE_ENABLED', true);`. Nie wymaga to włączenia sklepu ani blokowania wyposażenia. Zaloguj się ponownie przez Steam. To dopiero utworzy/zweryfikuje konto CloudHub.
7. Pierwszego OWNER nadaj kontem CLI z prawami INSERT do ról i audytu oraz SELECT na graczy. Zamień oba placeholdery własnym SteamID64 ze zweryfikowanej sesji, nie nickiem:

   ```bash
   CLOUDHUB_CONFIG=/etc/cloudhub/owner-bootstrap.php php bin/cloudhub-owner.php \
     --steamid=TWOJ_STEAMID64 --confirm-steamid=TWOJ_STEAMID64 \
     --reason='Pierwsze nadanie OWNER po weryfikacji Steam'
   ```

   Konto o samym wpisie z przyszłego pluginu nie spełnia warunku weryfikacji Steam. Nie wykonuj ręcznych INSERT do roli OWNER. Wycofaj dostęp do konfiguracji administracyjnej po użyciu. Faktyczny SteamID właściciela pozostaje nieznany i nie był zgadywany.
8. Sprawdź nowy endpoint, role i zachowanie konfiguratora. Nie przełączaj flag sklepu/własności — nie są jeszcze implementowane.

Rollback etapu 1: ustaw Core na false i wróć do poprzedniego wydania. Zachowaj `cloudhub_*` i backup; nie wykonuj DROP. Nie restartuj CS2. Nowe tabele nie wpływają na WeaponPaints, a istniejący frontend nie zależy od Core.

## Informacje do bezpiecznego audytu produkcji przed kolejnymi etapami

Właściciel może zebrać bez ujawniania danych logowania:

- `SELECT VERSION();`, listę nazw tabel i `SHOW CREATE TABLE` dla `wp_player_skins`, `wp_player_knife`, `wp_player_gloves` oraz pozostałych używanych tabel. Przekazać sam schemat, bez danych graczy i haseł.
- Dokładne wersje i hashe plików DLL pluginów, wersje MultiAddonManager/CS2UIKit oraz zanonimizowaną listę zarejestrowanych komend. Nie publikować plików konfiguracyjnych z bazą/tokenami.
- Źródła lub publiczny kontrakt zdarzeń CloudHub Match System: rozpoczęcie, anulowanie, zakończenie, identyfikator meczu/rundy, wynik i uczestnicy.
- Czy istniejące komendy/menu WeaponPaints umożliwiają zmianę skinów poza stroną. Bez ochrony tych ścieżek egzekwowanie własności nie może być włączone.
- Kopię bezpieczeństwa poprawionego gamedata wraz z hashem, bez nadpisywania `CBaseTrigger_StartTouch`. Nie instalować starego RayTrace i nie aktualizować automatycznie Metamod/CSS.

## Ograniczenia tego etapu

Nie ma jeszcze pluginu C#, naliczania statystyk/CC, transakcji zakupowych, leaderboardu, sezonowego zamykania, funkcji społecznościowych, panelu administracyjnego ani GUI CS2UIKit. Schema i usługi kont nie oznaczają ukończenia całego portalu. Weryfikacja prawdziwego Steam, WeaponPaints 3.3a i kompatybilności gry wymaga osobnego środowiska testowego i dostarczenia brakujących kontraktów.
