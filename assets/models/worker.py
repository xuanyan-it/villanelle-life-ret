#!/usr/bin/env python3
"""
CLAM Model Worker — JSON Lines protocol over stdin/stdout.

Protocol:
  Server → Worker (stdin):  {"id":"<seq>","cmd":"predict","DET_PKHD1L1":"...","DET_RPS4Y1":"...","DET_CRABP1":"...","Gender":"...","sampleType":"..."}
  Worker → Server (stdout): {"type":"ready","ok":true}
  Worker → Server (stdout): {"id":"<seq>","ok":true,"result":0.873}

Usage:
  python worker.py          (reads stdin, writes stdout)
  python worker.py --once   (single predict via CLI args, then exit)

Offline / USB deployment:
  All dependencies live in ../.venv/ and OpenSlide DLLs in ../openslide/.
"""

import json
import os
import sys
import traceback
from pathlib import Path

# ---------- USB offline: ensure bundled OpenSlide DLLs are findable ----------
_OPENSLIDE_DIR = Path(__file__).resolve().parent.parent / "openslide" / "bin"
if _OPENSLIDE_DIR.is_dir():
    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(str(_OPENSLIDE_DIR))
    os.environ.setdefault("PATH", str(_OPENSLIDE_DIR) + os.pathsep + os.environ.get("PATH", ""))

# ---------- placeholder: replace with real CLAM model loading ----------
MODEL = None  # TODO: load your trained CLAM model here


def load_model():
    """Load CLAM model (placeholder — replace with real model loading)."""
    global MODEL
    if MODEL is not None:
        return MODEL
    # TODO: actual model loading, e.g.:
    #   from models.model_clam import CLAM_SB
    #   MODEL = CLAM_SB(n_classes=...)
    #   MODEL.load_state_dict(torch.load("checkpoint.pt", map_location="cpu"))
    #   MODEL.eval()
    MODEL = "placeholder"
    return MODEL


def predict(features: dict) -> float:
    """
    Run inference on a single sample.
    features keys: DET_PKHD1L1, DET_RPS4Y1, DET_CRABP1, Gender, sampleType

    Returns a probability in [0, 1].
    """
    # TODO: replace with real CLAM inference
    # For now return a placeholder value
    _model = load_model()
    _ = features  # unused in placeholder
    return 0.5


def format_result(probability: float) -> str:
    return f"{probability:.4f}"


def handle_message(line: str) -> None:
    """Parse one JSON request and write the JSON response to stdout."""
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        write_line({"id": "", "ok": False, "error": "invalid json"})
        return

    msg_id = str(msg.get("id", ""))
    cmd = msg.get("cmd", "")

    if cmd != "predict":
        write_line({"id": msg_id, "ok": False, "error": f"unknown command: {cmd}"})
        return

    try:
        features = {
            "DET_PKHD1L1": msg.get("DET_PKHD1L1", ""),
            "DET_RPS4Y1": msg.get("DET_RPS4Y1", ""),
            "DET_CRABP1": msg.get("DET_CRABP1", ""),
            "Gender": msg.get("Gender", ""),
            "sampleType": msg.get("sampleType", ""),
        }
        prob = predict(features)
        write_line({"id": msg_id, "ok": True, "result": format_result(prob)})
    except Exception:
        write_line({"id": msg_id, "ok": False, "error": traceback.format_exc()})


def write_line(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def run_stdio_loop() -> None:
    """Main loop: announce ready, then process stdin line by line."""
    load_model()
    write_line({"type": "ready", "ok": True})

    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            continue
        handle_message(stripped)


def run_once() -> None:
    """Single-shot predict from CLI args (for quick testing)."""
    if len(sys.argv) < 5:
        print("Usage: python worker.py --once <DET_PKHD1L1> <DET_RPS4Y1> <DET_CRABP1> [Gender] [sampleType]", file=sys.stderr)
        sys.exit(1)
    features = {
        "DET_PKHD1L1": sys.argv[2],
        "DET_RPS4Y1": sys.argv[3],
        "DET_CRABP1": sys.argv[4],
        "Gender": sys.argv[5] if len(sys.argv) > 5 else "",
        "sampleType": sys.argv[6] if len(sys.argv) > 6 else "",
    }
    prob = predict(features)
    print(format_result(prob))


if __name__ == "__main__":
    if "--once" in sys.argv:
        run_once()
    else:
        run_stdio_loop()
