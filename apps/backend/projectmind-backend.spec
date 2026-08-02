# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

root = Path(SPECPATH)

analysis = Analysis(
    [str(root / "app" / "__main__.py")],
    pathex=[str(root)],
    binaries=[],
    datas=[
        (str(root / "migrations"), "migrations"),
        (str(root / "alembic.ini"), "."),
    ],
    hiddenimports=collect_submodules("app")
    + ["aiosqlite", "uvicorn.logging", "uvicorn.loops.auto"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=1,
)

pyz = PYZ(analysis.pure)

executable = EXE(
    pyz,
    analysis.scripts,
    analysis.binaries,
    analysis.datas,
    [],
    name="projectmind-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)
