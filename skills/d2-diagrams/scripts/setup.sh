#!/usr/bin/env bash
# setup.sh — check (and where possible install) the d2 toolchain.
#
# Vendored from khollingworth/d2-diagram-skill (MIT License, Copyright (c)
# 2026 Kevin Hollingworth). See ../../../LICENSE for the full notice.
# https://github.com/khollingworth/d2-diagram-skill
# Modified in this repo: WASM fallback (@terrastruct/d2 via npm) when the d2
# CLI is missing and cannot be installed (blocked networks, sandboxes).
#
# Usage: setup.sh [--with-tala] [--check-only] [--allow-unsupported] [--wasm]
#   --check-only         report status, install nothing
#                        (exit 0 = ready, 1 = d2 missing/unsupported or a
#                        requested TALA install failed)
#   --with-tala          also install the TALA layout engine (Terrastruct's proprietary
#                        engine; free to evaluate with a watermark, licence for clean output)
#   --allow-unsupported  don't fail on a d2 older than the tested minimum
#   --wasm               install the WASM fallback even if the d2 CLI is present
#
# WASM fallback: when d2 is not on PATH and Homebrew can't install it, setup
# installs @terrastruct/d2 (official WASM build of the same compiler, ELK and
# dagre layouts, no TALA) plus preview helpers from npm into
# ${D2_WASM_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/d2-diagrams-skill/wasm}.
# Needs Node.js 18+ and npm; installs nothing globally. render.sh uses it
# automatically when d2 is missing. A native d2 is still preferred.
#
# The skill is tested against d2 0.7.x; MIN_D2 below is the enforced floor.
# Non-interactive by design: never prompts. Prints clear status lines:
#   d2: ok 0.7.1 | d2: ok (wasm fallback …) | tala: ok (credentials found)

set -u

MIN_D2="0.7.0"

WITH_TALA=0
CHECK_ONLY=0
ALLOW_UNSUPPORTED=0
WANT_WASM=0
for arg in "$@"; do
  case "$arg" in
    --with-tala) WITH_TALA=1 ;;
    --check-only) CHECK_ONLY=1 ;;
    --allow-unsupported) ALLOW_UNSUPPORTED=1 ;;
    --wasm) WANT_WASM=1 ;;
    -h|--help) awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; exit 0 ;;
    *) printf 'setup.sh: unknown option %s\n' "$arg" >&2; exit 2 ;;
  esac
done

status=0

# --- WASM fallback helpers ---------------------------------------------------------
WASM_HOME="${D2_WASM_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/d2-diagrams-skill/wasm}"
WASM_PACKAGES="@terrastruct/d2 playwright-core @resvg/resvg-js"

wasm_version() {
  # Prints the installed @terrastruct/d2 version; fails if the fallback is unusable.
  command -v node >/dev/null 2>&1 || return 1
  [ -f "$WASM_HOME/node_modules/@terrastruct/d2/package.json" ] || return 1
  node -e 'const p=require("path"),f=require("fs");const m=p.join(process.argv[1],"node_modules");
    for (const d of ["@terrastruct/d2","playwright-core","@resvg/resvg-js"]) if(!f.existsSync(p.join(m,d,"package.json"))) process.exit(1);
    process.stdout.write(JSON.parse(f.readFileSync(p.join(m,"@terrastruct/d2/package.json"),"utf8")).version)' "$WASM_HOME" 2>/dev/null
}

wasm_status_line() {
  printf 'd2: ok (wasm fallback, @terrastruct/d2 %s — ELK/dagre only, no TALA; install the d2 CLI for full features)\n' "$1"
}

install_wasm() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    printf 'd2-wasm: cannot install (Node.js 18+ and npm are required)\n'
    return 1
  fi
  printf 'd2-wasm: installing %s into %s ...\n' "$WASM_PACKAGES" "$WASM_HOME"
  mkdir -p "$WASM_HOME" || return 1
  [ -f "$WASM_HOME/package.json" ] || printf '{"name":"d2-diagrams-wasm","private":true}\n' > "$WASM_HOME/package.json"
  # shellcheck disable=SC2086
  if ! (cd "$WASM_HOME" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-fund --no-audit --loglevel=error $WASM_PACKAGES >/dev/null 2>&1); then
    printf 'd2-wasm: npm install FAILED (is registry.npmjs.org reachable?)\n'
    return 1
  fi
  v=$(wasm_version) || { printf 'd2-wasm: install finished but the package is not usable\n'; return 1; }
  wasm_status_line "$v"
}

print_native_install() {
  printf '  Linux/macOS:  curl -fsSL https://d2lang.com/install.sh | sh -s --\n'
  printf '  Windows:      winget install --id Terrastruct.D2\n'
  printf '  Go toolchain: go install oss.terrastruct.com/d2@latest\n'
}

# --- d2 ------------------------------------------------------------------------
check_d2_version() {
  # Enforce the tested minimum: below MIN_D2 is an error unless --allow-unsupported.
  ver=$(d2 --version 2>/dev/null)
  printf 'd2: ok %s\n' "$ver"
  lowest=$(printf '%s\n%s\n' "$MIN_D2" "$ver" | sort -V | head -1)
  if [ "$lowest" != "$MIN_D2" ] && [ "$ver" != "$MIN_D2" ]; then
    if [ "$ALLOW_UNSUPPORTED" -eq 1 ]; then
      printf 'd2: WARNING — %s is below the tested minimum %s (continuing: --allow-unsupported)\n' "$ver" "$MIN_D2"
    else
      printf 'd2: UNSUPPORTED — %s is below the tested minimum %s. Upgrade d2, or rerun with --allow-unsupported to experiment anyway.\n' "$ver" "$MIN_D2"
      status=1
    fi
  fi
}

if command -v d2 >/dev/null 2>&1; then
  check_d2_version
  if [ "$WANT_WASM" -eq 1 ] && [ "$CHECK_ONLY" -eq 0 ]; then install_wasm || status=1; fi
elif [ "$CHECK_ONLY" -eq 1 ]; then
  if v=$(wasm_version); then
    wasm_status_line "$v"
  else
    printf 'd2: MISSING (no d2 CLI and no WASM fallback — run setup.sh without --check-only)\n'
    status=1
  fi
else
  native_ok=0
  if command -v brew >/dev/null 2>&1; then
    printf 'd2: installing via Homebrew...\n'
    if brew install d2 >/dev/null 2>&1 && command -v d2 >/dev/null 2>&1; then
      check_d2_version
      native_ok=1
    else
      printf 'd2: Homebrew install FAILED.\n'
    fi
  fi
  if [ "$native_ok" -eq 0 ]; then
    if v=$(wasm_version); then
      wasm_status_line "$v"
    elif ! install_wasm; then
      printf 'd2: MISSING. Install the d2 CLI with one of:\n'
      print_native_install
      status=1
    fi
    if [ "$status" -eq 0 ]; then
      printf 'd2: native CLI not installed — rendering will use the WASM fallback. For TALA and full CLI features, install d2:\n'
      print_native_install
    fi
  fi
fi

# --- TALA (optional) -------------------------------------------------------------
tala_licence_status() {
  # Presence of credentials only — validity is proven at first render (the
  # render script's watermark guard catches expired/invalid tokens).
  if [ -n "${TSTRUCT_TOKEN:-}" ] || { authfile="${TSTRUCT_AUTHFILE:-${XDG_CONFIG_HOME:-$HOME/.config}/tstruct/auth.json}"; [ -s "$authfile" ] && grep -q '"api_token"' "$authfile" 2>/dev/null; }; then
    printf 'credentials found (unverified — validity is proven at first render)'
  else
    printf 'no credentials — ELK fallback active; get a licence at https://terrastruct.com/tala'
  fi
}

if command -v d2plugin-tala >/dev/null 2>&1; then
  printf 'tala: ok (%s)\n' "$(tala_licence_status)"
elif [ "$WITH_TALA" -eq 1 ] && [ "$CHECK_ONLY" -eq 0 ]; then
  if command -v brew >/dev/null 2>&1; then
    printf 'tala: installing via Homebrew (Terrastruct proprietary licence applies)...\n'
    if brew install terrastruct/tap/tala >/dev/null 2>&1 && command -v d2plugin-tala >/dev/null 2>&1; then
      printf 'tala: ok (%s)\n' "$(tala_licence_status)"
    else
      printf 'tala: install FAILED. Install manually:\n'
      printf '  curl -fsSL https://d2lang.com/install.sh | sh -s -- --tala\n'
      status=1
    fi
  else
    printf 'tala: cannot install automatically (no Homebrew). Install with:\n'
    printf '  curl -fsSL https://d2lang.com/install.sh | sh -s -- --tala\n'
    status=1
  fi
elif [ "$WITH_TALA" -eq 1 ]; then
  printf 'tala: not installed (requested with --with-tala, but --check-only installs nothing)\n'
  status=1
else
  printf 'tala: not installed (optional — ELK is used instead; rerun with --with-tala to add it)\n'
fi

exit "$status"
