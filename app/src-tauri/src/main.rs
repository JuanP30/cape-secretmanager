// CAPE SecretManager — vive solo como ícono en la barra (Mac) / bandeja (Windows). Clic → panel pequeño
// bajo el ícono; se oculta al perder el foco. La sesión de persona va en el Llavero del sistema, nunca en
// un archivo. Copiar pone el valor en el portapapeles y lo borra a los 30 s si nadie lo cambió.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{thread, time::Duration};
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_positioner::{Position, WindowExt};

const SERVICIO: &str = "cape-secretmanager";

fn entrada() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICIO, "sesion").map_err(|e| e.to_string())
}

#[tauri::command]
fn token_guardar(token: String) -> Result<(), String> {
    entrada()?.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn token_leer() -> Option<String> {
    entrada().ok()?.get_password().ok()
}

#[tauri::command]
fn token_borrar() {
    if let Ok(e) = entrada() {
        let _ = e.delete_credential();
    }
}

#[tauri::command]
fn copiar(app: AppHandle, texto: String) -> Result<(), String> {
    app.clipboard().write_text(texto.clone()).map_err(|e| e.to_string())?;
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(30));
        if app.clipboard().read_text().ok().as_deref() == Some(texto.as_str()) {
            let _ = app.clipboard().write_text(String::new());
        }
    });
    Ok(())
}

// Mac: coordenadas nativas de macOS (puntos, iguales en todas las pantallas). Las de Tauri se
// descuadran con dos pantallas de escala distinta (Retina + externa) y el panel caía en la principal.
// El panel sale en la pantalla del mouse, pegado a la barra: bajo el mouse si vino del ícono, a la derecha si no.
#[cfg(target_os = "macos")]
fn colocar_mac(w: &tauri::WebviewWindow, desde_icono: bool) -> Option<()> {
    use objc2_app_kit::{NSEvent, NSScreen, NSWindow};
    use objc2_foundation::NSPoint;
    let mtm = objc2::MainThreadMarker::new()?;
    let m = NSEvent::mouseLocation();
    let pantalla = NSScreen::screens(mtm).iter().find(|s| {
        let f = s.frame();
        m.x >= f.origin.x && m.x <= f.origin.x + f.size.width && m.y >= f.origin.y && m.y <= f.origin.y + f.size.height
    })?;
    let v = pantalla.visibleFrame();
    let ventana = unsafe { &*(w.ns_window().ok()? as *const NSWindow) };
    let ancho = ventana.frame().size.width;
    let max_x = v.origin.x + v.size.width - ancho - 10.0;
    let x = if desde_icono { (m.x - ancho / 2.0).clamp(v.origin.x + 10.0, max_x) } else { max_x };
    ventana.setFrameTopLeftPoint(NSPoint::new(x, v.origin.y + v.size.height - 6.0));
    Some(())
}

// Con el mouse en otra pantalla (o con el ícono escondido tras la muesca) el panel sale en la
// pantalla donde está el mouse, arriba a la derecha bajo la barra. Desde el ícono, justo debajo de él.
fn a_pantalla_del_mouse(w: &tauri::WebviewWindow) -> Option<()> {
    let app = w.app_handle();
    let c = app.cursor_position().ok()?;
    let m = app.monitor_from_point(c.x, c.y).ok()??;
    let (p, t, f) = (m.position(), m.size(), m.scale_factor());
    let tam = w.outer_size().ok()?;
    let x = p.x + t.width as i32 - tam.width as i32 - (10.0 * f) as i32;
    let y = p.y + (32.0 * f) as i32;
    w.set_position(tauri::PhysicalPosition::new(x, y)).ok()
}

fn alternar_panel(app: &AppHandle, desde_icono: bool) {
    if let Some(w) = app.get_webview_window("panel") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            #[cfg(target_os = "macos")]
            let listo = colocar_mac(&w, desde_icono).is_some();
            #[cfg(not(target_os = "macos"))]
            let listo = false;
            if listo {
            } else if !desde_icono || w.move_window(Position::TrayCenter).is_err() {
                if a_pantalla_del_mouse(&w).is_none() {
                    let _ = w.move_window(Position::TopRight);
                }
            }
            let _ = w.emit("panel-mostrar", ()); // la web arranca la animación de entrada
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _atajo, evento| {
                    if evento.state() == ShortcutState::Pressed {
                        alternar_panel(app, false);
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // sin ícono en el Dock
            // Fondo translúcido del sistema (como los paneles de Wi-Fi o Centro de Control) y esquinas de 14 px.
            #[cfg(target_os = "macos")]
            if let Some(w) = app.get_webview_window("panel") {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                let _ = apply_vibrancy(&w, NSVisualEffectMaterial::Popover, Some(NSVisualEffectState::Active), Some(14.0));
                // En todos los escritorios (Spaces) y encima de apps a pantalla completa, como los paneles del sistema.
                if let Ok(ns) = w.ns_window() {
                    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior as B};
                    let ventana = unsafe { &*(ns as *const NSWindow) };
                    ventana.setCollectionBehavior(B::CanJoinAllSpaces | B::FullScreenAuxiliary | B::Stationary);
                }
            }
            #[cfg(target_os = "windows")]
            if let Some(w) = app.get_webview_window("panel") {
                let _ = window_vibrancy::apply_mica(&w, None);
            }
            // ⌘⇧K (Ctrl+Shift+K en Windows) abre el panel aunque el ícono no se vea.
            app.global_shortcut().register(Shortcut::new(Some((if cfg!(target_os = "macos") { Modifiers::SUPER } else { Modifiers::CONTROL }) | Modifiers::SHIFT), Code::KeyK))?;
            TrayIconBuilder::with_id("cape")
                .icon(Image::from_bytes(include_bytes!("../icons/barra.png"))?)
                .icon_as_template(true)
                .tooltip("CAPE SecretManager")
                .on_tray_icon_event(|tray, evento| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &evento);
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                        alternar_panel(tray.app_handle(), true);
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|ventana, evento| {
            if let WindowEvent::Focused(false) = evento {
                let _ = ventana.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![token_guardar, token_leer, token_borrar, copiar])
        .run(tauri::generate_context!())
        .expect("no pude arrancar CAPE SecretManager");
}
