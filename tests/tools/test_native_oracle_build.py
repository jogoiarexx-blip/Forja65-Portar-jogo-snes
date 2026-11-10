"""Portable test-only native bridge: real ABI, failure paths and argv quoting."""
import ctypes
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('native_oracle_build', ROOT / 'tools/native_oracle_build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NativeOracleBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='native oracle ç ')
        cls.root = Path(cls.temp.name)
        cls.source = cls.root / 'bridge ç.cpp'
        cls.source.write_text('''#if defined(_WIN32)
#define API __declspec(dllexport)
#else
#define API
#endif
extern "C" API unsigned wrap(unsigned a, unsigned b) { return (a+b)&65535u; }
''', encoding='utf8')
        cls.library = builder.build_native_library(cls.root / 'build ç', [cls.source], [])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_real_shared_library_abi_and_space_paths(self):
        lib = ctypes.CDLL(str(self.library))
        lib.wrap.argtypes = [ctypes.c_uint, ctypes.c_uint]
        lib.wrap.restype = ctypes.c_uint
        try:
            self.assertEqual(lib.wrap(65535, 2), 1)
        finally:
            builder.close_native_library(lib)

    def test_prebuilt_runs_without_cmake_or_cxx(self):
        with patch.dict(os.environ, {'NATIVE_TEST_BRIDGE': str(self.library), 'CXX': 'missing-g++', 'CMAKE_COMMAND': 'missing-cmake'}):
            with patch.object(builder.subprocess, 'run', side_effect=AssertionError('must not compile')):
                lib = builder.load_native_library(self.root, [], [], prebuilt_env='NATIVE_TEST_BRIDGE')
                try:
                    self.assertEqual(lib.wrap(65535, 2), 1)
                finally:
                    builder.close_native_library(lib)

    def test_bad_prebuilt_does_not_fallback(self):
        with patch.dict(os.environ, {'NATIVE_TEST_BRIDGE': str(self.root / 'missing.dll')}):
            with self.assertRaisesRegex(RuntimeError, 'pré-compilada'):
                builder.load_native_library(self.root, [], [], prebuilt_env='NATIVE_TEST_BRIDGE')

    def test_missing_cmake_has_actionable_error(self):
        with patch.dict(os.environ, {'CMAKE_COMMAND': 'definitely-missing-cmake'}):
            with self.assertRaisesRegex(RuntimeError, 'CMake.*não encontrado'):
                builder.build_native_library(self.root / 'no cmake', [self.source], [])

    def test_target_name_rejects_cmake_injection(self):
        with self.assertRaises(ValueError):
            builder.build_native_library(self.root, [self.source], [], name='bad)\nmessage(FATAL_ERROR x)')

    def test_compile_failure_is_not_suppressed(self):
        source = self.root / 'broken.cpp'
        source.write_text('#error deliberate_failure\n')
        with self.assertRaisesRegex(RuntimeError, '(?s)compilação.*deliberate_failure'):
            builder.build_native_library(self.root / 'failure', [source], [])


if __name__ == '__main__':
    unittest.main()
