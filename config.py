import os


APP_ROOT = os.path.dirname(os.path.abspath(__file__))


def _resolve_pathlike_value(key, value):
    """Resolve project-relative filesystem values to absolute paths."""
    if not isinstance(value, str) or not value:
        return value

    lowered = key.lower()
    looks_like_path_key = (
        lowered.endswith("_path")
        or lowered.endswith("_dir")
        or "snapshot" in lowered
        or lowered in {"cache_path", "temp_img_dir"}
    )
    if not looks_like_path_key:
        return value

    if os.path.isabs(value):
        return os.path.normpath(value)

    return os.path.normpath(os.path.join(APP_ROOT, value))

class Args(object):
    def __init__(self, config_dict):
        resolved = {
            key: _resolve_pathlike_value(key, val)
            for key, val in config_dict.items()
        }
        self.__dict__.update(resolved)

class Config(object):
    DEBUG=False
    AGGREGATION="none"
    ONCONET_CONFIG = {
        'cuda': False,
        'video': False,
        'test_image_transformers': ['scale_2d'],
        'test_tensor_transformers': ['force_num_chan_2d', 'normalize_2d'],
        'model_name': 'mirai_full',
        'snapshot': None,
        'img_encoder_snapshot': None,
        'transformer_snapshot': None,
        'use_precomputed_hiddens': False,
        'img_size': [256, 256],
        'img_mean': [0.2023],
        'img_std': [0.2576],
        'num_chan': 3,
        'freeze_image_encoder': False
    }
    ONCODATA_CONFIG = {
        'convertor': 'pydicom',
        'temp_img_dir': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp_images')
    }
    ONCONET_ARGS = Args(ONCONET_CONFIG)
    ONCODATA_ARGS = Args(ONCODATA_CONFIG)
    ONCOSERVE_VERSION = '0.2.0'
    ONCODATA_VERSION = '0.2.0'
    ONCONET_VERSION =  '0.2.0'
    ONCOQUERIES_VERSION =  '0.2.0'
    NAME = 'BaseConfig'
    PORT = 5009


class DensityConfig(Config):
    NAME = '2D_Mammo_Breast_Density'
    AGGREGATION="vote"

    def density_label_func(pred):
        pred = pred.argmax()
        density_labels = [1,2,3,4]
        return density_labels[pred]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7662.53827604],
        'img_std': [12604.0682836],
        'img_size': [256,256],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'snapshot': 'snapshots/mgh_mammo_density_sep26_2018.pt',
        'label_map': density_label_func,
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors':False,
        'callibrator_path': None
    }


    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer1YrDetectionHybridConfig(Config):
    NAME = '2D_Mammo_Cancer_1Year_Detection_Hybrid'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_1yr_detection_sep02_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': True,
        'risk_factor_keys': "density binary_family_history binary_biopsy_benign binary_biopsy_LCIS binary_biopsy_atypical_hyperplasia age menarche_age menopause_age first_pregnancy_age prior_hist race parous menopausal_status weight height ovarian_cancer ovarian_cancer_age ashkenazi brca mom_bc_cancer_history m_aunt_bc_cancer_history p_aunt_bc_cancer_history m_grandmother_bc_cancer_history p_grantmother_bc_cancer_history sister_bc_cancer_history mom_oc_cancer_history m_aunt_oc_cancer_history p_aunt_oc_cancer_history m_grandmother_oc_cancer_history p_grantmother_oc_cancer_history sister_oc_cancer_history hrt_type hrt_duration hrt_years_ago_stopped",
        'use_region_annotation': False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_1yr_detection_sep19_2018.pt'
    }
    ONCONET_CONFIG['risk_factor_keys'] = ONCONET_CONFIG['risk_factor_keys'].split()
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer5YrRiskHybridConfig(Config):
    NAME = '2D_Mammo_Cancer_5Year_Risk_Hybrid'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_5yr_risk_hybrid_aug08_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': True,
        'risk_factor_keys': "density binary_family_history binary_biopsy_benign binary_biopsy_LCIS binary_biopsy_atypical_hyperplasia age menarche_age menopause_age first_pregnancy_age prior_hist race parous menopausal_status weight height ovarian_cancer ovarian_cancer_age ashkenazi brca mom_bc_cancer_history m_aunt_bc_cancer_history p_aunt_bc_cancer_history m_grandmother_bc_cancer_history p_grantmother_bc_cancer_history sister_bc_cancer_history mom_oc_cancer_history m_aunt_oc_cancer_history p_aunt_oc_cancer_history m_grandmother_oc_cancer_history p_grantmother_oc_cancer_history sister_oc_cancer_history hrt_type hrt_duration hrt_years_ago_stopped",
        "use_region_annotation": False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_5yr_risk_hybrid_aug08_2018.pt'
    }
    ONCONET_CONFIG['risk_factor_keys'] = ONCONET_CONFIG['risk_factor_keys'].split()
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer1YrDetectionConfig(Config):
    NAME = '2D_Mammo_Cancer_1Year_Detection_Hybrid'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_1yr_detection_sep02_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': True,
        'risk_factor_keys': "density binary_family_history binary_biopsy_benign binary_biopsy_LCIS binary_biopsy_atypical_hyperplasia age menarche_age menopause_age first_pregnancy_age prior_hist race parous menopausal_status weight height ovarian_cancer ovarian_cancer_age ashkenazi brca mom_bc_cancer_history m_aunt_bc_cancer_history p_aunt_bc_cancer_history m_grandmother_bc_cancer_history p_grantmother_bc_cancer_history sister_bc_cancer_history mom_oc_cancer_history m_aunt_oc_cancer_history p_aunt_oc_cancer_history m_grandmother_oc_cancer_history p_grantmother_oc_cancer_history sister_oc_cancer_history hrt_type hrt_duration hrt_years_ago_stopped",
        'use_region_annotation': False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_1yr_detection_sep19_2018.pt'
    }
    ONCONET_CONFIG['risk_factor_keys'] = ONCONET_CONFIG['risk_factor_keys'].split()
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer5YrRiskImgOnlyConfig(Config):
    NAME = '2D_Mammo_Cancer_5Year_Risk_ImgOnly'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_5yr_risk_img_only_aug08_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': False,
        "use_region_annotation": False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_5yr_risk_img_only_aug08_2018.pt'
    }
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer2YrRiskHybridConfig(Config):
    NAME = '2D_Mammo_Cancer_2Year_Risk_Hybrid'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_2yr_risk_hybrid_aug10_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': True,
        'risk_factor_keys': "density binary_family_history binary_biopsy_benign binary_biopsy_LCIS binary_biopsy_atypical_hyperplasia age menarche_age menopause_age first_pregnancy_age prior_hist race parous menopausal_status weight height ovarian_cancer ovarian_cancer_age ashkenazi brca mom_bc_cancer_history m_aunt_bc_cancer_history p_aunt_bc_cancer_history m_grandmother_bc_cancer_history p_grantmother_bc_cancer_history sister_bc_cancer_history mom_oc_cancer_history m_aunt_oc_cancer_history p_aunt_oc_cancer_history m_grandmother_oc_cancer_history p_grantmother_oc_cancer_history sister_oc_cancer_history hrt_type hrt_duration hrt_years_ago_stopped",
        'use_region_annotation': False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_2yr_risk_hybrid_aug10_2018.pt'
    }
    ONCONET_CONFIG['risk_factor_keys'] = ONCONET_CONFIG['risk_factor_keys'].split()
    ONCONET_ARGS = Args(ONCONET_CONFIG)


class MammoCancer2YrRiskImgOnlyConfig(Config):
    NAME = '2D_Mammo_Cancer_2Year_Risk_ImgOnly'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_2yr_risk_img_only_aug07_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': False,
        "use_region_annotation": False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_2yr_risk_img_only_aug07_2018.pt'
    }
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancer1YrRiskImgOnlyConfig(Config):
    NAME = '2D_Mammo_Cancer_1Year_Risk_ImgOnly'
    AGGREGATION="max"

    def cancer_risk_func(pred):
        return pred[1]

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7240.058],
        'img_std': [12072.904],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'label_map': cancer_risk_func,
        'snapshot': 'snapshots/mgh_mammo_cancer_1yr_risk_nov22_2018.pt',
        'video':False,
        'use_precomputed_hiddens': False,
        'use_risk_factors': False,
        "use_region_annotation": False,
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'snapshots/callibrator_mgh_mammo_cancer_1yr_risk_nov22_2018.pt'
    }
    ONCONET_ARGS = Args(ONCONET_CONFIG)

class MammoCancerMirai(Config):
    NAME = '2D_Mammo_Cancer_Mirai'
    AGGREGATION="max"

    ONCONET_CONFIG = {
        'cuda': False,
        'img_mean': [7047.99],
        'img_std': [12005.5],
        'img_size': [1664,2048],
        'num_chan': 3,
        'num_gpus': 1,
        'test_image_transformers': ['scale_2d', 'align_to_left'],
        'test_tensor_transformers': ["force_num_chan_2d", "normalize_2d"],
        'additional': None,
        'img_encoder_snapshot': 'OncoNet/snapshots/mgh_mammo_MIRAI_Base_May20_2019.p',
        'transformer_snapshot': 'OncoNet/snapshots/mgh_mammo_cancer_MIRAI_Transformer_Jan13_2020.p',
        'video':False,
        "pred_risk_factors": True,
        'use_pred_risk_factors_at_test': True,
        'pred_both_sides': False,
        'multi_image': True,
        'num_images': 4,
        'wrap_model':False,
        'state_dict_path': None,
        'snapshot': None,
        'min_num_images': 4,
        'model_name': 'mirai_full',
        'max_followup': 5,
        'use_risk_factors': True,
        "use_region_annotation": False,
        'risk_factor_keys': "density binary_family_history binary_biopsy_benign binary_biopsy_LCIS binary_biopsy_atypical_hyperplasia age menarche_age menopause_age first_pregnancy_age prior_hist race parous menopausal_status weight height ovarian_cancer ovarian_cancer_age ashkenazi brca mom_bc_cancer_history m_aunt_bc_cancer_history p_aunt_bc_cancer_history m_grandmother_bc_cancer_history p_grantmother_bc_cancer_history sister_bc_cancer_history mom_oc_cancer_history m_aunt_oc_cancer_history p_aunt_oc_cancer_history m_grandmother_oc_cancer_history p_grantmother_oc_cancer_history sister_oc_cancer_history hrt_type hrt_duration hrt_years_ago_stopped",
        'use_second_order_risk_factor_features': False,
        'callibrator_path': 'OncoNet/snapshots/callibrators/MIRAI_FULL_PRED_RF.callibrator.p'
    }
    ONCONET_ARGS = Args(ONCONET_CONFIG)

