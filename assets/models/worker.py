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
import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

import h5py
import torch

# ==================== Bootstrap ====================
_PROJ = Path(__file__).resolve().parent  # assets/models/
_CLAM_DIR = _PROJ / "CLAM-master"
if str(_CLAM_DIR) not in sys.path:
    sys.path.insert(0, str(_CLAM_DIR))

# ---------- Offline: ensure bundled OpenSlide DLLs are findable ----------
_OPENSLIDE_DIR = _PROJ.parent / "openslide" / "bin"
_OPENSLIDE_DLL_HANDLE = None
if _OPENSLIDE_DIR.is_dir():
    os.environ["PATH"] = str(_OPENSLIDE_DIR) + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        # Keep the handle alive; closing/collecting it removes the directory
        # from this interpreter's DLL search path.
        _OPENSLIDE_DLL_HANDLE = os.add_dll_directory(str(_OPENSLIDE_DIR))

from models.model_clam import CLAM_MB  # noqa: E402

# ==================== Configuration ====================
MODEL_PATH = os.environ.get("CLAM_MODEL_CKPT", str(_PROJ / "2class.pt"))
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
CLASS_MAP = {0: "N", 1: "P"}

PYTHON_EXE = sys.executable
PATCH_SCRIPT = str(_PROJ / "create_patches_fp.py")
EXTRACT_SCRIPT = str(_PROJ / "extract_features_fp.py")

# ==================== Model ====================
MODEL = None


def load_model():
    """Load CLAM_MB from checkpoint (lazy, cached)."""
    global MODEL
    if MODEL is not None:
        return MODEL
    state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
    MODEL = CLAM_MB(n_classes=2, dropout=0.25, size_arg="small")
    MODEL.load_state_dict(state_dict, strict=False)
    MODEL.to(DEVICE)
    MODEL.eval()
    return MODEL


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


def _infer_from_path(h5_path: str, slide_id: str) -> float:
    """Run CLAM inference from an .h5 feature file.

    Returns probability (0–1) for the predicted class.
    """
    with h5py.File(h5_path, "r") as f:
        feats = torch.tensor(f["features"][:]).to(DEVICE)

    model = load_model()
    with torch.no_grad():
        _, Y_prob, Y_hat, _, _ = model(feats)
        pred_class = int(Y_hat.item())
        prob = float(Y_prob[0, pred_class])
        label = CLASS_MAP.get(pred_class, "?")

    print(f"[infer] slide={slide_id} class={pred_class}({label}) prob={prob:.4f}", file=sys.stderr)
    return prob


# ==================== JSON-Lines Protocol ====================

def write_progress(pct: int, step: str, msg_id: str) -> None:
    """Send a progress update to stdout (ignored by server if not supported)."""
    write_line({"type": "progress", "id": msg_id, "pct": pct, "step": step})


def write_line(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle_predict(msg: dict) -> None:
    """Run full CLAM pipeline for a single slide."""
    msg_id = str(msg.get("id", ""))
    slide_path = msg.get("slidePath", "")
    generate_heatmap = bool(msg.get("generateHeatmap", False))
    upload_id = str(msg.get("uploadId", ""))

    if not slide_path or not os.path.isfile(slide_path):
        write_line({"id": msg_id, "ok": False, "error": f"slide file not found: {slide_path}"})
        return

    slide_id = Path(slide_path).stem
    slide_dir = os.path.dirname(slide_path)

    _log_progress("STEP_0_input", {
        "upload_id": upload_id,
        "slide_path": slide_path,
        "slide_id": slide_id,
        "slide_dir": slide_dir,
        "slide_exists": os.path.isfile(slide_path),
        "slide_size": os.path.getsize(slide_path) if os.path.isfile(slide_path) else 0,
        "modelType": msg.get("modelType", ""),
        "generateHeatmap": generate_heatmap,
    })

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

        prob = _infer_from_path(h5_path, slide_id)
        _log_progress("STEP_3_infer_done", {"slide_id": slide_id, "prob": prob})

        if generate_heatmap:
            # TODO: implement heatmap generation via create_heatmaps.py
            print(f"[heatmap] requested for {slide_id} — not yet implemented", file=sys.stderr)

        write_line({"id": msg_id, "ok": True, "result": f"{prob:.4f}"})

    except Exception:
        write_line({"id": msg_id, "ok": False, "error": traceback.format_exc()})
    finally:
        shutil.rmtree(work_root, ignore_errors=True)


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
    else:
        write_line({"id": str(msg.get("id", "")), "ok": False, "error": f"unknown command: {cmd}"})


def run_stdio_loop() -> None:
    """Announce ready, then process stdin line-by-line."""
    try:
        load_model()
        write_line({"type": "ready", "ok": True})
    except Exception:
        write_line({"type": "ready", "ok": False, "error": traceback.format_exc()})
        sys.exit(1)

    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            continue
        handle_message(stripped)


if __name__ == "__main__":
    run_stdio_loop()
