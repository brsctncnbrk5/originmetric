#!/usr/bin/env bash
# Read-only audit, intentionally independent of Docker/.env setup.
set -Eeuo pipefail
printf '%s\n' 'OriginMetric VPS audit (no mutations / no secret files read)'
uname -sr
cat /etc/os-release | sed -n 's/^PRETTY_NAME=//p'
free -h
df -h /opt
ss -ltn '( sport = :22 or sport = :80 or sport = :443 or sport = :8088 or sport = :5432 )'
if command -v docker >/dev/null; then
  docker compose version || true
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
fi
if command -v ufw >/dev/null; then ufw status || true; fi
if command -v iptables >/dev/null; then iptables -S DOCKER-USER 2>/dev/null || true; fi
if command -v nft >/dev/null; then nft list tables || true; fi
printf '%s\n' 'Do not change existing listeners/firewall until topology is reviewed.'
