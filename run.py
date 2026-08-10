"""
run.py — single entry point for OncoServe MIRAI on Linux and Windows.

Usage:
    pip install -r requirements.txt
    python run.py
Then open http://127.0.0.1:5009 in your browser.
"""
import os
import sys
import importlib.util

# ── 1. Anchor working directory so all relative snapshot paths resolve ──
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(APP_ROOT)

# ── 2. Set config before any import touches os.environ ─────────────────
os.environ.setdefault('CONFIG_NAME', 'config.MammoCancerMirai')

# ── 3. Add all submodule roots to sys.path ──────────────────────────────
for subdir in ['', 'OncoNet', 'OncoData', 'OncoQueries']:
    p = os.path.normpath(os.path.join(APP_ROOT, subdir))
    if p not in sys.path:
        sys.path.insert(0, p)

# ── 4. Import app directly from scripts/app.py ──────────────────────────
spec = importlib.util.spec_from_file_location("scripts_app", os.path.join(APP_ROOT, "scripts", "app.py"))
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)
app = app_module.app

if __name__ == '__main__':
    port = app.config.get('PORT', 5009)
    print(f"\n  MIRAI is ready at  http://0.0.0.0:{port}\n")
    app.run(host='0.0.0.0', port=port, debug=False)
