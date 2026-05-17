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

From this folder:

```bash
# Reproduces make_gas_giants — simplex noise, 7 octaves, purple ramp.
cargo run --release -- \
  --preset gas-giants \
  --size 1000 \
  --out ../../../outputs/fbm_fields/gas_giants_small.png

# Reproduces make_river_section — perlin noise, 10 octaves, green-blue ramp.
cargo run --release -- \
  --preset river-section \
  --size 1000 \
  --out ../../../outputs/fbm_fields/river_section_small.png

# Print-quality: 12000 x 12000 ~= 40 inches at 300 dpi. Takes seconds.
cargo run --release -- \
  --preset gas-giants \
  --size 12000 \
  --out ../../../outputs/fbm_fields/gas_giants_print.png

# Full custom: any noise type + octaves + gradient + seed.
cargo run --release -- \
  --noise perlin --octaves 12 --persistence 0.55 \
  --gradient spectral-preset --seed 42 --size 2400 \
  --out ../../../outputs/fbm_fields/custom.png
```

## Flags

| flag            | default  | notes                                                    |
| --------------- | -------- | -------------------------------------------------------- |
| `--preset`      | (none)   | `gas-giants` or `river-section` (mirrors the R functions)|
| `--size`        | 1000     | side length in pixels (image is square)                  |
| `--octaves`     | 7        | fbm octave count                                         |
| `--persistence` | 0.5      | amplitude falloff per octave                             |
| `--lacunarity`  | 2.0      | frequency multiplier per octave                          |
| `--noise`       | simplex  | `simplex` or `perlin`                                    |
| `--gradient`    | purples  | `purples` `blues` `greens` `oranges` `grays` `spectral` `green-blue` `spectral-preset` |
| `--seed`        | 0        | reproducible — same seed → same output                   |
| `--out`         | required | path to write PNG or JPEG                                |

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
