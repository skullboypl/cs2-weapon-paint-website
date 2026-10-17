#!/usr/bin/env bash
set -euo pipefail
export CI=true
# Never consume deployment settings during preparation.
for cloudhub_var in $(compgen -e); do
 case "$cloudhub_var" in DB_*|CLOUDHUB_*|MYSQL_*|MARIADB_*|STEAM_API_KEY) unset "$cloudhub_var";; esac
done
cd /workspace/cs2-weapon-paint-website
tools=/workspace/.cloud-tools
mkdir -p "$tools"/{apt/lists/partial,apt/archives/partial,apt/empty,sysroot,bin}
cat > "$tools/apt/apt.conf" <<'EOF'
Dir::Etc::Parts "/workspace/.cloud-tools/apt/empty";
Dir::Etc::sourcelist "/workspace/.cloud-tools/apt/sources.list";
Dir::Etc::sourceparts "/workspace/.cloud-tools/apt/empty";
Dir::State::lists "/workspace/.cloud-tools/apt/lists";
Dir::Cache::archives "/workspace/.cloud-tools/apt/archives";
APT::Get::List-Cleanup "false";
EOF
cat > "$tools/apt/sources.list" <<'EOF'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian-security trixie-security main
EOF
APT_CONFIG="$tools/apt/apt.conf" /usr/bin/apt-get update
APT_CONFIG="$tools/apt/apt.conf" /usr/bin/apt-get -o Debug::NoLocking=true --download-only -y install php8.4-cli php8.4-mysql php8.4-curl mariadb-server mariadb-client chromium php8.4-fpm nginx
for deb in "$tools"/apt/archives/*.deb; do dpkg-deb -x "$deb" "$tools/sysroot"; done
npm install --prefix "$tools" pnpm@10.33.0 --cache /tmp/npm-cache --no-audit --no-fund
cat > "$tools/activate" <<'EOF'
export PATH=/workspace/.cloud-tools/bin:/workspace/.cloud-tools/node_modules/.bin:$PATH
export XDG_DATA_HOME=/workspace/.cloud-tools/share
export XDG_CACHE_HOME=/tmp/cloud-cache
export LD_LIBRARY_PATH=/workspace/.cloud-tools/sysroot/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export PHP_EXTENSION_DIR=/workspace/.cloud-tools/sysroot/usr/lib/php/20240924
export PHPRC=/workspace/.cloud-tools/php.ini
EOF
cat > "$tools/php.ini" <<'EOF'
extension_dir=/workspace/.cloud-tools/sysroot/usr/lib/php/20240924
extension=pdo
extension=mysqlnd
extension=pdo_mysql
extension=mysqli
extension=curl
extension=ctype
extension=fileinfo
extension=tokenizer
session.save_path=/workspace/cs2-weapon-paint-website/backend/storage/sessions
date.timezone=UTC
pdo_mysql.default_socket=/workspace/.cloud-tools/mysql.sock
mysqli.default_socket=/workspace/.cloud-tools/mysql.sock
EOF
ln -sf "$tools/sysroot/usr/bin/php8.4" "$tools/bin/php"
. "$tools/activate"
pnpm install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
# CloudHub Core .NET 10, official artifact verified with SHA-512.
set -euo pipefail
cloudhub_dotnet_root=/workspace/.cloud-tools/dotnet10
if [ ! -x "$cloudhub_dotnet_root/dotnet" ]; then
  curl -fLsS 'https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.112/dotnet-sdk-10.0.112-linux-x64.tar.gz' -o /tmp/cloudhub-dotnet10-sdk.tar.gz
  printf '%s  %s\n' '1ac949dfd3929855e3a102a5b12f843967a784ad2d911dfcfff6abdf81a2e78bccf25ddc055547de02b36133bf792aaf97fcba8db8aa6b52ac2e018b86935d05' /tmp/cloudhub-dotnet10-sdk.tar.gz | sha512sum -c -
  mkdir -p "$cloudhub_dotnet_root"
  tar -xzf /tmp/cloudhub-dotnet10-sdk.tar.gz -C "$cloudhub_dotnet_root"
fi
export PATH="$cloudhub_dotnet_root:$PATH"
export DOTNET_CLI_HOME=/workspace/.cloud-tools/dotnet-home
export NUGET_PACKAGES=/workspace/.cloud-tools/nuget
dotnet --version
php --version
php -r 'exit(extension_loaded("pdo_mysql") ? 0 : 1);'
pnpm --version
cat >> /workspace/.cloud-tools/activate <<'CLOUDHUB_DOTNET_ENV'
export PATH=/workspace/.cloud-tools/dotnet10:$PATH
export DOTNET_CLI_HOME=/workspace/.cloud-tools/dotnet-home
export NUGET_PACKAGES=/workspace/.cloud-tools/nuget
CLOUDHUB_DOTNET_ENV

# Dependency restore only, and only for projects actually present in this checkout.
for cloudhub_project in server/CloudHub.Plugin/CloudHub.Plugin.csproj server/CloudHub.Core.Tests/CloudHub.Core.Tests.csproj; do
 if [ -f "$cloudhub_project" ]; then dotnet restore "$cloudhub_project" --locked-mode; fi
done
