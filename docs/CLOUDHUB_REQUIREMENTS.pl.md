# CLOUDHUB — KOMPLETNY PROJEKT: RANKING CS2, CLOUD COINS, SKLEP SKINÓW, PROFILE STEAM, SPOŁECZNOŚĆ, PANEL OWNER I GUI CS2UIKIT

## TWOJA ROLA

Jesteś głównym programistą i architektem full-stack projektu CloudHub.

Masz za zadanie rozbudować istniejący, działający ekosystem Counter-Strike 2 o kompletny system rankingowy, ekonomię, sklep, profile graczy, funkcje społecznościowe, panel administracyjny i graficzny interfejs w grze.

**Nie ograniczaj się do opisania rozwiązania. Wykonaj audyt obecnego kodu, zaprojektuj architekturę, a następnie implementuj projekt etapami, testując każdą część.**

### ABSOLUTNIE NAJWAŻNIEJSZE ZASADY

1. **Istniejąca strona skinów CloudHub już działa. NIE TWÓRZ JEJ OD NOWA.**
2. Rozbuduj aktualną aplikację, zachowując logowanie Steam, wybór skinów, podgląd broni, działające API i bazę danych.
3. Nie usuwaj żadnych istniejących funkcji strony ani pluginów CS2.
4. Nie uszkodź konfiguracji WeaponPaints ani zapisanych skinów graczy.
5. Nie aktualizuj automatycznie CS2, Metamod ani CounterStrikeSharp.
6. Nie ingeruj w działający serwer produkcyjny bez wyraźnej zgody właściciela.
7. Pracuj na osobnym branchu, przygotowuj małe, testowalne commity i PR-y.
8. Wykorzystaj istniejący stack projektu. Nie zastępuj go nowym frameworkiem bez uzasadnionej potrzeby.
9. Dane rankingowe, ekonomia i profile muszą być współdzielone pomiędzy serwerem CS2 i stroną WWW.
10. **Cloud Coins służą wyłącznie do kupowania bazowych skinów, noży i rękawic. Cała personalizacja jest darmowa.**

---

# 1. AKTUALNA INFRASTRUKTURA

Projekt CloudHub działa na VPS z Ubuntu.

Znane informacje:

- Serwer CS2: `/mnt/storage/cs2`
- Katalog gry: `/mnt/storage/cs2/server/game/csgo`
- CounterStrikeSharp: `1.0.376`
- Metamod: `2.0.0-dev+1469`
- .NET SDK dostępny na VPS: `10.0.112`
- Strona skinów: `https://skins.cloudhub.autos`
- Webserwer: Nginx
- Backend strony: PHP
- Baza danych: MySQL/MariaDB
- Uwierzytelnianie: Steam OpenID
- Frontend istniejącej strony budowany przez Vite — sprawdź rzeczywisty framework w repozytorium
- System skinów: cs2-WeaponPaints
- Produkcyjna baza skinów: `cscloud_weaponpaints`

Na serwerze działają następujące pluginy:

1. CloudHub Match System
2. CS2-SimpleAdmin Fun Commands
3. jRandomSkills 1.2.4.b4
4. CS Cloud Maps
5. Wallhack Plugin CS2 2.3.2 — wersja zmodyfikowana dla CloudHub
6. PlayerSettings [Core]
7. WeaponPaints 3.3a
8. CS2-SimpleAdmin
9. MenuManager [Core]

Wszystkie te pluginy działają i muszą nadal działać po wdrożeniu.

### Ważna informacja o gamedata

Po aktualizacji CS2 z 15 października 2026 wystąpił błąd `Invalid function pointer`, związany z sygnaturą `CBaseTrigger_StartTouch`.

Na serwerze zastosowano działającą poprawkę w pliku CounterStrikeSharp `gamedata.json`.

**Nie nadpisuj tej poprawki. Nie instaluj starego RayTrace ani nie wykonuj zbędnych aktualizacji CounterStrikeSharp lub Metamod.**

Jeżeli potrzebujesz informacji, których nie ma w repozytorium, przygotuj bezpieczną instrukcję ich sprawdzenia. Nie zgaduj rzeczywistej konfiguracji VPS.

---

# 2. ARCHITEKTURA SYSTEMU

Zaprojektuj system jako jeden ekosystem z czterema warstwami.

### A. CloudHub Core — plugin C# dla CounterStrikeSharp

Nowy, oddzielny plugin odpowiedzialny za:

- Statystyki graczy.
- Punkty rankingowe.
- Rangi.
- Naliczanie Cloud Coins.
- Zdarzenia meczowe.
- Osiągnięcia.
- Synchronizację danych.
- Komendy rankingowe.
- Integrację z CS2UIKit.

Plugin powinien być izolowany od istniejących pluginów i nie może powodować konfliktów komend ani hooków.

### B. Backend i API CloudHub

Rozbuduj obecny backend PHP, o ile audyt nie wskaże uzasadnionej konieczności zmiany.

Backend ma obsługiwać:

- Steam OpenID.
- Konta użytkowników.
- Role i uprawnienia.
- Statystyki.
- Rankingi.
- Cloud Coins.
- Transakcje.
- Sklep.
- Własność skinów.
- Profile.
- Znajomych.
- Komentarze.
- Panel administracyjny.

### C. Strona internetowa CloudHub

Rozbuduj obecną stronę skórek o nowe zakładki i podstrony.

**Nie rób drugiej, niezależnej strony i nie kopiuj od nowa istniejącego konfiguratora WeaponPaints.**

### D. Graficzny interfejs CS2

Wykorzystaj bibliotekę:

https://github.com/nvmxre/cs2-ui-kit

Do tworzenia własnego interfejsu Panorama, rankingów, paneli statystyk, odznak i powiadomień.

---

# 3. SYSTEM KONT GRACZY

Każdy gracz powinien mieć jedno konto CloudHub identyfikowane poprzez **SteamID64**.

Konto ma działać zarówno w grze, jak i na stronie internetowej.

Po pierwszym połączeniu z serwerem:

- Zarejestruj profil gracza, jeśli nie istnieje.
- Zapisz SteamID64.
- Zapisz aktualny nick.
- Zapisz datę pierwszego połączenia.
- Zapisz datę ostatniej aktywności.
- Przygotuj statystyki i portfel.

Po zalogowaniu przez Steam na stronie gracz musi zobaczyć dokładnie te same dane.

Zmiana nicku Steam nie może powodować utraty postępu, skinów, znajomych ani Cloud Coins.

Stosuj spójną reprezentację SteamID64 oraz bezpieczne przekształcenia identyfikatorów pomiędzy pluginem i backendem.

---

# 4. RANKING I STATYSTYKI CS2

Zaimplementuj automatyczne zbieranie następujących statystyk:

- Zabójstwa.
- Zgony.
- Asysty.
- Headshoty.
- Liczba rund.
- Wygrane rundy.
- Przegrane rundy.
- Zwycięstwa meczowe.
- Porażki meczowe.
- MVP.
- Podłożone bomby.
- Rozbrojone bomby.
- Czas gry.
- K/D.
- KDA.
- Win rate.
- Procent headshotów.
- Serie zabójstw.
- Punkty rankingowe.
- Aktualna ranga.
- Pozycja w rankingu.
- Historia sezonów.

Zdarzenia meczowe muszą być zapisywane rzetelnie.

Jeżeli CloudHub Match System posiada już wiarygodne informacje o rozpoczęciu, zakończeniu i wyniku meczu, przeanalizuj możliwość bezpiecznej integracji.

Nie naliczaj wyniku meczu na podstawie domysłów.

### Początkowe wartości punktów

| Zdarzenie | Punkty RP | Cloud Coins |
|---|---:|---:|
| Zabójstwo przeciwnika | +10 | +3 |
| Headshot | +3 bonus | +1 bonus |
| Asysta | +4 | +1 |
| Wygrana runda | +5 | +2 |
| Śmierć | -2 | 0 |
| Teamkill | -20 | 0 |

Wartości mają być konfigurowalne w panelu administracyjnym.

**RP i CC to dwa oddzielne systemy.**

RP określa miejsce gracza w rankingu, a CC jest walutą, którą można wydawać w sklepie.

Zakup skina nie może obniżać punktów rankingowych.

### Zabezpieczenia przed farmieniem

Nie przyznawaj nagród za:

- Zabijanie botów.
- Samobójstwa.
- Rozgrzewkę.
- Nieprawidłowe lub anulowane rundy.
- Wielokrotne farmienie tego samego gracza.
- Zdarzenia z nieprawidłową liczbą rzeczywistych uczestników.

Wprowadź:

- Minimalną liczbę prawdziwych graczy.
- Konfigurowalny system antyfarm.
- Idempotencję zdarzeń.
- Zabezpieczenie przed wielokrotnym naliczeniem tej samej nagrody.
- Rozliczanie uczestnictwa w rundzie, zamiast bezwarunkowego nagradzania nieaktywnych graczy.

Nie karz przesadnie zwykłych graczy za uczciwą aktywność.

Zapis do bazy danych nie może blokować głównego wątku serwera CS2.

---

# 5. RANGI CLOUDHUB

Wprowadź następujące początkowe rangi:

| Ranga | Punkty RP |
|---|---|
| Bronze | 0–499 |
| Silver | 500–1199 |
| Gold | 1200–2499 |
| Platinum | 2500–4499 |
| Diamond | 4500–7499 |
| Master | 7500+ |

Każda ranga ma mieć:

- Nazwę.
- Ikonę.
- Kolor.
- Próg punktowy.
- Wyświetlanie na stronie WWW.
- Wyświetlanie w CS2UIKit.
- Pasek postępu do kolejnej rangi.

Ranga aktualizuje się automatycznie po zdobyciu lub utracie punktów.

Progi można edytować w panelu OWNER.

Zaprojektuj system w sposób umożliwiający późniejsze dodawanie kolejnych rang.

---

# 6. ODZNAKI NA PROFILACH

**BARDZO WAŻNA FUNKCJA.**

Każdy profil gracza ma automatycznie wyświetlać odpowiednie odznaki.

Odznaki dzielą się na trzy niezależne kategorie.

### A. Odznaka uprawnień

Przykłady:

- 👑 OWNER — właściciel CloudHub.
- ADMIN — administrator.
- MODERATOR — moderator.

Zwykły gracz nie musi mieć widocznej odznaki PLAYER.

### B. Odznaka rangi

Przykłady:

- BRONZE
- SILVER
- GOLD
- PLATINUM
- DIAMOND
- MASTER

Odznaka wynika bezpośrednio z punktów RP zdobytych na serwerze.

### C. Odznaka pozycji w rankingu

Przykłady:

- 🏆 TOP 1
- 🥈 TOP 2
- 🥉 TOP 3
- TOP 4
- TOP 5
- TOP 10

Pozycja musi być wyliczana z faktycznego rankingu. Nie może być wpisana ręcznie.

Przy zmianie pozycji gracza automatycznie aktualizuj odznakę.

Stosuj jednoznaczne zasady remisów i minimalnej aktywności wymaganej do klasyfikacji.

### Przykładowy profil właściciela

`👑 OWNER` `💎 DIAMOND` `🏆 TOP 1`

### Przykładowy profil zwykłego gracza

`GOLD` `TOP 8`

**Wszystkie odznaki muszą być wyświetlane jednocześnie, jeśli gracz spełnia ich warunki.**

Pokazuj je na:

- Profilu gracza.
- Leaderboardzie.
- Karcie gracza.
- Opcjonalnie obok komentarzy i na liście znajomych.

Dodaj możliwość historycznych odznak, np. `SEASON 1 CHAMPION`, które pozostają po zakończeniu sezonu.

---

# 7. SEZONY I LEADERBOARD

Stwórz ranking globalny oraz sezonowy.

Proponowany domyślny okres sezonu: 90 dni, z możliwością konfiguracji.

Po zakończeniu sezonu:

- Zapisz klasyfikację końcową.
- Zachowaj historię statystyk.
- Przyznaj historyczne odznaki za osiągnięcia.
- Rozpocznij nowy sezon zgodnie z konfiguracją.
- Nie usuwaj zakupionych skinów.
- Nie resetuj Cloud Coins.
- Nie kasuj profili i znajomych.

Nie wykonuj automatycznego zerowania rankingu bez zdefiniowanej i zatwierdzonej polityki sezonów.

### Leaderboard na stronie

Dodaj sekcję „Ranking” z:

- TOP 10.
- TOP 50.
- TOP 100.
- Pełnym rankingiem z paginacją.
- Wyszukiwaniem po nicku i SteamID64.
- Rankingiem globalnym.
- Rankingiem sezonowym.
- Historią poprzednich sezonów.
- Sortowaniem po punktach, zabójstwach, K/D, headshotach i win rate.
- Awatarami Steam.
- Rangami.
- Odznakami TOP.
- Linkami do profili.
- Wyróżnieniem zalogowanego gracza i jego pozycji.

Dane muszą być rzeczywiste, nie demonstracyjne.

---

# 8. CLOUD COINS — WALUTA SERWEROWA

Wprowadź walutę:

**Cloud Coins — CC**

Gracz zdobywa CC podczas normalnej gry.

Portfel będzie widoczny:

- Na stronie WWW.
- W profilu gracza.
- W sklepie.
- W GUI CS2UIKit.

Dostępna historia:

- Zarobione CC.
- Wydane CC.
- Nagrody od administratora.
- Zakupy.
- Ewentualne korekty salda.

### Reguły bezpieczeństwa

- Każda operacja zmiany salda musi być atomowa.
- Zakupy nie mogą powodować ujemnego salda.
- Każda transakcja posiada unikalny identyfikator.
- Zapisuj saldo przed operacją i po operacji.
- Zapisuj źródło transakcji.
- Nie pozwalaj na wielokrotne zaksięgowanie tej samej operacji.
- Nie pozwalaj klientowi WWW samodzielnie deklarować zdobytych CC.
- Wszystkie zmiany muszą przechodzić przez autoryzowany backend.

Przewidź również nagrody przyznawane ręcznie za eventy, turnieje i konkursy.

---

# 9. SKLEP SKINÓW — INTEGRACJA Z ISTNIEJĄCYM WEAPONPAINTS

**Nie twórz nowego konfiguratora od zera. Rozbuduj obecny panel skinów CloudHub.**

Aktualna strona posiada już:

- Logowanie Steam.
- Wybór skinów.
- Podglądy broni.
- Integrację z bazą WeaponPaints.
- Zapis konfiguracji skórek użytkownika.

Wykorzystaj istniejące mechanizmy i dodaj ekonomię.

### Model zakupu

Gracz kupuje bazowy skin za Cloud Coins.

Po zakupie otrzymuje trwałe uprawnienie do używania tego skina na serwerze CloudHub.

Zakup jest permanentny.

Gracz nie płaci ponownie za używanie skina ani za jego konfigurację.

Skin nie jest rzeczywistym przedmiotem w ekwipunku Steam. To wyłącznie serwerowe uprawnienie kosmetyczne.

### Kategorie produktów

Obsługuj:

- Skiny broni.
- Noże.
- Rękawice.

Inne przedmioty, takie jak agenci, mogą otrzymać własne produkty, jeśli są obsługiwane przez aktualny WeaponPaints i właściciel zdecyduje się je włączyć.

### Ceny bazowych skinów

Stwórz zróżnicowany, uczciwy cennik.

Proponowane przedziały:

| Kategoria | Cena |
|---|---:|
| Zwykłe, tanie skiny | 50–150 CC |
| Ładne, popularne skiny | 150–500 CC |
| Rzadkie skiny | 500–1100 CC |
| Bardzo wartościowe skiny | 1100–2500 CC |
| Noże i rękawice | 1500–4000 CC |
| Wyjątkowe skiny | maksymalnie około 5000 CC |

To przedziały startowe, nie sztywne reguły.

Cena konkretnego skina powinna uwzględniać:

- Rodzaj przedmiotu.
- Rzadkość.
- Atrakcyjność.
- Popularność.
- Wartość rynkową jako punkt odniesienia, jeśli dostępne są wiarygodne dane.
- Rzeczywisty czas potrzebny do zarobienia odpowiedniej liczby CC.

Nie kopiuj cen Steam Market 1:1.

Nie wyceniaj wszystkich skinów jednakowo.

Nie wyceniaj wszystkich noży jednakowo.

Nie przypisuj zawyżonych cen tylko dlatego, że dany skin jest popularny.

Właściciel musi móc ręcznie zmienić cenę każdego produktu.

---

# 10. BARDZO WAŻNE — CAŁA PERSONALIZACJA SKINÓW JEST DARMOWA

**To ostateczna decyzja projektowa. Zastępuje wszystkie wcześniejsze pomysły dotyczące płatnych naklejek, float, StatTrak i innych dodatków.**

Gracz wydaje Cloud Coins wyłącznie na odblokowanie bazowego skina, noża lub rękawic.

**Wszystkie poniższe elementy personalizacji mają kosztować dokładnie 0 CC:**

- Float / Wear.
- Pattern / Seed.
- Naklejki.
- Wybór naklejek.
- Wszystkie dostępne sloty naklejek.
- Przesuwanie naklejek.
- Skalowanie naklejek.
- Obracanie naklejek.
- Zużycie naklejek.
- Zawieszki / Keychains.
- Zmiana położenia zawieszki.
- StatTrak.
- Licznik StatTrak.
- Nametag.
- Zmiana nazwy broni.
- Zapisywanie konfiguracji.
- Zmiana aktywnej konfiguracji.
- Ponowne wyposażenie zakupionego skina.
- Wszystkie inne zwykłe opcje personalizacji dostępne w WeaponPaints.

### Zasady darmowej personalizacji

1. Po zakupieniu bazowego skina gracz może go dowolnie konfigurować bez kolejnych opłat.
2. Naklejki są darmowe — nie twórz osobnego płatnego sklepu z naklejkami.
3. Zawieszki są darmowe.
4. StatTrak jest darmowy.
5. Nametag jest darmowy.
6. Zmiana float i patternu jest darmowa.
7. Rzadki float lub wyjątkowy pattern również nie wymaga dopłaty.
8. Nie naliczaj dopłat procentowych ani mnożników za float, pattern czy naklejki.
9. Nie pobieraj CC za ponowną edycję lub zapis konfiguracji.
10. Nie wprowadzaj mikropłatności za kosmetyczne zmiany.

Przykład:

Gracz kupuje AK-47 | Redline za 350 CC.

Następnie ustawia:

- Factory New.
- Własny pattern.
- 5 naklejek.
- Zawieszkę.
- StatTrak.
- Własny nametag.

**Łączny koszt nadal wynosi 350 CC.**

Nie 400 CC, nie 575 CC — dokładnie 350 CC.

### Ograniczenia techniczne

Sprawdź, które ustawienia rzeczywiście obsługuje zainstalowana wersja WeaponPaints.

Zweryfikuj:

- Float i jego poprawne zakresy.
- Pattern i dostępne seedy.
- Naklejki oraz ich sloty.
- Pozycję, skalę, rotację i wear naklejek.
- Zawieszki.
- StatTrak.
- Nametag.

Nie pozwalaj zapisać wartości nieprawidłowych lub nieobsługiwanych przez dany przedmiot.

Nie udawaj w podglądzie 3D, że renderer pokazuje ustawienie, którego technicznie nie obsługuje.

### Model zapisu

Oddziel:

- Własność bazowego skina.
- Konfigurację kosmetyczną.
- Aktualnie wyposażony skin.
- Licznik StatTrak.

StatTrak powinien zachowywać licznik przy ponownym założeniu skina, zgodnie z przyjętym modelem przypisania licznika do konkretnej konfiguracji.

Nie mieszaj StatTrak z ogólnymi zabójstwami rankingowymi.

### Presety

Dodaj możliwość zapisania kilku konfiguracji dla posiadanych skinów.

Przykładowo:

- AK-47 Redline — czerwone naklejki.
- AK-47 Redline — inny pattern.
- AK-47 Redline — StatTrak i nametag.

Przełączanie presetów jest darmowe.

---

# 11. BALANS EKONOMII

Ekonomia ma motywować do grania, a nie zmuszać do setek godzin grindowania.

Docelowy czas zdobywania przedmiotów:

| Typ przedmiotu | Docelowy czas |
|---|---|
| Tani skin | 1–3 mecze |
| Średni skin | 3–8 meczów |
| Rzadki skin | 8–20 meczów |
| Nóż lub rękawice | 15–35 meczów |
| Wyjątkowy skin | Ambitny, ale osiągalny cel |

Nie traktuj tych wartości jako gwarancji bez pomiaru.

Wprowadź symulację ekonomii i możliwość jej kalibracji na podstawie rzeczywistych zdarzeń serwera.

Panel OWNER ma pokazywać:

- Średnie CC zdobywane za mecz.
- Średnie CC zdobywane na godzinę.
- Średni czas potrzebny do zakupu skina.
- Liczbę zakupionych skinów.
- Suma CC w obiegu.
- Źródła zarabiania CC.
- Statystyki wydawania CC.

Właściciel musi móc edytować:

- Nagrody CC za wydarzenia.
- Mnożniki ekonomii.
- Progi antyfarm.
- Ceny skinów.
- Aktywność sklepu.

Przed uruchomieniem płatnych zakupów przedstaw propozycję cennika i symulację zarobków do zatwierdzenia.

---

# 12. MIGRACJA ISTNIEJĄCYCH SKINÓW

Obecni gracze mają już zapisane skiny w działającym WeaponPaints.

**Nie wolno im automatycznie odebrać wyposażenia w trakcie budowy nowej ekonomii.**

Wprowadź bezpieczną strategię migracji:

1. Zrób audyt istniejących danych.
2. Przygotuj nowe tabele uprawnień.
3. Zachowaj dotychczasowe konfiguracje.
4. Dodaj możliwość przypisania posiadanych obecnie skinów do nowego modelu uprawnień.
5. Przygotuj tryb podglądu sklepu bez aktywnej blokady.
6. Dodaj konfigurowalny feature flag włączający egzekwowanie własności.
7. Nie włączaj blokady do czasu zatwierdzenia migracji przez OWNER.

Nie zakładaj, że samo ukrycie niedostępnych skinów we frontendzie wystarczy.

Backend i integracja z WeaponPaints muszą sprawdzać własność skina.

Nie wolno umożliwić zakupu za ujemne saldo ani obejścia sklepu przez ręczne wywołania API.

---

# 13. PROFILE GRACZY NA STRONIE WWW

Rozbuduj istniejącą witrynę CloudHub o publiczne profile graczy.

Każdy profil powinien zawierać:

- Avatar Steam.
- Nick Steam.
- SteamID64.
- Rolę użytkownika.
- Odznakę OWNER/ADMIN, jeśli dotyczy.
- Aktualną rangę CS2.
- Odznakę TOP.
- Punkty RP.
- Statystyki.
- K/D.
- Headshoty.
- Wygrane mecze i rundy.
- Win rate.
- Historię sezonów.
- Osiągnięcia.
- Datę ostatniej aktywności.
- Opis profilu.
- Znajomych.
- Komentarze.
- Kolekcję skinów, z uwzględnieniem prywatności.

Saldo Cloud Coins powinno być widoczne właścicielowi konta oraz administratorom z odpowiednimi uprawnieniami; nie publikuj domyślnie informacji finansowych każdego gracza.

### Personalizacja profilu

Zalogowany właściciel konta może:

- Zmienić opis profilu.
- Wybrać baner.
- Wybrać motyw.
- Wybrać dostępne elementy dekoracyjne.
- Zmienić ustawienia prywatności.
- Zarządzać znajomymi.
- Moderować komentarze na własnym profilu.

Nie może ręcznie edytować rangi, punktów, odznak OWNER/TOP, salda CC ani wyników meczowych.

---

# 14. SYSTEM ZNAJOMYCH

Stwórz własny system znajomych CloudHub.

Ma działać niezależnie od listy znajomych Steam.

Funkcje:

- Wysyłanie zaproszeń.
- Akceptowanie zaproszeń.
- Odrzucanie zaproszeń.
- Usuwanie znajomych.
- Blokowanie graczy.
- Przeglądanie listy znajomych.
- Wyszukiwanie użytkowników.
- Pokazywanie ostatniej aktywności, jeśli pozwala na to prywatność.

Zabezpiecz przed spamem zaproszeniami i duplikatami relacji.

---

# 15. KOMENTARZE NA PROFILACH

Zalogowany użytkownik Steam może zostawić komentarz na profilu innego gracza, jeśli ustawienia prywatności na to pozwalają.

Wprowadź:

- Dodawanie komentarzy.
- Wyświetlanie komentarzy.
- Datę i autora.
- Avatar autora.
- Odznaki autora.
- Usuwanie własnych komentarzy.
- Usuwanie komentarzy przez właściciela profilu.
- Moderację administratorów.
- Zgłaszanie komentarzy.
- Blokowanie użytkowników.
- Rate limiting.
- Ochronę przed spamem.
- Ochronę XSS.

Nie renderuj surowego HTML przesłanego przez graczy.

---

# 16. ROLE I UPRAWNIENIA

Zaimplementuj system:

- OWNER.
- ADMIN.
- MODERATOR.
- PLAYER.

### OWNER

Właściciel ma pełny dostęp administracyjny.

Moje konto Steam musi otrzymać rolę OWNER po skonfigurowaniu właściwego SteamID64.

**Nie zgaduj SteamID64 i nie wybieraj automatycznie pierwszego użytkownika jako OWNER.**

Przygotuj bezpieczną konfigurację lub kontrolowany proces pierwszego nadania OWNER.

SteamID64 musi pochodzić ze zweryfikowanej sesji Steam OpenID.

### ADMIN

Uprawnienia zgodne z konfiguracją, np.:

- Zarządzanie graczami.
- Przyznawanie CC.
- Moderacja komentarzy.
- Zarządzanie sklepem.

### MODERATOR

Domyślnie:

- Moderacja profili.
- Moderacja komentarzy.
- Obsługa zgłoszeń.

Bez dostępu do zmiany sald i krytycznych ustawień ekonomicznych, chyba że OWNER wyraźnie przyzna takie uprawnienia.

### PLAYER

Standardowe konto gracza.

**Uprawnienia muszą być egzekwowane w backendzie i na każdym endpointcie API. Samo ukrycie przycisku nie zapewnia bezpieczeństwa.**

---

# 17. PANEL ADMINISTRACYJNY CLOUDHUB

Dodaj osobną zakładkę Administracja dostępną po zalogowaniu przez Steam dla uprawnionych osób.

Panel OWNER powinien zawierać:

### Dashboard

- Liczba wszystkich graczy.
- Aktywność serwera.
- Statystyki ekonomii.
- Liczba transakcji.
- Popularne skiny.
- Najważniejsze działania administratorów.

### Gracze

- Wyszukiwanie po nicku.
- Wyszukiwanie po SteamID64.
- Otwieranie każdego profilu.
- Podgląd statystyk.
- Podgląd rangi.
- Podgląd salda CC.
- Podgląd historii transakcji.
- Podgląd posiadanych skinów.
- Podgląd uprawnień i odznak.

### Zarządzanie Cloud Coins

Możliwość:

- Dodania określonej liczby CC.
- Odjęcia określonej liczby CC.
- Przyznania nagrody grupie graczy.
- Przejrzenia historii operacji.
- Wykonania kontrolowanej korekty pomyłki.

Przykład:

1. Loguję się przez Steam jako OWNER.
2. Otwieram panel administracyjny.
3. Wyszukuję gracza.
4. Klikam „Dodaj Cloud Coins”.
5. Wpisuję `5000`.
6. Podaję powód, np. „Nagroda za event”.
7. Potwierdzam.
8. Backend sprawdza moje uprawnienia.
9. Baza zapisuje transakcję.
10. Gracz otrzymuje 5000 CC i widzi nowe saldo na stronie i w CS2.

Każda zmiana waluty musi posiadać zapis audytowy.

### Zarządzanie sklepem

- Lista wszystkich produktów.
- Indywidualne ceny skinów.
- Automatyczne sugestie cen.
- Ręczna edycja.
- Masowa edycja cen.
- Włączanie i wyłączanie produktów.
- Przyznawanie graczom skinów.
- Cofanie uprawnień do skinów.
- Podgląd zakupów.
- Monitoring balansu ekonomii.

Nie twórz płatnych produktów dla float, pattern, naklejek, zawieszek, StatTrak i nametagów.

Te funkcje są darmowe.

### Zarządzanie rankingiem

- Edycja progów rang.
- Edycja punktacji.
- Zarządzanie sezonami.
- Korekta punktów z zapisem powodu.
- Przegląd logów antyfarm.

### Moderacja

- Zarządzanie komentarzami.
- Przegląd zgłoszeń.
- Blokowanie użytkowników.
- Moderacja publicznych opisów profili.

### Role

OWNER może przyznawać i odbierać odpowiednie role.

Zabezpiecz możliwość podwyższenia własnych uprawnień przez zwykłych administratorów.

---

# 18. GRAFICZNY INTERFEJS CS2 — CS2UIKIT

**Obowiązkowo wykorzystaj:**

https://github.com/nvmxre/cs2-ui-kit

Znane wydanie: `v2.0.0-preview.1`.

Dokumentacja:

https://github.com/nvmxre/cs2-ui-kit/blob/master/README.md

CS2UIKit zapewnia:

- Własne panele Panorama.
- Klikalne elementy.
- Toasty / powiadomienia.
- Głosowania.
- Obsługę wielu paneli.
- Możliwość integracji z klawiszem B.

Nie jest gotowym rankingiem — ranking należy samodzielnie zbudować.

### Wymagane panele CloudHub

**Dashboard**

- Avatar gracza.
- Nick.
- Aktualna ranga.
- Punkty RP.
- Saldo CC.
- Odznaki.
- Skróty do pozostałych ekranów.

**Ranking**

- TOP 10.
- TOP 50.
- TOP 100, z paginacją.
- Avatar i nick gracza.
- Punkty.
- Ranga.
- Odznaki TOP.
- Własna pozycja gracza.

**Profil**

- Statystyki.
- Ranga.
- Postęp do następnej rangi.
- Odznaki.

**Portfel**

- Saldo.
- Ostatnie zdobyte CC.
- Informacje o nagrodach.

**Powiadomienia**

- Otrzymane CC.
- Zdobyte RP.
- Awans rangi.
- Nagroda za osiągnięcie.
- Wyniki wydarzeń i sezonów.

### Komendy

Preferuj komendy używane na czacie przez `/`:

- `/ranking`
- `/rank`
- `/stats`
- `/profil`
- `/top`
- `/saldo`

Sprawdź kolizje z istniejącymi pluginami i nie nadpisuj ich poleceń.

### Wymagania techniczne

Biblioteka wymaga CounterStrikeSharp `1.0.374+`.

Na serwerze jest `1.0.376`, ale kompatybilność musi zostać zweryfikowana.

Do obsługi własnych paneli u klientów wymagany jest dodatek Workshop:

`3807024759`

https://steamcommunity.com/sharedfiles/filedetails/?id=3807024759

Dostarcz go za pomocą MultiAddonManager i `mm_client_extra_addons`, nie `mm_extra_addons`.

Sprawdź zgodność wersji MultiAddonManager z obecnym Metamod.

Nie aktualizuj Metamod w ciemno.

Uwzględnij znane problemy biblioteki, w tym odświeżanie tekstów paneli po wejściu gracza (`UIKit.Rebuild()`), jeśli nadal wymagane.

Najpierw przygotuj bezpieczny prototyp i testy.

Fallback tekstowy może istnieć, ale docelowe GUI musi korzystać z CS2UIKit.

---

# 19. STRONA WWW — ROZBUDOWA ISTNIEJĄCEJ APLIKACJI

Docelowa nawigacja powinna zawierać:

- Strona główna.
- Skins.
- Sklep.
- Ranking.
- Profile.
- Znajomi.
- Mój profil.
- Portfel.
- Administracja — dostępna tylko dla uprawnionych.

### Strona główna

- Informacje o CloudHub.
- TOP 3 graczy.
- Aktualny sezon.
- Skróty do statystyk i sklepu.
- Informacje o serwerze.

### Strona Skinów

Zachowaj obecny panel i jego funkcje.

Dodaj:

- Informację o cenie bazowego skina.
- Informację „Posiadany”.
- Możliwość zakupu za CC.
- Możliwość wyposażenia zakupionego skina.
- Darmową personalizację.
- Darmowe naklejki, StatTrak, nametag i zawieszki.
- Presety konfiguracji.

### Ranking

- Leaderboard.
- Filtry.
- Sezony.
- Rangi.
- Odznaki.
- Linki do profili.

### Mój profil

- Avatar.
- Odznaki.
- Statystyki.
- Opis.
- Personalizacja.
- Znajomi.
- Komentarze.
- Kolekcja skinów.

### Portfel

- Saldo CC.
- Historia zarabiania.
- Historia zakupów.
- Historia nagród.

### Administracja

Pełny panel OWNER zgodny z wymaganiami powyżej.

### Wygląd

Projekt powinien wizualnie pasować do obecnej strony CloudHub.

Zachowaj spójność:

- Kolorów.
- Nawigacji.
- Typografii.
- Kart.
- Przycisków.
- Podglądów skinów.
- Ikon.
- Animacji.

Strona ma być responsywna i wygodna na telefonach.

---

# 20. BAZA DANYCH I MIGRACJE

Przeprowadź audyt istniejącej bazy danych i stwórz bezpieczne migracje.

Przykładowe tabele logiczne:

- `cloudhub_players`
- `cloudhub_profiles`
- `cloudhub_roles`
- `cloudhub_player_roles`
- `cloudhub_player_stats`
- `cloudhub_player_season_stats`
- `cloudhub_seasons`
- `cloudhub_rank_config`
- `cloudhub_wallets`
- `cloudhub_wallet_transactions`
- `cloudhub_shop_products`
- `cloudhub_player_entitlements`
- `cloudhub_equipment_presets`
- `cloudhub_friendships`
- `cloudhub_profile_comments`
- `cloudhub_comment_reports`
- `cloudhub_admin_audit_logs`
- `cloudhub_processed_events`

Dostosuj ostateczne nazwy i relacje do istniejącej architektury.

Koniecznie rozdziel:

- Statystyki.
- Ranking RP.
- Walutę CC.
- Transakcje.
- Własność skinów.
- Ustawienia WeaponPaints.
- Profile.
- Role.
- Komentarze.
- Znajomych.

Nie usuwaj aktualnych tabel `wp_*`.

W aktualnym kodzie WeaponPaints występują m.in.:

- `weapon_wear`
- `weapon_seed`
- `weapon_nametag`
- `weapon_stattrak`
- `weapon_stattrak_count`
- `weapon_sticker_0` ... `weapon_sticker_4`
- `weapon_keychain`

Zweryfikuj produkcyjną wersję schematu przed integracją.

Nie wykonuj destrukcyjnych migracji.

---

# 21. BEZPIECZEŃSTWO

To system, który będzie posiadał walutę, profile, moderację i uprawnienia administratorów.

Wymagane zabezpieczenia:

- Steam OpenID z prawidłową weryfikacją tożsamości.
- Bezpieczne sesje.
- SteamID64 pochodzące z uwierzytelnionej sesji.
- Autoryzacja każdej chronionej operacji.
- Kontrola ról.
- Prepared statements.
- Ochrona XSS.
- Ochrona CSRF.
- Rate limiting.
- Bezpieczne hasła, tokeny i sekrety poza repozytorium.
- Audyt działań administratorów.
- Atomowe transakcje walutowe.
- Idempotencja zakupów.
- Idempotencja zdarzeń meczowych.
- Walidacja ceny po stronie backendu.
- Weryfikacja własności skina po stronie backendu i serwera.
- Bezpieczna komunikacja pomiędzy pluginem CS2 i backendem.
- Zapobieganie ponawianiu i fałszowaniu komunikatów z serwera.
- Ochrona przed manipulowaniem RP i CC.
- Brak możliwości nadania sobie OWNER/ADMIN poprzez API.
- Ograniczenie nadmiernych operacji administracyjnych.
- Kontrola transakcji przy równoczesnych zakupach.

Nie ufaj danym przesyłanym z przeglądarki.

Nie pozwalaj użytkownikom podawać własnej liczby zabójstw, punktów RP ani zdobytych CC.

Przy projektowaniu funkcji społecznościowych uwzględnij prywatność, blokowanie i usuwanie kont lub danych zgodnie z przyjętą polityką.

---

# 22. WYDAJNOŚĆ I STABILNOŚĆ

CS2 Core nie może powodować lagów ani crashy.

Wymagania:

- Unikaj synchronicznych zapisów SQL na głównym wątku CS2.
- Kolejkuj i bezpiecznie rozliczaj zdarzenia.
- Wykorzystuj idempotencję.
- Obsłuż krótkie przerwy w dostępie do bazy.
- Zastosuj mechanizm bezpiecznego ponawiania zapisów.
- Nie wysyłaj nadmiernej liczby zapytań przy każdym ticku.
- Używaj cache z kontrolą aktualności danych.
- Dodaj indeksy SQL.
- Dodaj paginację.
- Testuj obciążenie leaderboardu.
- Obsłuż rozłączanie graczy i zmiany map.
- Nie ingeruj w obecne pluginy.

Przy niedostępności bazy CS2 powinien nadal działać bez blokowania głównego wątku.

---

# 23. KOLEJNOŚĆ IMPLEMENTACJI

Realizuj projekt w etapach.

### ETAP 1 — AUDYT I FUNDAMENTY

- Sprawdź strukturę repozytorium.
- Sprawdź obecny frontend.
- Sprawdź backend PHP.
- Sprawdź logowanie Steam.
- Sprawdź integrację WeaponPaints.
- Sprawdź schemat bazy.
- Zaplanuj architekturę.
- Dodaj migracje.
- Dodaj system kont i ról.
- Dodaj bezpieczną konfigurację OWNER.

Nie zmieniaj produkcyjnej strony skinów.

### ETAP 2 — CLOUDHUB CORE

- Nowy plugin CounterStrikeSharp.
- System statystyk.
- Punkty RP.
- Rangi.
- Sezony.
- Cloud Coins.
- Zdarzenia meczowe.
- Antyfarm.
- Bezpieczny zapis.

### ETAP 3 — API I BACKEND

- Profile.
- Ranking.
- Portfele.
- Transakcje.
- Historia zdarzeń.
- Role.
- Panel administratora.
- Znajomi.
- Komentarze.
- Katalog skinów.
- Uprawnienia do używania skinów.

### ETAP 4 — FRONTEND CLOUDHUB

- Rozbudowa obecnej strony.
- Profile graczy.
- Odznaki OWNER / RANGA / TOP.
- Leaderboard.
- Portfel.
- Znajomi.
- Komentarze.
- Panel administracyjny.
- Katalog skinów z cenami.

### ETAP 5 — EKONOMIA I WEAPONPAINTS

- Balans cen.
- Symulacja zarobków.
- Mechanizm zakupów.
- Ekwipunek.
- Darmowa personalizacja.
- Integracja z WeaponPaints.
- Migracja dotychczasowych skinów.
- Testy kontroli uprawnień.

**Nie włączaj jeszcze produkcyjnego pobierania CC ani blokowania starych skinów bez zgody OWNER.**

### ETAP 6 — CS2UIKIT

- Konfiguracja biblioteki.
- Weryfikacja MultiAddonManager.
- Panel rankingowy.
- Panel profilu.
- Panel portfela.
- Powiadomienia.
- Odznaki.
- Testy GUI w grze.

### ETAP 7 — TESTY I WDROŻENIE

- Test rejestracji i logowania Steam.
- Test naliczania RP.
- Test naliczania CC.
- Test awansowania rang.
- Test leaderboardu.
- Test odznak TOP.
- Test administracyjnego przyznawania CC.
- Test bezpieczeństwa API.
- Test zakupów.
- Test darmowej personalizacji.
- Test migracji WeaponPaints.
- Test zmian map.
- Test restartu serwera.
- Test kompatybilności z istniejącymi pluginami.
- Test wyglądu strony na telefonach.

---

# 24. WARUNKI ZAKOŃCZENIA PROJEKTU

Projekt jest gotowy, gdy:

1. Każdy gracz ma profil powiązany ze SteamID64.
2. Statystyki są zbierane automatycznie w CS2.
3. RP nalicza się poprawnie.
4. Ranga aktualizuje się automatycznie.
5. Cloud Coins są zdobywane za uczciwą grę.
6. Gracz widzi swoje saldo na stronie i w CS2.
7. Leaderboard WWW i CS2 prezentuje zgodne dane.
8. Profile pokazują role, rangi i odznaki TOP.
9. Konto właściciela ma rolę OWNER.
10. OWNER może zarządzać graczami, punktami i saldami.
11. Gracze mogą dodawać znajomych.
12. Gracze mogą komentować profile.
13. Można kupić bazowy skin za CC.
14. Zakupiony skin jest przypisany do konta na stałe.
15. Naklejki są darmowe.
16. Float, wear i pattern są darmowe.
17. StatTrak jest darmowy.
18. Nametag jest darmowy.
19. Zawieszki są darmowe.
20. Presety konfiguracji są darmowe.
21. Zakupione skiny działają w WeaponPaints.
22. System egzekwuje własność skinów po stronie serwera.
23. Dotychczasowa strona skinów nadal działa.
24. Wszystkie istniejące pluginy CS2 nadal działają.
25. Jest gotowa dokumentacja wdrożenia, backupu i rollbacku.

---

# 25. ZASADY PRACY CODEXA

Nie implementuj wszystkiego jako jednej ogromnej zmiany bez testów.

Pracuj etapami i twórz małe, czytelne commity oraz PR-y.

Po każdym etapie podaj:

- Co wykonano.
- Jakie pliki zmieniono.
- Jakie migracje przygotowano.
- Jakie testy wykonano.
- Jakie są ryzyka.
- Co pozostaje do wykonania.
- Czy można bezpiecznie połączyć PR.

Nie zapisuj danych dostępowych do Git.

Nie wykonuj nieodwracalnych zmian na VPS.

Nie używaj danych demonstracyjnych jako rzeczywistych danych rankingu.

Nie zastępuj funkcjonalnej implementacji samym interfejsem graficznym.

Jeśli masz dostęp wyłącznie do GitHub, implementuj kod i przygotuj dokładne instrukcje wdrożenia. Nie zakładaj dostępu do produkcyjnego VPS.

**Nigdy nie wykonuj produkcyjnego deploymentu, migracji produkcyjnej bazy ani restartu CS2 bez mojej wyraźnej zgody.**

Jeżeli nie możesz dokończyć całego projektu w jednej sesji, prowadź plik:

`CLOUDHUB_IMPLEMENTATION_PROGRESS.md`

Uwzględnij w nim:

- Aktualny etap.
- Wykonane funkcje.
- Niewykonane funkcje.
- Ważne decyzje.
- Schemat danych.
- Wymagane konfiguracje.
- Wyniki testów.
- Następne kroki.

---

# 26. ROZPOCZNIJ PRACĘ

**Teraz przeprowadź audyt istniejącej strony CloudHub i rozpocznij ETAP 1.**

Najpierw potwierdź, gdzie znajduje się aktualny kod strony skinów, jak działa logowanie Steam i w jaki sposób backend komunikuje się z bazą WeaponPaints.

Następnie przygotuj oraz zaimplementuj fundamenty systemu użytkowników, ról, rankingów i ekonomii.

Nie zaczynaj od tworzenia nowej strony.

Nie zaczynaj od instalowania nowych pluginów na produkcji.

Nie zmieniaj działającego WeaponPaints.

Nie resetuj baz danych.

Przygotuj architekturę nadającą się do dalszej rozbudowy i rozpocznij rzeczywistą implementację.

**Docelowy rezultat: profesjonalny portal CloudHub połączony z serwerem CS2, z rankingiem, rangami, Cloud Coins, osiągalnym cenowo sklepem skinów, darmową personalizacją, profilami społecznościowymi, odznakami i panelem właściciela.**