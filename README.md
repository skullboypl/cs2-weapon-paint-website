# CloudHub CS2

A responsive CS2 skin studio built with React 19, Vite, PHP and MariaDB. Includes Steam OpenID sign-in, player profiles, separate T/CT loadouts, weapon skins, knives, gloves, agents, five sticker slots, charms, wear/seed, StatTrak, music, pins and private/public saved loadouts.

The CloudHub interface adds a sidebar, searchable/filterable weapon library, dedicated account/help views, responsive navigation, local fonts, optimized real skin artwork and explicit save/error feedback. The PHP API validates session ownership, CSRF tokens, request origins and catalogue values. Steam assertions are verified against a fixed provider endpoint with a one-time session challenge.

- [Local setup, build and tests](docs/TESTING.md)
- [VPS deployment: Nginx / PHP 8.5 / MariaDB](docs/DEPLOYMENT.pl.md)
- [WeaponPaints compatibility](docs/COMPATIBILITY.md)

```bash
pnpm install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
pnpm dev
```

Configure the backend first as described in the local setup guide. The frontend uses same-origin `/api` by default. Production secrets belong in `/etc/cloudhub/config.php`, outside the public directory, selected using `CLOUDHUB_CONFIG`.

```bash
pnpm lint
pnpm build
# Explicit local database socket is required by the test harness:
CLOUDHUB_TEST_SOCKET=/run/mysqld/mysqld.sock pnpm test
pnpm assets:prepare
pnpm release
```

Release output: `releases/cloudhub-cs2-1.0.0.tar.gz`. Only its `public/` directory belongs in the web root. No Node runtime is required on the VPS.

Based on RubLud/cs2-weapon-paint-website and [Nereziel/cs2-WeaponPaints](https://github.com/Nereziel/cs2-WeaponPaints). Skin artwork and item definitions belong to Valve and their respective owners. Not affiliated with Valve, Steam or Counter-Strike. Use on servers you control; this application does not change Steam inventory.
