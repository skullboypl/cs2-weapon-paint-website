# CloudHub CS2 — zmiany do przeglądu

Proponowany tytuł PR: CloudHub CS2: nowy panel gracza, bezpieczne API i pakiet wdrożeniowy

Nowy interfejs zastępuje dotychczasowy układ strony: ekran Steam, panel z boczną nawigacją, profil, wyposażenie T/CT, wyszukiwanie i filtrowanie oraz edytor skinów. Prawdziwe grafiki katalogu są przygotowywane lokalnie jako WebP. Zachowane są noże, rękawice, agenci, muzyka, przypinki, naklejki, zawieszki, wear, seed, StatTrak i zapisane zestawy.

Backend PHP otrzymał ochronę CSRF, walidację danych katalogowych, sprawdzanie pochodzenia żądań, autoryzację kont i zestawów, transakcje zapisu oraz weryfikację Steam OpenID. Konfiguracja i sesje mogą znajdować się poza katalogiem publicznym. Migracje uruchamia się osobno; konto WWW potrzebuje tylko uprawnień do danych.

Pakiet zawiera public/, konfiguracje Nginx i PHP-FPM, migrator CLI, instrukcję instalacji oraz sumy SHA-256. Nie zawiera lokalnej konfiguracji, kluczy ani sesji. Skrypty kompilacji i przygotowania grafik pozwalają odtworzyć wydanie. Biblioteka opcjonalnego podglądu 3D ładuje się dopiero na żądanie.

## Weryfikacja 2026-10-15

- ESLint: bez błędów i ostrzeżeń.
- Playwright: 8/8 testów API i przeglądarki, z prawdziwą lokalną MariaDB oraz syntetycznymi sesjami tworzonymi wyłącznie przez CLI.
- Testy obejmują zapis wyposażenia, separację użytkowników i drużyn, zestawy publiczne/prywatne, błędne dane, CSRF, fałszywy callback Steam, desktop/mobile i zachowanie formularza po błędzie.
- Składnia wszystkich plików PHP backendu i migratora: poprawna.
- Produkcyjny build: poprawny; pozostaje ostrzeżenie o rozmiarze opcjonalnego modułu 3D (~663 kB przed gzip).
- Nginx i PHP-FPM: konfiguracje sprawdzone po lokalnej zamianie ścieżek, portów i użytkownika. Rzeczywiste żądania HTTPS potwierdziły działanie strony/API i blokadę dostępu do konfiguracji oraz klas PHP.
- Środowisko testowe: Node 24, PHP 8.4, MariaDB 11.8, Chromium 155. Docelowy PHP 8.5 wymaga kontroli przy instalacji.

Nie wykonywano logowania na rzeczywiste konto Steam ani testu synchronizacji na serwerze gry. Zgodność struktury danych porównano z przypiętą rewizją pluginu opisaną w COMPATIBILITY.md. Jeden przedmiot nie ma grafiki u źródła — otrzymuje oznaczenie braku podglądu.

Zmiany pozostają lokalnie na gałęzi cloudhub-cs2 do przeglądu i zatwierdzenia. Nie wdrażano ich na VPS ani nie modyfikowano produkcyjnej bazy lub plików CS2.
