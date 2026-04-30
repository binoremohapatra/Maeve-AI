# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['maeve_stealth_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('backend/venv/Lib/site-packages/pystray', 'pystray'), ('backend/venv/Lib/site-packages/PIL', 'PIL')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='maeve_stealth_launcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
