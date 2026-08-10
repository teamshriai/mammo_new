import logging
import pickle
import torch
import torch.autograd as autograd
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import oncoserve.logger
import onconet.utils.parsing as parsing
from  onconet.transformers.basic import ComposeTrans
from onconet.models.factory import get_model
import  onconet.transformers.factory as transformer_factory
import oncoserve.aggregators.factory as aggregator_factory
import pdb

INIT_MESSAGE = "OncoNet- Initializing OncoNet Wrapper..."
TRANSF_MESSAGE = "OncoNet- Transfomers succesfully composed"
MODEL_MESSAGE = "OncoNet- Model successfully loaded from : {}"
AGGREGATOR_MESSAGE = "OncoNet- Aggregator [{}] succesfully loaded"
IMG_START_CLASSIF_MESSAGE = "OncoNet- Image classification start with tensor size {}"
IMG_FINISH_CLASSIF_MESSAGE = "OncoNet- Image classification produced {}"
EXAM_CLASSIF_MESSAGE = "OncoNet- Exam classification complete!"
ERR_MSG = "OncoNet- Fail to label exam. Exception: {}"

class OncoNetWrapper(object):
    def __init__(self, args, aggregator_name, logger):
        logger.info(INIT_MESSAGE)
        self.args = args
        args.cuda = args.cuda and torch.cuda.is_available()
        args.test_image_transformers = parsing.parse_transformers(args.test_image_transformers)
        args.test_tensor_transformers = parsing.parse_transformers(args.test_tensor_transformers)
        test_transformers = transformer_factory.get_transformers(
            args.test_image_transformers, args.test_tensor_transformers, args)


        self.transformer = ComposeTrans(test_transformers)
        logger.info(TRANSF_MESSAGE)
        if self.args.model_name == 'mirai_full':
            self.model = get_model(args)
        else:
            try:
                self.model = torch.load(args.snapshot, map_location='cpu', weights_only=False)
            except TypeError:
                # Older torch versions do not support weights_only.
                self.model = torch.load(args.snapshot, map_location='cpu')

        # Unpack models taht were trained as data parallel
        if isinstance(self.model, nn.DataParallel):
            self.model = self.model.module
        # Add use precomputed hiddens for models trained before it was introduced.
        # Assumes a resnet base backbone
        try:
            self.model._model.args.use_precomputed_hiddens = args.use_precomputed_hiddens
            self.model._model.args.cuda = args.cuda
        except Exception as e:
            pass
        # Load callibrator if desired
        if args.callibrator_path is not None:
            try:
                with open(args.callibrator_path, 'rb') as f:
                    self.callibrator = pickle.load(f)
            except (ModuleNotFoundError, AttributeError) as e:
                logger.warning(f"Could not load calibrator from {args.callibrator_path}: {e}. Proceeding without calibration.")
                self.callibrator = None
        else:
            self.callibrator = None

        logger.info(MODEL_MESSAGE.format(args.snapshot))
        self.aggregator = aggregator_factory.get_exam_aggregator(aggregator_name)

        self.logger = logger


    @torch.no_grad()
    def process_image_indep(self, batch, risk_factor_vector=None):
        try:
            ## Apply transformers
            x = self.transformer(batch['x'], self.args.additional)
            x = autograd.Variable(x.unsqueeze(0))
            risk_factors = autograd.Variable(risk_factor_vector.unsqueeze(0)) if risk_factor_vector is not None else None
            self.logger.info(IMG_START_CLASSIF_MESSAGE.format(x.size()))
            if self.args.cuda:
                x = x.cuda()
                self.model = self.model.cuda()
            else:
                self.model = self.model.cpu()
            ## Index 0 to toss batch dimension
            pred_y = F.softmax(self.model(x, risk_factors)[0])[0]
            pred_y = np.array(self.args.label_map( pred_y.cpu().data.numpy() ))
            if self.callibrator is not None:
                pred_y = self.callibrator.predict_proba(pred_y.reshape(-1,1))[0,1]
            self.logger.info(IMG_FINISH_CLASSIF_MESSAGE.format(pred_y))
            return pred_y
        except Exception as e:
            err_msg = ERR_MSG.format(e)
            raise Exception(err_msg)

    @torch.no_grad()
    def process_image_joint(self, batch, risk_factor_vector=None):
        try:
            ## Apply transformers
            x = batch['x']
            risk_factors = autograd.Variable(risk_factor_vector.unsqueeze(0)) if risk_factor_vector is not None else None
            self.logger.info(IMG_START_CLASSIF_MESSAGE.format(x.size()))
            if self.args.cuda:
                x = x.cuda()
                self.model = self.model.cuda()
            else:
                self.model = self.model.cpu()
            ## Index 0 to toss batch dimension
            logit, _, _ = self.model(x, risk_factors, batch)
            if self.args.pred_both_sides:
                logit, _ = torch.max( torch.cat( [logit['l'].unsqueeze(-1), logit['r'].unsqueeze(-1)], dim=-1), dim=-1)
            probs = torch.sigmoid(logit).cpu().data.numpy()
            pred_y= np.zeros(probs.shape[1])

            # DEBUG: Print raw probabilities (with forced flush)
            import sys
            sys.stdout.write(f"\n{'='*70}\n")
            sys.stdout.write(f"DEBUG: MIRAI Model Output\n")
            sys.stdout.write(f"{'='*70}\n")
            sys.stdout.write(f"Logit shape: {logit.shape}\n")
            sys.stdout.write(f"Raw logit values:\n{logit.cpu().data.numpy()}\n")
            sys.stdout.write(f"After Sigmoid:\n{probs}\n")
            sys.stdout.write(f"Min/Max probs: {probs.min():.10f} / {probs.max():.10f}\n")
            sys.stdout.flush()

            if self.callibrator is not None:
                sys.stdout.write(f"✓ Calibrator loaded with {len(self.callibrator)} years\n")
                sys.stdout.flush()
                for i in self.callibrator.keys():
                    raw_val = probs[0, i]
                    calibrated = self.callibrator[i].predict_proba(raw_val.reshape(-1,1))[0,1]
                    pred_y[i] = calibrated
                    sys.stdout.write(f"  Year {i+1}: raw={raw_val:.10f} → calibrated={calibrated:.10f}\n")
                    sys.stdout.flush()
            else:
                sys.stdout.write(f"⚠ WARNING: No calibrator loaded - using raw sigmoid probs\n")
                sys.stdout.flush()
                pred_y = probs[0]

            sys.stdout.write(f"Final predictions: {pred_y}\n")
            sys.stdout.write(f"As percentages: {[f'{p*100:.2f}%' for p in pred_y]}\n")
            sys.stdout.write(f"{'='*70}\n\n")
            sys.stdout.flush()
            self.logger.info(IMG_FINISH_CLASSIF_MESSAGE.format(pred_y))
            return pred_y.tolist()
        except Exception as e:
            err_msg = ERR_MSG.format(e)
            raise Exception(err_msg)



    def process_exam(self, images, risk_factor_vector):
        preds = []
        if self.args.model_name == 'mirai_full':
            batch = self.collate_batch(images)
            y = self.process_image_joint(batch, risk_factor_vector)
        else:
            for im in images:
                preds.append(self.process_image_indep(im, risk_factor_vector))
            y = self.aggregator(preds)
            if isinstance(y, np.generic):
                y = y.item()
        self.logger.info(EXAM_CLASSIF_MESSAGE)
        return y

    def collate_batch(self, images):
        assert len(images) >= self.args.min_num_images
        batch = {}
        batch['side_seq'] = torch.cat([torch.tensor(b['side_seq']).unsqueeze(0) for b in images], dim=0).unsqueeze(0)
        batch['view_seq'] = torch.cat([torch.tensor(b['view_seq']).unsqueeze(0) for b in images], dim=0).unsqueeze(0)
        batch['time_seq'] = torch.zeros_like(batch['view_seq'])
        batch['x'] = torch.cat( (lambda self, images: [ self.transformer(b['x'], self.args.additional).unsqueeze(0) for b in images])(self, images), dim=0).unsqueeze(0).transpose(1,2)
        return batch

