# Design

## Context

iOS universal links already work. On Android, App Links verification fails silently when the signing certificate in assetlinks.json does not match the installed build, and Play App Signing re-signs releases with a different key than our upload key.

## Goals / Non-Goals

**Goals:**
- Verified App Links on Android 9 and newer
- One linking config for both platforms

**Non-Goals:**
- Deferred deep links for fresh installs
- Custom URL schemes

## Decisions

**List both the upload key and the Play signing key.** Debug and internal builds use the upload key, store builds use the Play key; listing both keeps testing and production working.

**Shared route table.** Routes are declared once in the navigation linking config and used for both web links and notification payloads.

## Risks / Trade-offs

- The well-known file is cached by the OS for days; verify with a fresh install after changes
