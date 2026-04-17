"""Characterization and safety tests for policy_merge."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

# Package root (``cua/``): used as subprocess cwd and PYTHONPATH for ``python -m ...`` tests.
_CUA_ROOT = Path(__file__).resolve().parents[1]

from cua_chrome.core.policy_merge import (
    DEFAULT_OUTPUT_NAME,
    EXIT_DATA_ERROR,
    EXIT_INVALID_INPUT_PATH,
    EXIT_LOCK_HELD,
    EXIT_SUCCESS,
    LOCK_DIR_NAME,
    LockHeldError,
    StaleLockError,
    acquire_run_lock,
    apply_legacy_path_argv,
    deep_merge_policies,
    discover_policy_inputs,
    load_and_merge,
    main,
    run_merge,
    write_json_atomic,
)


def _run_module_main(argv: list[str]) -> int:
    """Invoke ``main()`` like a subprocess would (fresh interpreter semantics not guaranteed)."""
    return main(argv)


def _subprocess_cli(argv: list[str], *, cwd: Path, extra_env: dict[str, str] | None = None) -> int:
    env = {**os.environ, "PYTHONPATH": str(cwd / "cua_chrome")}
    if extra_env:
        env.update(extra_env)
    cmd = [sys.executable, "-m", "cua_chrome.core.policy_merge", *argv]
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode


class TestDeepMerge(unittest.TestCase):
    def test_dict_recurses_and_overrides_scalar(self) -> None:
        base = {"a": 1, "nested": {"x": 1, "y": 2}}
        overlay = {"b": 2, "nested": {"y": 9, "z": 3}}
        out = deep_merge_policies(base, overlay)
        self.assertEqual(out["a"], 1)
        self.assertEqual(out["b"], 2)
        self.assertEqual(out["nested"]["x"], 1)
        self.assertEqual(out["nested"]["y"], 9)
        self.assertEqual(out["nested"]["z"], 3)

    def test_list_concatenates(self) -> None:
        self.assertEqual(deep_merge_policies([1, 2], [3]), [1, 2, 3])

    def test_scalar_replaced(self) -> None:
        self.assertEqual(deep_merge_policies({"k": [1]}, {"k": 2}), {"k": 2})


class TestDiscoveryAndMerge(unittest.TestCase):
    def setUp(self) -> None:
        self._log = logging.getLogger("test_policy_merge")
        self._log.setLevel(logging.WARNING)

    def test_happy_path_merge_order_sorted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "z.json").write_text('{"z": 1}\n', encoding="utf-8")
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertFalse(disc.second_pass)
            self.assertEqual([p.name for p in disc.merge_paths], ["a.json", "z.json"])
            merged = load_and_merge(disc.merge_paths)
            self.assertEqual(merged["a"], 1)
            self.assertEqual(merged["z"], 1)

    def test_second_pass_existing_output_first(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / DEFAULT_OUTPUT_NAME).write_text('{"base": true}\n', encoding="utf-8")
            (d / "new.json").write_text('{"extra": 1}\n', encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertTrue(disc.second_pass)
            self.assertEqual(
                [p.name for p in disc.merge_paths],
                [DEFAULT_OUTPUT_NAME, "new.json"],
            )

    def test_mixed_directory_ignores_non_json_and_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "note.txt").write_text("x", encoding="utf-8")
            (d / "subdir").mkdir()
            (d / "ok.json").write_text('{"k": 1}\n', encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertEqual([p.name for p in disc.merge_paths], ["ok.json"])
            self.assertIn("note.txt", disc.ignored_non_json)
            self.assertIn("subdir", disc.ignored_dirs)

    def test_lock_dir_not_reported_as_ignored_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / LOCK_DIR_NAME).mkdir()
            (d / "ok.json").write_text('{"k": 1}\n', encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertEqual([p.name for p in disc.merge_paths], ["ok.json"])
            self.assertNotIn(LOCK_DIR_NAME, disc.ignored_dirs)

    def test_invalid_json_raises_before_io(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "bad.json").write_text("{not json", encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            with self.assertRaises(ValueError):
                load_and_merge(disc.merge_paths)
            self.assertFalse((d / DEFAULT_OUTPUT_NAME).exists())

    def test_empty_directory_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            with self.assertRaises(ValueError):
                run_merge(d, dry_run=True)

    def test_subdirs_not_traversed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            nested = d / "nested"
            nested.mkdir()
            (nested / "inner.json").write_text('{"x": 1}\n', encoding="utf-8")
            with self.assertRaises(ValueError):
                run_merge(d, dry_run=True)

    def test_symlink_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            real = d / "real.json"
            real.write_text('{"a": 1}\n', encoding="utf-8")
            try:
                os.symlink(real, d / "link.json")
            except OSError:
                self.skipTest("symlinks not supported on this platform")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertEqual([p.name for p in disc.merge_paths], ["real.json"])
            self.assertIn("link.json", disc.ignored_symlinks)

    def test_hidden_and_log_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / ".hidden.json").write_text("{}", encoding="utf-8")
            (d / "x.log").write_text("log", encoding="utf-8")
            (d / "vis.json").write_text('{"v": 1}\n', encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            self.assertEqual([p.name for p in disc.merge_paths], ["vis.json"])

    def test_bad_input_path_main(self) -> None:
        code = main(["--input", str(Path("/nonexistent/path/merge_dir_abc"))])
        self.assertEqual(code, EXIT_INVALID_INPUT_PATH)

    def test_main_input_path_is_file_returns_invalid_path(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
            path = handle.name
        try:
            code = main(["--input", path])
            self.assertEqual(code, EXIT_INVALID_INPUT_PATH)
        finally:
            os.unlink(path)

    def test_legacy_path_kwarg_rewritten(self) -> None:
        self.assertEqual(
            apply_legacy_path_argv(["path=/tmp/x", "--dry-run"]),
            ["--input", "/tmp/x", "--dry-run"],
        )

    def test_legacy_double_dash_path(self) -> None:
        self.assertEqual(
            apply_legacy_path_argv(["--path=/data/policies", "--dry-run"]),
            ["--input", "/data/policies", "--dry-run"],
        )

    def test_legacy_path_two_token_form(self) -> None:
        self.assertEqual(
            apply_legacy_path_argv(["--path", "/data/policies", "--dry-run"]),
            ["--input", "/data/policies", "--dry-run"],
        )

    def test_legacy_merge_keys_dropped(self) -> None:
        self.assertEqual(
            apply_legacy_path_argv(
                ["path=/tmp/x", "merge_keys=ManagedBookmarks", "--dry-run"]
            ),
            ["--input", "/tmp/x", "--dry-run"],
        )

    def test_legacy_merge_keys_hyphen_form(self) -> None:
        self.assertEqual(
            apply_legacy_path_argv(["--merge-keys", "ManagedBookmarks", "--input", "/y"]),
            ["--input", "/y"],
        )

    def test_main_legacy_path_and_merge_keys_dry_run(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"ManagedBookmarks": []}\n', encoding="utf-8")
            code = main(
                [f"path={d}", "merge_keys=ManagedBookmarks", "--dry-run"]
            )
            self.assertEqual(code, EXIT_SUCCESS)

    def test_main_help_returns_zero(self) -> None:
        self.assertEqual(_run_module_main(["--help"]), EXIT_SUCCESS)

    def test_subprocess_module_help(self) -> None:
        code = _subprocess_cli(["--help"], cwd=_CUA_ROOT)
        self.assertEqual(code, EXIT_SUCCESS)

    def test_entrypoint_cli_help_via_sys_argv(self) -> None:
        """Console scripts call ``cli()`` which reads ``sys.argv`` (like ``policy-merge``)."""
        proc = subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; sys.argv = ['policy-merge', '--help']; "
                "from cua_chrome.core.policy_merge import cli; cli()",
            ],
            cwd=str(_CUA_ROOT),
            env={**os.environ, "PYTHONPATH": str(_CUA_ROOT / "cua_chrome")},
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, EXIT_SUCCESS)

    def test_atomic_write_uses_temp_then_replace(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            target = d / "out.json"
            write_json_atomic(target, {"k": "v"}, dry_run=False)
            self.assertTrue(target.is_file())
            self.assertEqual(
                json.loads(target.read_text(encoding="utf-8")),
                {"k": "v"},
            )
            temps = [p for p in d.iterdir() if p.name.startswith(".out.json.")]
            self.assertEqual(temps, [])

    def test_run_merge_dry_run_leaves_sources(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            run_merge(d, dry_run=True)
            self.assertTrue((d / "a.json").exists())
            self.assertFalse((d / DEFAULT_OUTPUT_NAME).exists())
            self.assertFalse((d / LOCK_DIR_NAME).exists())

    def test_failure_midway_no_output_no_archive(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "good.json").write_text('{"a": 1}\n', encoding="utf-8")
            (d / "bad.json").write_text("oops", encoding="utf-8")
            with self.assertRaises(ValueError):
                run_merge(d, dry_run=False)
            self.assertFalse((d / DEFAULT_OUTPUT_NAME).exists())
            self.assertFalse((d / "policy_merge_archive").exists())
            self.assertFalse((d / LOCK_DIR_NAME).exists())

    def test_write_failure_after_backup_logs_and_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / DEFAULT_OUTPUT_NAME).write_text('{"old": true}\n', encoding="utf-8")
            (d / "frag.json").write_text('{"n": 1}\n', encoding="utf-8")
            with mock.patch(
                "cua_chrome.core.policy_merge.write_json_atomic",
                side_effect=OSError("disk full"),
            ):
                with self.assertRaises(OSError):
                    run_merge(d, dry_run=False)
            self.assertTrue((d / DEFAULT_OUTPUT_NAME).exists())
            self.assertFalse((d / LOCK_DIR_NAME).exists())

    def test_second_pass_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            run_merge(d, dry_run=False)
            self.assertTrue((d / DEFAULT_OUTPUT_NAME).is_file())
            (d / "b.json").write_text('{"b": 2}\n', encoding="utf-8")
            run_merge(d, dry_run=False)
            merged = json.loads((d / DEFAULT_OUTPUT_NAME).read_text(encoding="utf-8"))
            self.assertEqual(merged.get("a"), 1)
            self.assertEqual(merged.get("b"), 2)

    def test_output_json_sorted_keys_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "z.json").write_text('{"z": 1, "a": 2}\n', encoding="utf-8")
            run_merge(d, dry_run=False)
            text = (d / DEFAULT_OUTPUT_NAME).read_text(encoding="utf-8")
            self.assertRegex(text, r'"a"\s*:\s*2')
            z_pos = text.index('"z"')
            a_pos = text.index('"a"')
            self.assertLess(a_pos, z_pos)

    def test_non_object_json_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "list.json").write_text("[1]", encoding="utf-8")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)
            with self.assertRaises(ValueError):
                load_and_merge(disc.merge_paths)

    def test_main_data_error_on_empty_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            code = main(["--input", str(d)])
            self.assertEqual(code, EXIT_DATA_ERROR)

    def test_main_invalid_json_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "bad.json").write_text("{", encoding="utf-8")
            code = main(["--input", str(d), "--dry-run"])
            self.assertEqual(code, EXIT_DATA_ERROR)

    def test_output_symlink_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            real = d / "real.json"
            real.write_text('{"x": 1}\n', encoding="utf-8")
            out = d / DEFAULT_OUTPUT_NAME
            try:
                os.symlink(real, out)
            except OSError:
                self.skipTest("symlink creation not available")
            with self.assertRaises(ValueError):
                discover_policy_inputs(d, DEFAULT_OUTPUT_NAME, log=self._log)

    def test_stale_lock_auto_removed_when_pid_not_running(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            (lock / "pid").write_text("999999999", encoding="utf-8")
            run_merge(d, dry_run=True)
            self.assertFalse(lock.exists())

    def test_corrupt_lock_requires_break_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            with self.assertRaises(StaleLockError):
                run_merge(d, dry_run=True)
            run_merge(d, dry_run=True, break_lock=True)
            self.assertFalse(lock.exists())

    def test_invalid_owner_json_treated_as_corrupt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            (lock / "owner.json").write_text("{not-json", encoding="utf-8")
            with self.assertRaises(StaleLockError):
                run_merge(d, dry_run=True)
            run_merge(d, dry_run=True, break_lock=True)
            self.assertFalse(lock.exists())

    def test_corrupt_lock_main_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            code = main(["--input", str(d), "--dry-run"])
            self.assertEqual(code, EXIT_LOCK_HELD)

    def test_break_lock_main_succeeds_after_corrupt_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            code_fail = main(["--input", str(d), "--dry-run"])
            self.assertEqual(code_fail, EXIT_LOCK_HELD)
            code_ok = main(["--input", str(d), "--dry-run", "--break-lock"])
            self.assertEqual(code_ok, EXIT_SUCCESS)
            self.assertFalse(lock.exists())

    def test_subprocess_lock_conflict_with_parent_pid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
            lock = d / LOCK_DIR_NAME
            lock.mkdir()
            (lock / "pid").write_text(str(os.getpid()), encoding="utf-8")
            code = _subprocess_cli(["--input", str(d), "--dry-run"], cwd=_CUA_ROOT)
            self.assertEqual(code, EXIT_LOCK_HELD)

    def test_concurrent_thread_lock_held(self) -> None:
        log = logging.getLogger("locktest")
        log.setLevel(logging.CRITICAL)
        hold_started = threading.Event()
        release = threading.Event()

        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "x.json").write_text('{"x": 1}\n', encoding="utf-8")

            def hold_lock() -> None:
                with acquire_run_lock(d, break_lock=False, log=log):
                    hold_started.set()
                    release.wait(timeout=30)

            t = threading.Thread(target=hold_lock)
            t.start()
            self.assertTrue(hold_started.wait(timeout=10))
            with self.assertRaises(LockHeldError):
                run_merge(d, dry_run=True, log=log)
            release.set()
            t.join(timeout=10)
            self.assertFalse(t.is_alive())

    def test_break_lock_does_not_remove_active_lock(self) -> None:
        """``--break-lock`` must not clear a lock whose owner pid is still running (same process)."""
        log = logging.getLogger("locktest_break")
        log.setLevel(logging.CRITICAL)
        hold = threading.Event()
        release = threading.Event()

        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "x.json").write_text('{"x": 1}\n', encoding="utf-8")

            def hold_lock() -> None:
                with acquire_run_lock(d, break_lock=False, log=log):
                    hold.set()
                    release.wait(timeout=30)

            t = threading.Thread(target=hold_lock)
            t.start()
            self.assertTrue(hold.wait(timeout=10))
            code = main(["--input", str(d), "--dry-run", "--break-lock"])
            release.set()
            t.join(timeout=10)
            self.assertFalse(t.is_alive())

        self.assertEqual(code, EXIT_LOCK_HELD)


class TestNonFileEntry(unittest.TestCase):
    def test_fifo_or_special_skipped_if_present(self) -> None:
        """Platforms without FIFO can skip; if mkfifo works, entry is ignored as non-regular."""
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            fifo = d / "pipe.json"
            try:
                os.mkfifo(fifo, 0o644)
            except (AttributeError, OSError):
                self.skipTest("FIFO not available")
            disc = discover_policy_inputs(d, DEFAULT_OUTPUT_NAME)
            self.assertEqual(disc.merge_paths, [])
            self.assertIn("pipe.json", disc.ignored_non_json)
