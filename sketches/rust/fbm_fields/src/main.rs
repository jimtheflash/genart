// fbm_fields: domain-warped fbm noise renderer.
//
// Ports DopeGenerativeArt's make_gas_giants (simplex, 7 octaves) and
// make_river_section (perlin, 10 octaves) from R/ggplot2 to Rust.
//
// The algorithm mirrors the R `ambient::fracture(... fbm ...)` pattern:
//   1. Sample fractional Brownian motion noise on a grid.
//   2. Re-sample the same fbm but with the previous noise added to the
//      coordinates — i.e. domain warping. This is the move that turns
//      smooth noise into Jupiter-band swirls and river-delta veining.
//
// Dimensions default to image_config.yml at the repo root (16 in x 16 in at
// 300 dpi = 4800 x 4800 px). Override with --width-inches / --height-inches
// / --dpi, or point --image-config at a different YAML.
//
// Usage:
//   cargo run --release -- --preset gas-giants --out path.png
//   cargo run --release -- --preset river-section --out path.png
//   cargo run --release -- --noise perlin --octaves 12 \
//       --width-inches 12 --height-inches 12 --dpi 300 \
//       --gradient spectral --seed 42 --out path.png

mod image_config;

use std::path::PathBuf;
use std::time::Instant;

use clap::{Parser, ValueEnum};
use colorgrad::{Color, Gradient};
use image::{ImageBuffer, Rgb};
use noise::{Fbm, MultiFractal, NoiseFn, Perlin, Simplex};
use rayon::prelude::*;

#[derive(Copy, Clone, Debug, ValueEnum)]
enum NoiseKind {
    Simplex,
    Perlin,
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum Preset {
    /// Simplex, 7 octaves, purple ramp. Mirrors make_gas_giants.
    GasGiants,
    /// Perlin, 10 octaves, green-blue ramp. Mirrors make_river_section.
    RiverSection,
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum GradientName {
    Purples,
    Blues,
    Greens,
    Oranges,
    Grays,
    Spectral,
    /// ggthemes "Classic Green-Blue" lookalike, used by make_river_section.
    GreenBlue,
    /// Built-in colorgrad spectral preset — bonus, useful for variety.
    SpectralPreset,
}

#[derive(Parser, Debug)]
#[command(version, about = "Domain-warped fbm noise renderer.")]
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

    /// Number of fbm octaves.
    #[arg(long, default_value_t = 7)]
    octaves: usize,

    /// Persistence: how much each successive octave contributes.
    #[arg(long, default_value_t = 0.5)]
    persistence: f64,

    /// Lacunarity: frequency multiplier between octaves.
    #[arg(long, default_value_t = 2.0)]
    lacunarity: f64,

    /// Which underlying noise primitive to fracture into fbm.
    #[arg(long, value_enum, default_value_t = NoiseKind::Simplex)]
    noise: NoiseKind,

    /// Color gradient applied to the final noise field.
    #[arg(long, value_enum, default_value_t = GradientName::Purples)]
    gradient: GradientName,

    /// RNG seed for the noise function — fully reproducible.
    #[arg(long, default_value_t = 0)]
    seed: u32,

    /// Output path. Extension picks the format (.png or .jpg).
    #[arg(long)]
    out: PathBuf,
}

fn main() {
    let mut cli = Cli::parse();
    apply_preset(&mut cli);

    let cfg = image_config::load(&cli.image_config, "fbm_fields");
    let resolved = image_config::Resolved {
        width_inches: cli.width_inches.unwrap_or(cfg.width_inches),
        height_inches: cli.height_inches.unwrap_or(cfg.height_inches),
        dpi: cli.dpi.unwrap_or(cfg.dpi),
    };
    let width_px = resolved.width_px();
    let height_px = resolved.height_px();

    if width_px != height_px {
        eprintln!(
            "error: fbm_fields currently supports square canvases only; got {}x{} px ({} in x {} in @ {} dpi). \
             Set --width-inches and --height-inches to the same value, or edit image_config.yml.",
            width_px, height_px, resolved.width_inches, resolved.height_inches, resolved.dpi,
        );
        std::process::exit(2);
    }
    let size = width_px;

    let started = Instant::now();
    let pixels = render(&cli, size);
    let render_ms = started.elapsed().as_millis();

    let buffer: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_raw(size, size, pixels).expect("buffer dimensions mismatch");

    if let Some(parent) = cli.out.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).expect("could not create output directory");
        }
    }

    buffer.save(&cli.out).expect("could not save image");

    println!(
        "wrote {} ({}x{} px, {} in x {} in @ {} dpi, noise={:?}, octaves={}, gradient={:?}, seed={}) in {} ms",
        cli.out.display(),
        size,
        size,
        resolved.width_inches,
        resolved.height_inches,
        resolved.dpi,
        cli.noise,
        cli.octaves,
        cli.gradient,
        cli.seed,
        render_ms,
    );
}

fn apply_preset(cli: &mut Cli) {
    let Some(preset) = cli.preset else { return };
    match preset {
        Preset::GasGiants => {
            cli.noise = NoiseKind::Simplex;
            cli.octaves = 7;
            cli.gradient = GradientName::Purples;
        }
        Preset::RiverSection => {
            cli.noise = NoiseKind::Perlin;
            cli.octaves = 10;
            cli.gradient = GradientName::GreenBlue;
        }
    }
}

fn render(cli: &Cli, side_px: u32) -> Vec<u8> {
    let size = side_px as usize;
    let gradient = build_gradient(cli.gradient);

    let raw = match cli.noise {
        NoiseKind::Simplex => noise_field::<Simplex>(cli, size),
        NoiseKind::Perlin => noise_field::<Perlin>(cli, size),
    };

    // Map noise values into [0, 1] using the field's own min/max for full
    // contrast — paletteer's scale_color_paletteer_c does the same thing.
    let (lo, hi) = raw
        .par_iter()
        .copied()
        .fold(
            || (f64::INFINITY, f64::NEG_INFINITY),
            |(lo, hi), v| (lo.min(v), hi.max(v)),
        )
        .reduce(
            || (f64::INFINITY, f64::NEG_INFINITY),
            |a, b| (a.0.min(b.0), a.1.max(b.1)),
        );
    let span = (hi - lo).max(1e-9);

    let mut pixels = vec![0u8; size * size * 3];
    pixels
        .par_chunks_mut(3)
        .zip(raw.par_iter())
        .for_each(|(chunk, &value)| {
            let t = ((value - lo) / span).clamp(0.0, 1.0);
            let color = gradient.at(t).to_rgba8();
            chunk[0] = color[0];
            chunk[1] = color[1];
            chunk[2] = color[2];
        });

    pixels
}

fn noise_field<N>(cli: &Cli, size: usize) -> Vec<f64>
where
    N: NoiseFn<f64, 2> + noise::Seedable + Default + Sync,
{
    let fbm: Fbm<N> = Fbm::new(cli.seed)
        .set_octaves(cli.octaves)
        .set_persistence(cli.persistence)
        .set_lacunarity(cli.lacunarity);
    let inv = 1.0 / (size as f64);

    // Two-pass domain warping. R version:
    //   noise = fracture(... fbm, x, y)
    //   noise = fracture(... fbm, x+noise, y+noise)
    let first: Vec<f64> = (0..size * size)
        .into_par_iter()
        .map(|idx| {
            let i = idx / size;
            let j = idx % size;
            let x = j as f64 * inv;
            let y = i as f64 * inv;
            fbm.get([x, y])
        })
        .collect();

    (0..size * size)
        .into_par_iter()
        .map(|idx| {
            let i = idx / size;
            let j = idx % size;
            let x = j as f64 * inv;
            let y = i as f64 * inv;
            let warp = first[idx];
            fbm.get([x + warp, y + warp])
        })
        .collect()
}

fn build_gradient(name: GradientName) -> Gradient {
    // Hand-rolled stops chosen to feel close to the paletteer gradients used
    // by the R functions; not a 1:1 match but visually in the same family.
    match name {
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
        GradientName::GreenBlue => stops(&[
            (236, 247, 235),
            (199, 233, 192),
            (146, 207, 165),
            (88, 178, 154),
            (49, 145, 159),
            (33, 102, 153),
            (8, 64, 129),
            (4, 32, 86),
        ]),
        GradientName::SpectralPreset => colorgrad::spectral(),
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
