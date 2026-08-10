# OncoServe MIRAI 0.5.0 for Windows

## Welcome! 👋

This is a locally-runnable version of the MIRAI breast cancer risk prediction model. The Docker-based app has been extracted, fixed, and enhanced with a clean web interface for easy testing.

**Status**: ✅ Ready to use for research and testing

---

## 📚 Documentation (Start Here)

Read these in order based on your task:

### 1. **Quick Reference** (`QUICK_REFERENCE.txt`)
   - **For**: Getting started fast
   - **Contains**: Copy-paste commands for setup, testing, and troubleshooting
   - **Time**: 5 minutes to read

### 2. **Implementation Summary** (`IMPLEMENTATION_SUMMARY.md`)
   - **For**: Understanding what was fixed and how
   - **Contains**: Complete list of changes, architecture diagram, known issues
   - **Time**: 15 minutes to read

### 3. **Testing Guide** (`TESTING_GUIDE.md`)
   - **For**: Comprehensive testing procedure
   - **Contains**: Step-by-step test procedures for synthetic data and CBIS-DDSM files
   - **Time**: 30 minutes to read, but reference as needed

---

## 🚀 Quick Start (2 minutes)

```bash
# 1. Install Python dependencies (one time)
pip install -r requirements.txt

# 2. Install the React frontend dependencies (one time)
cd frontend && npm install

# 3. From the repository root, start the Vite dev server
npm run dev

# 4. Build the React frontend
npm run build

# 5. Generate test DICOM files
python generate_synthetic_dicoms.py

# 6. Start server
python run.py

# 7. Open in browser
# → http://127.0.0.1:5009

# 8. Upload synthetic_dicoms/*.dcm files and test
```

The Flask app serves the proven template UI at `/ui` (folder drag/drop, chart, and image previews) and preserves the existing prediction endpoints and workflow.

---

## 🚢 Deployment (Linux/AWS)

For a deployment-only runbook (no local setup/testing content), use:
`LINUX_DEPLOYMENT_STAGE.md`

This app runs as a standard Flask server. In production, it reads remote folders
from the server filesystem (tmp_data). It does not automatically read from S3.

**Recommended env vars:**

```bash
export PORT=5009
export REMOTE_ENABLED=1            # set 0 to disable remote mode
export ONCOSERVE_API_KEY=your_key  # optional, enables API key protection
```

**Start server:**

```bash
python run.py
```

**Notes for AWS/EC2:**
- Ensure tmp_data exists and contains patient folders.
- The OS user running the app must have read permissions on tmp_data.
- If ONCOSERVE_API_KEY is set, include X-API-Key in requests to /predict, /serve,
  /list-remote-folders, /preview-remote-folder, and /predict-remote.
- For the web UI, set it once in the browser console:
   localStorage.setItem('oncoserveApiKey','your_key')
- Put a reverse proxy (nginx/ALB) in front for HTTPS and timeouts.

---

## 🔧 Core Tools

### Web Interface
- **URL**: http://127.0.0.1:5009
- **Entry point**: `run.py`
- **Routes**:
  - `GET /ui` - Web interface (drag-drop upload)
  - `POST /predict` - Submit 4 DICOM files for prediction
  - `GET /health` - Health check
  - `POST /serve` - Legacy REST API

### Diagnostic Tool
```bash
python diagnose_dicom.py path/to/file.dcm
```
Use this to:
- Check if your DICOM files are readable
- See what metadata tags are present
- Identify corrupted or unsupported DICOM files
- Verify pixel data is accessible

### Synthetic Test Data Generator
```bash
python generate_synthetic_dicoms.py
```
Creates 4 test DICOM mammogram files suitable for testing the full pipeline.

---

## 📂 File Structure

```
extracted_app/
├── IMPLEMENTATION_SUMMARY.md    ← What was fixed and why
├── QUICK_REFERENCE.txt           ← Copy-paste commands
├── TESTING_GUIDE.md              ← Detailed testing procedures
├── README.md (this file)
├── requirements.txt              ← Dependencies
├── run.py                        ← Start the server here
├── diagnose_dicom.py            ← Diagnostic tool
├── generate_synthetic_dicoms.py  ← Create test data
│
├── scripts/
│   └── app.py                   ← Flask application
├── templates/
│   └── index.html               ← Web UI
├── oncoserve/
│   ├── onconet_wrapper.py       ← Model inference
│   └── oncodata_wrapper.py      ← DICOM→PNG pipeline
├── OncoNet/
│   ├── snapshots/               ← MIRAI model weights (~164 MB)
│   └── onconet/
│       ├── models/
│       │   ├── factory.py       ← Model loading
│       │   └── mirai_full.py    ← MIRAI architecture
│       └── ...
├── OncoData/
│   └── oncodata/
│       └── dicom_to_png/
│           ├── dicom_to_png_pydicom.py  ← Windows DICOM converter (✨ new)
│           └── ...
└── config.py                    ← Configuration
```

---

## 🎯 Common Tasks

### Task 1: Test with Synthetic Data (Guaranteed to work)
```bash
python generate_synthetic_dicoms.py
python run.py
# Then open http://127.0.0.1:5009 and upload files
```

### Task 2: Test with Your CBIS-DDSM Data
```bash
# First, check if your files are readable
python diagnose_dicom.py your_file.dcm

# If diagnostic passes, upload 4 files to web UI
# Expected: Some files may show low predictions (normal)
```

### Task 3: Find Why Upload Failed
1. Check browser console: **F12 → Console tab**
2. Check server terminal for errors: **Look for "ERROR" or "Traceback"**
3. Run diagnostic on your DICOM file: **`python diagnose_dicom.py`**
4. Read the specific error in TESTING_GUIDE.md

### Task 4: Debug Model Predictions
1. Upload files and run prediction
2. Watch server output (shows: "Step 1: ...", "Step 2: ...", etc.)
3. Look for "Predictions: {year_1: X, year_2: Y, ...}"
4. If all zeros, likely pixel value range mismatch (see TESTING_GUIDE.md)

---

## ⚙️ What Was Fixed

The original Docker version had several issues preventing local Windows execution:

| Issue | Fix |
|-------|-----|
| dcmtk DICOM converter (Linux-only) | ✅ Pure-Python pydicom converter |
| Hardcoded Linux temp path | ✅ Portable os.path.join() |
| Wrong calibrator filename | ✅ Correct filename from disk |
| PyTorch snapshot loading fails in 2.x | ✅ Added weights_only=False |
| Model initialization commented out | ✅ Uncommented and verified |
| No web UI | ✅ Clean drag-drop interface created |
| No easy entry point | ✅ run.py created |
| Missing dependencies list | ✅ requirements.txt created |

---

## 🧠 How It Works

1. **User uploads 4 DICOM mammogram files** (L-CC, L-MLO, R-CC, R-MLO)
2. **Flask receives files** and passes to OncoData wrapper
3. **OncoData converts DICOM→PNG** using pydicom converter
4. **Images preprocessed**: resized, normalized for model input
5. **OncoNet (MIRAI) infers**: predicts cancer risk with Transformer
6. **Risk percentages calibrated** and returned as JSON
7. **Web UI displays risk bars** color-coded by risk level
8. **Research-only disclaimer** shown to user

---

## ⚠️ Important Notes

### Not For Clinical Use
- MIRAI is a research tool only
- NOT FDA approved or clinically validated for this setup
- Should not be used for patient care decisions
- The web UI shows a prominent disclaimer

### Predictions May Be Low
- CBIS-DDSM images differ from MIRAI training data
- Pixel normalization may not match
- Some files may have compressed pixel data we can't read
- Use `diagnose_dicom.py` to identify compatible files

### Windows Specific
- All code is now cross-platform
- Tested on Windows 11
- Should also work on macOS/Linux if needed
- Uses only Python libraries, no system dependencies

---

## 🆘 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| "Port 5009 already in use" | Kill other Python processes or change PORT in config.py |
| "Module not found" errors | Run `pip install -r requirements.txt` again |
| Browser won't load page | Check server terminal for "ERROR" messages |
| Upload button stays disabled | Check F12 console for JavaScript errors |
| "Missing DICOM files" error | Verify all 4 files uploaded (green borders visible) |
| 0% predictions | Run `diagnose_dicom.py` - pixel normalization may not match |
| Hangs on "Loading..." | Wait 60+ seconds, model inference is slow on CPU |
| Specific error message | Search for it in TESTING_GUIDE.md under "Troubleshooting" |

---

## 📞 Getting Help

1. **Check the error message** - It often tells you the exact issue
2. **Check server terminal** - Copy full traceback
3. **Run diagnose_dicom.py** - Verify DICOM files are readable
4. **Read TESTING_GUIDE.md** - Comprehensive troubleshooting
5. **Check IMPLEMENTATION_SUMMARY.md** - Understand architecture

---

## ✅ Verification Checklist

After installation, verify everything works:

- [ ] `pip install -r requirements.txt` completes without errors
- [ ] `python generate_synthetic_dicoms.py` creates 4 .dcm files
- [ ] `python run.py` starts server without errors
- [ ] http://127.0.0.1:5009 loads in browser
- [ ] Can drag files to upload grid
- [ ] "Upload and Run Prediction" button works with all 4 files
- [ ] Prediction returns results within 90 seconds
- [ ] See 5 risk bars (not 0% for all)

**If all checks pass**: ✨ You're ready to use MIRAI!

---

## 🎓 Research Use

This version is intended for:
- Educational purposes
- Research validation studies
- Comparing MIRAI with other models
- Understanding AI in medical imaging
- Creating benchmarks on CBIS-DDSM datasets

**Not for**:
- Clinical decision making
- Patient screening
- Medical practice
- Regulatory approval submissions

---

## 📝 License & Attribution

MIRAI was developed at MIT-IBM Watson AI Lab.
This implementation is a Windows port with enhancements for local use.

**Citation**:
```
@article{Yala2019,
  title={Towards Robust Interpretability with Self-Explaining Neural Networks},
  author={Yala, A. et al.},
  journal={Advances in Neural Information Processing Systems},
  year={2019}
}
```

---

## 🆙 Next Steps

1. **Read QUICK_REFERENCE.txt** - Get your first test running
2. **Run synthetic data test** - Verify everything works
3. **Review TESTING_GUIDE.md** - Understand the full process
4. **Test with your data** - Use diagnose_dicom.py first
5. **Analyze results** - Check IMPLEMENTATION_SUMMARY.md for what predictions mean

---

**Built with ❤️ for research. Use responsibly. 🔬**
