#!/usr/bin/env bash
set -Eeuo pipefail
/usr/local/sbin/originmetric-web-firewall remove
systemctl disable --now originmetric-web-firewall.service
