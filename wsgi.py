import os
import sys


APP_ROOT = os.path.dirname(os.path.abspath(__file__))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)
os.chdir(APP_ROOT)

from scripts.app import app

if __name__ == "__main__":
    port = app.config.get('PORT', 5009)
    app.run(host='127.0.0.1', port=port)
