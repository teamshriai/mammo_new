import os
import uuid
import oncoserve.logger
from oncodata.dicom_to_png.dicom_to_png import dicom_to_png_dcmtk, dicom_to_png_imagemagick
from oncodata.dicom_to_png.dicom_to_png_pydicom import dicom_to_png_pydicom
from PIL import Image
import pdb
import pydicom


NO_CONVERTOR_MSG = 'OncoData- Converter choice {} not recognized!'
FAIL_CONVERT_MESSAGE = 'OncoData- Fail to convert dicom {}. Caused Exception {} with args: {}'
SUCCESS_CONV_MESSAGE = 'OncoData- Succesffuly converted dicom {} into png with args: {}'

def get_converter(args, logger):
    convertor = args.convertor

    if convertor == 'dcmtk':
        return dicom_to_png_dcmtk
    elif convertor == 'imagemagick':
        return dicom_to_png_imagemagick
    elif convertor == 'pydicom':
        return dicom_to_png_pydicom
    else:
        err_msg = NO_CONVERTOR_MSG.format(convertor)
        logger.error(err_msg)
        raise Exception(err_msg)


def remove_if_exist(path):
    if os.path.exists(path):
            os.remove(path)

def get_pngs(dicoms, args, logger):
    '''
        Converts dicoms into PIL images through use of OncoData.
        This function makes and deletes temporary files to interface with OncoData depdencies.

        params:
        - dicoms: List of dicom files, each in bytes
        - args: Instance of OncoData args. Specify what kind of convertor to use. i.e dcmtk, imagemagic or matlab.

        returns:
        - images: list of PIL image objects

    '''
    convertor = get_converter(args, logger)
    images = []
    for key, dicom in enumerate(dicoms):
        os.makedirs(args.temp_img_dir, exist_ok=True)
        dicom_path = "{}.dcm".format(os.path.join(args.temp_img_dir, str(uuid.uuid4())))
        png_path = "{}.png".format(os.path.join(args.temp_img_dir, str(uuid.uuid4())))

        remove_if_exist(dicom_path)
        remove_if_exist(png_path)

        dicom.save(dicom_path)
        convertor(dicom_path, png_path, [], skip_existing=False)
        try:
            side, view, permissible_mammogram = get_info(dicom_path)
            os.remove(dicom_path)
            if permissible_mammogram:
                with Image.open(png_path) as _im:
                    img = _im.convert('I') if _im.mode in ('I;16', 'I;16B') else _im.copy()
                images.append({'x': img, 'side_seq': side, 'view_seq': view})
                logger.info(SUCCESS_CONV_MESSAGE.format(key, args.convertor))
            else:
                logger.info(FAIL_CONVERT_MESSAGE.format(key, "Not permissible_mammogram Err", args.convertor))
            os.remove(png_path)

        except Exception as e:
            if os.path.exists(dicom_path):
                os.remove(dicom_path)
            err_msg = FAIL_CONVERT_MESSAGE.format(key, e, args.convertor)
            logger.error(err_msg)
            raise Exception(err_msg)

    return images

def get_pngs_with_metadata(dicoms, slot_metadata, slots, args, logger):
    '''
    Converts dicoms to PNG using provided metadata (doesn't require DICOM tags).
    Used when DICOM files lack proper mammography metadata.

    Args:
        dicoms: List of dicom FileStorage objects
        slot_metadata: Dict mapping slot name to (side_seq, view_seq)
        slots: List of slot names in order
        args: OncoData args
        logger: Logger instance

    Returns:
        List of dicts with {'x': PIL_image, 'side_seq': int, 'view_seq': int}
    '''
    convertor = get_converter(args, logger)
    images = []

    for slot_name, dicom in zip(slots, dicoms):
        os.makedirs(args.temp_img_dir, exist_ok=True)
        dicom_path = "{}.dcm".format(os.path.join(args.temp_img_dir, str(uuid.uuid4())))
        png_path = "{}.png".format(os.path.join(args.temp_img_dir, str(uuid.uuid4())))

        remove_if_exist(dicom_path)
        remove_if_exist(png_path)

        dicom.save(dicom_path)

        try:
            convertor(dicom_path, png_path, [], skip_existing=False)
        except ValueError as e:
            # DICOM conversion failed - provide detailed error message
            if os.path.exists(dicom_path):
                os.remove(dicom_path)
            err_msg = f"DICOM conversion failed for slot '{slot_name}': {str(e)}"
            logger.error(err_msg)
            raise Exception(err_msg)
        except Exception as e:
            # Other errors during conversion
            if os.path.exists(dicom_path):
                os.remove(dicom_path)
            err_msg = f"Unexpected error converting {slot_name} to PNG: {str(e)}"
            logger.error(err_msg)
            raise Exception(err_msg)

        try:
            # Use provided metadata instead of reading from DICOM
            side_seq, view_seq = slot_metadata[slot_name]
            os.remove(dicom_path)

            with Image.open(png_path) as _im:
                img = _im.convert('I') if _im.mode in ('I;16', 'I;16B') else _im.copy()
            images.append({'x': img, 'side_seq': side_seq, 'view_seq': view_seq})
            logger.info(SUCCESS_CONV_MESSAGE.format(slot_name, args.convertor))
            os.remove(png_path)

        except Exception as e:
            if os.path.exists(dicom_path):
                os.remove(dicom_path)
            if os.path.exists(png_path):
                os.remove(png_path)
            err_msg = FAIL_CONVERT_MESSAGE.format(slot_name, e, args.convertor)
            logger.error(err_msg)
            raise Exception(err_msg)

    return images

def get_info(dicom_path):
    dcm = pydicom.dcmread(dicom_path)
    view_str = getattr(dcm, 'ViewPosition', None)
    side_str = getattr(dcm, 'ImageLaterality', None)

    # Debug: print all available tags
    print(f"\n=== DICOM Tags Debug ===")
    print(f"File: {dicom_path}")
    print(f"ViewPosition: {view_str}")
    print(f"ImageLaterality: {side_str}")
    print(f"All DICOM tags:")
    for tag in dcm.dir():
        try:
            value = getattr(dcm, tag)
            if 'view' in tag.lower() or 'lateral' in tag.lower() or 'position' in tag.lower():
                print(f"  {tag}: {value}")
        except:
            pass
    print("======================\n")

    if not view_str or not side_str:
        raise ValueError(f"DICOM missing required tags: ViewPosition={view_str}, ImageLaterality={side_str}")

    view_seq = 0 if view_str == 'CC' else 1
    side_seq = 0 if side_str == 'R' else 1
    dcm_permissible = side_str in ['R', 'L'] and view_str in ['MLO', 'CC']
    return side_seq, view_seq, dcm_permissible


