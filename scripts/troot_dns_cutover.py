#!/usr/bin/env python3
"""Guarded TROOT Cloudflare DNS switch: manual GitHub Actions only."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

DOMAIN = "rentpay.site"
HOST = "trootwindow.rentpay.site"
OLD = "troot-window.netlify.app"
NEW = "troot-window.pages.dev"
NAMESERVERS = {"curt.ns.cloudflare.com", "riya.ns.cloudflare.com"}
BASE = "https://api.cloudflare.com/client/v4"
CONFIRM = {"inspect": "", "cutover": "SWITCH_TROOT_TO_CLOUDFLARE",
           "rollback": "RESTORE_TROOT_TO_NETLIFY"}


def normal(value):
    return str(value or "").strip().lower().rstrip(".")


def verify_operation(operation, phrase):
    if operation not in CONFIRM or CONFIRM[operation] != phrase:
        raise ValueError("Manual confirmation phrase does not authorize this operation.")


def verify_zone(zone):
    if normal(zone.get("name")) != DOMAIN or zone.get("status") != "active":
        raise ValueError("Expected active rentpay.site zone missing.")
    if {normal(x) for x in zone.get("name_servers", [])} != NAMESERVERS:
        raise ValueError("Authoritative nameservers differ from verified baseline.")
    if not zone.get("id"):
        raise ValueError("Zone ID missing.")
    return zone["id"]


def verify_record(rec):
    if normal(rec.get("name")) != HOST or rec.get("type") != "CNAME":
        raise ValueError("Unexpected TROOT DNS record.")
    if rec.get("proxied") is not False or not rec.get("id"):
        raise ValueError("TROOT CNAME must be DNS-only and have an ID.")
    target = normal(rec.get("content"))
    if target not in {OLD, NEW}:
        raise ValueError("Unexpected current DNS destination.")
    return target


def api(token, method, path, payload=None):
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            response = json.load(r)
    except urllib.error.HTTPError as e:
        raise ValueError("Cloudflare API returned HTTP " + str(e.code)) from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Cloudflare API could not be reached.") from None
    if response.get("success") is not True:
        raise ValueError("Cloudflare API reported failure.")
    return response["result"]


def check_public(url, expect_noindex):
    try:
        with urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent": "troot-migration-safety-check"}), timeout=20) as r:
            if r.status != 200:
                raise ValueError("Public site did not return HTTP 200: " + url)
            noindex = "noindex" in r.headers.get("X-Robots-Tag", "").lower()
            html = r.read(160000).decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Public site unavailable: " + url) from None
    if noindex != expect_noindex:
        raise ValueError("Unexpected indexing signal at " + url)
    if 'href="https://trootwindow.rentpay.site/"' not in html:
        raise ValueError("Canonical URL not preserved at " + url)
    print("PASS: site response, canonical URL and indexing signal: " + url)


def main():
    operation = os.environ.get("OPERATION", "inspect")
    verify_operation(operation, os.environ.get("CONFIRMATION", ""))
    token = os.environ.get("CLOUDFLARE_DNS_TOKEN", "")
    if not token:
        raise ValueError("CLOUDFLARE_RENTPAY_DNS_TOKEN GitHub secret is missing.")
    zones = api(token, "GET", "/zones?" + urllib.parse.urlencode({"name": DOMAIN}))
    matches = [z for z in zones if normal(z.get("name")) == DOMAIN]
    if len(matches) != 1:
        raise ValueError("Token must access exactly one rentpay.site zone.")
    zone_id = verify_zone(matches[0])
    records = api(token, "GET", "/zones/" + zone_id + "/dns_records?"
                  + urllib.parse.urlencode({"name": HOST, "per_page": 100}))
    relevant = [r for r in records if normal(r.get("name")) == HOST]
    if len(relevant) != 1:
        raise ValueError("Expected exactly one DNS record for TROOT.")
    rec = relevant[0]
    current = verify_record(rec)
    print("Current verified TROOT CNAME target: " + current)
    if operation == "inspect":
        check_public("https://troot-window.pages.dev/", True)
        check_public("https://trootwindow.rentpay.site/", False)
        print("READ-ONLY CHECK PASSED. No DNS change made.")
        return
    destination = NEW if operation == "cutover" else OLD
    if current == destination:
        print("Already at requested destination. No DNS change needed.")
        return
    if operation == "cutover":
        if current != OLD:
            raise ValueError("Netlify must be the present CNAME before cutover.")
        check_public("https://troot-window.pages.dev/", True)
        check_public("https://trootwindow.rentpay.site/", False)
    elif current != NEW:
        raise ValueError("Rollback requires the CNAME to currently target Cloudflare Pages.")
    path = "/zones/" + zone_id + "/dns_records/" + rec["id"]
    api(token, "PATCH", path, {
        "type": "CNAME", "name": HOST, "content": destination, "proxied": False
    })
    if verify_record(api(token, "GET", path)) != destination:
        raise ValueError("DNS change could not be verified through Cloudflare API.")
    print("UPDATED: " + HOST + " now points to " + destination)
    print("Verify public TLS, canonical tags and route behavior after DNS propagation.")
    print("Keep the existing Netlify site available for rollback.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)
