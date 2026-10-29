# sepsim
A modern, cross-platform desktop rebuild of the SEPSim microprocessor simulator. Built with Tauri and React to completely eliminate the need for legacy Windows XP virtual machines.

# This is my latest open source project and I currently working on this. So there are not available sources or updates yet

## Golden traces

`tests/golden` is a submodule pointing at a **private** repo of recordings from the
original SEP model (ModelSim, Windows XP VM). The new engine is tested against them.
With access to that repo, fetch it with:

```
git submodule update --init
```

Without access the folder stays empty; everything else still works.

## Working on it

```
npm install
npm run dev        # the app in a browser at http://localhost:5173
npm test           # engine tests (parity tests need tests/golden)
npm run build      # the app, built for Chromium 108 and later
```

- `packages/sep-core`: the SEP processor model, assembler and file formats (no UI).
- `packages/sep-app`: the user interface (React, Tailwind, Monaco bundled locally so it
  works offline).
- `desktop/tauri`: the Windows 10/11 app (Tauri, using the WebView2 built into Windows).
- `desktop/electron`: the Windows 7/8 app (Electron 22, the last Electron that runs there).

## Windows installers

GitHub Actions builds them on every push (see the **Desktop installers** workflow; the
installers are attached to each run). Pushing a tag such as `v0.1.0` also makes a draft
release with them.

| Installer | For | Notes |
| --- | --- | --- |
| `SEPSim-<version>-Windows-10-11-64-bit-Setup.exe` | Windows 10 and 11, 64-bit | Includes WebView2, so it installs offline |
| `SEPSim-<version>-Windows-10-11-32-bit-Setup.exe` | Windows 10, 32-bit | Includes WebView2, so it installs offline |
| `SEPSim-<version>-Windows-7-8-Setup.exe` | Windows 7, 8 and 8.1, 32- and 64-bit | Picks the right build itself |

To build them yourself on Windows:

```
npm install
cd desktop/tauri && npm install && npm run dist              # Windows 10/11
cd desktop/electron && npm install && npm run dist           # Windows 7/8
```

The Tauri build needs Rust and the Visual Studio C++ build tools
(see https://tauri.app/start/prerequisites/). For a 32-bit build, add
`-- --target i686-pc-windows-msvc` after `npm run dist`.
