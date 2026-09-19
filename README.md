# OncoTraceAI — Mammography 1–5 Year Cancer Risk Prediction

**Production URL**: [https://www.oncotrace-ai.org/mammodemo/](https://www.oncotrace-ai.org/mammodemo/) *(legacy `oncotraceai.org` 301-redirects here)*  
**Server Host**: `thulasi@52.89.98.162`  
**GitHub Repository**: [https://github.com/teamshriai/mammo_new](https://github.com/teamshriai/mammo_new)  
**Local Project Path**: `~/Mirai_backup/Mirai`  

---

## 📋 Executive Summary of Work Done

### 1. Nginx 413 Upload Limit & Duplicate Directive Resolution
- **Issue**: Uploading 4 DICOM mammogram views (~20–60MB) returned `HTTP 413 Request Entity Too Large` from Nginx before reaching Flask.
- **Root Cause & Fix**: Increased `client_max_body_size 500M;` in both `/etc/nginx/nginx.conf` and `/etc/nginx/sites-enabled/oncotraceai.org`. Cleaned up duplicate lines in site configuration to ensure `sudo nginx -t` passes.

### 2. Gunicorn Worker Timeout & Response Size Optimization
- **Issue**: Gunicorn worker process was being `SIGKILL`ed due to worker timeout after inference.
- **Root Cause**: `_encode_previews()` converted 4 DICOM images into full-resolution, uncompressed base64 PNGs (~33MB JSON payload), causing socket write timeouts.
- **Fix**: Updated `_encode_previews()` in `scripts/app.py` to downscale preview images to max 800px and compress to JPEG format (~80% quality). Reduced JSON response payload from **33MB → ~1-2MB**, eliminating timeouts.

### 3. Mammogram Image Quality & Normalization Fix
- **Issue**: Converted 16-bit DICOM previews appeared dark and washed-out on the frontend.
- **Fix**: Implemented 16-bit to 8-bit `numpy` range stretching `(0..255)` followed by `PIL.ImageOps.autocontrast(cutoff=1)` for natural clinical mammogram rendering.

### 4. Torch Threading & Performance Optimization
- App configured with 4 CPU threads (`torch.set_num_threads(4)`, `OMP_NUM_THREADS=4`, `MKL_NUM_THREADS=4`) to optimize CPU inference speed (~45-50 seconds per exam on 4-core server).

### 5. Frontend & UI Enhancements
- **"New Exam" Button**: Replaced the `< Back` button with a prominent `↻ New Exam` button in the top right of the upload container, allowing instant reset for new exam uploads or error retries.
- **Removed "MIRAI" References**: Completely scrubbed the term "MIRAI" from loading cards and modal titles (`Running the MIRAI model` → `Running AI inference model`).
- **Dynamic Header & Patient Title**: Removed static `"Patient"` fallback. The page header dynamically displays `Patient Name` if specified, or the uploaded `Folder Name` (`selectedRemoteFolder` or local folder name) if no patient name is provided.

### 6. GitHub & Large File Storage (Git LFS) Setup
- Initialized local repository, installed `git-lfs`, and configured LFS tracking for large model files (`*.p`, `*.pt`, `*.pth`, `*.pkl`, `*.bin`).
- Pushed entire codebase including 172MB model weights to `https://github.com/teamshriai/mammo_new.git` on branch `main`.

---

## 💻 Local Development & Testing

### 1. Local Prerequisites & Environment Setup
```bash
cd ~/Mirai_backup/Mirai

# Install Python dependencies (in virtualenv or system python)
pip install -r requirements.txt

# Install Frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Running Locally

#### Method A: Combined Concurrent Run (Recommended)
```bash
cd ~/Mirai_backup/Mirai
npm run dev
```

#### Method B: Separate Terminals

**Terminal 1 — Flask Backend (Port 5009):**
```bash
cd ~/Mirai_backup/Mirai
python3 run.py
```
> *If port 5009 is blocked:* `fuser -k 5009/tcp`

**Terminal 2 — Vite Frontend (Port 5173):**
```bash
cd ~/Mirai_backup/Mirai/frontend
npm run dev
```

#### Access Local Application:
Open browser at: `http://127.0.0.1:5173/mammodemo/`

---

## 🚀 Standard Production Deployment Workflow

Whenever you make code or UI changes locally, follow these steps to build and deploy to the server:

### Step 1: Build Frontend Locally
```bash
cd ~/Mirai_backup/Mirai/frontend
npm run build
```
*(Creates output in `frontend/dist/`)*

### Step 2: Push Code Changes to GitHub
```bash
cd ~/Mirai_backup/Mirai
git add .
git commit -m "Describe your changes"
git push origin main
```

### Step 3: Upload Build & Code to Production Server
```bash
# Upload frontend production build (dist)
scp -i /home/shriai/shri-key.pem -r ~/Mirai_backup/Mirai/frontend/dist thulasi@52.89.98.162:/home/thulasi/Mirai/frontend/

# Upload updated index.html template
scp -i /home/shriai/shri-key.pem ~/Mirai_backup/Mirai/frontend/dist/index.html thulasi@52.89.98.162:/home/thulasi/Mirai/templates/index.html

# Upload backend Python files (if modified)
scp -i /home/shriai/shri-key.pem ~/Mirai_backup/Mirai/scripts/app.py thulasi@52.89.98.162:/home/thulasi/Mirai/scripts/app.py
```

### Step 4: Restart & Verify Service on Server

Connect to server via SSH:
```bash
ssh -i /home/shriai/shri-key.pem thulasi@52.89.98.162
```

Run restart & permissions check:
```bash
# Ensure nginx read permissions on dist folder
sudo chmod -R o+rx /home/thulasi/Mirai/frontend/dist/

# Restart Gunicorn application service
sudo systemctl restart oncotrace-mammo

# Verify service status
sudo systemctl status oncotrace-mammo --no-pager | head -10
```

---

## 🩺 Production Health & Monitoring Commands

Run directly on the production server (`thulasi@52.89.98.162`):

```bash
# 1. Check Flask Gunicorn status
sudo systemctl status oncotrace-mammo

# 2. Watch live logs during inference test
sudo journalctl -u oncotrace-mammo -f

# 3. Check recent logs (last 5 minutes)
sudo journalctl -u oncotrace-mammo --since "5 minutes ago" --no-pager

# 4. Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# 5. Fast backend endpoint health check
curl http://127.0.0.1:5009/health
```

---

## ⚙️ Key Server Configuration Files

- **Flask Service Config**: `/etc/systemd/system/oncotrace-mammo.service`
  ```ini
  [Unit]
  Description=OncoTrace Mammo Demo (Flask)
  After=network.target

  [Service]
  User=thulasi
  WorkingDirectory=/home/thulasi/Mirai
  ExecStart=/usr/local/bin/gunicorn -w 1 -b 127.0.0.1:5009 --timeout 600 wsgi:app
  Environment="OMP_NUM_THREADS=4"
  Environment="MKL_NUM_THREADS=4"
  Environment="MAMMO_DEMO_USERNAME=<set-this>"
  Environment="MAMMO_DEMO_PASSWORD=<set-this>"
  Restart=always

  [Install]
  WantedBy=multi-user.target
  ```
- **Nginx Site Config**: `/etc/nginx/sites-enabled/oncotraceai.org`
- **Main Nginx Config**: `/etc/nginx/nginx.conf` (`client_max_body_size 500M;`)

---

## 🔒 Demo Access Gate

The demo is invite-only, gated by a shared username/password (`MammoAuthGate`,
see `MAMMO_AUTH_GATE_INTEGRATION.md`). Two layers make this real access
control rather than decoration:

1. **Frontend** (`frontend/src/MammoAuthGate.jsx`, wired into
   `frontend/src/main.jsx`) — shows a login screen before the app mounts.
   Nothing is persisted (no localStorage/cookies), so a refresh or a direct
   hit on `/mammodemo/ui` always re-prompts.
2. **Backend** (`scripts/app.py`) — `POST /auth/verify` checks HTTP Basic
   credentials against `MAMMO_DEMO_USERNAME` / `MAMMO_DEMO_PASSWORD`, and the
   same check now guards `/predict`, `/predict-remote`, `/predict-synthetic`,
   `/list-remote-folders`, `/preview-remote-folder`, and `/serve`. If either
   env var is unset, those routes fail closed with `503` instead of silently
   serving everyone.

**To enable on the production server:**

1. Add `MAMMO_DEMO_USERNAME` / `MAMMO_DEMO_PASSWORD` to
   `/etc/systemd/system/oncotrace-mammo.service` (see above), then
   `sudo systemctl daemon-reload && sudo systemctl restart oncotrace-mammo`.
2. Make sure Nginx proxies `/mammodemo/auth/verify` to the Flask backend the
   same way it already proxies `/mammodemo/predict` etc. (strip the
   `/mammodemo` prefix before forwarding to `127.0.0.1:5009/auth/verify`).
   Without this, the login screen will show "Can't reach the sign-in service."
3. Rebuild and redeploy the frontend (`npm run build` in `frontend/`, then
   follow the standard deployment steps above) so the built bundle includes
   the gate.

**Verify:**
```bash
curl -i -X POST https://www.oncotrace-ai.org/mammodemo/auth/verify   # no creds -> 401, no WWW-Authenticate header
curl -X POST https://www.oncotrace-ai.org/mammodemo/predict          # no creds -> 401
```
