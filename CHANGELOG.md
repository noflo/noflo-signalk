# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A `signalk/LinearConvert` component for converting raw sensor readings to engineering units with a linear calibration (`(in - offset) / scale`), e.g. deriving amps from a current-sensor voltage path. Unusable readings and configurations produce no output instead of `NaN` or `Infinity`
- A `signalk/RunDailyAt` generator component that fires once per local day when the onboard time reaches one of the configured times (given as an IIP, a single HH:MM string or an array). It fetches `navigation.datetime` and `environment.time.timezoneOffset` itself, so graphs no longer need separate listener nodes for those paths

## [0.3.0] - 2026-10-06

### Changed

- Replaced ESLint with Biome for formatting and linting, renamed the smoke tests to the `test/*.test.js` convention, and require Node.js 22 or later
- Status and error reporting now falls back to the provider-level status API on servers that lack the plugin-level one, log startup and stop failures via `app.error`, and mark the plugin stopped when the runtime shuts down
- CI runs on the shared Signal K plugin workflow (Node.js 22 and 24 on Linux, Linux arm64, macOS and Windows), and the publish workflow uses OIDC with current action versions

### Added

- Descriptions for all plugin configuration fields so the admin UI shows hint text

### Fixed

- Runtime startup failures are now reported to Signal K. A failure to start the main graph is reported with the graph name and the cause, and failures in graph preparation no longer go silently unhandled while the plugin shows as Started
- The plugin's port option is now actually passed to the NoFlo runtime, and the running status reports the port the runtime bound to

## [0.2.2] - 2024-06-11

### Added

- A triggering inport for the `All` component to allow differing timings for the value inputs

## [0.2.1] - 2024-06-08

### Added

- An `All` component for checking that all input values are truthy

## [0.2.0] - 2023-01-12

### Changed

- Now using the community version of NoFlo UI

### Fixed

- Main graph detection
