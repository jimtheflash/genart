# physarum

Agent-based physarum / slime-mold simulation.

Ports `make_pollack_explosion` (chaotic splatter) and `make_snakeasketch`
(persistent meander) from [`DopeGenerativeArt`](https://github.com/jkloet/DopeGenerativeArt)
(R + Rcpp + Armadillo) into Rust. The kernel mirrors `inst/abstractions_funs.cpp`
in that repo step for step.

## Setup

```bash
# One-time, if Rust isn't installed yet:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

## Run

From this folder. Dimensions default to `image_config.yml` at the repo root
(16 in × 16 in @ 300 dpi → 4800 × 4800 px). At that default size, `--preset
pollack` runs ~23,456 iterations across a 4800² env grid and typically takes
~15–60 minutes — drop the canvas for quick iteration.

```bash
# Default print size from image_config.yml (4800 x 4800 px, ~15-60 min).
cargo run --release -- \
  --preset pollack \
  --out ../../../outputs/physarum/pollack_default.png

# Quick iteration: small canvas via CLI override (~seconds).
cargo run --release -- \
  --preset pollack \
  --width-inches 4 --height-inches 4 --dpi 250 \
  --out ../../../outputs/physarum/pollack_small.png

# Persistent meandering trails at default size.
cargo run --release -- \
  --preset snake \
  --out ../../../outputs/physarum/snake_default.png

# Full custom — tune every knob from the R source.
cargo run --release -- \
  --width-inches 4 --height-inches 4 --dpi 300 \
  --agents 4000 --iters 15000 \
  --decay 0.5 --deposit 14 --step 1.8 \
  --rotation-angle 30 --sensor-angle 20 --sensor-offset 6 \
  --gradient magma --seed 7 \
  --out ../../../outputs/physarum/custom.png
```

The presets fix `--agents` at a count tuned for the original ~1000² canvas.
At the 4800 × 4800 default the agent density drops ~23×, so the pattern reads
sparser and finer; bump `--agents` to ~150k (≈ 6789 × (width_px / 1000)²) for
visually comparable density.

## Flags

| flag                | default                | notes                                                |
| ------------------- | ---------------------- | ---------------------------------------------------- |
| `--preset`          | (none)                 | `pollack` or `snake`                                 |
| `--width-inches`    | from `image_config.yml`| canvas width in inches                               |
| `--height-inches`   | from `image_config.yml`| canvas height in inches (must equal width for now)   |
| `--dpi`             | from `image_config.yml`| print resolution (pixels per inch)                   |
| `--image-config`    | `../../../image_config.yml` | YAML path with defaults                        |
| `--agents`          | 6789                   | agent count                                          |
| `--iters`           | 23456                  | simulation iterations                                |
| `--decay`           | 0.123                  | evaporation per iter (0..1)                          |
| `--deposit`         | 11.0                   | trail strength laid per step                         |
| `--sensor-offset`   | 5.0                    | distance ahead of agent to sample                    |
| `--rotation-angle`  | 45.0                   | turn step in degrees                                 |
| `--sensor-angle`    | 22.5                   | ±FL angle in degrees                                 |
| `--step`            | 1.5                    | move distance per iter (pixels)                      |
| `--magnetic-ring`   | true                   | seed env with an annulus the agents fall into        |
| `--gradient`        | spectral               | `spectral` `purples` `blues` `greens` `oranges` `grays` `magma` `inferno` `plasma` `viridis` |
| `--seed`            | 1                      | reproducible PRNG seed                               |
| `--out`             | required               | output path (`.png` or `.jpg`)                       |

## Algorithm

```text
for each iteration:
  for each agent:
    sense env at +FL, 0, -FR offsets (sensor offset SO ahead of heading)
    turn ±RA based on whichever sensor was strongest (random tie-break)
  for each agent:
    advance step SS pixels along the new heading (toroidal wrap)
  for each agent:
    env[cell at agent] += depT
  env *= (1 - decayT)        # evaporation
```

Render: `t = (-ln(env) - min) / range`, gradient-lookup, with v=0 cells
painted as the gradient's t=0 color so the print has a clean background.
