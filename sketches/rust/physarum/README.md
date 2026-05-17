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

From this folder:

```bash
# 6789 agents x 23456 iters, decay 0.123. Splatter.
cargo run --release -- \
  --preset pollack \
  --size 1000 \
  --out ../../../outputs/physarum/pollack_small.png

# 1000 agents x 10000 iters, decay 0.99. Persistent meandering trails.
cargo run --release -- \
  --preset snake \
  --size 1000 \
  --out ../../../outputs/physarum/snake_small.png

# Print-quality 4096 x 4096 — minutes, not hours.
cargo run --release -- \
  --preset pollack --size 4096 \
  --gradient viridis \
  --out ../../../outputs/physarum/pollack_print.png

# Full custom — tune every knob from the R source.
cargo run --release -- \
  --size 1200 --agents 4000 --iters 15000 \
  --decay 0.5 --deposit 14 --step 1.8 \
  --rotation-angle 30 --sensor-angle 20 --sensor-offset 6 \
  --gradient magma --seed 7 \
  --out ../../../outputs/physarum/custom.png
```

## Flags

| flag                | default  | notes                                                |
| ------------------- | -------- | ---------------------------------------------------- |
| `--preset`          | (none)   | `pollack` or `snake`                                 |
| `--size`            | 1000     | side length / env grid                               |
| `--agents`          | 6789     | agent count                                          |
| `--iters`           | 23456    | simulation iterations                                |
| `--decay`           | 0.123    | evaporation per iter (0..1)                          |
| `--deposit`         | 11.0     | trail strength laid per step                         |
| `--sensor-offset`   | 5.0      | distance ahead of agent to sample                    |
| `--rotation-angle`  | 45.0     | turn step in degrees                                 |
| `--sensor-angle`    | 22.5     | ±FL angle in degrees                                 |
| `--step`            | 1.5      | move distance per iter (pixels)                      |
| `--magnetic-ring`   | true     | seed env with an annulus the agents fall into        |
| `--gradient`        | spectral | `spectral` `purples` `blues` `greens` `oranges` `grays` `magma` `inferno` `plasma` `viridis` |
| `--seed`            | 1        | reproducible PRNG seed                               |
| `--out`             | required | output path (`.png` or `.jpg`)                       |

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
