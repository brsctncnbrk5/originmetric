#!/usr/bin/env bash
# No Docker/host mutations: exercise deploy failure paths with bounded command doubles.
set -Eeuo pipefail
OM_SOURCE=$(cd "$(dirname "$0")/../.." && pwd)
OM_FIXTURE=$(mktemp -d)
trap 'rm -rf "$OM_FIXTURE"' EXIT
mkdir -p "$OM_FIXTURE/scripts/vps" "$OM_FIXTURE/mock" "$OM_FIXTURE/.runtime"
cp "$OM_SOURCE/scripts/deploy.sh" "$OM_FIXTURE/scripts/"
cp "$OM_SOURCE/scripts/vps/"{common,init-env,preflight,smoke}.sh "$OM_FIXTURE/scripts/vps/"
cat > "$OM_FIXTURE/scripts/vps/backup.sh" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
cat > "$OM_FIXTURE/mock/git" <<'MOCK'
#!/usr/bin/env bash
if [[ $* == 'rev-parse HEAD' ]]; then printf '%s\n' "$OM_NEW_SHA"; fi
MOCK
cat > "$OM_FIXTURE/mock/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s %s\n' "${APP_TAG:-unset}" "$*" >> "$OM_MOCK_LOG"
if [[ $* == 'compose version --short' ]]; then printf '2.27.0\n'; fi
if [[ $* == *'exec -T app node'* && ${APP_TAG:-} == "$OM_NEW_SHA" ]]; then exit 1; fi
MOCK
cat > "$OM_FIXTURE/mock/curl" <<'MOCK'
#!/usr/bin/env bash
if [[ ${APP_TAG:-} == "$OM_NEW_SHA" ]]; then exit 22; fi
if [[ $* == *'%{http_code}'* ]]; then
  if [[ $* == *'/api/v1/e'* ]]; then printf 202; else printf 404; fi
elif [[ $* == *'/api/health'* ]]; then printf '{"status":"ok"}';
else printf 'tracker'; fi
MOCK
cat > "$OM_FIXTURE/mock/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$OM_FIXTURE/mock/"*
export PATH="$OM_FIXTURE/mock:$PATH"
export OM_NEW_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export OM_OLD_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
export OM_MOCK_LOG="$OM_FIXTURE/.runtime/mock.log"
cd "$OM_FIXTURE"
bash scripts/vps/init-env.sh >/dev/null
OM_CHECKSUM=$(sha256sum .env.production)
if bash scripts/vps/init-env.sh >/dev/null 2>&1; then echo 'init overwrote existing secrets' >&2; exit 1; fi
[[ $(sha256sum .env.production) == "$OM_CHECKSUM" ]]
printf '%s\n' "$OM_OLD_SHA" > .runtime/current-tag
if bash scripts/deploy.sh "$OM_NEW_SHA" > .runtime/with-old.log 2>&1; then echo 'failed deploy returned success' >&2; exit 1; fi
[[ $(cat .runtime/current-tag) == "$OM_OLD_SHA" ]]
grep -q 'Previous app restored' .runtime/with-old.log
grep -q "$OM_OLD_SHA.*up -d --no-deps app caddy" .runtime/mock.log
rm .runtime/current-tag
if bash scripts/deploy.sh "$OM_NEW_SHA" > .runtime/first.log 2>&1; then echo 'first failure returned success' >&2; exit 1; fi
grep -q 'stop app caddy' .runtime/mock.log
grep -q 'DB preserved' .runtime/first.log
printf '%s\n' 'Deploy control proof PASS: no secret overwrite, prior tag rollback + health, first-deploy stop with DB preservation.'
