"""
Pure-Python DICOM to 16-bit PNG converter using pydicom + numpy + Pillow.

Replaces dcmtk's dcmj2pnm so the app runs on Windows without any system
dependencies.  Replicates the three windowing strategies used by the
original dcmtk-based converter:

  GE manufacturer        -> apply first VOI LUT window from DICOM metadata
  C-View series          -> fixed window (center=540, width=580)
  Everything else        -> min-max window stretch
"""

import os
import numpy as np
import pydicom
from PIL import Image


def dicom_to_png_pydicom(dicom_path, image_path, selection_criteria=None,
                         skip_existing=False):
    """Convert a DICOM mammogram to a 16-bit grayscale PNG.

    Args:
        dicom_path:          Path to the source .dcm file.
        image_path:          Destination .png path.
        selection_criteria:  Unused; kept for API parity with dcmtk converter.
        skip_existing:       Skip conversion if image_path already exists.
    """
    if skip_existing and os.path.exists(image_path):
        return

    try:
        # Try standard read first
        dcm = pydicom.dcmread(dicom_path)
    except Exception as e:
        # If standard read fails, try with stop_before_pixels to avoid pixel data parse errors
        try:
            dcm = pydicom.dcmread(dicom_path, stop_before_pixels=True)
            print(f"Warning: Read DICOM header only for {dicom_path} (full read failed)")
        except Exception as e2:
            raise ValueError(f"Failed to read DICOM file {dicom_path}: {str(e)}. "
                           f"Alternate read also failed: {str(e2)}")

    # Try to get pixel data, with defensive fallback
    try:
        pixels = dcm.pixel_array.astype(np.float64)
    except AttributeError as e:
        # Missing required pixel-related metadata
        raise ValueError(
            f"DICOM file {dicom_path} missing pixel data or required metadata. "
            f"Error: {str(e)}. This DICOM file may be corrupted or not a valid mammogram."
        )
    except Exception as e:
        raise ValueError(f"Failed to extract pixel array from {dicom_path}: {str(e)}")

    # Invert MONOCHROME1 so bright = high signal (same as dcmj2pnm)
    photometric = getattr(dcm, 'PhotometricInterpretation', '')
    if photometric and 'MONOCHROME1' in photometric.upper():
        pixels = pixels.max() - pixels

    manufacturer  = str(getattr(dcm, 'Manufacturer', '')).strip()
    series_desc   = str(getattr(dcm, 'SeriesDescription', '')).strip()

    try:
        if 'GE' in manufacturer.upper():
            pixels = _apply_voi_lut(dcm, pixels)
        elif 'C-View' in series_desc:
            pixels = _apply_window(pixels, center=540.0, width=580.0)
        else:
            pixels = _apply_min_max_window(pixels)
    except Exception as e:
        # If windowing fails, fall back to min-max
        print(f"Warning: Windowing operation failed for {dicom_path}: {str(e)}")
        print(f"         Falling back to min-max window stretch.")
        pixels = _apply_min_max_window(pixels)

    pixels = np.clip(pixels, 0, 65535).astype(np.uint16)

    os.makedirs(os.path.dirname(os.path.abspath(image_path)), exist_ok=True)
    # Pillow saves uint16 arrays as 16-bit PNGs via mode 'I;16'
    Image.fromarray(pixels, mode='I;16').save(image_path)


# ---------------------------------------------------------------------------
# Windowing helpers
# ---------------------------------------------------------------------------

def _apply_voi_lut(dcm, pixels):
    """Apply the first VOI LUT window from the DICOM header (GE path)."""
    try:
        wc = getattr(dcm, 'WindowCenter', None)
        ww = getattr(dcm, 'WindowWidth', None)
        if wc is not None and ww is not None:
            wc = float(wc[0]) if hasattr(wc, '__len__') else float(wc)
            ww = float(ww[0]) if hasattr(ww, '__len__') else float(ww)
            return _apply_window(pixels, center=wc, width=ww)
    except (ValueError, TypeError, AttributeError) as e:
        print(f"Warning: Could not apply VOI LUT window: {str(e)}")

    return _apply_min_max_window(pixels)


def _apply_window(pixels, center, width):
    """Linear window/level mapping scaled to [0, 65535]."""
    lower = center - width / 2.0
    upper = center + width / 2.0
    return (pixels - lower) / (upper - lower) * 65535.0


def _apply_min_max_window(pixels):
    """Stretch the full pixel range to [0, 65535]."""
    pmin, pmax = pixels.min(), pixels.max()
    if pmax == pmin:
        return np.zeros_like(pixels)
    return (pixels - pmin) / (pmax - pmin) * 65535.0
