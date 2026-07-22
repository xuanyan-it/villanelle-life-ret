#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CLAM 全自动预测 + 热力图生成 (批量处理所有切片，仅调用一次 create_heatmaps.py)
"""

import os
import sys
import subprocess
import torch
import pandas as pd
import numpy as np
import h5py
from pathlib import Path
import glob
import yaml
import tempfile

# -------- project bootstrap --------
_PROJ = Path(__file__).resolve().parent  # assets/models/
_CLAM_DIR = _PROJ / "CLAM-master"
if str(_CLAM_DIR) not in sys.path:
    sys.path.insert(0, str(_CLAM_DIR))

from models.model_clam import CLAM_MB

# ==================== 配置区域 ====================
# 所有路径可设绝对路径，留空则用项目 data/ 目录
_DATA_ROOT = Path(os.environ.get("CLAM_DATA_DIR", str(_PROJ.parent.parent / "data")))
SLIDE_DIR = os.environ.get("CLAM_SLIDE_DIR", str(_DATA_ROOT / "slides"))
MODEL_PATH = os.environ.get("CLAM_MODEL_CKPT", str(_PROJ / "checkpoint.pt"))
OUTPUT_ROOT = os.environ.get("CLAM_OUTPUT_DIR", str(_DATA_ROOT / "output"))
PRESET = os.environ.get("CLAM_PRESET", str(_CLAM_DIR / "presets" / "bwh_biopsy.csv"))
TEMPLATE_CONFIG = os.environ.get("CLAM_HEATMAP_TEMPLATE", str(_CLAM_DIR / "heatmaps" / "configs" / "heatmap_config_template.yaml"))
BATCH_SIZE = 256
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLASS_MAP = {0: 'N', 1: 'R', 2: 'B'}
FEAT_SUBDIR = "tumor_subtyping_resnet_features"

TEMPLATE_CONFIG = r"D:\CLAM\CLAM-master\heatmaps\configs\heatmap_config_template.yaml"
# ====================================================

PROJECT_ROOT = str(_CLAM_DIR)
CREATE_HEATMAPS_SCRIPT = os.path.join(PROJECT_ROOT, "create_heatmaps.py")
PROCESS_LISTS_DIR = os.path.join(PROJECT_ROOT, "heatmaps", "process_lists")

def run_command(cmd, description):
    print(f"\n>>> {description}")
    print(f"执行命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if result.returncode != 0:
        print("命令执行失败！错误信息：")
        print(result.stderr)
        sys.exit(1)
    else:
        print("成功完成。")
        if result.stdout:
            print(result.stdout)

def find_h5_file(feat_root, slide_id):
    candidates = [
        os.path.join(feat_root, "h5_files", f"{slide_id}.h5"),
        os.path.join(feat_root, f"{slide_id}.h5"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    pattern = os.path.join(feat_root, "**", f"{slide_id}.h5")
    matches = glob.glob(pattern, recursive=True)
    if matches:
        return matches[0]
    return None

def generate_heatmap_config_from_template(slide_path, model_path, feat_dir, save_exp_code, process_list_filename,
                                          output_root):
    """
    基于模板配置文件生成 YAML 配置，使用指定的 process_list 文件名（不含路径）。
    """
    with open(TEMPLATE_CONFIG, 'r') as f:
        config = yaml.safe_load(f)

    # 设置输出目录到 OUTPUT_ROOT/heatmaps 下
    production_dir = os.path.join(output_root, "production")
    raw_dir = os.path.join(output_root, "raw")
    os.makedirs(production_dir, exist_ok=True)
    os.makedirs(raw_dir, exist_ok=True)

    config['exp_arguments']['save_exp_code'] = save_exp_code
    config['exp_arguments']['n_classes'] = 3
    config['exp_arguments']['batch_size'] = 64
    config['exp_arguments']['production_save_dir'] = production_dir
    config['exp_arguments']['raw_save_dir'] = raw_dir

    config['data_arguments']['data_dir'] = os.path.dirname(slide_path)  # 所有切片在同一目录
    config['data_arguments']['slide_ext'] = SLIDE_EXT
    config['data_arguments']['preset'] = PRESET
    config['data_arguments']['process_list'] = process_list_filename  # 只写文件名，不包含路径

    config['model_arguments']['ckpt_path'] = model_path
    config['model_arguments']['model_type'] = 'clam_mb'
    config['model_arguments']['model_size'] = 'small'
    config['model_arguments']['embed_dim'] = 1024
    config['model_arguments']['drop_out'] = 0.25
    config['model_arguments']['initiate_fn'] = 'initiate_model'

    # 可根据需要微调热力图参数
    config['heatmap_arguments']['alpha'] = 0.5
    config['heatmap_arguments']['save_ext'] = 'png'
    config['heatmap_arguments']['use_ref_scores'] = True
    config['heatmap_arguments']['calc_heatmap'] = True

    return config

def batch_predict_and_heatmap(slide_dir, model_path, feat_root, output_root):
    # 确保 process_lists 目录存在
    os.makedirs(PROCESS_LISTS_DIR, exist_ok=True)
    os.makedirs(output_root, exist_ok=True)

    print(f"\n开始批量预测，模型路径: {model_path}")
    print(f"特征根目录: {feat_root}")

    # 加载模型（仅用于预测）
    state_dict = torch.load(model_path, map_location=DEVICE)
    model = CLAM_MB(n_classes=3, dropout=0.25, size_arg='small')
    model.load_state_dict(state_dict, strict=False)
    model.to(DEVICE)
    model.eval()
    print("模型加载完成。")

    slide_files = [f for f in os.listdir(slide_dir) if f.endswith((SLIDE_EXT, '.tif'))]
    if not slide_files:
        print("警告：未找到任何 WSI 文件。")
        return

    results = []
    process_data = []  # 用于构建 process list

    for slide_file in slide_files:
        slide_path = os.path.join(slide_dir, slide_file)
        slide_id = Path(slide_file).stem
        print(f"\n处理切片: {slide_id}")

        h5_path = find_h5_file(feat_root, slide_id)
        if h5_path is None:
            print(f"警告：未找到特征文件，跳过 {slide_id}")
            continue
        print(f"找到特征文件: {h5_path}")

        # 读取特征进行预测
        try:
            with h5py.File(h5_path, 'r') as f:
                features = torch.tensor(f['features'][:]).to(DEVICE)
        except Exception as e:
            print(f"读取特征文件失败 ({slide_id}): {e}")
            continue

        with torch.no_grad():
            logits, Y_prob, Y_hat, A, _ = model(features)
            pred_class = Y_hat.item()
            pred_label = CLASS_MAP.get(pred_class, "Unknown")
            print(f"预测类别: {pred_label} (class {pred_class})")
            results.append({
                'slide_id': slide_id,
                'pred_class': pred_class,
                'pred_label': pred_label
            })
            # 记录到 process list 数据
            process_data.append({
                'slide_id': slide_id,
                'label': pred_class,
                'process': 1
            })

    # 如果有切片无法预测（无特征文件），process_data可能为空，此时跳过热力图生成
    if not process_data:
        print("警告：没有可处理的切片，跳过热力图生成。")
        df = pd.DataFrame(results)
        csv_path = os.path.join(output_root, "prediction_summary.csv")
        df.to_csv(csv_path, index=False)
        return

    # ---- 生成包含所有切片的 process list CSV ----
    process_filename = "process_all.csv"
    process_path = os.path.join(PROCESS_LISTS_DIR, process_filename)
    df_process = pd.DataFrame(process_data)
    df_process.to_csv(process_path, index=False)
    print(f"生成 process list: {process_path}")

    # ---- 生成 YAML 配置文件（仅一次） ----
    # 取第一张切片作为 data_dir 参考（所有切片在同一目录）
    first_slide = slide_files[0]
    first_slide_path = os.path.join(slide_dir, first_slide)
    try:
        config = generate_heatmap_config_from_template(
            first_slide_path, model_path, feat_root,
            "all_slides_heatmap", process_filename, output_root
        )
        # 写入临时 YAML 文件
        temp_yaml = tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8')
        yaml.dump(config, temp_yaml)
        yaml_path = temp_yaml.name
        temp_yaml.close()

        # 执行 create_heatmaps.py（只调用一次，处理所有切片）
        cmd = [
            "python", CREATE_HEATMAPS_SCRIPT,
            "--config_file", yaml_path,
            "--save_exp_code", "all_slides_heatmap"
        ]
        print(f"执行热力图生成命令: {' '.join(cmd)}")
        # 关键：设置工作目录为项目根目录，确保相对路径 'heatmaps/process_lists' 正确
        subprocess.run(cmd, input=b'Y\n', check=True, cwd=PROJECT_ROOT)
        print("所有切片热力图生成完成。")

    except subprocess.CalledProcessError as e:
        print(f"热力图生成失败: {e}")
    except Exception as e:
        print(f"生成热力图时出现异常: {e}")
    finally:
        # 删除临时 YAML 文件
        if 'yaml_path' in locals() and os.path.exists(yaml_path):
            os.unlink(yaml_path)
        # 删除 process CSV（可选，为了干净）
        if os.path.exists(process_path):
            os.unlink(process_path)

    # 保存预测汇总
    df = pd.DataFrame(results)
    csv_path = os.path.join(output_root, "prediction_summary.csv")
    df.to_csv(csv_path, index=False)
    print(f"\n预测结果汇总已保存: {csv_path}")

def main():
    data_dir = os.path.join(OUTPUT_ROOT, "data")
    patches_dir = os.path.join(data_dir, "patches")
    masks_dir = os.path.join(data_dir, "masks")
    stitches_dir = os.path.join(data_dir, "stitches")
    feat_root = os.path.join(data_dir, "feats", FEAT_SUBDIR)
    heatmap_dir = os.path.join(OUTPUT_ROOT, "heatmaps")
    for d in [patches_dir, masks_dir, stitches_dir, feat_root, heatmap_dir]:
        os.makedirs(d, exist_ok=True)

    # 步骤1：创建 patches
    patch_script = os.path.join(_PROJ, "create_patches_fp.py")
    cmd_create = [
        "python", patch_script,
        "--source", SLIDE_DIR,
        "--save_dir", data_dir,
        "--preset", PRESET,
        "--patch_size", "256",
        "--step_size", "256"
    ]
    run_command(cmd_create, "步骤 1：创建 patches")

    # 步骤2：提取特征
    process_list = os.path.join(data_dir, "process_list_autogen.csv")
    extract_script = os.path.join(_PROJ, "extract_features_fp.py")
    cmd_extract = [
        "python", extract_script,
        "--data_h5_dir", data_dir,
        "--data_slide_dir", SLIDE_DIR,
        "--csv_path", process_list,
        "--feat_dir", feat_root,
        "--batch_size", str(BATCH_SIZE),
        "--slide_ext", SLIDE_EXT,
    ]
    run_command(cmd_extract, "步骤 2：提取特征")

    # 步骤3：预测并生成热力图（批量）
    batch_predict_and_heatmap(SLIDE_DIR, MODEL_PATH, feat_root, heatmap_dir)

    print("\n========== 全流程处理完成 ==========")
    print(f"预测汇总: {os.path.join(heatmap_dir, 'prediction_summary.csv')}")
    print(f"热力图保存在: {heatmap_dir}/production 和 {heatmap_dir}/raw")

if __name__ == "__main__":
    main()