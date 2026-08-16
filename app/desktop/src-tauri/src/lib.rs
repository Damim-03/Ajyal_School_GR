mod printing;
#[cfg(windows)]
pub mod usbprint;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      printing::list_printers,
      printing::default_printer,
      printing::print_sheet,
      printing::list_usb_printers,
      printing::print_usb,
      printing::thermal_ready,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
