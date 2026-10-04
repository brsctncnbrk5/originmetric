#!/usr/bin/env bash
# Audited host topology: eth0 is public; ports below have no unrelated listeners.
# Never flush chains or change policies. Docker destinations are OriginMetric-only.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
OM_ACTION=${1:-apply}
[[ $OM_ACTION == apply || $OM_ACTION == remove ]] || exit 2
for OM_TOOL in iptables ip6tables; do
  OM_RULE=(-i eth0 -p tcp -m multiport --dports 3000,5432,8088 -m comment --comment originmetric-private-ports -j DROP)
  if [[ $OM_ACTION == apply ]]; then
    "$OM_TOOL" -w -C INPUT "${OM_RULE[@]}" 2>/dev/null || "$OM_TOOL" -w -I INPUT 1 "${OM_RULE[@]}"
  else
    if "$OM_TOOL" -w -C INPUT "${OM_RULE[@]}" 2>/dev/null; then "$OM_TOOL" -w -D INPUT "${OM_RULE[@]}"; fi
  fi
  for OM_NETWORK in originmetric_backend originmetric_proxy; do
    OM_ID=$(docker network inspect --format '{{.Id}}' "$OM_NETWORK")
    OM_BRIDGE=br-${OM_ID:0:12}
    OM_RULE=(-i eth0 -o "$OM_BRIDGE" -m conntrack ! --ctstate ESTABLISHED,RELATED -m comment --comment originmetric-container-ingress -j DROP)
    if [[ $OM_ACTION == apply ]]; then
      "$OM_TOOL" -w -C DOCKER-USER "${OM_RULE[@]}" 2>/dev/null || "$OM_TOOL" -w -I DOCKER-USER 1 "${OM_RULE[@]}"
    else
      if "$OM_TOOL" -w -C DOCKER-USER "${OM_RULE[@]}" 2>/dev/null; then "$OM_TOOL" -w -D DOCKER-USER "${OM_RULE[@]}"; fi
    fi
  done
done
