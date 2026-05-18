// physarum: agent-based slime-mold simulation.
//
// Ports DopeGenerativeArt's make_pollack_explosion (chaotic splatter) and
// make_snakeasketch (persistent meander) from R/Rcpp/Armadillo into Rust.
//
// One algorithm with two preset parameter sets. The kernel is a faithful
// translation of `inst/abstractions_funs.cpp` in the original repo:
//
//   for each iteration:
//     - SENSOR  : at +FL, 0, -FR offsets check the environment matrix and
//                 decide whether to turn left, right, stay, or randomly turn.
//     - MOTOR   : advance each agent SS pixels along its heading (toroidal).
//     - DEPOSIT : add depT to the env cell at the agent's new position.
//     - EVAPORATE: env *= (1 - decayT) globally.
//
// Output is a grayscale-to-color mapping of `-ln(env + epsilon)` so that
// recent / heavily trafficked cells read as the bright end of the gradient.
//
// Dimensions default to image_config.yml at the repo root (16 in x 16 in at
// 300 dpi = 4800 x 4800 px). Override with --width-inches / --height-inches
// / --dpi, or point --image-config at a different YAML.
//
// Usage:
//   cargo run --release -- --preset pollack \
//       --out ../../../outputs/physarum/pollack_default.png
//   cargo run --release -- --preset snake --width-inches 4 --height-inches 4 \
//       --out ../../../outputs/physarum/snake_small.png

mod image_config;

use std::f64::consts::PI;
use std::path::PathBuf;
use std::time::Instant;

use clap::{Parser, ValueEnum};
use colorgrad::{Color, Gradient};
use image::{ImageBuffer, Rgb};
use rand::{Rng, SeedableRng};
use rand_pcg::Pcg64;
use rayon::prelude::*;

#[derive(Copy, Clone, Debug, ValueEnum)]
enum Preset {
    /// 6789 agents x 23456 iters, decay 0.123, RA 45°. Splatter / explosion.
    Pollack,
    /// 1000 agents x 10000 iters, decay 0.99. Persistent meander / snake.
    Snake,
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum GradientName {
    Spectral,
    Purples,
    Blues,
    Greens,
    Oranges,
    Grays,
    Magma,
    Inferno,
    Plasma,
    Viridis,
}

#[derive(Parser, Debug)]
#[command(version, about = "Physarum slime-mold simulation renderer.")]
struct Cli {
    /// Quick start: pick a preset matching one of the original R functions.
    #[arg(long, value_enum)]
    preset: Option<Preset>,

    /// Override the canvas width (inches). Falls back to image_config.yml.
    #[arg(long)]
    width_inches: Option<f64>,

    /// Override the canvas height (inches). Falls back to image_config.yml.
    #[arg(long)]
    height_inches: Option<f64>,

    /// Override the print resolution (dots per inch). Falls back to image_config.yml.
    #[arg(long)]
    dpi: Option<u32>,

    /// Path to the YAML defaults file.
    #[arg(long, default_value = "../../../image_config.yml")]
    image_config: PathBuf,

    /// Number of agents.
    #[arg(long, default_value_t = 6789)]
    agents: usize,

    /// Number of simulation iterations.
    #[arg(long, default_value_t = 23456)]
    iters: usize,

    /// Trail-map evaporation rate per iteration (0..1).
    #[arg(long, default_value_t = 0.123)]
    decay: f64,

    /// Chemoattractant deposit per agent per iteration.
    #[arg(long, default_value_t = 11.0)]
    deposit: f64,

    /// Sensor offset distance (pixels).
    #[arg(long, default_value_t = 5.0)]
    sensor_offset: f64,

    /// Agent rotation angle (degrees).
    #[arg(long, default_value_t = 45.0)]
    rotation_angle: f64,

    /// Sensor angle ±FL (degrees).
    #[arg(long, default_value_t = 22.5)]
    sensor_angle: f64,

    /// Step size per iteration (pixels).
    #[arg(long, default_value_t = 1.5)]
    step: f64,

    /// Seed the env with a magnetic ring annulus at imageH/8..imageH/6.
    #[arg(long, default_value_t = true)]
    magnetic_ring: bool,

    /// Color gradient applied to the final env field.
    #[arg(long, value_enum, default_value_t = GradientName::Spectral)]
    gradient: GradientName,

    /// RNG seed.
    #[arg(long, default_value_t = 1)]
    seed: u64,

    /// Output path. Extension picks the format (.png or .jpg).
    #[arg(long)]
    out: PathBuf,
}

fn main() {
    let mut cli = Cli::parse();
    apply_preset(&mut cli);

    let cfg = image_config::load(&cli.image_config, "physarum");
    let resolved = image_config::Resolved {
        width_inches: cli.width_inches.unwrap_or(cfg.width_inches),
        height_inches: cli.height_inches.unwrap_or(cfg.height_inches),
        dpi: cli.dpi.unwrap_or(cfg.dpi),
    };
    let width_px = resolved.width_px();
    let height_px = resolved.height_px();

    if width_px != height_px {
        eprintln!(
            "error: physarum currently supports square canvases only; got {}x{} px ({} in x {} in @ {} dpi). \
             Set --width-inches and --height-inches to the same value, or edit image_config.yml.",
            width_px, height_px, resolved.width_inches, resolved.height_inches, resolved.dpi,
        );
        std::process::exit(2);
    }
    let size = width_px;

    println!(
        "running physarum: {}x{} px ({} in x {} in @ {} dpi) agents={} iters={} decay={} deposit={} step={} RA={}° SO={} FL={}° preset={:?} seed={}",
        size,
        size,
        resolved.width_inches,
        resolved.height_inches,
        resolved.dpi,
        cli.agents,
        cli.iters,
        cli.decay,
        cli.deposit,
        cli.step,
        cli.rotation_angle,
        cli.sensor_offset,
        cli.sensor_angle,
        cli.preset,
        cli.seed,
    );

    let started = Instant::now();
    let env = simulate(&cli, size);
    let sim_ms = started.elapsed().as_millis();

    let pixels = colorize(&env, size as usize, cli.gradient);

    let buffer: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_raw(size, size, pixels).expect("buffer dimensions mismatch");

    if let Some(parent) = cli.out.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).expect("could not create output directory");
        }
    }

    buffer.save(&cli.out).expect("could not save image");

    println!(
        "wrote {} after {} ms simulation + render",
        cli.out.display(),
        sim_ms,
    );
}

fn apply_preset(cli: &mut Cli) {
    let Some(preset) = cli.preset else { return };
    match preset {
        Preset::Pollack => {
            cli.agents = 6789;
            cli.iters = 23456;
            cli.decay = 0.123;
            cli.deposit = 11.0;
            cli.sensor_offset = 5.0;
            cli.rotation_angle = 45.0;
            cli.sensor_angle = 22.5;
            cli.step = 1.5;
            cli.magnetic_ring = true;
            cli.gradient = GradientName::Spectral;
        }
        Preset::Snake => {
            cli.agents = 1000;
            cli.iters = 10000;
            cli.decay = 0.99;
            cli.deposit = 16.0;
            cli.sensor_offset = 5.2;
            cli.rotation_angle = 45.0;
            cli.sensor_angle = 22.5;
            cli.step = 1.7;
            cli.magnetic_ring = true;
            cli.gradient = GradientName::Spectral;
        }
    }
}

struct Agents {
    x: Vec<f64>,
    y: Vec<f64>,
    h: Vec<f64>,
}

fn simulate(cli: &Cli, side_px: u32) -> Vec<f64> {
    let size = side_px as usize;
    let mut env = vec![0.0_f64; size * size];

    // Magnetic-ring prelude: matches the R "magnetic disc" snippet that
    // seeds an annulus from imageH/8 to imageH/6 with env = 5.
    if cli.magnetic_ring {
        let half = size as f64 * 0.5;
        let inner = size as f64 / 8.0;
        let outer = size as f64 / 6.0;
        for i in 0..size {
            for j in 0..size {
                let dx = i as f64 - half;
                let dy = j as f64 - half;
                let r = (dx * dx + dy * dy).sqrt();
                if r > inner && r < outer {
                    env[i * size + j] = 5.0;
                }
            }
        }
    }

    // Agents start evenly spaced on a small circle around the center,
    // heading outward with a tiny jitter — same construction as the R code.
    let mut rng = Pcg64::seed_from_u64(cli.seed);
    let mut agents = Agents {
        x: Vec::with_capacity(cli.agents),
        y: Vec::with_capacity(cli.agents),
        h: Vec::with_capacity(cli.agents),
    };
    let center = size as f64 * 0.5;
    let ring = size as f64 / 20.0;
    for i in 0..cli.agents {
        let h0 = (i as f64) * 2.0 * PI / (cli.agents as f64);
        agents.x.push(ring * h0.cos() + center);
        agents.y.push(ring * h0.sin() + center);
        agents.h.push(h0 + PI + rng.gen_range(-0.001..0.001));
    }

    let fl = cli.sensor_angle.to_radians();
    let fr = -fl;
    let ra = cli.rotation_angle.to_radians();
    let so = cli.sensor_offset;
    let ss = cli.step;
    let deposit = cli.deposit;
    let evap = 1.0 - cli.decay;

    for _ in 0..cli.iters {
        sense_and_turn(&mut agents, &env, size, fl, fr, ra, so, &mut rng);
        motor(&mut agents, size, ss);
        deposit_step(&agents, &mut env, size, deposit);
        evaporate(&mut env, evap);
    }

    env
}

fn sense_and_turn(
    agents: &mut Agents,
    env: &[f64],
    size: usize,
    fl: f64,
    fr: f64,
    ra: f64,
    so: f64,
    rng: &mut Pcg64,
) {
    for i in 0..agents.x.len() {
        let x = agents.x[i];
        let y = agents.y[i];
        let h = agents.h[i];

        let fx = wrap(x + so * h.cos(), size);
        let fy = wrap(y + so * h.sin(), size);
        let flx = wrap(x + so * (h + fl).cos(), size);
        let fly = wrap(y + so * (h + fl).sin(), size);
        let frx = wrap(x + so * (h + fr).cos(), size);
        let fry = wrap(y + so * (h + fr).sin(), size);

        let f = env[fx * size + fy];
        let l = env[flx * size + fly];
        let r = env[frx * size + fry];

        let new_h = if f > l && f > r {
            h
        } else if f < l && f < r {
            if rng.gen::<bool>() {
                h + ra
            } else {
                h - ra
            }
        } else if l < r {
            h - ra
        } else if r < l {
            h + ra
        } else {
            h
        };

        agents.h[i] = new_h;
    }
}

fn motor(agents: &mut Agents, size: usize, ss: f64) {
    for i in 0..agents.x.len() {
        let nx = agents.x[i] + ss * agents.h[i].cos();
        let ny = agents.y[i] + ss * agents.h[i].sin();
        agents.x[i] = wrap_f(nx, size);
        agents.y[i] = wrap_f(ny, size);
    }
}

fn deposit_step(agents: &Agents, env: &mut [f64], size: usize, deposit: f64) {
    for i in 0..agents.x.len() {
        let x = wrap(agents.x[i], size);
        let y = wrap(agents.y[i], size);
        env[x * size + y] += deposit;
    }
}

fn evaporate(env: &mut [f64], retain: f64) {
    env.par_iter_mut().for_each(|cell| {
        *cell *= retain;
    });
}

/// Toroidal wrap (Euclidean modulo) returning a valid array index.
fn wrap(v: f64, size: usize) -> usize {
    let m = size as i64;
    let r = (v.round() as i64).rem_euclid(m);
    r as usize
}

/// Toroidal wrap that preserves the fractional part for agent positions.
fn wrap_f(v: f64, size: usize) -> f64 {
    let m = size as f64;
    ((v % m) + m) % m
}

fn colorize(env: &[f64], size: usize, name: GradientName) -> Vec<u8> {
    let gradient = build_gradient(name);

    // Mirror the R rendering: filter v > 0, then map fill = -log(v) across
    // the active range. Untouched cells become the background — we paint
    // them as the gradient's t=0 stop so prints look clean against a plain
    // backdrop instead of being dominated by black.
    let active_log: Vec<f64> = env
        .iter()
        .filter(|&&v| v > 0.0)
        .map(|&v| -v.ln())
        .collect();

    let (lo, hi) = if active_log.is_empty() {
        (0.0, 1.0)
    } else {
        active_log
            .iter()
            .copied()
            .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), v| {
                (lo.min(v), hi.max(v))
            })
    };
    let span = (hi - lo).max(1e-9);
    let background = gradient.at(0.0).to_rgba8();

    let mut pixels = vec![0u8; size * size * 3];
    for (idx, chunk) in pixels.chunks_mut(3).enumerate() {
        let v = env[idx];
        let color = if v > 0.0 {
            let t = ((-v.ln() - lo) / span).clamp(0.0, 1.0);
            gradient.at(t).to_rgba8()
        } else {
            background
        };
        chunk[0] = color[0];
        chunk[1] = color[1];
        chunk[2] = color[2];
    }

    pixels
}

fn build_gradient(name: GradientName) -> Gradient {
    match name {
        GradientName::Spectral => stops(&[
            (94, 79, 162),
            (50, 136, 189),
            (102, 194, 165),
            (171, 221, 164),
            (230, 245, 152),
            (254, 224, 139),
            (253, 174, 97),
            (244, 109, 67),
            (213, 62, 79),
            (158, 1, 66),
        ]),
        GradientName::Purples => stops(&[
            (252, 251, 253),
            (218, 218, 235),
            (188, 189, 220),
            (158, 154, 200),
            (128, 125, 186),
            (106, 81, 163),
            (84, 39, 143),
            (63, 0, 125),
        ]),
        GradientName::Blues => stops(&[
            (247, 251, 255),
            (222, 235, 247),
            (198, 219, 239),
            (158, 202, 225),
            (107, 174, 214),
            (66, 146, 198),
            (33, 113, 181),
            (8, 69, 148),
        ]),
        GradientName::Greens => stops(&[
            (247, 252, 245),
            (229, 245, 224),
            (199, 233, 192),
            (161, 217, 155),
            (116, 196, 118),
            (65, 171, 93),
            (35, 139, 69),
            (0, 90, 50),
        ]),
        GradientName::Oranges => stops(&[
            (255, 245, 235),
            (254, 230, 206),
            (253, 208, 162),
            (253, 174, 107),
            (253, 141, 60),
            (241, 105, 19),
            (217, 72, 1),
            (140, 45, 4),
        ]),
        GradientName::Grays => stops(&[
            (255, 255, 255),
            (224, 224, 224),
            (189, 189, 189),
            (150, 150, 150),
            (115, 115, 115),
            (82, 82, 82),
            (37, 37, 37),
            (0, 0, 0),
        ]),
        GradientName::Magma => colorgrad::magma(),
        GradientName::Inferno => colorgrad::inferno(),
        GradientName::Plasma => colorgrad::plasma(),
        GradientName::Viridis => colorgrad::viridis(),
    }
}

fn stops(rgb: &[(u8, u8, u8)]) -> Gradient {
    let colors: Vec<Color> = rgb
        .iter()
        .map(|(r, g, b)| Color::from_rgba8(*r, *g, *b, 255))
        .collect();
    colorgrad::CustomGradient::new()
        .colors(&colors)
        .build()
        .expect("invalid gradient stops")
}
