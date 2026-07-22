#!/usr/bin/env python3
"""
One-shot evaluation script (fallback for persistence module).

Usage:
  python evaluation.py <DET_PKHD1L1> <DET_RPS4Y1> <DET_CRABP1>

Outputs one of: 0, 1, 2  to stdout (exit code 0).
Outputs "process error" and exits non-zero on failure.

This mirrors the threshold-based classifier in server/src/modules/persistence/evaluation.ts.
"""

import sys


def evaluate(pkhd1l1: float, rps4y1: float, crabp1: float) -> str:
    """Threshold-based classifier (same logic as TS fallback)."""
    if any(v >= 2.2 for v in (pkhd1l1, rps4y1, crabp1)):
        return "2"
    if any(v >= 1.2 for v in (pkhd1l1, rps4y1, crabp1)):
        return "1"
    return "0"


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python evaluation.py <DET_PKHD1L1> <DET_RPS4Y1> <DET_CRABP1>", file=sys.stderr)
        sys.exit(1)

    try:
        det_pkhd1l1 = float(sys.argv[1])
        det_rps4y1 = float(sys.argv[2])
        det_crabp1 = float(sys.argv[3])
    except ValueError:
        print("process error", file=sys.stderr)
        sys.exit(1)

    result = evaluate(det_pkhd1l1, det_rps4y1, det_crabp1)
    print(result)


if __name__ == "__main__":
    main()
