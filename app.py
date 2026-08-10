"""Top-level entrypoint for local development.

Usage:
    python app.py
"""

from run import app


if __name__ == '__main__':
    port = app.config.get('PORT', 5009)
    app.run(host='127.0.0.1', port=port, debug=False)
