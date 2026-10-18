#!/usr/bin/env bash
set -euo pipefail
base_url="${1:?Pass the draft preview URL}"
html_file="$(mktemp)"
trap 'rm -f "$html_file"' EXIT
curl --fail --silent --show-error --location --max-time 20 "$base_url" -o "$html_file"
grep -Eqi '<html|<!doctype html' "$html_file"
assets="$(grep -Eo '(src|href)="/assets/[^"]+\.(js|css)(\?[^"]*)?"' "$html_file" | sed -E 's/^(src|href)="([^"]+)"$/\2/' | sort -u)"
test -n "$assets"
while IFS= read -r asset; do
  test -n "$asset"
  curl --fail --silent --show-error --location --max-time 20 "${base_url%/}${asset}" -o /dev/null
done <<< "$assets"
echo "Preview HTML and $(printf '%s\n' "$assets" | wc -l | tr -d ' ') JS/CSS asset(s) returned successful HTTP responses."
