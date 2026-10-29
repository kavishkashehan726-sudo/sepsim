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
