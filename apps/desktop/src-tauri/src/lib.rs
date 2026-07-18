use std::{
    net::TcpListener,
    sync::Mutex,
};

use base64::{
    Engine as _,
    engine::general_purpose::URL_SAFE_NO_PAD,
};
use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_shell::{
    ShellExt,
    process::CommandChild,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendBootstrap {
    base_url: String,
    session_token: String,
    managed: bool,
}

struct BackendProcess(Mutex<Option<CommandChild>>);

#[tauri::command]
fn backend_bootstrap(state: State<'_, BackendBootstrap>) -> BackendBootstrap {
    state.inner().clone()
}

fn reserve_loopback_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn create_session_token() -> Result<String, Box<dyn std::error::Error>> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes)?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn development_bootstrap() -> Option<BackendBootstrap> {
    let base_url = std::env::var("PROJECTMIND_BACKEND_URL").ok()?;
    let session_token = std::env::var("PROJECTMIND_SESSION_TOKEN").ok()?;
    Some(BackendBootstrap {
        base_url,
        session_token,
        managed: false,
    })
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                if let Some(bootstrap) = development_bootstrap() {
                    app.manage(bootstrap);
                    app.manage(BackendProcess(Mutex::new(None)));
                    return Ok(());
                }
            }

            let port = reserve_loopback_port()?;
            let token = create_session_token()?;
            let data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let port_argument = port.to_string();
            let data_dir_argument = data_dir.to_string_lossy().into_owned();

            let sidecar = app
                .shell()
                .sidecar("projectmind-backend")?
                .args([
                    "--host".to_owned(),
                    "127.0.0.1".to_owned(),
                    "--port".to_owned(),
                    port_argument,
                    "--data-dir".to_owned(),
                    data_dir_argument,
                    "--environment".to_owned(),
                    "production".to_owned(),
                ])
                .env("PROJECTMIND_SESSION_TOKEN", &token);

            let (mut events, child) = sidecar.spawn()?;
            tauri::async_runtime::spawn(async move {
                while events.recv().await.is_some() {
                    // Drain sidecar output so its pipe cannot block. Technical logs are written
                    // by the backend and are intentionally not forwarded to the webview.
                }
            });

            app.manage(BackendBootstrap {
                base_url: format!("http://127.0.0.1:{port}"),
                session_token: token,
                managed: true,
            });
            app.manage(BackendProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backend_bootstrap])
        .build(tauri::generate_context!())
        .expect("failed to build ProjectMind desktop application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let process = app_handle.state::<BackendProcess>();
            if let Ok(mut guard) = process.0.lock() {
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        }
    });
}
