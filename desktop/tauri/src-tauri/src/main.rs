// SEPSim desktop shell for Windows 10 and 11. The whole simulator runs in the web view; this
// only opens the window. Windows 7 and 8 use the Electron shell instead (desktop/electron).

// No console window next to the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("SEPSim could not start");
}
