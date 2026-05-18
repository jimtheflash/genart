# p5.js Sketches

Browser sketches live here. They are useful when you want something Processing-like that runs in Chrome, Safari, or VS Code Live Server.

Most sketches can be opened by loading their `index.html` file in a browser.

## Spirograph Playground

The sketch is self-contained — it bundles its own `palettes.yml` next to `index.html`, so it can be served from any folder. From the repo root:

```text
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/sketches/p5js/spirograph_playground/
```

Or serve the folder directly:

```text
cd sketches/p5js/spirograph_playground && python3 -m http.server 8001
```

The in-sketch `palettes.yml` is a sync artifact of the canonical `palettes.yml` at the repo root. Use `tools/build_spirograph.sh` to refresh it (and to deploy the bundle to a Quarto site).
