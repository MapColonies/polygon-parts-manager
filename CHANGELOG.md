# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.6.0](https://github.com/MapColonies/polygon-parts-manager/compare/v1.5.2...v1.6.0) (2025-03-10)


### Features

* find polygon parts (MAPCO-6251) ([#39](https://github.com/MapColonies/polygon-parts-manager/issues/39)) ([5aae7c4](https://github.com/MapColonies/polygon-parts-manager/commit/5aae7c430b04d0ebeb196c2225ba49b58e8e8776)), closes [#41](https://github.com/MapColonies/polygon-parts-manager/issues/41)


### Bug Fixes

* removing max_old_space_size from Dockerfile ([#40](https://github.com/MapColonies/polygon-parts-manager/issues/40)) ([69b8435](https://github.com/MapColonies/polygon-parts-manager/commit/69b8435d6cd84f771546cc0b7fcf99c72affb57a))

### [1.5.2](https://github.com/MapColonies/polygon-parts-manager/compare/v1.5.1...v1.5.2) (2025-02-03)


### Bug Fixes

* correct bufferStyleParameters in helm values ([#38](https://github.com/MapColonies/polygon-parts-manager/issues/38)) ([ce872e2](https://github.com/MapColonies/polygon-parts-manager/commit/ce872e2b1c084f5c8acf938df2cbc3419fd731cb))

### [1.5.1](https://github.com/MapColonies/polygon-parts-manager/compare/v1.5.0...v1.5.1) (2025-02-03)


### Bug Fixes

* correct bufferStyleParameters format in configuration files ([#37](https://github.com/MapColonies/polygon-parts-manager/issues/37)) ([c40812f](https://github.com/MapColonies/polygon-parts-manager/commit/c40812f74fedc79ec9bab89d90fe7c62bd2d9046))

## [1.5.0](https://github.com/MapColonies/polygon-parts-manager/compare/v1.4.2...v1.5.0) (2025-02-03)


### Features

* aggregation buffer style ([#36](https://github.com/MapColonies/polygon-parts-manager/issues/36)) ([7fbe2c8](https://github.com/MapColonies/polygon-parts-manager/commit/7fbe2c876a2b6cc11a628ff93cf9f2f267933222))
* aggregation simplification (MAPCO-6591) ([#35](https://github.com/MapColonies/polygon-parts-manager/issues/35)) ([db1099e](https://github.com/MapColonies/polygon-parts-manager/commit/db1099ed70348954fe38e9ae9b3febf6d0ae79e6))

### [1.4.2](https://github.com/MapColonies/polygon-parts-manager/compare/v1.4.1...v1.4.2) (2025-02-02)


### Bug Fixes

* handle empty geometries of small footprints ([#34](https://github.com/MapColonies/polygon-parts-manager/issues/34)) ([2f1228f](https://github.com/MapColonies/polygon-parts-manager/commit/2f1228f55b792d29e3b4ceb8a0fc21a6f2236f26))

### [1.4.1](https://github.com/MapColonies/polygon-parts-manager/compare/v1.4.0...v1.4.1) (2025-01-28)


### Bug Fixes

* aggregation causes connection termination ([#32](https://github.com/MapColonies/polygon-parts-manager/issues/32)) ([48f91db](https://github.com/MapColonies/polygon-parts-manager/commit/48f91dbaaed8bc06b1c5de2847b40854a84c67db))
* calculate polygon parts stored procedure (MAPCO-6442) ([#33](https://github.com/MapColonies/polygon-parts-manager/issues/33)) ([110768a](https://github.com/MapColonies/polygon-parts-manager/commit/110768a54df7b878bd6f31c82ad59e4d7ce338eb))

## [1.4.0](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.6...v1.4.0) (2024-12-25)


### Features

* aggregation footprint ([#31](https://github.com/MapColonies/polygon-parts-manager/issues/31)) ([84d301a](https://github.com/MapColonies/polygon-parts-manager/commit/84d301a99d67522639f862c13ba7624ead11e122))

### [1.3.6](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.5...v1.3.6) (2024-12-22)


### Bug Fixes

* make child tables inherit parents ([#29](https://github.com/MapColonies/polygon-parts-manager/issues/29)) ([c2b3b88](https://github.com/MapColonies/polygon-parts-manager/commit/c2b3b8885ea63ee8165528ae6e832688e40253b9))

### [1.3.5](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.4...v1.3.5) (2024-12-16)


### Bug Fixes

* change collation to match pg version in other networks ([#30](https://github.com/MapColonies/polygon-parts-manager/issues/30)) ([6c44135](https://github.com/MapColonies/polygon-parts-manager/commit/6c44135c318a0b2fb100328064818b98b4487e12))
* changed horizontal accuracy initial type to numeric ([#28](https://github.com/MapColonies/polygon-parts-manager/issues/28)) ([5170cbb](https://github.com/MapColonies/polygon-parts-manager/commit/5170cbb80f5004e7f9bf099ac20f9c8199159239))
* save (MAPCO-5565) ([#26](https://github.com/MapColonies/polygon-parts-manager/issues/26)) ([dcacdfe](https://github.com/MapColonies/polygon-parts-manager/commit/dcacdfe27c9be7f793c51f53fbd4f41f50a076c8))

### [1.3.4](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.3...v1.3.4) (2024-12-11)


### Bug Fixes

* changed horizontal accuracies to numeric (MAPCO-5791) ([#24](https://github.com/MapColonies/polygon-parts-manager/issues/24)) ([6c8bcdd](https://github.com/MapColonies/polygon-parts-manager/commit/6c8bcdd35f20d4f1f1437256e4ddc0b2552e190c))

### [1.3.3](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.2...v1.3.3) (2024-12-08)


### Bug Fixes

* modify aggregation logic (MAPCO-5636) ([#23](https://github.com/MapColonies/polygon-parts-manager/issues/23)) ([d11408d](https://github.com/MapColonies/polygon-parts-manager/commit/d11408d482f24e9a09a9bd7bd859c07ba3e35f0f))

### [1.3.2](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.1...v1.3.2) (2024-12-02)


### Bug Fixes

* implementation ([#22](https://github.com/MapColonies/polygon-parts-manager/issues/22)) ([3395872](https://github.com/MapColonies/polygon-parts-manager/commit/339587214c0711854e524396547d6ae0312a0c2a))

### [1.3.1](https://github.com/MapColonies/polygon-parts-manager/compare/v1.3.0...v1.3.1) (2024-11-27)

## [1.3.0](https://github.com/MapColonies/polygon-parts-manager/compare/v1.2.1...v1.3.0) (2024-11-26)


### Features

* aggregation ([#19](https://github.com/MapColonies/polygon-parts-manager/issues/19)) ([53f44b9](https://github.com/MapColonies/polygon-parts-manager/commit/53f44b9a056a34b836f1207cb47ef2c1a42bd94a))

### [1.2.1](https://github.com/MapColonies/polygon-parts-manager/compare/v1.2.0...v1.2.1) (2024-11-20)


### Bug Fixes

* upgarde git workflow files ([#16](https://github.com/MapColonies/polygon-parts-manager/issues/16)) ([02bff82](https://github.com/MapColonies/polygon-parts-manager/commit/02bff827e41130c3a5bacc9120114d284771531a))

## 1.2.0 (2024-11-20)


### Features

* initial polygon parts ingestion (MAPCO-4710) ([#9](https://github.com/MapColonies/polygon-parts-manager/issues/9)) ([d529728](https://github.com/MapColonies/polygon-parts-manager/commit/d5297280d79edf4737cf8eb132c588da79139ffe))
* insert polygon parts ([#2](https://github.com/MapColonies/polygon-parts-manager/issues/2)) ([5ad4064](https://github.com/MapColonies/polygon-parts-manager/commit/5ad4064581d722bd95f27d3c8dc19b0db0d2b54c))
* schema generator stored procedure ([#7](https://github.com/MapColonies/polygon-parts-manager/issues/7)) ([086a56d](https://github.com/MapColonies/polygon-parts-manager/commit/086a56dcb71bef984edbaa457d19775960426df6))
* update new procedures naming conventions (MAPCO-4206) ([#3](https://github.com/MapColonies/polygon-parts-manager/issues/3)) ([c2324d7](https://github.com/MapColonies/polygon-parts-manager/commit/c2324d73c1a05272819797c4be152904f440762a))
* Update pp functionality (MAPCO-4748) ([#17](https://github.com/MapColonies/polygon-parts-manager/issues/17)) ([1fa5860](https://github.com/MapColonies/polygon-parts-manager/commit/1fa5860f763457bb679fb953196438f3f90472c6))
* update schemas ([#1](https://github.com/MapColonies/polygon-parts-manager/issues/1)) ([d4ee9e1](https://github.com/MapColonies/polygon-parts-manager/commit/d4ee9e1d7056b89453627545a752a42c9b8f9e9b))
* use execute for dynamic sql commands ([#6](https://github.com/MapColonies/polygon-parts-manager/issues/6)) ([0ec10e1](https://github.com/MapColonies/polygon-parts-manager/commit/0ec10e1faecc18473fbd2298fa8e67f958c1ca0a))


### Bug Fixes

* add product_id product_type to store procedures ([#5](https://github.com/MapColonies/polygon-parts-manager/issues/5)) ([e15ddec](https://github.com/MapColonies/polygon-parts-manager/commit/e15ddecd6f04d3d20b9b7f6660266efd1ae9212a))
* connection manager ([#14](https://github.com/MapColonies/polygon-parts-manager/issues/14)) ([d3ed2e8](https://github.com/MapColonies/polygon-parts-manager/commit/d3ed2e8e1a2f8ec5440b09bd7f28ed3963d9178a))
* helm ([#11](https://github.com/MapColonies/polygon-parts-manager/issues/11)) ([c6a40b7](https://github.com/MapColonies/polygon-parts-manager/commit/c6a40b7ccb3f2a9f12089c34732c701d4aca3bd7))
* product type ([#13](https://github.com/MapColonies/polygon-parts-manager/issues/13)) ([9e304ad](https://github.com/MapColonies/polygon-parts-manager/commit/9e304ad9cd8377155b408fea8e7e9c15719800e7))

## 1.1.0 (2024-10-15)


### Features

* initial polygon parts ingestion (MAPCO-4710) ([#9](https://github.com/MapColonies/polygon-parts-manager/issues/9)) ([d529728](https://github.com/MapColonies/polygon-parts-manager/commit/d5297280d79edf4737cf8eb132c588da79139ffe))
* insert polygon parts ([#2](https://github.com/MapColonies/polygon-parts-manager/issues/2)) ([5ad4064](https://github.com/MapColonies/polygon-parts-manager/commit/5ad4064581d722bd95f27d3c8dc19b0db0d2b54c))
* schema generator stored procedure ([#7](https://github.com/MapColonies/polygon-parts-manager/issues/7)) ([086a56d](https://github.com/MapColonies/polygon-parts-manager/commit/086a56dcb71bef984edbaa457d19775960426df6))
* update new procedures naming conventions (MAPCO-4206) ([#3](https://github.com/MapColonies/polygon-parts-manager/issues/3)) ([c2324d7](https://github.com/MapColonies/polygon-parts-manager/commit/c2324d73c1a05272819797c4be152904f440762a))
* update schemas ([#1](https://github.com/MapColonies/polygon-parts-manager/issues/1)) ([d4ee9e1](https://github.com/MapColonies/polygon-parts-manager/commit/d4ee9e1d7056b89453627545a752a42c9b8f9e9b))
* use execute for dynamic sql commands ([#6](https://github.com/MapColonies/polygon-parts-manager/issues/6)) ([0ec10e1](https://github.com/MapColonies/polygon-parts-manager/commit/0ec10e1faecc18473fbd2298fa8e67f958c1ca0a))


### Bug Fixes

* add product_id product_type to store procedures ([#5](https://github.com/MapColonies/polygon-parts-manager/issues/5)) ([e15ddec](https://github.com/MapColonies/polygon-parts-manager/commit/e15ddecd6f04d3d20b9b7f6660266efd1ae9212a))
* helm ([#11](https://github.com/MapColonies/polygon-parts-manager/issues/11)) ([c6a40b7](https://github.com/MapColonies/polygon-parts-manager/commit/c6a40b7ccb3f2a9f12089c34732c701d4aca3bd7))
* product type ([#13](https://github.com/MapColonies/polygon-parts-manager/issues/13)) ([9e304ad](https://github.com/MapColonies/polygon-parts-manager/commit/9e304ad9cd8377155b408fea8e7e9c15719800e7))
