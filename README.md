# Load Estimator

Load Estimator is a static progressive web application for electrical load estimation. It is designed around Ghanaian distribution assumptions so you can estimate:

- connected load in `W`, `kW`, `VA`, `kVA`, or `hp`
- diversified and design demand in `kW` and `kVA`
- service current at `230 V`, `400 V`, `11 kV`, and `33 kV`
- meter class recommendation: residential, commercial, or SLT
- provisional SLT feeder guidance: LV service, `11 kV`, or `33 kV`
- monthly energy and a tariff-based monthly bill estimate

## Running locally

```bash
npm run serve
```

Then open `http://localhost:4173`.

## Railway database

The app uses `data/app-db.json` when no database is configured. For Railway Postgres, set `DATABASE_URL` in Railway or in a local `.env` file based on `.env.example`, then restart the server.

When `DATABASE_URL` is present, the server stores users, sessions, reset tokens, tariff rows, and audit events in Postgres. It also creates `app_users`, `app_tariff_rates`, and `app_audit_events` for user records and data analysis.

## Running tests

```bash
npm test
```

## Mobile packaging

This project is now prepared for Capacitor so it can be packaged for Android and iPhone.

Useful commands:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Open the native projects with:

```bash
npm run mobile:open:android
npm run mobile:open:ios
```

Notes:

- Android builds and Play Store submission are handled through Android Studio.
- The iPhone project can be generated here, but App Store submission still requires Xcode on macOS for signing, archiving, and upload.
- The current mobile app identifier is `com.loadestimator.mobile`. Change it before final store submission if you want a different bundle/package name.

## Engineering model

The calculator uses this chain:

1. Convert each load item to real power in `kW`.
2. Apply quantity to obtain connected load.
3. Apply per-item demand factor to get diversified item demand.
4. Apply a project diversity factor to get group demand.
5. Apply growth margin to obtain design demand.
6. Convert to current at the relevant service voltage.

## Ghana-specific rules used

- ECG LV basis: `230 V` single-phase and `400 V` three-phase at `50 Hz`.
- ECG notes that demands above `800 kW` may be supplied at `11 kV` or `33 kV`.
- PURC rate-setting guidance is used for the `100 kVA` boundary between ordinary service and SLT planning.
- Tariff profile included: PURC electricity rates effective `April 1, 2026`.

## Important note

The meter recommendation and feeder guidance are engineering pre-screens, not a replacement for utility connection studies, protection coordination, or approval processes. LV and MV current ceilings inside the app are editable engineering defaults so utilities or consultants can tune them to their own standards.
