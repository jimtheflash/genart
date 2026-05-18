// Reads the repo-root `image_config.yml`. Resolves a sketch's print
// dimensions (in inches + dpi) by layering: hard-coded fallback ->
// global square defaults -> per-sketch override -> CLI flags (caller
// applies those on top).
//
// Mirrors the YAML vocabulary one-to-one:
//   dpi: <int>
//   square: { width_inches, height_inches }
//   sketches:
//     <name>: { shape: square | width_inches: ..., height_inches: ..., dpi: ... }
//
// The file is duplicated in each Rust sketch's `src/` rather than
// extracted into a workspace crate, to keep each sketch a self-contained
// `cargo run`-able directory. If a third Rust sketch lands, promote.

use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Clone, Copy)]
pub struct Resolved {
    pub width_inches: f64,
    pub height_inches: f64,
    pub dpi: u32,
}

impl Resolved {
    pub fn width_px(&self) -> u32 {
        (self.width_inches * self.dpi as f64).round() as u32
    }

    pub fn height_px(&self) -> u32 {
        (self.height_inches * self.dpi as f64).round() as u32
    }
}

const FALLBACK: Resolved = Resolved {
    width_inches: 16.0,
    height_inches: 16.0,
    dpi: 300,
};

pub fn load(yaml_path: &Path, sketch_name: &str) -> Resolved {
    let text = match std::fs::read_to_string(yaml_path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!(
                "warning: could not read image config at {}: {}. Falling back to {} in x {} in at {} dpi.",
                yaml_path.display(),
                e,
                FALLBACK.width_inches,
                FALLBACK.height_inches,
                FALLBACK.dpi,
            );
            return FALLBACK;
        }
    };

    let parsed: RawConfig = match serde_yaml::from_str(&text) {
        Ok(c) => c,
        Err(e) => {
            eprintln!(
                "warning: could not parse {}: {}. Falling back to {} in x {} in at {} dpi.",
                yaml_path.display(),
                e,
                FALLBACK.width_inches,
                FALLBACK.height_inches,
                FALLBACK.dpi,
            );
            return FALLBACK;
        }
    };

    let mut resolved = FALLBACK;
    if let Some(dpi) = parsed.dpi {
        resolved.dpi = dpi;
    }
    if let Some(sq) = &parsed.square {
        if let Some(w) = sq.width_inches {
            resolved.width_inches = w;
        }
        if let Some(h) = sq.height_inches {
            resolved.height_inches = h;
        }
    }
    if let Some(sketches) = &parsed.sketches {
        if let Some(entry) = sketches.get(sketch_name) {
            if let Some(w) = entry.width_inches {
                resolved.width_inches = w;
            }
            if let Some(h) = entry.height_inches {
                resolved.height_inches = h;
            }
            if let Some(dpi) = entry.dpi {
                resolved.dpi = dpi;
            }
        }
    }
    resolved
}

#[derive(Debug, Deserialize)]
struct RawConfig {
    dpi: Option<u32>,
    square: Option<RawSquare>,
    sketches: Option<std::collections::BTreeMap<String, RawSketch>>,
}

#[derive(Debug, Deserialize)]
struct RawSquare {
    width_inches: Option<f64>,
    height_inches: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RawSketch {
    // `shape: square` is informational; square defaults are already loaded.
    // Per-sketch width/height/dpi (if present) override the square defaults.
    #[allow(dead_code)]
    shape: Option<String>,
    width_inches: Option<f64>,
    height_inches: Option<f64>,
    dpi: Option<u32>,
}
