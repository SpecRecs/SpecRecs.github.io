# SpecRecs: Dataset Options

Research notes on where SpecRecs can get PC hardware specs and benchmark scores. Written 2026-10-17.

**Status:** research only. Nothing below has been downloaded or tested except the TechPowerUp API (queried live on 2026-10-17) and the docyx RAM, motherboard and PSU files (already vendored in `data/`). Field lists and licenses come from each source's own page. Items marked **unverified** were not confirmed.

---

## 1. Why this research was needed

The "My PC" page (`build.html`, `build.js`) uses the TechPowerUp (TPU) free API for GPU, CPU and storage. That API only returns part of its data.

Live check, 2026-10-17:

| Endpoint | Query | Total matches | Full records returned | Withheld |
|---|---|---|---|---|
| `gpu-specs/api/v1/cards` | `rtx` | 239 (of 3,387 cards) | 23 | 216 |
| `cpu-specs/api/v1/chips` | `ryzen` | 489 (of 4,508 chips) | 16 | 473 |
| `ssd-specs/api/v1/drives` | `990` | 25 (of 3,165 drives) | 3 | 22 |

- The search covers the whole database, but only a small sample comes back as full records.
- The rest is replaced by a `{"_type":"withheld"}` entry: "N remaining records not shown. Contact w1zzard@techpowerup.com for a commercial license to access the full dataset."
- `build.js` drops the withheld entry, so a specific part (for example "RTX 4070") can be missing from search results.
- The free tier is for academic and research use. A public or commercial SpecRecs needs a license.
- It is unverified how the free subset is chosen. The same part may be shown or hidden depending on the query.

Other open gaps from `user_pc_plan.md`: no CPU benchmark score, and PSU efficiency `"plus"` is unverified.

---

## 2. Summary table

| # | Source | Covers | License | Benchmark / performance score | Format |
|---|---|---|---|---|---|
| 1 | docyx/pc-part-dataset | CPU, GPU, storage and about 25 other categories | MIT (repo); data scraped from PCPartPicker | No | JSON, JSONL, CSV |
| 2 | GPU Ark | 13,566 GPUs (1999-2025) | CC BY 4.0 | Partly (993 benchmark rows, compute and AI focused) | CSV, SQLite |
| 3 | Blender Open Data | CPUs and GPUs that have been benchmarked | Public domain | Yes (render score) | JSON, CSV, daily snapshot zip |
| 4 | Kaggle: CPU and GPU Stats | TechPowerUp CPUs (1998 to Jan 2023) and GPUs | CC0 (as listed on Kaggle) | No | CSV |
| 5 | dbgpu | 2,000+ GPUs from TechPowerUp | MIT | Derived GFLOPS and fill rates only | PyPI package |
| 6 | Kaggle: GPU Benchmarks Compilation | PassMark GPU scores | CC0 (as listed on Kaggle) | Yes (PassMark) | CSV |
| 7 | TechPowerUp API (current) | Full database, sampled | Free for research only | GPU only (`relativePerformance.score`) | REST JSON |
| 8 | TechPowerUp commercial license | Full database | Commercial, price unknown | GPU only | REST JSON |

---

## 3. Source details

### 3.1 docyx/pc-part-dataset

- **URL:** https://github.com/docyx/pc-part-dataset
- **What it is:** a PCPartPicker snapshot. 66,778 parts, last updated 2025-07-23.
- **Categories:** CPUs, CPU coolers, motherboards, memory, storage, video cards, cases, power supplies, optical drives, operating systems, monitors, external storage, case accessories and fans, fan controllers, thermal compound, UPS, sound cards, network adapters, headphones, keyboards, mice, speakers, webcams.
- **License:** MIT on the repo. The underlying data was scraped from PCPartPicker, so provenance is a risk (see section 5).
- **Fields (from `API.md`):**
  - CPU: `core_count`, `core_clock`, `boost_clock`, `microarchitecture`, `tdp`, `graphics`, `smt`, `price`
  - Video card: `chipset`, `memory`, `core_clock`, `boost_clock`, `color`, `length`, `price`
  - Storage: `capacity`, `price_per_gb`, `type`, `cache`, `form_factor`, `interface`, `price`
- **Already in use:** memory, motherboard and PSU, via `scripts/build_data.mjs` into `data/*.json` (prices dropped, duplicates removed, 10-character SHA-1 IDs added).

| Pros | Cons |
|---|---|
| Already integrated: pipeline, `mapResult` pattern and lazy-loaded local search exist | CPU and GPU records have few spec fields |
| One source could replace the TPU calls for CPU, GPU and storage | No benchmark scores |
| No rate limits, withheld rows, CORS or runtime network dependency | CPU has no socket or cache fields |
| Includes old hardware (LGA775, AM3, DDR3) | GPU records are PCPartPicker listings, so board-partner variants appear as separate entries |
| Easy refresh with `node scripts/build_data.mjs` | Scraped from PCPartPicker (licensing risk); snapshot is from July 2025 and goes stale |
| | About 80% of records have no price (not an issue while price is out of scope) |

### 3.2 GPU Ark

- **URL:** https://huggingface.co/datasets/Intelion/gpuark-gpu-dataset
- **Maintainer:** GPU Ark (gpuark.com), a GPU catalog and price comparison project. It appears to be original research rather than a TPU scrape.
- **Size:** 13,566 GPUs released 1999-2025 (`gpuark-gpu-specs.csv`), 993 benchmark rows (`gpuark-benchmarks.csv`), plus a SQLite database.
- **License:** CC BY 4.0. Attribution to gpuark.com is required.
- **`gpu_specs` fields:** `id`, `name`, `slug`, `vendor`, `manufacturer`, `arch_name`, `card_release_date`, `proc_foundry`, `proc_process_size`, `proc_transistors`, `cores`, `tensor_cores`, `base_clock`, `boost_clock`, `ram`, `ram_type`, `bus_width`, `ram_bandwidth`, `fp16_performance`, `fp32_performance`, `fp64_performance`, `bf16_performance`, `tf32_performance`, `int8_performance`, `tdp`, `multi_gpu`, `api_cuda`, `is_retail_board`, `gpi_value`
- **`benchmarks` fields:** `gpu_id`, `test_name`, `score`, `unit`, `source_name`
- **Benchmark tests included:** Hashcat, llama.cpp, LLM inference, OpenBenchmarking.

| Pros | Cons |
|---|---|
| Largest GPU list here (13,566) | GPU only |
| Clean license; attribution is the only requirement | Benchmarks cover compute and AI, not gaming |
| Rich compute fields (FP16, FP32, FP64 and others) | Only 993 of 13,566 GPUs have a benchmark row |
| CSV and SQLite, so no scraping | No single comparable performance score like TPU's `relativePerformance` |
| | Last update date **unverified** |

### 3.3 Blender Open Data

- **URL:** https://opendata.blender.org/ (data access docs: https://opendata.blender.org/about/)
- **What it is:** anonymized results of the Blender Benchmark, submitted by the community. Median render scores per CPU and GPU.
- **License:** public domain ("license-free", non-proprietary formats). The benchmark scenes are CC0 and the software is GPL.
- **Access:**
  - Search page (`/benchmarks/query/`) for querying, sorting and downloading JSON or CSV.
  - A daily raw snapshot at `/snapshots/opendata-latest.zip`.
  - Per-submission raw data in each result's detail view.
  - No dedicated API was found. **Unverified:** the snapshot's size.
- **Device data:** OS, CPU/GPU specs, render device type and other non-identifying hardware details.

| Pros | Cons |
|---|---|
| Only free source here with a comparable score for both CPUs and GPUs | Measures rendering only, a weak proxy for gaming or general use |
| Public domain | Little spec data (no cores, clocks or TDP), so it must be joined to another dataset by name |
| Updated daily; JSON and CSV | Name matching to TPU or docyx records will be messy |
| Fills the "no CPU benchmark" gap in `user_pc_plan.md` | Only hardware that people have benchmarked appears |
| | Snapshot size **unverified** (matters for a static site) |

### 3.4 Kaggle: CPU and GPU Stats (TechPowerUp scrape)

- **URL:** https://www.kaggle.com/datasets/baraazaid/cpu-and-gpu-stats
- **Scraper:** https://github.com/BaraaZ95/Techpowerup-scraper (Python Scrapy)
- **Coverage:** Intel and AMD CPUs released 1998 to January 2023, plus GPUs.
- **License on Kaggle:** CC0 (public domain).

| Pros | Cons |
|---|---|
| TPU-quality spec fields in one CSV | Scrape of TPU, whose terms restrict use of the full dataset; a CC0 label on the copy does not change that |
| No API limits | Stops at January 2023, so it misses current parts |
| | No benchmark score |

### 3.5 dbgpu

- **URL:** https://github.com/painebenjamin/dbgpu
- **What it is:** a Python package with a bundled database of 2,000+ GPUs, built from TPU.
- **License:** MIT. The README says it is not affiliated with TPU.
- **Fields:** architecture, process (foundry, size, transistors), clocks, memory configuration and bandwidth, core counts (shading, tensor, ray tracing), API support (DirectX, OpenGL, Vulkan, OpenCL, CUDA), pixel and texture rates, FP performance, dimensions, power connectors.
- **Rebuild:** over 10 hours, rate-limited to 4 requests per minute. The latest build ships with the PyPI package.

| Pros | Cons |
|---|---|
| Maintained, easy to install, detailed GPU fields | Derived from TPU, so the same terms-of-use concern applies |
| No runtime network dependency | GPU only; no comparative performance score (only GFLOPS and fill rates) |
| | 2,000+ GPUs is fewer than the TPU database (3,387 queried) |

### 3.6 Kaggle: GPU Benchmarks Compilation

- **URL:** https://www.kaggle.com/datasets/alanjo/gpu-benchmarks
- **What it is:** PassMark GPU benchmark results compiled into CSV.
- **License on Kaggle:** CC0. The data originates with PassMark.

| Pros | Cons |
|---|---|
| Real performance scores for many GPUs | Copy of PassMark data, so the CC0 label may not reflect PassMark's rights |
| Simple CSV | Freshness and exact fields **unverified** |
| | Scores only; would still need a spec source and name matching |

### 3.7 Also seen (not evaluated)

- Kaggle: Popular CPU & GPU Specs (CC0): https://www.kaggle.com/datasets/kkhandekar/cpu-gpu-specs/tasks
- Kaggle: CPUs and GPUs: https://www.kaggle.com/datasets/sujaykapadnis/cpus-and-gpus
- GitHub: RonnyMuthomi/GPUs-Specs (TPU export): https://github.com/RonnyMuthomi/GPUs-Specs
- GitHub: RightNow-AI/RightNow-GPU-Database (2,824 GPUs, via dbgpu): https://github.com/RightNow-AI/RightNow-GPU-Database
- GitHub: mlco2/impact `gpus.csv`: https://github.com/mlco2/impact/blob/master/data/gpus.csv

### 3.8 TechPowerUp (current API and commercial license)

- **Free API:** https://www.techpowerup.com/database-licensing/. No key, CORS open, intended for academic and research use, attribution appreciated. Returns a sampled subset (section 1).
- **Commercial license:** contact w1zzard@techpowerup.com. The price is unknown.
- **Useful fields (verified against the live API):**
  - GPU: `relativePerformance.score`, shaders, boostClock, memSize, memType, memBandwidth, tdp
  - CPU: cores, threads, baseClockMhz, cacheL3Kb, tdpW, memSpeedMhz (no benchmark score)
  - SSD: seqReadMbs, seqWriteMbs, capacityGB, interface

| Pros | Cons |
|---|---|
| Best spec detail for GPU, CPU and SSD | Free tier withholds most results |
| Only source with a ready-made GPU relative-performance score | Free use is limited to academic and research |
| Official, current and maintained | Full access needs a license of unknown cost |
| Already integrated | Depends on a third-party API at runtime |

---

## 4. Coverage gaps by component

| Component | Specs source options | Performance score options |
|---|---|---|
| GPU | TPU API (partial), GPU Ark, docyx, dbgpu | TPU `relativePerformance` (partial), Blender Open Data, PassMark compilation, GPU Ark benchmarks (sparse) |
| CPU | TPU API (partial), docyx | Blender Open Data only |
| Storage | TPU API (partial), docyx | TPU read and write speeds (partial) |
| RAM | docyx (in use) | None (speed, CAS and latency only) |
| Motherboard | docyx (in use) | Not applicable |
| PSU | docyx (in use) | Not applicable |

---

## 5. Licensing notes

- **Academic and research use:** the TPU free tier and the current project scope are compatible.
- **Public or commercial launch:** each of these needs review first.
  - TPU needs a commercial license.
  - docyx is MIT-licensed, but its data was scraped from PCPartPicker.
  - Kaggle copies of TPU or PassMark data carry the same provenance risk. A CC0 or MIT label on a derived copy does not remove the original site's terms.
- **Cleanest options:** GPU Ark (CC BY 4.0, attribution required) and Blender Open Data (public domain).

---

## 6. Recommendation

For the course project, keep the TPU API and add vendored data for the gaps:

1. **Blender Open Data** for CPU and GPU benchmark scores. This closes the open "no CPU benchmark" item.
2. **GPU Ark** for GPUs the TPU free tier withholds.
3. **docyx CPU data** for CPUs, the only full CPU spec list here.

For a public launch: license TPU, or use only the sources with clear terms (GPU Ark, Blender, and docyx after a licensing check).

## 7. Next steps

- Download a sample of the GPU Ark and Blender files and check field coverage.
- Test name matching between Blender or GPU Ark and TPU or docyx names (for example "GeForce RTX 4070" vs "NVIDIA RTX 4070").
- Check the Blender snapshot size to see if it can be vendored in `data/`.
- Confirm GPU Ark's update date.
- Decide whether to add new `kind: "dataset"` entries in `SOURCES` or merge benchmarks into existing records at build time (`scripts/build_data.mjs`).

---

## Sources

- [GPU Ark dataset (Hugging Face)](https://huggingface.co/datasets/Intelion/gpuark-gpu-dataset)
- [Blender Open Data](https://opendata.blender.org/)
- [Blender Open Data: about and data access](https://opendata.blender.org/about/)
- [docyx/pc-part-dataset](https://github.com/docyx/pc-part-dataset)
- [docyx API.md](https://raw.githubusercontent.com/docyx/pc-part-dataset/main/API.md)
- [dbgpu](https://github.com/painebenjamin/dbgpu)
- [Kaggle: CPU and GPU Stats](https://www.kaggle.com/datasets/baraazaid/cpu-and-gpu-stats)
- [Techpowerup-scraper](https://github.com/BaraaZ95/Techpowerup-scraper)
- [Kaggle: GPU Benchmarks Compilation](https://www.kaggle.com/datasets/alanjo/gpu-benchmarks)
- [Kaggle: Popular CPU & GPU Specs](https://www.kaggle.com/datasets/kkhandekar/cpu-gpu-specs/tasks)
- [Kaggle: CPUs and GPUs](https://www.kaggle.com/datasets/sujaykapadnis/cpus-and-gpus)
- [RonnyMuthomi/GPUs-Specs](https://github.com/RonnyMuthomi/GPUs-Specs)
- [RightNow-AI/RightNow-GPU-Database](https://github.com/RightNow-AI/RightNow-GPU-Database)
- [mlco2/impact gpus.csv](https://github.com/mlco2/impact/blob/master/data/gpus.csv)
- [TechPowerUp database licensing](https://www.techpowerup.com/database-licensing/)
