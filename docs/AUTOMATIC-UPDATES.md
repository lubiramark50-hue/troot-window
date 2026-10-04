# Troot automatic updates

Troot now treats the Git commit SHA as the immutable frontend build identity.

## Web

Every frontend build writes `version.json`. Running Troot clients poll that file every 30 seconds and immediately reload when a newer build is detected. The check is cache-busted and never blocks normal application use.

## Android

The Android workflow already rebuilds the APK whenever `main` changes. A native APK cannot safely replace its own native binary from GitHub; production device updates should therefore be delivered through Google Play or another trusted signed distribution channel. The live-update mechanism above is for the web layer.

## Important boundary

Troot, Ziggo, Stream, and MarkupTV are separate applications. They should not have their complete source trees blindly overwritten by Troot changes. Shared code should be extracted into versioned packages/contracts and consumed by each application. This avoids breaking unrelated products while still allowing one central change to propagate safely.
