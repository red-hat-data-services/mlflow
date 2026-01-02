#!/usr/bin/env python3
"""
Post-process a pybuild-deps generated requirements file using overrides from the
committed version (and an optional overrides file), stamping the output with a
marker comment.

Usage:
    python requirements/apply_build_overrides.py \
        --generated requirements/build-requirements.txt \
        --output requirements/build-requirements.txt \
        --override-file requirements/build-overrides.txt

Behavior:
    1. Reads the freshly generated file.
    2. Reads the committed version of that file from git (HEAD).
    3. Optionally reads an overrides file (fully pinned blocks) and prefers it
       over the committed version.
    4. For any requirement present in overrides/committed, that block replaces
       the generated block (so curated pins/duplicates win).
    5. Duplicate packages are de-duped; the first occurrence wins unless an
       override exists.
    6. Ensures a marker comment is added to the header to record the
       post-processing step.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple

MARKER = "# Post-processed by requirements/apply_build_overrides.py"


def _parse_blocks(lines: List[str]) -> List[Tuple[str, List[str]]]:
    """
    Parse requirement blocks: a package line starting with "<name>==" followed by
    indented/hash lines until the next package line or EOF.
    """
    blocks: List[Tuple[str, List[str]]] = []
    current: List[str] = []
    current_name: str | None = None

    def flush() -> None:
        if current_name is not None:
            blocks.append((current_name, current.copy()))

    for line in lines:
        if line.strip() and not line.startswith(" "):
            parts = line.split("==", 1)
            if len(parts) == 2:
                flush()
                current = [line]
                current_name = parts[0].strip()
                continue
        if current:
            current.append(line)
    flush()
    return blocks


def _split_header_body(lines: List[str]) -> Tuple[List[str], List[str]]:
    """
    Split leading header comments from the body; header ends before the first
    requirement line ("pkg==version").
    """
    header: List[str] = []
    body_start = 0
    for idx, line in enumerate(lines):
        if line.startswith("#"):
            header.append(line)
        elif "==" in line:
            body_start = idx
            break
        else:
            header.append(line)
    return header, lines[body_start:]


def _load_committed(path: Path) -> List[str]:
    """Read the committed version of path from git HEAD."""
    result = subprocess.run(
        ["git", "show", f"HEAD:{path.as_posix()}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    return result.stdout.splitlines()


def _load_override_file(path: Path) -> List[str]:
    """Read an overrides file if it exists; otherwise return empty."""
    if not path.exists():
        return []
    return path.read_text().splitlines()


def apply_overrides(
    generated_path: Path, output_path: Path, override_file: Path | None
) -> None:
    generated_lines = generated_path.read_text().splitlines()
    committed_lines = _load_committed(generated_path)
    override_lines = (
        _load_override_file(override_file) if override_file is not None else []
    )

    gen_header, gen_body = _split_header_body(generated_lines)
    _, committed_body = _split_header_body(committed_lines)
    _, override_body = _split_header_body(override_lines) if override_lines else ([], [])

    # Build override map (override file takes precedence over committed)
    overrides: Dict[str, List[str]] = {}
    for name, block in _parse_blocks(committed_body):
        overrides[name] = block
    for name, block in _parse_blocks(override_body):
        overrides[name] = block

    header = list(gen_header)
    if MARKER not in header:
        header.append(MARKER)

    output: List[str] = []
    output.extend(header)

    seen_names: set[str] = set()
    for name, block in _parse_blocks(gen_body):
        if name in seen_names:
            continue
        seen_names.add(name)
        if name in overrides:
            output.extend(overrides[name])
        else:
            output.extend(block)

    # Add any override-only packages not present in generated (rare)
    for name, block in overrides.items():
        if name not in seen_names:
            output.extend(block)

    output_path.write_text("\n".join(output) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply committed overrides to a pybuild-deps output file."
    )
    parser.add_argument(
        "--generated",
        default="requirements/build-requirements.txt",
        type=Path,
        help="Path to the freshly generated requirements file.",
    )
    parser.add_argument(
        "--output",
        default=None,
        type=Path,
        help="Path to write the merged file (defaults to --generated).",
    )
    parser.add_argument(
        "--override-file",
        default="requirements/build-overrides.txt",
        type=Path,
        help="Optional overrides file containing fully pinned requirement blocks.",
    )
    args = parser.parse_args()
    output = args.output or args.generated

    apply_overrides(args.generated, output, args.override_file)


if __name__ == "__main__":
    main()
