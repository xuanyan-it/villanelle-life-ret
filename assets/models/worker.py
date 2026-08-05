#!/usr/bin/env python3
"""
CLAM Model Worker — JSON Lines protocol over stdin/stdout.

Protocol:
  Server → Worker (stdin):  {"id":"<seq>","cmd":"predict","slidePath":"...","modelType":"2class","generateHeatmap":true,"uploadId":"..."}
  Worker → Server (stdout): {"type":"ready","ok":true}
  Worker → Server (stdout): {"id":"<seq>","ok":true,"result":0.873}

Offline / USB deployment:
  Bundled venv at ../venv-LMN-1.0/, OpenSlide DLLs at ../openslide/bin/.
"""

import glob
import contextlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

import h5py
import numpy as np
import torch

# ==================== Bootstrap ====================
_PROJ = Path(__file__).resolve().parent  # assets/models/
_CLAM_DIR = _PROJ / "CLAM-master"
if str(_CLAM_DIR) not in sys.path:
    sys.path.insert(0, str(_CLAM_DIR))

# ---------- Offline: ensure bundled OpenSlide DLLs are findable ----------
# Supports both layouts:
#   assets/models/ + assets/openslide/bin/  (development / portable)
#   model/ + model/openslide/bin/            (NSIS standalone)
_OPENSLIDE_CANDIDATES = [
    _PROJ / "openslide" / "bin",       # model/openslide/bin/ (NSIS)
    _PROJ.parent / "openslide" / "bin", # assets/openslide/bin/ (dev/portable)
]
_OPENSLIDE_DIR = next((d for d in _OPENSLIDE_CANDIDATES if d.is_dir()), _OPENSLIDE_CANDIDATES[0])
_OPENSLIDE_DLL_HANDLE = None
if _OPENSLIDE_DIR.is_dir():
    os.environ["PATH"] = str(_OPENSLIDE_DIR) + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        # Keep the handle alive; closing/collecting it removes the directory
        # from this interpreter's DLL search path.
        _OPENSLIDE_DLL_HANDLE = os.add_dll_directory(str(_OPENSLIDE_DIR))

from models.model_clam import CLAM_MB  # noqa: E402

# ==================== Configuration ====================
PRESET = os.environ.get("CLAM_PRESET", str(_CLAM_DIR / "presets" / "bwh_biopsy.csv"))
RESNET_WEIGHTS_PATH = Path(
    os.environ.get(
        "CLAM_RESNET_CKPT",
        str(_PROJ / "resnet50.tv_in1k.safetensors"),
    )
)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SLIDE_EXT = ".svs"
PATCH_SIZE = 256
STEP_SIZE = 256
BATCH_SIZE = 256
FEAT_SUBDIR = "tumor_subtyping_resnet_features"
HEATMAP_MAX_PIXELS = int(os.environ.get("CLAM_HEATMAP_MAX_PIXELS", "12000000"))

MODEL_CONFIGS = {
    "2class": {
        "path": Path(os.environ.get("CLAM_2CLASS_CKPT", str(_PROJ / "2class.pt"))),
        "n_classes": 2,
        "labels": {0: "Non-RET", 1: "RET"},
    },
    "3class": {
        "path": Path(os.environ.get("CLAM_3CLASS_CKPT", str(_PROJ / "3class.pt"))),
        "n_classes": 3,
        "labels": {0: "Negative", 1: "RET", 2: "BRAFV600E"},
    },
    "5class": {
        "path": Path(os.environ.get("CLAM_5CLASS_CKPT", str(_PROJ / "5class.pt"))),
        "n_classes": 5,
        "labels": {
            0: "Negative",
            1: "RET",
            2: "BRAFV600E",
            3: "BRAF+TERT",
            4: "RAS",
        },
    },
}

PYTHON_EXE = sys.executable
PATCH_SCRIPT = str(_PROJ / "create_patches_fp.py")
EXTRACT_SCRIPT = str(_PROJ / "extract_features_fp.py")

# ==================== Model ====================
MODELS = {}


def _get_model_config(model_type: object) -> dict:
    """Return the requested model configuration or reject unsupported input."""
    normalized = str(model_type or "").strip().lower()
    config = MODEL_CONFIGS.get(normalized)
    if config is None:
        supported = ", ".join(MODEL_CONFIGS)
        raise ValueError(
            f"unsupported modelType {model_type!r}; expected one of: {supported}"
        )
    model_path = config["path"]
    if not model_path.is_file():
        raise FileNotFoundError(
            f"{normalized} checkpoint not found: {model_path}"
        )
    return {"model_type": normalized, **config}


def load_model(model_type: object):
    """Load the requested CLAM_MB checkpoint (lazy, cached per model type)."""
    config = _get_model_config(model_type)
    normalized = config["model_type"]
    if normalized in MODELS:
        return MODELS[normalized]

    state_dict = torch.load(config["path"], map_location=DEVICE)
    model = CLAM_MB(
        n_classes=config["n_classes"],
        dropout=0.25,
        size_arg="small",
    )
    incompatible = model.load_state_dict(state_dict, strict=False)
    unexpected = set(incompatible.unexpected_keys) - {"instance_loss_fn.labels"}
    if incompatible.missing_keys or unexpected:
        raise RuntimeError(
            f"{normalized} checkpoint does not match the model architecture; "
            f"missing={incompatible.missing_keys}, unexpected={sorted(unexpected)}"
        )
    model.to(DEVICE)
    model.eval()
    MODELS[normalized] = model
    print(
        f"[model] loaded type={normalized} classes={config['n_classes']} "
        f"path={config['path']}",
        file=sys.stderr,
        flush=True,
    )
    return model


# ==================== Pipeline Steps ====================

def _require_resnet_weights() -> Path:
    """Return the bundled ResNet-50 weights or fail with a clear error."""
    if not RESNET_WEIGHTS_PATH.is_file():
        raise FileNotFoundError(
            f"bundled ResNet-50 weights not found: {RESNET_WEIGHTS_PATH}"
        )
    return RESNET_WEIGHTS_PATH


def _run(cmd: list[str], step: str, resnet_weights: Path | None = None) -> None:
    """Run a subprocess, streaming its output to stderr in real time."""
    script_path = cmd[1]
    script_args = cmd[2:]

    timm_bootstrap = ""
    if resnet_weights is not None:
        patch_code = (
            "def _create_model_from_local_weights(model_name, *args, **kwargs):\n"
            "    if model_name == 'resnet50.tv_in1k' and kwargs.get('pretrained'):\n"
            "        overlay = dict(kwargs.get('pretrained_cfg_overlay') or {})\n"
            "        overlay['file'] = _resnet_weights\n"
            "        kwargs['pretrained_cfg_overlay'] = overlay\n"
            "    return _original_timm_create_model(model_name, *args, **kwargs)\n"
        )
        timm_bootstrap = (
            f"import timm as _timm;"
            f"_resnet_weights={str(resnet_weights)!r};"
            f"_original_timm_create_model=_timm.create_model;"
            f"exec({patch_code!r});"
            f"_timm.create_model=_create_model_from_local_weights;"
        )

    wrapper = (
        f"import os, sys;"
        f"_od={str(_OPENSLIDE_DIR)!r};"
        f"_odh=os.add_dll_directory(_od) if hasattr(os,'add_dll_directory') else None;"
        f"os.environ['PATH']=_od+os.pathsep+os.environ.get('PATH','');"
        f"sys.path.insert(0, {str(_CLAM_DIR)!r});"
        f"{timm_bootstrap}"
        f"sys.argv = {[script_path] + script_args!r};"
        f"exec(compile(open(sys.argv[0], 'rb').read(), sys.argv[0], 'exec'), "
        f"{{'__file__': sys.argv[0], '__name__': '__main__'}})"
    )

    # multiprocessing uses "spawn" on Windows. Each spawned interpreter must
    # register the OpenSlide directory before it unpickles WholeSlideImage;
    # the registration performed in the parent process is not inherited.
    with tempfile.TemporaryDirectory(prefix="clam-python-bootstrap-") as bootstrap_dir:
        sitecustomize = Path(bootstrap_dir) / "sitecustomize.py"
        sitecustomize.write_text(
            "import os\n"
            f"_openslide_dir = {str(_OPENSLIDE_DIR)!r}\n"
            "os.environ['PATH'] = _openslide_dir + os.pathsep + os.environ.get('PATH', '')\n"
            "_openslide_dll_handle = (os.add_dll_directory(_openslide_dir) "
            "if hasattr(os, 'add_dll_directory') else None)\n",
            encoding="utf-8",
        )

        env = os.environ.copy()
        old_pythonpath = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = (
            bootstrap_dir + (os.pathsep + old_pythonpath if old_pythonpath else "")
        )
        proc = subprocess.Popen(
            [sys.executable, "-c", wrapper],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="ignore",
            env=env,
        )

        # Stream output line-by-line so we see progress immediately
        collected: list[str] = []
        assert proc.stdout is not None
        for line in proc.stdout:
            stripped = line.rstrip("\n")
            collected.append(stripped)
            print(f"[{step}] {stripped}", file=sys.stderr)

        rc = proc.wait()
    if rc != 0:
        raise RuntimeError(
            f"[{step}] failed (rc={rc}): {' | '.join(collected[-5:])}"
        )


def _find_h5(feat_root: str, slide_id: str) -> str | None:
    """Locate the .h5 feature file for a slide (any subdirectory)."""
    # Direct candidates
    cand = [
        os.path.join(feat_root, "h5_files", f"{slide_id}.h5"),
        os.path.join(feat_root, "pt_files", f"{slide_id}.h5"),
        os.path.join(feat_root, f"{slide_id}.h5"),
    ]
    for p in cand:
        if os.path.exists(p):
            return p
    # Recursive glob
    pattern = os.path.join(feat_root, "**", f"{slide_id}*.h5")
    hits = glob.glob(pattern, recursive=True)
    if hits:
        return hits[0]
    # Last resort: walk and print what we found for debugging
    all_h5 = glob.glob(os.path.join(feat_root, "**", "*.h5"), recursive=True)
    print(f"[features] feat_root={feat_root} slide_id={slide_id} all_h5={all_h5}", file=sys.stderr)
    return None


def _run_patches(slide_dir: str, work_dir: str) -> None:
    """Step 1: create patches from SVS slide(s)."""
    cmd = [
        PYTHON_EXE, PATCH_SCRIPT,
        "--source", slide_dir,
        "--save_dir", work_dir,
        "--preset", PRESET,
        "--patch_size", str(PATCH_SIZE),
        "--step_size", str(STEP_SIZE),
    ]
    _run(cmd, "patches")


def _run_features(slide_dir: str, work_dir: str, feat_dir: str) -> None:
    """Step 2: extract features from patches."""
    resnet_weights = _require_resnet_weights()
    proc_list = os.path.join(work_dir, "process_list_autogen.csv")
    cmd = [
        PYTHON_EXE, EXTRACT_SCRIPT,
        "--data_h5_dir", work_dir,
        "--data_slide_dir", slide_dir,
        "--csv_path", proc_list,
        "--feat_dir", feat_dir,
        "--batch_size", str(BATCH_SIZE),
        "--slide_ext", SLIDE_EXT,
    ]
    _run(cmd, "features", resnet_weights=resnet_weights)


def _log_progress(step: str, data: dict) -> None:
    """Emit a JSON progress checkpoint to stderr."""
    record = {"step": step, **data}
    print(json.dumps(record, ensure_ascii=False, default=str), file=sys.stderr, flush=True)


def _infer_from_path(
    h5_path: str,
    slide_id: str,
    model_type: str,
) -> tuple[int, str, float, np.ndarray, np.ndarray]:
    """Run CLAM inference from an .h5 feature file.

    Returns class metadata plus attention scores and patch coordinates.
    """
    with h5py.File(h5_path, "r") as f:
        feats = torch.tensor(f["features"][:]).to(DEVICE)
        coords = f["coords"][:]

    config = _get_model_config(model_type)
    model = load_model(model_type)
    with torch.no_grad():
        _, Y_prob, Y_hat, attention_raw, _ = model(feats)
        pred_class = int(Y_hat.item())
        prob = float(Y_prob[0, pred_class])
        label = config["labels"].get(pred_class, str(pred_class))
        attention = attention_raw[pred_class].reshape(-1, 1).cpu().numpy()

    print(
        f"[infer] slide={slide_id} model={model_type} "
        f"class={pred_class}({label}) prob={prob:.4f}",
        file=sys.stderr,
    )
    return pred_class, label, prob, attention, coords


def _generate_heatmap(
    slide_path: str,
    attention: np.ndarray,
    coords: np.ndarray,
) -> Path:
    """Render both the coarse block map and the high-definition slide overlay.

    ``heatmap_blockmap.png`` keeps the old 32x-downsampled output for debugging.
    ``heatmap.png`` is the production image consumed by the applications.  It
    uses the finest native SVS pyramid level that stays inside a conservative
    pixel budget, then smooths patch boundaries in the same way as CLAM's
    production heatmap renderer.
    """
    from vis_utils.heatmap_utils import drawHeatmap
    from wsi_core.WholeSlideImage import WholeSlideImage

    heatmap_path = _persistent_heatmap_path(slide_path)
    output_dir = heatmap_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    blockmap_path = output_dir / "heatmap_blockmap.png"
    slide_preview_path = output_dir / "slide_preview.png"

    wsi_object = WholeSlideImage(slide_path)
    coarse_level = wsi_object.wsi.get_best_level_for_downsample(32)
    hd_level = _select_heatmap_level(wsi_object.wsi)

    def save_atomic(image, destination: Path) -> None:
        temporary_path = destination.with_suffix(destination.suffix + ".tmp")
        try:
            image.save(temporary_path, format="PNG")
            os.replace(temporary_path, destination)
        finally:
            temporary_path.unlink(missing_ok=True)
            image.close()

    # CLAM's helper prints diagnostic text to stdout. Redirect it so the
    # worker's JSON-lines protocol remains clean.
    with contextlib.redirect_stdout(sys.stderr):
        blockmap = drawHeatmap(
            attention,
            coords,
            slide_path=slide_path,
            wsi_object=wsi_object,
            vis_level=coarse_level,
            cmap="jet",
            alpha=0.5,
            segment=False,
            use_holes=False,
            binarize=False,
            blank_canvas=False,
            thresh=-1,
            patch_size=(PATCH_SIZE, PATCH_SIZE),
            convert_to_percentiles=True,
        )
        save_atomic(blockmap, blockmap_path)

        heatmap = drawHeatmap(
            attention.copy(),
            coords,
            slide_path=slide_path,
            wsi_object=wsi_object,
            vis_level=hd_level,
            cmap="jet",
            alpha=0.5,
            segment=False,
            use_holes=False,
            binarize=False,
            blank_canvas=False,
            thresh=-1,
            patch_size=(PATCH_SIZE, PATCH_SIZE),
            convert_to_percentiles=True,
            blur=True,
            overlap=0.5,
        )
        save_atomic(heatmap, heatmap_path)

        slide_preview = wsi_object.visWSI(
            vis_level=hd_level,
            view_slide_only=True,
        )
        save_atomic(slide_preview, slide_preview_path)

    wsi_object.wsi.close()
    print(
        f"[heatmap] saved production={heatmap_path} blockmap={blockmap_path} "
        f"slide_preview={slide_preview_path} vis_level={hd_level}",
        file=sys.stderr,
        flush=True,
    )
    return heatmap_path


def _select_heatmap_level(wsi) -> int:
    """Choose the clearest native pyramid level that fits the memory budget."""
    for level, (width, height) in enumerate(wsi.level_dimensions):
        if width * height <= HEATMAP_MAX_PIXELS:
            return level
    return wsi.level_count - 1


# ==================== JSON-Lines Protocol ====================

def write_progress(pct: int, step: str, msg_id: str) -> None:
    """Send a progress update to stdout (ignored by server if not supported)."""
    write_line({"type": "progress", "id": msg_id, "pct": pct, "step": step})


def write_line(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _parse_bool(value: object) -> bool:
    """Parse JSON/IPC boolean values without treating the string 'false' as true."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _persistent_heatmap_path(slide_path: str) -> Path:
    return Path(slide_path).resolve().parent.parent / "output" / "heatmap.png"


def _persistent_preview_paths(slide_path: str) -> tuple[Path, Path, Path]:
    output_dir = _persistent_heatmap_path(slide_path).parent
    return (
        output_dir / "heatmap.png",
        output_dir / "heatmap_blockmap.png",
        output_dir / "slide_preview.png",
    )


def handle_predict(msg: dict) -> None:
    """Run full CLAM pipeline for a single slide."""
    msg_id = str(msg.get("id", ""))
    slide_path = msg.get("slidePath", "")
    generate_heatmap_raw = msg.get("generateHeatmap", False)
    generate_heatmap = _parse_bool(generate_heatmap_raw)
    upload_id = str(msg.get("uploadId", ""))

    if not slide_path or not os.path.isfile(slide_path):
        write_line({"id": msg_id, "ok": False, "error": f"slide file not found: {slide_path}"})
        return

    try:
        model_config = _get_model_config(msg.get("modelType"))
    except (ValueError, FileNotFoundError) as error:
        write_line({"id": msg_id, "ok": False, "error": str(error)})
        return

    model_type = model_config["model_type"]
    slide_id = Path(slide_path).stem
    slide_dir = os.path.dirname(slide_path)

    _log_progress("STEP_0_input", {
        "upload_id": upload_id,
        "slide_path": slide_path,
        "slide_id": slide_id,
        "slide_dir": slide_dir,
        "slide_exists": os.path.isfile(slide_path),
        "slide_size": os.path.getsize(slide_path) if os.path.isfile(slide_path) else 0,
        "modelType": model_type,
        "modelPath": model_config["path"],
        "nClasses": model_config["n_classes"],
        "generateHeatmapRaw": repr(generate_heatmap_raw),
        "generateHeatmap": generate_heatmap,
    })

    if not generate_heatmap:
        for preview_path in _persistent_preview_paths(slide_path):
            preview_path.unlink(missing_ok=True)

    # Temp work directory per evaluation
    work_root = os.path.join(tempfile.gettempdir(), "ret-eval", upload_id)
    data_dir = os.path.join(work_root, "data")
    feat_dir = os.path.join(data_dir, "feats", FEAT_SUBDIR)
    for d in [
        os.path.join(data_dir, "patches"),
        os.path.join(data_dir, "masks"),
        os.path.join(data_dir, "stitches"),
        feat_dir,
    ]:
        os.makedirs(d, exist_ok=True)

    try:
        write_progress(10, "patches", msg_id)
        _log_progress("STEP_1_patches_input", {"slide_dir": slide_dir, "data_dir": data_dir})
        _run_patches(slide_dir, data_dir)
        write_progress(40, "features", msg_id)
        _log_progress("STEP_1_patches_done", {
            "data_dir_files": sorted(os.listdir(data_dir)),
            "patches_h5": glob.glob(os.path.join(data_dir, "patches", "*.h5")),
            "csv": glob.glob(os.path.join(data_dir, "*.csv")),
        })

        _log_progress("STEP_2_features_input", {"data_dir": data_dir, "feat_dir": feat_dir})
        _run_features(slide_dir, data_dir, feat_dir)
        write_progress(70, "inference", msg_id)
        _log_progress("STEP_2_features_done", {
            "feat_dir_files": sorted(os.listdir(feat_dir)) if os.path.isdir(feat_dir) else [],
            "h5_files": glob.glob(os.path.join(feat_dir, "**", "*.h5"), recursive=True),
        })

        h5_path = _find_h5(feat_dir, slide_id)
        _log_progress("STEP_3_infer_input", {"feat_dir": feat_dir, "slide_id": slide_id, "h5_found": h5_path})
        if h5_path is None:
            raise RuntimeError(f"feature .h5 not found for slide {slide_id} in {feat_dir}")

        pred_class, label, prob, attention, coords = _infer_from_path(
            h5_path,
            slide_id,
            model_type,
        )
        result = f"class={pred_class}({label}) prob={prob:.4f}"
        _log_progress("STEP_3_infer_done", {
            "slide_id": slide_id,
            "modelType": model_type,
            "class": pred_class,
            "label": label,
            "prob": prob,
            "result": result,
        })

        if generate_heatmap:
            write_progress(85, "heatmap", msg_id)
            heatmap_path = _generate_heatmap(slide_path, attention, coords)
            _log_progress("STEP_4_heatmap_done", {
                "slide_id": slide_id,
                "heatmap_path": heatmap_path,
            })

        write_line({"id": msg_id, "ok": True, "result": result})

    except Exception:
        write_line({"id": msg_id, "ok": False, "error": traceback.format_exc()})
    finally:
        shutil.rmtree(work_root, ignore_errors=True)


def handle_slide_info(msg: dict) -> None:
    """Return slide metadata via OpenSlide.

    Input:  {"id":"...", "cmd":"slide-info", "slidePath":"..."}
    Output: {"id":"...", "ok":true, "result": "{...json...}"}
    """
    import json

    msg_id = str(msg.get("id", ""))
    slide_path = msg.get("slidePath", "")

    if not slide_path or not os.path.isfile(slide_path):
        write_line({"id": msg_id, "ok": False, "error": f"slide file not found: {slide_path}"})
        return

    try:
        import openslide
        slide = openslide.OpenSlide(slide_path)
        try:
            dims = slide.level_dimensions
            downs = slide.level_downsamples
            info = {
                "width": slide.dimensions[0],
                "height": slide.dimensions[1],
                "tileWidth": int(slide.properties.get("openslide.level[0].tile-width", 256)),
                "tileHeight": int(slide.properties.get("openslide.level[0].tile-height", 256)),
                "levels": slide.level_count,
                "levelDimensions": [{"width": int(w), "height": int(h)} for w, h in dims],
                "levelDownsamples": [float(d) for d in downs],
            }
            write_line({"id": msg_id, "ok": True, "result": json.dumps(info)})
        finally:
            slide.close()
    except Exception:
        write_line({"id": msg_id, "ok": False, "error": traceback.format_exc()})


def handle_extract_tile(msg: dict) -> None:
    """Extract a single tile from an SVS slide via OpenSlide.

    Input:  {"id":"...", "cmd":"extract-tile", "slidePath":"...",
             "level":0, "x":0, "y":0,
             "tileWidth":256, "tileHeight":256}
    Output: {"id":"...", "ok":true, "tile":"base64png..."}
    """
    import base64
    import io

    msg_id = str(msg.get("id", ""))
    slide_path = msg.get("slidePath", "")
    level = int(msg.get("level", 0))
    x = int(msg.get("x", 0))
    y = int(msg.get("y", 0))
    tile_w = int(msg.get("tileWidth", 256))
    tile_h = int(msg.get("tileHeight", 256))

    if not slide_path or not os.path.isfile(slide_path):
        write_line({"id": msg_id, "ok": False, "error": f"slide file not found: {slide_path}"})
        return

    try:
        import openslide
        slide = openslide.OpenSlide(slide_path)
        try:
            # read_region params are in level-0 coordinates
            region = slide.read_region((x, y), level, (tile_w, tile_h))
            buf = io.BytesIO()
            region.save(buf, format="PNG")
            tile_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            write_line({"id": msg_id, "ok": True, "result": tile_b64})
        finally:
            slide.close()
    except Exception:
        write_line({"id": msg_id, "ok": False, "error": traceback.format_exc()})



def handle_message(line: str) -> None:
    """Parse one JSON request and dispatch."""
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        write_line({"id": "", "ok": False, "error": "invalid json"})
        return

    cmd = msg.get("cmd", "")
    if cmd == "predict":
        handle_predict(msg)
    elif cmd == "extract-tile":
        handle_extract_tile(msg)
    elif cmd == "slide-info":
        handle_slide_info(msg)
    else:
        write_line({"id": str(msg.get("id", "")), "ok": False, "error": f"unknown command: {cmd}"})


def run_stdio_loop() -> None:
    """Announce ready, then process stdin line-by-line."""
    # The model type is supplied per request. Loading here would either choose
    # the wrong checkpoint or require a model type before the request exists.
    # Each requested checkpoint is validated and lazily cached in load_model().
    write_line({"type": "ready", "ok": True})

    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            continue
        handle_message(stripped)


if __name__ == "__main__":
    run_stdio_loop()
