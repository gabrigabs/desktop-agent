use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const NORMAL_WIDTH: f64 = 520.0;
const NORMAL_HEIGHT: f64 = 820.0;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
                let _ = window.set_decorations(false);
            }

            // Register global shortcut: Control+Shift+Space
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            let _ = app.global_shortcut().register(shortcut);

            // Setup System Tray Icon
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .expect("failed to load tray icon");

            let tray_menu = tauri::menu::Menu::with_items(
                app,
                &[
                    &tauri::menu::MenuItem::with_id(app, "show", "Mostrar Helix", true, None::<&str>)?,
                    &tauri::menu::MenuItem::with_id(app, "hide", "Ocultar Helix", true, None::<&str>)?,
                    &tauri::menu::PredefinedMenuItem::separator(app)?,
                    &tauri::menu::MenuItem::with_id(app, "quit", "Sair do Helix", true, None::<&str>)?,
                ],
            )?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .icon_as_template(true)
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            use tauri::Emitter;
                            use tauri_plugin_positioner::{Position, WindowExt};
                            let _ = window.set_shadow(false);
                            let _ = window.set_decorations(false);
                            let _ = window.set_resizable(true);
                            let _ = window.set_min_size::<tauri::Size>(None);
                            let _ = window.set_fullscreen(false);
                            let _ = window.set_simple_fullscreen(false);
                            let _ = window.unmaximize();
                            let _ = window.set_size(tauri::Size::Logical(
                                tauri::LogicalSize::new(NORMAL_WIDTH, NORMAL_HEIGHT),
                            ));
                            let _ = window.move_window(Position::TrayCenter);
                            let _ = window.emit("tray-click", "normal");
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                use tauri::Emitter;
                                use tauri_plugin_positioner::{Position, WindowExt};
                                let _ = window.set_shadow(false);
                                let _ = window.set_decorations(false);
                                let _ = window.set_resizable(true);
                                let _ = window.set_min_size::<tauri::Size>(None);
                                let _ = window.set_fullscreen(false);
                                let _ = window.set_simple_fullscreen(false);
                                let _ = window.unmaximize();
                                let _ = window.set_size(tauri::Size::Logical(
                                    tauri::LogicalSize::new(NORMAL_WIDTH, NORMAL_HEIGHT),
                                ));
                                let _ = window.move_window(Position::TrayCenter);
                                let _ = window.emit("tray-click", "normal");
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized { .. } = event {
                let _ = window.set_shadow(false);
            }
            if let tauri::WindowEvent::Destroyed = event {
                std::process::exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
