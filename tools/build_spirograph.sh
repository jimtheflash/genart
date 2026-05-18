#!/usr/bin/env bash
# Refresh the bundled palettes file and deploy the spirograph playground
# into a Quarto site repo.
#
# Usage:
#   tools/build_spirograph.sh                 # deploy to default site repo
#   tools/build_spirograph.sh /path/to/site   # deploy to a different repo
#   SITE_REPO=/path/to/site tools/build_spirograph.sh
#   tools/build_spirograph.sh --check         # verify the in-sketch palettes
#                                             # copy matches the canonical
#                                             # palettes.yml (exit 1 on drift)
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
sketch_dir="$repo_root/sketches/p5js/spirograph_playground"
canonical_palettes="$repo_root/palettes.yml"
bundled_palettes="$sketch_dir/palettes.yml"

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -q "$canonical_palettes" "$bundled_palettes" >/dev/null; then
    echo "palettes.yml drift detected:" >&2
    diff -u "$canonical_palettes" "$bundled_palettes" >&2 || true
    echo "" >&2
    echo "Run tools/build_spirograph.sh to refresh the bundled copy." >&2
    exit 1
  fi
  echo "palettes.yml is in sync."
  exit 0
fi

site_repo="${1:-${SITE_REPO:-$HOME/Code/jimtheflash.github.io}}"
dest="$site_repo/spirograph"

if [[ ! -d "$site_repo" ]]; then
  echo "Site repo not found at: $site_repo" >&2
  echo "Pass a path as the first arg or set SITE_REPO." >&2
  exit 1
fi

echo "Refreshing bundled palettes ($canonical_palettes -> $bundled_palettes)"
cp "$canonical_palettes" "$bundled_palettes"

echo "Deploying spirograph bundle to $dest"
mkdir -p "$dest"
cp "$sketch_dir/index.html" "$dest/"
cp "$sketch_dir/style.css" "$dest/"
cp "$sketch_dir/sketch.js" "$dest/"
cp "$sketch_dir/palettes.yml" "$dest/"

cat <<EOF

Done. Next steps:
  cd "$site_repo"
  quarto preview      # verify /spirograph/ renders
  git add spirograph/ projects.qmd _quarto.yml
  git commit -m "Update spirograph playground"
  git push            # triggers the Quarto Publish action
EOF
