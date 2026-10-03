#!/usr/bin/env bash
# Host audit: nginx owns eth0 TCP 80/443; app/DB are unpublished.
# Changes only dedicated web chains/jumps. Existing SSH/Docker rules survive.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
OM_ACTION=${1:-apply}
[[ $OM_ACTION == apply || $OM_ACTION == remove ]] || exit 2
OM_CF_RANGE_DIR=${OM_CF_RANGE_DIR:-/etc/originmetric/firewall}

if [[ $OM_ACTION == apply ]]; then
  # Validate both families before the first firewall mutation.
  python3 - "$OM_CF_RANGE_DIR" <<'PY'
import ipaddress, pathlib, sys
for version in (4, 6):
    rows = pathlib.Path(sys.argv[1], f'cloudflare-v{version}.txt').read_text().splitlines()
    assert rows and len(rows) == len(set(rows)), 'Empty/duplicate source ranges'
    for row in rows:
        net = ipaddress.ip_network(row, strict=True)
        assert net.version == version and row == str(net), 'Invalid source range'
        assert net.network_address.is_global and net.broadcast_address.is_global, 'Non-global range'
PY
  # Populate and verify both detached chains before attaching any jumps.
  for OM_VERSION in 4 6; do
    OM_TOOL=iptables
    [[ $OM_VERSION == 6 ]] && OM_TOOL=ip6tables
    OM_CHAIN=OM_CF_WEB$OM_VERSION
    mapfile -t OM_RANGES < "$OM_CF_RANGE_DIR/cloudflare-v$OM_VERSION.txt"
    if ! "$OM_TOOL" -w -S "$OM_CHAIN" >/dev/null 2>&1; then
      "$OM_TOOL" -w -N "$OM_CHAIN"
      for OM_RANGE in "${OM_RANGES[@]}"; do
        "$OM_TOOL" -w -A "$OM_CHAIN" -p tcp -s "$OM_RANGE" -j RETURN
      done
      "$OM_TOOL" -w -A "$OM_CHAIN" -j DROP
    fi
    # Fail closed on drift; range refresh requires a separately reviewed update.
    OM_RULE_COUNT=$("$OM_TOOL" -w -S "$OM_CHAIN" | rg -c '^-A ')
    [[ $OM_RULE_COUNT == $((${#OM_RANGES[@]} + 1)) ]]
    for OM_RANGE in "${OM_RANGES[@]}"; do
      "$OM_TOOL" -w -C "$OM_CHAIN" -p tcp -s "$OM_RANGE" -j RETURN
    done
    [[ $("$OM_TOOL" -w -S "$OM_CHAIN" | tail -n 1) == "-A $OM_CHAIN -j DROP" ]]
  done
fi

for OM_VERSION in 4 6; do
  OM_TOOL=iptables
  [[ $OM_VERSION == 6 ]] && OM_TOOL=ip6tables
  OM_CHAIN=OM_CF_WEB$OM_VERSION
  for OM_PROTOCOL in tcp udp; do
    OM_RULE=(-i eth0 -p "$OM_PROTOCOL" -m multiport --dports 80,443 -m comment --comment originmetric-cloudflare-web -j "$OM_CHAIN")
    if [[ $OM_ACTION == apply ]]; then
      "$OM_TOOL" -w -C INPUT "${OM_RULE[@]}" 2>/dev/null || "$OM_TOOL" -w -I INPUT 1 "${OM_RULE[@]}"
    else
      while "$OM_TOOL" -w -C INPUT "${OM_RULE[@]}" 2>/dev/null; do
        "$OM_TOOL" -w -D INPUT "${OM_RULE[@]}"
      done
    fi
  done
  if [[ $OM_ACTION == remove ]] && "$OM_TOOL" -w -S "$OM_CHAIN" >/dev/null 2>&1; then
    # Only this owned chain; never flush INPUT, Docker or a shared ruleset.
    "$OM_TOOL" -w -F "$OM_CHAIN"
    "$OM_TOOL" -w -X "$OM_CHAIN"
  fi
done
