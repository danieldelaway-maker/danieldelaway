# danieldelaway.com

Personal directory page linking out to all of Daniel's projects. Plain HTML/CSS, no build step.

- `index.html` – the page. Add a project by copying one `<a class="card">` block.
- `styles.css` – styles. Cards have a fixed-height logo area; the whole logo always fits inside (no cropping).
- `assets/` – logos and favicon.

## Deploy

GitHub Pages from `main`, root. Pushing to `main` publishes within a minute or two.
Custom domain `danieldelaway.com` via `CNAME`.

## DNS (at the registrar, Google Domains / Squarespace)

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | danieldelaway-maker.github.io |
