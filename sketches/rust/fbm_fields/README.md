# fbm_fields

Domain-warped fractional Brownian motion noise renderer.

Ports `make_gas_giants` and `make_river_section` from
[`DopeGenerativeArt`](https://github.com/jkloet/DopeGenerativeArt) (R) into
Rust so high-resolution prints render in seconds instead of minutes and come
out as true rasters.

## Setup

```bash
# One-time, if Rust isn't installed yet:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

## Run

From this folder. Dimensions default to `image_config.yml` at the repo root
(16 in × 16 in @ 300 dpi → 4800 × 4800 px). Noise rendering is cheap, so the
default size completes in seconds; visual detail scales with grid density, so
expect tighter, busier output than the original 1000² runs.

```bash
# Default print size from image_config.yml (4800 x 4800 px).
cargo run --release -- \
  --preset gas-giants \
  --out ../../../outputs/fbm_fields/gas_giants_default.png

# Reproduces make_river_section — perlin noise, 10 octaves, green-blue ramp.
cargo run --release -- \
  --preset river-section \
  --out ../../../outputs/fbm_fields/river_section_default.png

# 40 inches at 300 dpi for very large prints.
cargo run --release -- \
  --preset gas-giants \
  --width-inches 40 --height-inches 40 --dpi 300 \
  --out ../../../outputs/fbm_fields/gas_giants_print.png

# Quick iteration: small canvas via CLI override.
cargo run --release -- \
  --preset gas-giants \
  --width-inches 4 --height-inches 4 --dpi 250 \
  --out ../../../outputs/fbm_fields/gas_giants_small.png

# Full custom: any noise type + octaves + gradient + seed.
cargo run --release -- \
  --noise perlin --octaves 12 --persistence 0.55 \
  --gradient spectral-preset --seed 42 \
  --width-inches 8 --height-inches 8 --dpi 300 \
  --out ../../../outputs/fbm_fields/custom.png
```

## Flags

| flag             | default                | notes                                                    |
| ---------------- | ---------------------- | -------------------------------------------------------- |
| `--preset`       | (none)                 | `gas-giants` or `river-section` (mirrors the R functions)|
| `--width-inches` | from `image_config.yml`| canvas width in inches                                   |
| `--height-inches`| from `image_config.yml`| canvas height in inches (must equal width for now)       |
| `--dpi`          | from `image_config.yml`| print resolution (pixels per inch)                       |
| `--image-config` | `../../../image_config.yml` | YAML path with defaults                             |
| `--octaves`      | 7                      | fbm octave count                                         |
| `--persistence`  | 0.5                    | amplitude falloff per octave                             |
| `--lacunarity`   | 2.0                    | frequency multiplier per octave                          |
| `--noise`        | simplex                | `simplex` or `perlin`                                    |
| `--gradient`     | purples                | `purples` `blues` `greens` `oranges` `grays` `spectral` `green-blue` `spectral-preset` |
| `--seed`         | 0                      | reproducible — same seed → same output                   |
| `--out`          | required               | path to write PNG or JPEG                                |

## Algorithm

```text
inv = 1 / size
for each (i, j):
    x, y = j*inv, i*inv
    first[i, j]  = fbm(x, y)
    second[i, j] = fbm(x + first[i, j], y + first[i, j])   # domain warp
color = gradient((second - min) / (max - min))
```

Identical in spirit to the R `ambient::fracture(..., fbm, x = x + noise, y = y + noise)`
calls; rayon parallelizes both passes per pixel.
