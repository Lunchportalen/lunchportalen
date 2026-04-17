"""
Merge JSON policy fragments in a directory into a single deterministic output file.

Operational safety properties:
- Only regular ``*.json`` files are considered (non-recursive).
- Hidden files, directories, symlinks, logs, temp patterns, and non-JSON are skipped
  with warnings (canonical policy: **ignore-with-warning**).
- All inputs are parsed before any write or move; failures leave the directory unchanged.
- Output is written via a temp file + ``os.replace`` (atomic on the same volume).
- Optional archival moves fragment files only after a successful merge + output write.
"""

from __future__ import annotations

import argparse
import contextlib
import ctypes
import json
import logging
import os
import re
import shutil
import socket
import stat
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Mapping, Sequence

# Canonical merged policy filename (also used as second-pass input when present).
DEFAULT_OUTPUT_NAME = "000_policy_merge.json"

# Exit codes (stable contract for automation).
EXIT_SUCCESS = 0
EXIT_INVALID_ARGS = 2
EXIT_INVALID_INPUT_PATH = 3
EXIT_DATA_ERROR = 4
EXIT_IO_ERROR = 5
EXIT_LOCK_HELD = 6

_LOG = logging.getLogger(__name__)

# Exclusive run lock (directory created with mkdir — atomic on local filesystems).
LOCK_DIR_NAME = ".policy_merge.lock"
# Canonical owner metadata (JSON). Legacy installs may still have ``pid`` / ``host`` files only.
LOCK_OWNER_FILE = "owner.json"
_LEGACY_PID_FILE = "pid"


class LockHeldError(Exception):
    """Another live policy-merge process holds the input directory lock."""


class StaleLockError(Exception):
    """Lock metadata is unreadable; operator intervention may be required."""


@dataclass(frozen=True)
class _LockSnapshot:
    """Parsed view of an existing ``.policy_merge.lock`` directory (read-only)."""

    pid: int | None
    corrupt: bool


# Temp / noise patterns (basename match, case-insensitive).
_TEMP_NAME_RE = re.compile(
    r"^(\..*\.swp|\.~|~.*|.*\.tmp|.*\.temp|.*\.bak|.*~)$",
    re.IGNORECASE,
)


def _is_hidden_name(name: str) -> bool:
    return name.startswith(".")


def _is_log_name(name: str) -> bool:
    return name.lower().endswith(".log")


def _is_temp_name(name: str) -> bool:
    return bool(_TEMP_NAME_RE.match(name))


def _process_alive(pid: int) -> bool:
    """Best-effort check whether ``pid`` refers to a running process on this host."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        kernel32 = ctypes.windll.kernel32
        process_query_limited_information = 0x1000
        handle = kernel32.OpenProcess(process_query_limited_information, False, int(pid))
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        # Another user's process; treat as alive so we fail closed.
        return True
    except (OSError, ValueError):
        # Invalid pid / platform limits — not a live owner we can coordinate with.
        return False
    return True


def _read_lock_snapshot(lock_dir: Path) -> _LockSnapshot:
    """
    Inspect an existing lock directory without mutating it.

    **Corrupt / incomplete** means the directory exists but no valid integer ``pid`` could be read
    from ``owner.json`` or the legacy ``pid`` file.
    """
    owner_path = lock_dir / LOCK_OWNER_FILE
    if owner_path.is_file():
        try:
            data = json.loads(owner_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            return _LockSnapshot(pid=None, corrupt=True)
        if not isinstance(data, Mapping):
            return _LockSnapshot(pid=None, corrupt=True)
        pid_val = data.get("pid")
        try:
            pid = int(pid_val) if pid_val is not None else None
        except (TypeError, ValueError):
            return _LockSnapshot(pid=None, corrupt=True)
        if pid is None or pid <= 0:
            return _LockSnapshot(pid=None, corrupt=True)
        return _LockSnapshot(pid=pid, corrupt=False)

    legacy_pid = lock_dir / _LEGACY_PID_FILE
    if legacy_pid.is_file():
        try:
            line = legacy_pid.read_text(encoding="utf-8").strip().splitlines()[0]
            pid = int(line)
        except (OSError, ValueError, IndexError):
            return _LockSnapshot(pid=None, corrupt=True)
        if pid <= 0:
            return _LockSnapshot(pid=None, corrupt=True)
        return _LockSnapshot(pid=pid, corrupt=False)

    # Directory exists but has no recognizable owner metadata.
    return _LockSnapshot(pid=None, corrupt=True)


def _resolve_existing_lock_directory(
    lock_dir: Path,
    *,
    break_lock: bool,
    log: logging.Logger,
) -> None:
    """
    If ``lock_dir`` exists, either remove it (stale / breakable) or raise.

    ``--break-lock`` may only clear **stale** (dead pid) or **corrupt/incomplete** locks.
    It must **not** remove a lock whose owner pid is still running on this host.
    """
    if not lock_dir.exists():
        return

    snap = _read_lock_snapshot(lock_dir)

    if break_lock:
        if snap.corrupt or snap.pid is None:
            shutil.rmtree(lock_dir, ignore_errors=True)
            log.warning("Removed corrupt or incomplete lock directory (--break-lock): %s", lock_dir)
            return
        if _process_alive(snap.pid):
            raise LockHeldError(
                f"Refusing --break-lock: active lock at {lock_dir} is held by running pid {snap.pid}. "
                "Wait for that process to finish."
            )
        shutil.rmtree(lock_dir, ignore_errors=True)
        log.warning(
            "Removed stale lock directory (--break-lock): pid %s is not running (%s).",
            snap.pid,
            lock_dir,
        )
        return

    if snap.corrupt or snap.pid is None:
        raise StaleLockError(
            f"Lock directory exists but owner metadata is missing or unreadable: {lock_dir}. "
            "If no other run is active, remove the directory or run once with --break-lock after verification."
        )

    if not _process_alive(snap.pid):
        log.warning("Removing stale lock directory (pid %s is not running).", snap.pid)
        shutil.rmtree(lock_dir, ignore_errors=True)
        return

    raise LockHeldError(
        f"Another policy-merge run holds the lock on {lock_dir.parent} (pid={snap.pid}). "
        f"If no other run is active, remove {lock_dir} or use --break-lock after verification."
    )


@contextlib.contextmanager
def acquire_run_lock(
    input_dir: Path,
    *,
    break_lock: bool,
    log: logging.Logger | None = None,
) -> Iterator[None]:
    """
    Serialize runs against ``input_dir`` using an exclusive lock directory.

    **Active lock:** ``.policy_merge.lock/`` exists with readable ``owner.json`` (or legacy ``pid``)
    pointing at a **running** process on this host.

    **Stale lock:** owner pid is no longer running → removed automatically, then acquisition retries.

    **Corrupt / incomplete lock:** directory exists but ``owner.json`` / legacy ``pid`` cannot yield
    a valid pid → :class:`StaleLockError` unless ``break_lock`` clears it (CLI: ``--break-lock``).

    The lock directory is removed when the context exits (including on exceptions after acquisition).

    ``--dry-run`` uses the same lock as a write run so concurrent dry-run and write cannot overlap.
    """
    logger = log or _LOG
    lock_dir = input_dir / LOCK_DIR_NAME

    _resolve_existing_lock_directory(lock_dir, break_lock=break_lock, log=logger)
    try:
        lock_dir.mkdir(mode=0o700)
    except FileExistsError:
        _resolve_existing_lock_directory(lock_dir, break_lock=break_lock, log=logger)
        try:
            lock_dir.mkdir(mode=0o700)
        except FileExistsError as exc:
            raise LockHeldError(
                f"Could not acquire run lock at {lock_dir} after conflict resolution: {exc}"
            ) from exc

    try:
        lock_dir.chmod(0o700)
    except OSError:
        pass

    owner_payload = {
        "pid": os.getpid(),
        "hostname": socket.gethostname(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (lock_dir / LOCK_OWNER_FILE).write_text(
        json.dumps(owner_payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )

    try:
        yield
    finally:
        shutil.rmtree(lock_dir, ignore_errors=True)


def deep_merge_policies(base: Any, overlay: Any) -> Any:
    """
    Merge two JSON values.

    - dict + dict: recursive merge; keys from overlay win on scalar conflicts.
    - list + list: concatenate (overlay items after base items).
    - otherwise: overlay replaces base.
    """
    if isinstance(base, Mapping) and isinstance(overlay, Mapping):
        out: dict[str, Any] = dict(base)
        for k, v in overlay.items():
            if k in out:
                out[k] = deep_merge_policies(out[k], v)
            else:
                out[k] = v
        return out
    if isinstance(base, list) and isinstance(overlay, list):
        return list(base) + list(overlay)
    return overlay


def _parse_json_object(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"Top-level JSON must be an object in {path}, got {type(data).__name__}")
    return data


@dataclass
class DiscoveryResult:
    """Outcome of scanning an input directory (non-recursive)."""

    merge_paths: list[Path] = field(default_factory=list)
    ignored_dirs: list[str] = field(default_factory=list)
    ignored_symlinks: list[str] = field(default_factory=list)
    ignored_non_json: list[str] = field(default_factory=list)
    ignored_hidden: list[str] = field(default_factory=list)
    ignored_temp_or_log: list[str] = field(default_factory=list)
    second_pass: bool = False


def discover_policy_inputs(
    input_dir: Path,
    output_name: str,
    *,
    log: logging.Logger | None = None,
) -> DiscoveryResult:
    """
    Discover JSON inputs in ``input_dir`` (top level only).

    Merge order:
    1. ``output_name`` if it exists as a regular file (second pass).
    2. Other ``*.json`` files, sorted lexicographically by name.

    Canonical policy for unexpected entries: **ignore-with-warning** (never crash on clutter).
    """
    logger = log or _LOG
    result = DiscoveryResult()
    output_path = input_dir / output_name

    if not input_dir.is_dir():
        raise NotADirectoryError(str(input_dir))

    if output_path.exists(follow_symlinks=False) and output_path.is_symlink():
        raise ValueError(f"Output path must not be a symlink: {output_path}")

    json_candidates: list[Path] = []
    for entry in sorted(input_dir.iterdir(), key=lambda p: p.name):
        name = entry.name
        if entry.is_dir():
            if name == LOCK_DIR_NAME:
                # Operational artefact from this tool; do not warn each run.
                continue
            result.ignored_dirs.append(name)
            logger.warning("Ignoring directory: %s", name)
            continue
        if entry.is_symlink():
            result.ignored_symlinks.append(name)
            logger.warning("Ignoring symlink (unsupported): %s", name)
            continue
        try:
            st = entry.stat(follow_symlinks=False)
        except OSError as exc:
            result.ignored_non_json.append(name)
            logger.warning("Ignoring unreadable path %s: %s", name, exc)
            continue
        if not stat.S_ISREG(st.st_mode):
            result.ignored_non_json.append(name)
            logger.warning("Ignoring non-regular file: %s", name)
            continue
        if _is_hidden_name(name):
            result.ignored_hidden.append(name)
            logger.warning("Ignoring hidden file: %s", name)
            continue
        if _is_log_name(name) or _is_temp_name(name):
            result.ignored_temp_or_log.append(name)
            logger.warning("Ignoring temp/log-like file: %s", name)
            continue
        if not name.lower().endswith(".json"):
            result.ignored_non_json.append(name)
            logger.warning("Ignoring non-JSON file: %s", name)
            continue
        if name == output_name:
            # Handled separately when present (second pass); not a "fragment" candidate.
            continue
        json_candidates.append(entry)

    if output_path.is_file():
        if output_path.is_symlink():
            raise ValueError(f"Output path must not be a symlink: {output_path}")
        result.second_pass = True
        result.merge_paths.append(output_path)

    result.merge_paths.extend(sorted(json_candidates, key=lambda p: p.name))
    return result


def load_and_merge(paths: Sequence[Path]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for path in paths:
        fragment = _parse_json_object(path)
        merged = deep_merge_policies(merged, fragment)
        if not isinstance(merged, dict):
            raise ValueError("Merge produced non-object root; check inputs.")
    return merged


def write_json_atomic(target: Path, payload: Mapping[str, Any], *, dry_run: bool) -> None:
    """Write JSON atomically using temp file in the same directory."""
    if dry_run:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    tmp_name = f".{target.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    tmp_path = target.with_name(tmp_name)
    try:
        with tmp_path.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, target)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                _LOG.exception("Failed to remove temporary file %s", tmp_path)


def _ensure_archive_dir(base: Path, run_tag: str) -> Path:
    archive_root = base / "policy_merge_archive"
    dest = archive_root / run_tag
    dest.mkdir(parents=True, exist_ok=False)
    return dest


def _new_archive_run_tag() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + f"_{uuid.uuid4().hex[:8]}"


def backup_existing_output(output_path: Path, archive_dir: Path) -> None:
    """Copy existing output into archive before it is replaced."""
    if not output_path.is_file():
        return
    dest = archive_dir / f"{output_path.stem}.before_replace{output_path.suffix}"
    shutil.copy2(output_path, dest)
    _LOG.info("Backed up existing output to %s", dest.name)


def apply_legacy_path_argv(argv: list[str]) -> list[str]:
    """
    Normalize legacy CLI tokens for argparse.

    - ``path=...`` / ``--path=...`` / ``--path <dir>`` → ``--input`` (+ value).
    - ``merge_keys=...`` / ``merge-keys=...`` / ``--merge-keys ...`` → dropped
      (historical no-op: merges always apply to whole fragment objects).
    """
    out: list[str] = []
    i = 0
    n = len(argv)
    while i < n:
        arg = argv[i]
        if arg.startswith("path="):
            out.extend(["--input", arg.split("=", 1)[1]])
        elif arg.startswith("--path="):
            out.extend(["--input", arg.split("=", 1)[1]])
        elif arg == "--path":
            if i + 1 >= n:
                out.append(arg)
            else:
                out.extend(["--input", argv[i + 1]])
                i += 1
        elif arg.startswith("merge_keys=") or arg.startswith("merge-keys="):
            pass
        elif arg in ("--merge-keys", "--merge_keys"):
            if i + 1 < n:
                i += 1
            else:
                out.append(arg)
        else:
            out.append(arg)
        i += 1
    return out


@dataclass
class RunSummary:
    candidates_found: int = 0
    json_processed: int = 0
    ignored_total: int = 0
    output_path: Path | None = None
    second_pass: bool = False
    dry_run: bool = False
    archive_dir: Path | None = None


def run_merge(
    input_dir: Path,
    *,
    output_name: str = DEFAULT_OUTPUT_NAME,
    dry_run: bool = False,
    break_lock: bool = False,
    log: logging.Logger | None = None,
) -> RunSummary:
    """
    Execute discovery, merge, atomic output, and archival.

    Raises:
        NotADirectoryError, ValueError, OSError on hard failures.
        LockHeldError if another live process holds the run lock (``.policy_merge.lock``) under input.
        StaleLockError if a lock directory exists but ``owner.json`` / legacy ``pid`` cannot be read.
    """
    logger = log or _LOG
    summary = RunSummary(dry_run=dry_run, second_pass=False)

    if not input_dir.is_dir():
        raise NotADirectoryError(str(input_dir))

    with acquire_run_lock(input_dir, break_lock=break_lock, log=logger):
        return _run_merge_locked(
            input_dir,
            output_name=output_name,
            dry_run=dry_run,
            log=logger,
            summary=summary,
        )


def _run_merge_locked(
    input_dir: Path,
    *,
    output_name: str,
    dry_run: bool,
    log: logging.Logger,
    summary: RunSummary,
) -> RunSummary:
    """Body of ``run_merge`` while the input-directory lock is held."""

    discovery = discover_policy_inputs(input_dir, output_name, log=log)
    summary.second_pass = discovery.second_pass

    ignored_lists = [
        discovery.ignored_dirs,
        discovery.ignored_symlinks,
        discovery.ignored_non_json,
        discovery.ignored_hidden,
        discovery.ignored_temp_or_log,
    ]
    summary.ignored_total = sum(len(x) for x in ignored_lists)
    summary.candidates_found = len(discovery.merge_paths)

    if not discovery.merge_paths:
        raise ValueError(
            "No JSON policy fragments found. "
            f"Expected regular *.json files in {input_dir} (output file {output_name} "
            "counts only when doing a second pass)."
        )

    merged = load_and_merge(discovery.merge_paths)
    summary.json_processed = len(discovery.merge_paths)
    output_path = input_dir / output_name
    summary.output_path = output_path

    had_existing = output_path.is_file()
    output_resolved = output_path.resolve()
    fragments = [p for p in discovery.merge_paths if p.resolve() != output_resolved]

    archive_dir: Path | None = None
    needs_archive = (not dry_run) and (had_existing or bool(fragments))
    if needs_archive:
        archive_dir = _ensure_archive_dir(input_dir, _new_archive_run_tag())
        if had_existing:
            backup_existing_output(output_path, archive_dir)

    try:
        write_json_atomic(output_path, merged, dry_run=dry_run)
    except OSError:
        if archive_dir is not None and archive_dir.exists():
            log.error(
                "Output write failed; archive folder may contain only backups: %s",
                archive_dir,
            )
        raise

    if not dry_run and archive_dir is not None:
        for path in fragments:
            dest = archive_dir / path.name
            if dest.exists():
                dest = archive_dir / f"{path.stem}_{uuid.uuid4().hex[:8]}{path.suffix}"
            shutil.move(str(path), str(dest))
            log.info("Archived fragment: %s -> %s", path.name, dest)
        if had_existing:
            log.info("Prior output backed up under %s", archive_dir)
        summary.archive_dir = archive_dir

    return summary


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="policy_merge",
        description=(
            "Merge Chrome JSON policy fragments in a directory into "
            f"{DEFAULT_OUTPUT_NAME} (non-recursive, atomic write, safe archival)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Unknown top-level clutter (non-JSON, logs, temp patterns, directories) is ignored "
            "with a warning. Only regular *.json files participate.\n\n"
            "Legacy usage: path=/dir, --path=/dir, --path /dir → --input; "
            "merge_keys=… / --merge-keys … are ignored (full-object merge).\n"
        ),
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Input directory containing JSON policy fragments (top level only).",
    )
    parser.add_argument(
        "--output-name",
        default=DEFAULT_OUTPUT_NAME,
        help=f"Merged output filename (default: {DEFAULT_OUTPUT_NAME}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and merge only; do not write output or move files.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging.",
    )
    parser.add_argument(
        "--break-lock",
        action="store_true",
        help=(
            "Remove a stale (dead pid) or corrupt/incomplete lock only. "
            "Never removes a lock held by a running process."
        ),
    )
    return parser


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(levelname)s %(message)s",
    )


def print_summary(summary: RunSummary) -> None:
    lines = [
        "---- policy_merge summary ----",
        f"candidates (json-related entries): {summary.candidates_found}",
        f"JSON files merged: {summary.json_processed}",
        f"ignored entries (warnings): {summary.ignored_total}",
        f"second_pass: {summary.second_pass}",
        f"dry_run: {summary.dry_run}",
    ]
    if summary.output_path is not None:
        lines.append(f"output: {summary.output_path}")
    if summary.archive_dir is not None:
        lines.append(f"archive: {summary.archive_dir}")
    print("\n".join(lines))


def main(argv: list[str] | None = None) -> int:
    argv = apply_legacy_path_argv(list(sys.argv[1:] if argv is None else argv))
    parser = build_arg_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        code = 0 if exc.code is None else exc.code
        if isinstance(code, int):
            return code
        return EXIT_INVALID_ARGS

    configure_logging(args.verbose)
    log = logging.getLogger("policy_merge")

    input_dir = args.input.expanduser().resolve()
    output_name: str = args.output_name

    if not input_dir.exists():
        log.error("Input path does not exist: %s", input_dir)
        return EXIT_INVALID_INPUT_PATH
    if not input_dir.is_dir():
        log.error("Input path is not a directory: %s", input_dir)
        return EXIT_INVALID_INPUT_PATH

    try:
        summary = run_merge(
            input_dir,
            output_name=output_name,
            dry_run=args.dry_run,
            break_lock=args.break_lock,
            log=log,
        )
    except (NotADirectoryError, ValueError) as exc:
        log.error("%s", exc)
        return EXIT_DATA_ERROR
    except OSError as exc:
        log.error("I/O error: %s", exc)
        return EXIT_IO_ERROR
    except (LockHeldError, StaleLockError) as exc:
        log.error("%s", exc)
        return EXIT_LOCK_HELD

    print_summary(summary)
    return EXIT_SUCCESS


def cli() -> None:
    """Console entry point for setuptools scripts."""
    raise SystemExit(main())


if __name__ == "__main__":
    cli()
