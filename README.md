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
  works offline). The desktop shells (Tauri for Windows 10/11, Electron 22 for Windows 7/8)
  will wrap this build.
