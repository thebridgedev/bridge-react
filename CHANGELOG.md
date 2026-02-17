# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-02-17

### Added

- Install test: `bun run test:install` and CI workflow to verify the packed package installs with React 18 and React 19.

### Changed

- Peer dependencies `react` and `react-dom` updated to include `^19.0.0` for React 19 compatibility.

### Fixed

- Install test script now cleans up `install-test-tmp` and `install-test-pkg.tgz` after run (and on exit).

## [0.2.0] - 2025-02-15

### Changed

- Documentation: README default callback URL corrected to `origin + '/auth/oauth-callback'`.
- Quickstart and examples: consistent "Bridge" product naming.
- Plan service and related hooks for subscription/plan management.

## [0.1.0] - Previous

Initial release.

[0.2.1]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.2.1
[0.2.0]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.1.0
