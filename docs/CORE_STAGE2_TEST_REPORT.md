# Etap 2 — raport weryfikacji, 17 października 2026

Weryfikacja wykonana wyłącznie w środowisku Codexa. Bazą prac był `14b1391` (master po PR #2 i #3). Historia modułów została sukcesywnie wypchnięta na `RubLud/cs2-weapon-paint-website`, gałąź `cloudhub-core-stage2`.

| Kontrola | Wynik |
|---|---|
| Bezpieczny `docs/codex-setup.sh` | PASS, pełne wykonanie i powtórzenie; brak SQL/startu bazy/CS2 |
| Zamrożone zależności pnpm i locked restore .NET | PASS |
| Plugin CounterStrikeSharp.API **1.0.376** | Release build PASS, 0 błędów, 0 ostrzeżeń |
| Testy C# | **39 asercji PASS** |
| Fundamenty PHP / MariaDB | **31 asercji PASS** |
| Rozliczenia PHP / MariaDB | **50 asercji PASS** |
| Playwright API i UI | **13 testów PASS**, końcowe pełne uruchomienie |
| PHP lint backend/bin/tests | PASS |
| Frontend lint i build | PASS; istniejące ostrzeżenie rozmiaru modułu podglądu 3D |
| Bash syntax setup/helper | PASS |
| Nginx — domyślny blokujący i opcjonalny ingestion | `nginx -t` PASS na lokalnych kopiach |
| PHP-FPM — osobna pula ingestion | `php-fpm8.4 -t` PASS na lokalnej kopii |

Nginx/FPM sprawdzono z podmienionymi ścieżkami lokalnymi, użytkownikiem testowym i jednorazowym certyfikatem localhost. Nie uruchamiano wdrożenia. Nie jest to potwierdzenie poprawności istniejącej konfiguracji VPS.

## Zakres dowodów

- Obserwator: ruch, AFK, ograniczenie aktywności od strzelania do czasu rzeczywistego, warmup/boty, luki próbkowania, team switch, late join, respawn, disconnect/reconnect, duplikaty zgonów i zakończeń, poprawne powody końca rundy, brak meczowych wyników.
- Outbox: zachowanie treści podczas 503, ponowienie po odtworzeniu instancji, usunięcie po `duplicate`, odzyskanie kompletnego `.tmp`, kwarantanna 409, zachowanie danych przy nieznanym/za dużym ACK, odrzucenie HTTP i niebezpiecznej nazwy rekordu. Test HTTP używa lokalnego handlera w pamięci; nie kontaktuje się z prawdziwym endpointem.
- PHP: naliczanie RP/CC i sześciu rang, minimum graczy, AFK, odejście przed końcem, samobójstwo i teamkill, okno par między serwerami i przy spóźnionych zdarzeniach, limity godzinowe, niepoprawne reguły, sezon bez resetu salda, blokada nakładających się sezonów.
- Transakcje: trigger wymuszający błąd księgi potwierdza rollback salda/statystyk/znacznika zdarzenia; późniejsza próba działa. Dwa niezależne procesy PHP potwierdzają jeden `applied` i jeden `duplicate`. Portfele uzgodnione z sumą księgi.
- HMAC: wspólny wektor UTF-8 C#/PHP, modyfikacja treści, wygasły podpis, nieznany serwer; endpoint odmawia autoryzacji cookie Steam/OWNER. Wyłączony endpoint zwraca 404 bez konfiguracji DB. Testy konfliktu event/runda i limitu rozmiaru.
- Prywatna historia: sesja określa właściciela; podany w URL cudzy SteamID nie rozszerza dostępu; izolacja ksiąg, paginacja, walidacja kursora, żądanie anonimowe.
- Dotychczasowe operacje WeaponPaints i testy UI pozostają działające.

Pierwsza próba setupu wymagała `CI=true` do nieinteraktywnego pnpm. Testy bazy wymagały jawnego Unix socket w DSN (ustawienia php.ini nie można zmienić przez ini_set). W nowym teście anonimowej historii wyczyszczono zachowany cookie klienta testowego. Wszystkie poprawki zweryfikowano ponownie; końcowy zestaw nie ma pominiętych ani oczekiwanych porażek.

## Środowisko i ograniczenia

.NET SDK 10.0.112, PHP 8.4.26, MariaDB 11.8.6, pnpm 10.33.0, Chromium. API zweryfikowane z wydaniem CSS v1.0.376 (`653d651f1ac09ac1ddb423d588f871b891038860`) i przypiętym pakietem NuGet z lockfile.

**Niewykonane:** natywny proces CS2, faktyczne współdziałanie z produkcyjnymi pluginami, logowanie prawdziwego Steam, PHP 8.5, TLS/reverse proxy na docelowym VPS, testy obciążeniowe i odporność na zanik zasilania. Ograniczenie kolejki: tylko dane po flush/rename są trwałe; RAM może zostać utracony przy crash. Warunki i plan stagingu: [CORE_STAGE2.pl.md](CORE_STAGE2.pl.md).

Nie wykonano zmian ani połączeń do produkcyjnej bazy/VPS. Automatyczny setup pozostaje oddzielony od ręcznego helpera uruchamiającego bazę testową.
