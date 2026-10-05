# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
