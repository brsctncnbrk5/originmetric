#!/usr/bin/env bash
# Isolated command doubles only: no production env, DB, upload, prune or ping.
set -Eeuo pipefail
OM_SOURCE=$(cd "$(dirname "$0")/../.." && pwd)
OM_FIXTURE=$(mktemp -d)
trap 'rm -rf "$OM_FIXTURE"' EXIT
mkdir -p "$OM_FIXTURE/"{scripts/vps,mock,.runtime,remote}
cp "$OM_SOURCE/scripts/vps/"{common,backup}.sh "$OM_FIXTURE/scripts/vps/"
printf 'AGE_RECIPIENT=age1fixture\nBACKUP_REMOTE=fixture:bucket/originmetric\n' > "$OM_FIXTURE/.env.production"
chmod 600 "$OM_FIXTURE/.env.production"
printf 'fixture\n' > "$OM_FIXTURE/.runtime/current-tag"
cat > "$OM_FIXTURE/mock/docker" <<'MOCK'
#!/usr/bin/env bash
printf 'synthetic dump'
MOCK
cat > "$OM_FIXTURE/mock/age" <<'MOCK'
#!/usr/bin/env bash
cat >/dev/null
printf 'synthetic ciphertext'
MOCK
cat > "$OM_FIXTURE/mock/rclone" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$1" >> "$OM_TEST_LOG"
case $1 in
  copyto) cp "$2" "$OM_TEST_REMOTE" ;;
  ls) printf '%s object\n' "$(stat -c %s "$OM_TEST_REMOTE")" ;;
  cat)
    case $OM_TEST_MODE in
      corrupt) printf 'Synthetic ciphertext' ;; # same length, different bytes
      readfail) cat "$OM_TEST_REMOTE"; exit 9 ;;
      *) cat "$OM_TEST_REMOTE" ;;
    esac ;;
  lsf) printf 'originmetric-2000-01-%02d.dump.age\n' {1..9} ;;
  deletefile) : ;;
  *) exit 8 ;;
esac
MOCK
chmod +x "$OM_FIXTURE/mock/"*
export PATH="$OM_FIXTURE/mock:$PATH"
export OM_TEST_LOG="$OM_FIXTURE/.runtime/test.log"
export OM_TEST_REMOTE="$OM_FIXTURE/remote/object"
cd "$OM_FIXTURE"
for OM_TEST_MODE in corrupt readfail valid; do
  export OM_TEST_MODE
  : > "$OM_TEST_LOG"
  rm -f .runtime/last-backup-size
  if bash scripts/vps/backup.sh > .runtime/result 2>&1; then
    [[ $OM_TEST_MODE == valid ]]
    [[ -f .runtime/last-backup-size ]]
    [[ $(grep -c '^cat$' "$OM_TEST_LOG") == 3 ]]
    grep -q '^deletefile$' "$OM_TEST_LOG"
  else
    [[ $OM_TEST_MODE != valid ]]
    [[ ! -e .runtime/last-backup-size ]]
    ! grep -Eq '^(lsf|deletefile)$' "$OM_TEST_LOG"
    ! grep -q 'backup CREATED' .runtime/result
  fi
done
printf '%s\n' 'Backup readback PASS: equal-size corruption/read failure block success and retention; three valid class readbacks pass.'
