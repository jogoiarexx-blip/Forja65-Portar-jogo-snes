#!/usr/bin/env python3
"""Generic CMake shared-library builder for development-time native oracles.

No game, ROM, CPU or PPU knowledge belongs here. All subprocess calls use argv.
CTest should supply a prebuilt target; standalone maintenance can use CMake.
"""
from __future__ import annotations
import argparse
import ctypes
import json
import os
from pathlib import Path
import re
import shutil
import subprocess


def _literal(path: Path) -> str:
    value = path.resolve().as_posix()
    equals = '='
    while ']' + equals + ']' in value:
        equals += '='
    return '[' + equals + '[' + value + ']' + equals + ']'


def _run(argv: list[str], log: Path, phase: str) -> None:
    try:
        result = subprocess.run(argv, text=True, encoding='utf8', errors='replace',
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError as error:
        raise RuntimeError(f'{phase}: não foi possível executar {argv[0]}. {error}') from error
    log.write_text(result.stdout, encoding='utf8')
    if result.returncode:
        raise RuntimeError(f'Falha na {phase} do oráculo nativo. Consulte {log}.\n{result.stdout[-8000:]}')


def build_native_library(build_dir: Path, sources: list[Path], include_dirs: list[Path],
                         *, name: str = 'native_oracle') -> Path:
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', name):
        raise ValueError('Nome de alvo CMake inválido')
    if not sources or any(not Path(p).is_file() for p in sources):
        raise ValueError('Fontes do oráculo ausentes ou inválidas')
    command = os.environ.get('CMAKE_COMMAND') or shutil.which('cmake')
    resolved = shutil.which(command) if command else None
    if not resolved:
        raise RuntimeError('CMake não encontrado. Instale CMake e adicione ao PATH, ou configure CMAKE_COMMAND com o caminho do executável.')
    build_dir = Path(build_dir).resolve()
    project = build_dir / 'oracle-src'
    binary = build_dir / 'oracle-build'
    project.mkdir(parents=True, exist_ok=True)
    cmake = ('cmake_minimum_required(VERSION 3.20)\n'
             'project(NativeOracle LANGUAGES CXX)\n'
             f'add_library({name} SHARED\n' + '\n'.join(_literal(Path(p)) for p in sources) + '\n)\n'
             f'target_compile_features({name} PRIVATE cxx_std_20)\n'
             f'set_target_properties({name} PROPERTIES WINDOWS_EXPORT_ALL_SYMBOLS ON)\n')
    if include_dirs:
        cmake += f'target_include_directories({name} PRIVATE\n' + '\n'.join(_literal(Path(p)) for p in include_dirs) + '\n)\n'
    cmake += f'file(GENERATE OUTPUT "${{CMAKE_BINARY_DIR}}/oracle-$<CONFIG>.txt" CONTENT "$<TARGET_FILE:{name}>")\n'
    (project / 'CMakeLists.txt').write_text(cmake, encoding='utf8')
    # Respect CXX/CMAKE_GENERATOR: CMake owns toolchain selection and platform flags.
    _run([resolved, '-S', str(project), '-B', str(binary), '-DCMAKE_BUILD_TYPE=Release'],
         build_dir / 'oracle-configure.log', 'configuração')
    _run([resolved, '--build', str(binary), '--config', 'Release', '--target', name],
         build_dir / 'oracle-build.log', 'compilação')
    output = binary / 'oracle-Release.txt'
    if not output.is_file():
        raise RuntimeError(f'CMake não forneceu o caminho da biblioteca: {output}')
    library = Path(output.read_text(encoding='utf8').strip())
    if not library.is_file():
        raise RuntimeError(f'Biblioteca do oráculo não foi gerada: {library}')
    return library


def load_native_library(build_dir: Path, sources: list[Path], include_dirs: list[Path],
                        *, prebuilt_env: str, name: str = 'native_oracle') -> ctypes.CDLL:
    prebuilt = os.environ.get(prebuilt_env)
    if prebuilt:
        library = Path(prebuilt)
        if not library.is_absolute() or not library.is_file():
            raise RuntimeError(f'Biblioteca pré-compilada inválida em {prebuilt_env}: {library}. Recompile o alvo de testes com CMake.')
    else:
        library = build_native_library(build_dir, sources, include_dirs, name=name)
    try:
        return ctypes.CDLL(str(library))
    except OSError as error:
        raise RuntimeError(f'Não foi possível carregar a biblioteca nativa {library}; confira a arquitetura do Python e do build (x64). {error}') from error


def close_native_library(library: ctypes.CDLL) -> None:
    """Release a completed oracle so Windows can remove its temporary DLL."""
    if os.name == 'nt':
        import _ctypes
        _ctypes.FreeLibrary(library._handle)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec', type=Path, help='JSON: sources, include_dirs (relative to spec), optional name')
    parser.add_argument('--build-dir', type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.spec.read_text(encoding='utf8'))
    parent = args.spec.resolve().parent
    try:
        library = build_native_library(args.build_dir, [parent / p for p in config['sources']],
                                       [parent / p for p in config.get('include_dirs', [])],
                                       name=config.get('name', 'native_oracle'))
    except (RuntimeError, ValueError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps({'library': str(library)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
