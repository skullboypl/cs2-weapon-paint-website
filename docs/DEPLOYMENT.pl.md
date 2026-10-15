# CloudHub CS2 — skins.cloudhub.autos

Instrukcja dla Ubuntu 26.04, Nginx, PHP 8.5-FPM, MariaDB 11.8 i HTTPS z Certbota. Publiczny katalog: `/var/www/skins.cloudhub.autos`. Wdrożenie jest osobnym etapem wykonywanym przez administratora. Żadnych opisanych operacji nie wykonano na VPS.

## Pakiet

`cloudhub-cs2-1.0.0.tar.gz` zawiera `public/` (gotowa aplikacja i PHP), `deployment/` (konfiguracje), `bin/` (migracja CLI), `docs/` oraz `SHA256SUMS`. Obok archiwum jest jego suma `.sha256`. Na VPS nie potrzeba Node ani pnpm.

W prywatnym katalogu staging:

```bash
sha256sum -c cloudhub-cs2-1.0.0.tar.gz.sha256
mkdir -p cloudhub-staging
tar -xzf cloudhub-cs2-1.0.0.tar.gz -C cloudhub-staging
cd cloudhub-staging
sha256sum -c SHA256SUMS
```

Do katalogu publicznego trafi wyłącznie zawartość `public/`. Konfiguracja, narzędzia CLI, dokumentacja i kopie bazy pozostają poza nim.

## Kopia i wybór bazy

Przed wdrożeniem wykonaj kopię obecnego katalogu strony i konfiguracji tej witryny. Przed migracją wykonaj spójny zrzut wybranej bazy (`mariadb-dump --single-transaction`) do pliku z prawami `0600` poza katalogiem publicznym. Użyj lokalnego uwierzytelnienia administratora albo monitu o hasło; nie umieszczaj hasła w argumentach polecenia.

Ustal rzeczywistą nazwę bazy używanej przez plugin. Strona i plugin muszą korzystać z tej samej bazy. Nowa, pusta baza nie zsynchronizuje wyposażenia z CS2. Nie zakładaj nazwy `weaponpaints` bez sprawdzenia. Nie jest potrzebna edycja, przenoszenie ani instalowanie plików serwera CS2.

## Prywatna konfiguracja i uprawnienia

Po sprawdzeniu, czy konto i katalogi już istnieją:

```bash
sudo adduser --system --group --no-create-home cloudhub
sudo install -d -m 0750 -o root -g cloudhub /etc/cloudhub
sudo install -d -m 0750 -o cloudhub -g cloudhub /var/lib/cloudhub
sudo install -d -m 0750 -o cloudhub -g cloudhub /var/lib/cloudhub/sessions /var/lib/cloudhub/cache /var/lib/cloudhub/ratelimit
sudo install -d -m 0750 -o cloudhub -g cloudhub /var/log/cloudhub
sudo install -m 0640 -o root -g cloudhub public/api/config.sample.php /etc/cloudhub/config.php
```

Nie nadpisuj istniejącego pliku konfiguracji. Kod strony powinien należeć do administratora, z prawami `0644` dla plików i `0755` dla katalogów. PHP zapisuje tylko w `/var/lib/cloudhub` i `/var/log/cloudhub`. Nie stosuj `chmod -R 777`.

## MariaDB na tym samym VPS

Zalecane jest osobne konto WWW z uwierzytelnieniem Unix socket. Jego nazwa odpowiada użytkownikowi systemowemu puli PHP. W konsoli administratora MariaDB, po zastąpieniu nazwy bazy rzeczywistą:

```sql
CREATE USER 'cloudhub'@'localhost' IDENTIFIED VIA unix_socket;
GRANT SELECT, INSERT, UPDATE, DELETE ON `RZECZYWISTA_BAZA_PLUGINU`.* TO 'cloudhub'@'localhost';
```

Jeśli konto istnieje, sprawdź jego uprawnienia zamiast ponownie je tworzyć. Nie zmieniaj konta używanego przez plugin. Konto WWW nie otrzymuje CREATE, ALTER, DROP ani dostępu z innych hostów. MariaDB nie musi być publicznie dostępna.

W `/etc/cloudhub/config.php` ustaw:

- `DOMAIN_NAME`: `https://skins.cloudhub.autos` bez końcowego ukośnika.
- `DB_HOST`: `localhost`, `DB_USER`: `cloudhub`, `DB_PASS`: pusty ciąg, `DB_NAME`: rzeczywista baza pluginu. `localhost` wybiera Unix socket.
- `STEAM_API_KEY`: prawdziwy klucz wpisany tylko w tym prywatnym pliku przez administratora. Nie w repozytorium ani czacie.
- `DB_AUTO_MIGRATE`: `false` dla żądań WWW.
- `STORAGE_PATH`: `/var/lib/cloudhub`, albo użyj zmiennej `CLOUDHUB_STORAGE` z dostarczonej puli.
- `BETA_3D`: domyślnie `false`; podstawowy podgląd 2D działa bez zewnętrznych modeli.

Dla zdalnej MariaDB potrzebne jest osobne konto z ograniczeniem hosta, silne hasło w prywatnym configu, firewall oraz zweryfikowany TLS (`DB_SSL_CA`). Nie wyłączaj weryfikacji certyfikatu. Instrukcja socketu dotyczy tylko bazy lokalnej.

## Kontrolowana migracja schematu

Sześć tabel pluginu jest zachowanych. CloudHub dodaje `wp_users_data` i `wp_saved_loadouts`. Migracja używa `CREATE TABLE IF NOT EXISTS` i przyrostowego dodania kolumny/indeksu zestawów. Nie resetuje danych graczy, ale wymaga kopii i świadomego wyboru bazy. Najpierw sprawdź migrację na kopii danych.

Utwórz tymczasowy `/etc/cloudhub/migration.php` z prawami `0600`, tylko dla administratora. Wskaż tę samą bazę, używając osobnego konta z uprawnieniami CREATE/ALTER (np. lokalnego MariaDB root z Unix socketem). Nie nadawaj tych praw kontu WWW. Szablon configu pozwala CLI włączyć migrację: nie definiuj w pliku migracyjnym bezwarunkowo `DB_AUTO_MIGRATE=false`.

Z prywatnego rozpakowanego katalogu pakietu:

```bash
sudo env CLOUDHUB_CONFIG=/etc/cloudhub/migration.php php8.5 bin/migrate.php --apply
```

Po sukcesie usuń plik migracyjny. Nigdy nie wykonuj migracji przez HTTP. Nietypowe stare struktury pluginu mogą wymagać osobnej analizy; nie usuwaj ani nie odtwarzaj automatycznie istniejących tabel.

## Steam

Wygeneruj klucz przez oficjalną stronę Steam dla `skins.cloudhub.autos`. Hasło Steam wpisuje się wyłącznie na stronie Steam. Klucz Web API pobiera nick/avatar; OpenID identyfikuje konto niezależnie, więc brak klucza może skutkować zastępczym profilem.

Adres powrotu: `https://skins.cloudhub.autos/api/steamauth/steamlogin.php?state=...`. Losowe `state` generuje aplikacja — nie wpisuj go ręcznie. PHP wymaga wychodzącego HTTPS do `steamcommunity.com` i `api.steampowered.com`. Avatary są pobierane przez przeglądarkę z domen Steam. Używaj jednej, kanonicznej domeny HTTPS.

## PHP-FPM i Nginx

Wymagane rozszerzenia: PDO MySQL, cURL, OpenSSL, session i JSON. Zweryfikuj zarówno CLI, jak i FPM (`php8.5 -m` i konfiguracja puli); mogą korzystać z różnych INI. Pakiety `php8.5-mysql` i `php8.5-curl` instaluj wyłącznie z zaufanych, podpisanych repozytoriów systemowych.

Przejrzyj i zainstaluj `deployment/php-fpm.conf` jako `/etc/php/8.5/fpm/pool.d/cloudhub.conf`. Nie zastępuj innych pul. Dedykowana pula działa jako `cloudhub`, słucha na `/run/php/cloudhub.sock`, czyta `/etc/cloudhub/config.php` i zapisuje sesje poza katalogiem publicznym.

Przejrzyj `deployment/nginx.conf`, zachowaj prawidłowe ścieżki istniejącego certyfikatu i mechanizm odnowień Certbota. Zmień tylko konfigurację tej witryny. Szablon zapewnia:

- HTTPS, fallback Reacta dla `/t/rifle` i pozostałych tras;
- wykonanie tylko jawnie wymienionych wejść PHP, blokadę `config`, `class`, `storage` i plików ukrytych;
- nagłówki CSP, ochronę ramek, limit żądania 64 KB;
- długie cache dla plików z hashem i ponowną weryfikację HTML;
- domyślnie wyłączoną trasę `/lielxd/`; opcjonalne proxy 3D jest w osobnym `deployment/nginx-3d.conf`, z weryfikacją certyfikatów.

Wgraj zawartość `public/` do `/var/www/skins.cloudhub.autos`. Dla aktualizacji najpierw przejrzyj wynik `rsync --dry-run`; nie usuwaj istniejących danych ani configu bez kopii. Nie wgrywaj plików testowych do katalogu publicznego.

Aby włączyć beta 3D, ustaw `BETA_3D=true`, skopiuj `deployment/nginx-3d.conf` do `/etc/nginx/snippets/cloudhub-3d.conf` i zastąp domyślny blok `location /lielxd/ { return 404; }` dyrektywą `include /etc/nginx/snippets/cloudhub-3d.conf;`. Sprawdź rozwiązywanie domeny i dostęp HTTPS do `raw.githubusercontent.com`. Nie jest to wymagane dla kompletnego trybu 2D.

Przed przeładowaniem:

```bash
sudo php-fpm8.5 -tt
sudo nginx -t
```

Po pomyślnym sprawdzeniu:

```bash
sudo systemctl reload php8.5-fpm
sudo systemctl reload nginx
```

## Odbiór po wdrożeniu

1. `/api/` zwraca `status: OK`, a `/api/site-config.php` konfigurację.
2. Bez logowania API danych zwraca 401. GET nie może wykonywać operacji zmieniających dane.
3. `/api/config.php`, `/api/storage/`, `/api/class/Database.php` oraz `/.git/config` dają 404.
4. Zaloguj własne konto przez Steam. Sprawdź nick/avatar oraz cookie `wp_session`: Secure, HttpOnly, SameSite=Lax.
5. Zapisz pojedynczy skin T i sprawdź, że CT jest niezależne. Przetestuj zestaw, rękawice, agenta i wylogowanie.
6. Na własnym koncie CS2 użyj istniejącego odświeżania pluginu (`!ws`, zgodnie z jego konfiguracją) lub połącz się ponownie. Nie jest potrzebna ingerencja w pliki serwera gry.
7. Sprawdź telefon oraz log `/var/log/cloudhub/php-error.log`. Nie publikuj logów zawierających dane użytkowników.

## Rollback i granice testów

Zachowaj poprzednie pliki witryny i konfigurację serwera. W razie problemu przywróć te pliki, sprawdź konfigurację i przeładuj usługi. Nie przywracaj automatycznie całej bazy — plugin mógł zapisać nowsze dane graczy. O odtworzeniu bazy decyduje administrator po analizie i zatrzymaniu zapisów.

W Codexie użyto PHP 8.4, MariaDB 11.8, Node 24 i Chromium z jednorazową lokalną bazą. PHP 8.5-FPM wymaga sprawdzenia `-tt` na VPS. Prawdziwy callback Steam, klucz API oraz działanie w uruchomionym CS2 wymagają odbioru po osobnym wdrożeniu. Zgodność formatów opisuje `COMPATIBILITY.md`.
