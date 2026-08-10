import os, shutil
from os.path import dirname, realpath
import sys
import base64
from io import BytesIO
import numpy as np
import torch
from PIL import Image, ImageOps

torch.set_num_threads(4)
torch.set_num_interop_threads(2)
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

APP_ROOT = dirname(dirname(realpath(__file__)))
for module_path in [
    APP_ROOT,
    os.path.join(APP_ROOT, 'OncoNet'),
    os.path.join(APP_ROOT, 'OncoData'),
    os.path.join(APP_ROOT, 'OncoQueries'),
]:
    norm_path = os.path.normpath(module_path)
    if norm_path not in sys.path:
        sys.path.insert(0, norm_path)

import oncoserve.logger
from flask import Flask, request, json, jsonify, render_template, redirect, url_for
import oncoserve.onconet_wrapper as onconet_wrapper
import oncoserve.oncodata_wrapper as oncodata_wrapper
import oncoserve.oncoqueries_wrapper as oncoqueries_wrapper

ONCODATA_SUCCESS_MSG   = 'OncoData- Successfully converted dicoms into pngs through OncoData'
ONCOQUERIES_SUCCESS_MSG = 'OncoQueries- Successfully obtained risk factors through OncoQueries'
ONCONET_SUCCESS_MSG    = 'OncoNet- Succesfully got prediction from OncoNet for exam'
ONCOSERVE_FAIL_MSG     = 'Error. Could not serve request. Exception: {}'
HTTP_200_OK                    = 200
HTTP_400_BAD_REQUEST           = 400
HTTP_500_INTERNAL_SERVER_ERROR = 500

app = Flask(
    __name__,
    template_folder=os.path.join(APP_ROOT, 'templates'),
    static_folder=os.path.join(APP_ROOT, 'static'),
)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True
app.jinja_env.cache = {}

LOG_FILE    = os.path.join(APP_ROOT, 'LOGS_local')
CONFIG_NAME = os.environ.get('CONFIG_NAME', 'config.MammoCancerMirai')
app.config.from_object(CONFIG_NAME)

# Deployment controls (optional)
REMOTE_ENABLED = os.environ.get('REMOTE_ENABLED', '1').lower() in ('1', 'true', 'yes')
API_KEY = os.environ.get('ONCOSERVE_API_KEY', '').strip()

# Allow PORT environment override for local runs
env_port = os.environ.get('PORT')
if env_port:
    try:
        app.config['PORT'] = int(env_port)
    except ValueError:
        pass

logger = oncoserve.logger.get_logger('oncologger', LOG_FILE)

onconet_args  = app.config['ONCONET_ARGS']
oncodata_args = app.config['ONCODATA_ARGS']

# Load model at startup
onconet = onconet_wrapper.OncoNetWrapper(onconet_args, app.config['AGGREGATION'], logger)


def _check_api_key():
    if not API_KEY:
        return None
    provided = request.headers.get('X-API-Key') or request.args.get('api_key')
    if provided != API_KEY:
        return jsonify({'error': True, 'msg': 'Unauthorized'}), 401
    return None


def _encode_previews(images, slots):
    """Return slot->dataUrl for the mammogram images, sized for display.
    Uses proper 16-bit normalisation + autocontrast so images look like
    normal clinical mammograms rather than washed-out greyscale.
    Response size is kept small (~1-2 MB) with JPEG compression.
    """
    previews = {}
    MAX_SIZE = 800   # max display dimension in pixels
    JPEG_QUALITY = 80
    for slot, img_dict in zip(slots, images):
        pil_img = img_dict['x']

        # --- 1. Normalise to 8-bit L (greyscale) --------------------------
        if pil_img.mode in ('I', 'I;16', 'I;16B', 'I;16L', 'I;16S', 'I;32'):
            # 16/32-bit: stretch full pixel range to [0, 255]
            arr = np.array(pil_img, dtype=np.float32)
            lo, hi = arr.min(), arr.max()
            if hi > lo:
                arr = ((arr - lo) / (hi - lo) * 255.0)
            arr = arr.clip(0, 255).astype(np.uint8)
            pil_img = Image.fromarray(arr, mode='L')
        elif pil_img.mode == 'RGB':
            pil_img = pil_img.convert('L')
        elif pil_img.mode != 'L':
            pil_img = pil_img.convert('L')

        # --- 2. Autocontrast: stretches histogram for natural mammo look ---
        pil_img = ImageOps.autocontrast(pil_img, cutoff=1)

        # --- 3. Resize for web display ------------------------------------
        pil_img.thumbnail((MAX_SIZE, MAX_SIZE))

        # --- 4. Encode as JPEG -------------------------------------------
        buf = BytesIO()
        pil_img.save(buf, format='JPEG', quality=JPEG_QUALITY)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode('ascii')
        previews[slot] = f"data:image/jpeg;base64,{encoded}"
    return previews


# ── Web UI ──────────────────────────────────────────────────────────────────

@app.route('/test', methods=['GET'])
def test_page():
    """Serve the endpoint test page."""
    import os
    test_file = os.path.join(APP_ROOT, 'test_endpoints.html')
    if os.path.exists(test_file):
        with open(test_file, 'r') as f:
            return f.read()
    return "Test page not found", 404


@app.route('/', methods=['GET'])
def index():
    return redirect(url_for('ui'))

@app.route('/ui', methods=['GET'])
def ui():
    app.jinja_env.cache.clear()
    return render_template('index.html',
                           model_name=app.config['NAME'],
                           version=app.config['ONCOSERVE_VERSION'])


@app.after_request
def disable_ui_cache(response):
    if request.path in ['/', '/ui']:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/list-remote-folders', methods=['GET'])
def list_remote_folders():
    """
    List all folders in tmp_data directory for remote access.
    Returns JSON: { folders: [folder_name1, folder_name2, ...] }
    """
    if not REMOTE_ENABLED:
        return jsonify({'error': True, 'msg': 'Remote access is disabled'}), 403
    auth = _check_api_key()
    if auth:
        return auth
    try:
        tmp_data_dir = os.path.join(APP_ROOT, 'tmp_data')
        if not os.path.exists(tmp_data_dir):
            os.makedirs(tmp_data_dir)
            return jsonify({'folders': []}), HTTP_200_OK

        folders = [f for f in os.listdir(tmp_data_dir)
                  if os.path.isdir(os.path.join(tmp_data_dir, f))]
        return jsonify({'folders': sorted(folders)}), HTTP_200_OK

    except Exception as e:
        logger.error(f"Error listing remote folders: {str(e)}")
        return jsonify({'error': True, 'msg': str(e)}), HTTP_500_INTERNAL_SERVER_ERROR


@app.route('/preview-remote-folder', methods=['POST'])
def preview_remote_folder():
    """
    Preview files in a remote folder without running prediction.
    Accepts JSON: { folder_name: 'sanjai' }
    Returns: { error, files: {l_cc: 'filename', ...}, missing: [...] }
    """
    if not REMOTE_ENABLED:
        return jsonify({'error': True, 'msg': 'Remote access is disabled'}), 403
    auth = _check_api_key()
    if auth:
        return auth
    try:
        data = request.get_json()
        folder_name = data.get('folder_name')

        if not folder_name:
            return jsonify({
                'error': True,
                'msg': 'No folder name provided'
            }), HTTP_400_BAD_REQUEST

        tmp_data_dir = os.path.join(APP_ROOT, 'tmp_data', folder_name)

        if not os.path.exists(tmp_data_dir):
            return jsonify({
                'error': True,
                'msg': f'Folder "{folder_name}" not found'
            }), HTTP_400_BAD_REQUEST

        # Find DICOM files
        import glob
        dicom_files = glob.glob(os.path.join(tmp_data_dir, '*.dcm'))

        # Map filenames to slots
        slot_map = {
            'l_cc': None, 'l_mlo': None,
            'r_cc': None, 'r_mlo': None
        }

        for dcm_path in dicom_files:
            filename = os.path.basename(dcm_path).lower()
            # Match patterns: check for l- or r- at start, or _l_ or _r_ pattern
            if (filename.startswith('l') or 'l-' in filename or '_l' in filename) and 'cc' in filename and 'mlo' not in filename:
                slot_map['l_cc'] = os.path.basename(dcm_path)
            elif (filename.startswith('l') or 'l-' in filename or '_l' in filename) and 'mlo' in filename:
                slot_map['l_mlo'] = os.path.basename(dcm_path)
            elif (filename.startswith('r') or 'r-' in filename or '_r' in filename) and 'cc' in filename and 'mlo' not in filename:
                slot_map['r_cc'] = os.path.basename(dcm_path)
            elif (filename.startswith('r') or 'r-' in filename or '_r' in filename) and 'mlo' in filename:
                slot_map['r_mlo'] = os.path.basename(dcm_path)

        missing = [s.upper().replace('_', '-') for s, f in slot_map.items() if f is None]
        found = {s: f for s, f in slot_map.items() if f is not None}

        return jsonify({
            'error': False,
            'files': found,
            'missing': missing,
            'all_found': len(missing) == 0
        }), HTTP_200_OK

    except Exception as e:
        logger.error(f"Error previewing remote folder: {str(e)}")
        return jsonify({'error': True, 'msg': str(e)}), HTTP_500_INTERNAL_SERVER_ERROR


@app.route('/predict-remote', methods=['POST'])
def predict_remote():
    """
    Load DICOM files from selected tmp_data folder and run prediction.
    Accepts JSON: { folder_name: 'sanjai' }
    Returns same format as /predict endpoint.
    """
    logger.info("Remote folder prediction request received.")

    if not REMOTE_ENABLED:
        return jsonify({'error': True, 'msg': 'Remote access is disabled'}), 403
    auth = _check_api_key()
    if auth:
        return auth

    try:
        data = request.get_json()
        folder_name = data.get('folder_name')

        if not folder_name:
            return jsonify({
                'error': True,
                'msg': 'No folder name provided'
            }), HTTP_400_BAD_REQUEST

        tmp_data_dir = os.path.join(APP_ROOT, 'tmp_data', folder_name)

        if not os.path.exists(tmp_data_dir):
            return jsonify({
                'error': True,
                'msg': f'Folder "{folder_name}" not found in tmp_data'
            }), HTTP_400_BAD_REQUEST

        # Find DICOM files in the folder
        import glob
        dicom_files = glob.glob(os.path.join(tmp_data_dir, '*.dcm'))

        if not dicom_files:
            return jsonify({
                'error': True,
                'msg': f'No DICOM files found in folder "{folder_name}"'
            }), HTTP_400_BAD_REQUEST

        # Map filenames to slots (case-insensitive matching)
        slot_map = {
            'l_cc': None, 'l_mlo': None,
            'r_cc': None, 'r_mlo': None
        }

        for dcm_path in dicom_files:
            filename = os.path.basename(dcm_path).lower()
            # Match patterns: check for l- or r- at start, or _l_ or _r_ pattern
            if (filename.startswith('l') or 'l-' in filename or '_l' in filename) and 'cc' in filename and 'mlo' not in filename:
                slot_map['l_cc'] = dcm_path
            elif (filename.startswith('l') or 'l-' in filename or '_l' in filename) and 'mlo' in filename:
                slot_map['l_mlo'] = dcm_path
            elif (filename.startswith('r') or 'r-' in filename or '_r' in filename) and 'cc' in filename and 'mlo' not in filename:
                slot_map['r_cc'] = dcm_path
            elif (filename.startswith('r') or 'r-' in filename or '_r' in filename) and 'mlo' in filename:
                slot_map['r_mlo'] = dcm_path

        missing = [s for s, f in slot_map.items() if f is None]
        if missing:
            return jsonify({
                'error': True,
                'msg': f'Missing DICOM files for: {", ".join(missing).upper().replace("_", "-")}. '
                       f'Found files: {[os.path.basename(f) for f in dicom_files]}'
            }), HTTP_400_BAD_REQUEST

        # Create file-like objects from the DICOM files
        from werkzeug.datastructures import FileStorage
        from io import BytesIO

        dicoms = []
        for slot_name in ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']:
            with open(slot_map[slot_name], 'rb') as f:
                file_obj = FileStorage(
                    stream=BytesIO(f.read()),
                    filename=os.path.basename(slot_map[slot_name])
                )
                dicoms.append(file_obj)

        # Run prediction with slot metadata
        slots = ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']
        slot_metadata = {
            'l_cc':  (1, 0),
            'l_mlo': (1, 1),
            'r_cc':  (0, 0),
            'r_mlo': (0, 1),
        }

        images = oncodata_wrapper.get_pngs_with_metadata(dicoms, slot_metadata, slots, oncodata_args, logger)
        previews = _encode_previews(images, slots)
        logger.info(ONCODATA_SUCCESS_MSG)

        if len(images) < onconet_args.min_num_images:
            return jsonify({
                'error': True,
                'msg': f'Only {len(images)} valid mammogram view(s) were found.'
            }), HTTP_400_BAD_REQUEST

        y = onconet.process_exam(images, risk_factor_vector=None)
        logger.info(ONCONET_SUCCESS_MSG)

        prediction = {f'year_{i + 1}': round(float(p) * 100, 2) for i, p in enumerate(y)}
        return jsonify({
            'error': False,
            'prediction': prediction,
            'previews': previews,
            'msg': f'Prediction complete for remote folder: {folder_name}'
        }), HTTP_200_OK

    except Exception as e:
        msg = ONCOSERVE_FAIL_MSG.format(str(e))
        logger.error(msg)
        return jsonify({'error': True, 'msg': msg}), HTTP_500_INTERNAL_SERVER_ERROR


@app.route('/predict-synthetic', methods=['POST'])
def predict_synthetic():
    """
    Load synthetic DICOM files from synthetic_dicoms/ folder and run prediction.
    Convenience endpoint for testing without manual file upload.
    """
    logger.info("Synthetic data prediction request received.")
    auth = _check_api_key()
    if auth:
        return auth

    import glob
    synthetic_dir = os.path.join(APP_ROOT, 'synthetic_dicoms')

    # Find synthetic DICOM files
    dicom_files = glob.glob(os.path.join(synthetic_dir, '*.dcm'))
    if not dicom_files:
        return jsonify({
            'error': True,
            'msg': f'No synthetic DICOM files found in {synthetic_dir}. '
                   'Run: python generate_synthetic_dicoms.py'
        }), HTTP_400_BAD_REQUEST

    # Map filenames to slots
    slot_map = {
        'l_cc': None, 'l_mlo': None,
        'r_cc': None, 'r_mlo': None
    }

    for dcm_path in dicom_files:
        filename = os.path.basename(dcm_path).lower()
        for slot in slot_map.keys():
            if slot.replace('_', '').lower() in filename.lower():
                slot_map[slot] = dcm_path
                break

    missing = [s for s, f in slot_map.items() if f is None]
    if missing:
        return jsonify({
            'error': True,
            'msg': f'Missing synthetic DICOM files for: {", ".join(missing).upper()}. '
                   'Run: python generate_synthetic_dicoms.py'
        }), HTTP_400_BAD_REQUEST

    try:
        # Create file-like objects from the DICOM files
        from werkzeug.datastructures import FileStorage
        from io import BytesIO

        dicoms = []
        for slot_name in ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']:
            with open(slot_map[slot_name], 'rb') as f:
                file_obj = FileStorage(
                    stream=BytesIO(f.read()),
                    filename=os.path.basename(slot_map[slot_name])
                )
                dicoms.append(file_obj)

        # Run prediction with slot metadata
        slots = ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']
        slot_metadata = {
            'l_cc':  (1, 0),
            'l_mlo': (1, 1),
            'r_cc':  (0, 0),
            'r_mlo': (0, 1),
        }

        images = oncodata_wrapper.get_pngs_with_metadata(dicoms, slot_metadata, slots, oncodata_args, logger)
        previews = _encode_previews(images, slots)
        logger.info(ONCODATA_SUCCESS_MSG)

        if len(images) < onconet_args.min_num_images:
            return jsonify({
                'error': True,
                'msg': f'Only {len(images)} valid mammogram view(s) were found.'
            }), HTTP_400_BAD_REQUEST

        y = onconet.process_exam(images, risk_factor_vector=None)
        logger.info(ONCONET_SUCCESS_MSG)

        prediction = {f'year_{i + 1}': round(float(p) * 100, 2) for i, p in enumerate(y)}
        return jsonify({'error': False, 'prediction': prediction, 'previews': previews, 'msg': 'Sample prediction complete'}), HTTP_200_OK

    except Exception as e:
        msg = ONCOSERVE_FAIL_MSG.format(str(e))
        logger.error(msg)
        return jsonify({'error': True, 'msg': msg}), HTTP_500_INTERNAL_SERVER_ERROR



@app.route('/predict', methods=['POST'])
def predict():
    """
    Web UI inference endpoint.
    Accepts 4 DICOM files posted as form fields: l_cc, l_mlo, r_cc, r_mlo.
    Returns JSON: { error, prediction: {year_1..year_5 as %}, msg }
    """
    auth = _check_api_key()
    if auth:
        return auth
    import sys
    logger.info("Web UI predict request received.")
    slots    = ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']
    dicoms   = [request.files.get(s) for s in slots]
    missing  = [s for s, f in zip(slots, dicoms) if f is None or f.filename == '']

    sys.stdout.write(f"\n{'='*70}\n")
    sys.stdout.write(f"PREDICT ENDPOINT CALLED\n")
    sys.stdout.write(f"Received files: {[f.filename if f else 'None' for f in dicoms]}\n")
    sys.stdout.flush()

    if missing:
        return jsonify({
            'error': True,
            'msg': f'Missing DICOM files for views: {", ".join(missing).upper().replace("_", "-")}. '
                   'All 4 views (L-CC, L-MLO, R-CC, R-MLO) are required.'
        }), HTTP_400_BAD_REQUEST

    try:
        sys.stdout.write("Step 1: Preparing metadata\n")
        sys.stdout.flush()

        slots = ['l_cc', 'l_mlo', 'r_cc', 'r_mlo']
        # Map slot names to (side, view) metadata
        slot_metadata = {
            'l_cc':  (1, 0),  # (side_seq=Left, view_seq=CC)
            'l_mlo': (1, 1),  # (side_seq=Left, view_seq=MLO)
            'r_cc':  (0, 0),  # (side_seq=Right, view_seq=CC)
            'r_mlo': (0, 1),  # (side_seq=Right, view_seq=MLO)
        }

        sys.stdout.write("Step 2: Converting DICOMs to PNG\n")
        sys.stdout.flush()

        images = oncodata_wrapper.get_pngs_with_metadata(dicoms, slot_metadata, slots, oncodata_args, logger)

        sys.stdout.write(f"Step 3: Converted {len(images)} images\n")
        sys.stdout.flush()

        logger.info(ONCODATA_SUCCESS_MSG)

        if len(images) < onconet_args.min_num_images:
            return jsonify({
                'error': True,
                'msg': (f'Only {len(images)} valid mammogram view(s) were found after processing. '
                        f'Ensure each file is a standard CC or MLO view with correct DICOM metadata '
                        f'(ImageLaterality + ViewPosition tags).')
            }), HTTP_400_BAD_REQUEST

        sys.stdout.write("Step 4: Running model inference\n")
        sys.stdout.flush()

        y = onconet.process_exam(images, risk_factor_vector=None)

        sys.stdout.write("Step 5: Processing complete\n")
        sys.stdout.flush()

        logger.info(ONCONET_SUCCESS_MSG)

        prediction = {f'year_{i + 1}': round(float(p) * 100, 2) for i, p in enumerate(y)}

        # Include the PNG previews returned by OncoData
        previews = _encode_previews(images, slots)

        sys.stdout.write(f"Step 6: Returning JSON response\n")
        sys.stdout.write(f"Predictions: {prediction}\n")
        sys.stdout.write(f"{'='*70}\n\n")
        sys.stdout.flush()

        return jsonify({'error': False, 'prediction': prediction, 'previews': previews, 'msg': 'OK'}), HTTP_200_OK

    except Exception as e:
        import traceback
        sys.stdout.write(f"\n{'='*70}\n")
        sys.stdout.write(f"ERROR IN PREDICT:\n")
        sys.stdout.write(f"{str(e)}\n")
        sys.stdout.write(f"TRACEBACK:\n")
        sys.stdout.write(traceback.format_exc())
        sys.stdout.write(f"{'='*70}\n\n")
        sys.stdout.flush()

        msg = ONCOSERVE_FAIL_MSG.format(str(e))
        logger.error(msg)

        error_str = str(e).lower()
        if "dicom conversion failed" in error_str or "missing required element" in error_str or "corrupted" in error_str:
            return jsonify({'error': True, 'msg': str(e)}), HTTP_400_BAD_REQUEST

        return jsonify({'error': True, 'msg': msg}), HTTP_500_INTERNAL_SERVER_ERROR


# ── Original REST API ────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'message': 'OncoServe is running',
        'version': app.config['ONCOSERVE_VERSION']
    }), HTTP_200_OK


@app.route('/serve', methods=['POST'])
def serve():
    '''
    Raw API endpoint (original). Accepts any number of dicom files posted as
    multipart field "dicom". Returns exam-level prediction JSON.
    '''
    logger.info("Serving /serve request...")
    auth = _check_api_key()
    if auth:
        return auth
    response = {
        'model_name':        app.config['NAME'],
        'oncoserve_version': app.config['ONCOSERVE_VERSION'],
        'onconet_version':   app.config['ONCONET_VERSION'],
        'oncodata_version':  app.config['ONCODATA_VERSION'],
        'log_file':          LOG_FILE,
    }
    try:
        dicoms   = request.files.getlist('dicom')
        metadata = request.form
        response['metadata'] = metadata
        images   = oncodata_wrapper.get_pngs(dicoms, oncodata_args, logger)
        logger.info(ONCODATA_SUCCESS_MSG)

        if onconet_args.use_risk_factors and not onconet_args.use_pred_risk_factors_at_test:
            assert 'mrn' in metadata
            assert 'accession' in metadata
            risk_factor_vector = oncoqueries_wrapper.get_risk_factors(
                onconet_args, metadata['mrn'], metadata['accession'],
                oncodata_args.temp_img_dir, logger)
            logger.info(ONCOQUERIES_SUCCESS_MSG)
        else:
            risk_factor_vector = None

        y = onconet.process_exam(images, risk_factor_vector)
        logger.info(ONCONET_SUCCESS_MSG)
        response['prediction'] = y
        response['msg'] = 'OK'
        return jsonify(response), HTTP_200_OK

    except Exception as e:
        response['prediction'] = None
        response['msg'] = ONCOSERVE_FAIL_MSG.format(str(e))
        return jsonify(response), HTTP_500_INTERNAL_SERVER_ERROR


if __name__ == '__main__':
    port = app.config['PORT']
    logger.info("Launching app at port {}".format(port))
    app.run(host='0.0.0.0', port=port)
