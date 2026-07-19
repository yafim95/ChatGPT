use std::{
    fs::{self, OpenOptions},
    io::Write,
    net::TcpListener,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{
    Engine as _,
    engine::general_purpose::URL_SAFE_NO_PAD,
};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendBootstrap {
    base_url: String,
    session_token: String,
    managed: bool,
}

struct BackendProcessState {
    child: Option<CommandChild>,
    generation: u64,
    last_error: Option<String>,
}

struct BackendProcess {
    state: Mutex<BackendProcessState>,
    data_dir: PathBuf,
    log_path: PathBuf,
    port: u16,
}

impl BackendProcess {
    fn new(data_dir: PathBuf, port: u16) -> Self {
        let log_path = data_dir.join("logs").join("desktop.log");
        Self {
            state: Mutex::new(BackendProcessState {
                child: None,
                generation: 0,
                last_error: None,
            }),
            data_dir,
            log_path,
            port,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendRuntimeStatus {
    running: bool,
    managed: bool,
    last_error: Option<String>,
    log_path: String,
}

#[tauri::command]
fn backend_bootstrap(state: State<'_, BackendBootstrap>) -> BackendBootstrap {
    state.inner().clone()
}

#[tauri::command]
fn backend_runtime_status(
    bootstrap: State<'_, BackendBootstrap>,
    process: State<'_, BackendProcess>,
) -> Result<BackendRuntimeStatus, String> {
    let state = process
        .state
        .lock()
        .map_err(|_| "The local service state is unavailable.".to_owned())?;
    Ok(BackendRuntimeStatus {
        running: state.child.is_some(),
        managed: bootstrap.managed,
        last_error: state.last_error.clone(),
        log_path: process.log_path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn restart_backend(
    app: AppHandle,
    bootstrap: State<'_, BackendBootstrap>,
    process: State<'_, BackendProcess>,
) -> Result<BackendBootstrap, String> {
    if bootstrap.managed {
        launch_sidecar(&app, bootstrap.inner(), process.inner())?;
    }
    Ok(bootstrap.inner().clone())
}

#[tauri::command]
fn report_frontend_ready(process: State<'_, BackendProcess>) {
    append_desktop_log(&process.log_path, "frontend connected to local backend");
    if let Ok(mut state) = process.state.lock() {
        state.last_error = None;
    }
}

fn reserve_loopback_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn create_session_token() -> Result<String, Box<dyn std::error::Error>> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|error| {
        std::io::Error::other(format!("failed to generate session token: {error}"))
    })?;
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

fn append_desktop_log(path: &Path, message: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let message = message.replace('\r', " ").replace('\n', " ");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{timestamp} {message}");
    }
}

fn record_launch_error(process: &BackendProcess, generation: u64, message: String) {
    append_desktop_log(&process.log_path, &message);
    if let Ok(mut state) = process.state.lock() {
        if state.generation == generation {
            state.last_error = Some(message);
            state.child = None;
        }
    }
}

fn launch_sidecar(
    app: &AppHandle,
    bootstrap: &BackendBootstrap,
    process: &BackendProcess,
) -> Result<(), String> {
    let (generation, previous_child) = {
        let mut state = process
            .state
            .lock()
            .map_err(|_| "The local service state is unavailable.".to_owned())?;
        state.generation += 1;
        state.last_error = None;
        (state.generation, state.child.take())
    };

    if let Some(child) = previous_child {
        let _ = child.kill();
    }

    append_desktop_log(
        &process.log_path,
        &format!("launching backend on loopback port {}", process.port),
    );
    let sidecar = app
        .shell()
        .sidecar("projectmind-backend")
        .map_err(|error| format!("Could not locate the packaged local service: {error}"))?
        .args([
            "--host".to_owned(),
            "127.0.0.1".to_owned(),
            "--port".to_owned(),
            process.port.to_string(),
            "--data-dir".to_owned(),
            process.data_dir.to_string_lossy().into_owned(),
            "--environment".to_owned(),
            "production".to_owned(),
        ])
        .env("PROJECTMIND_SESSION_TOKEN", &bootstrap.session_token);

    let (mut events, child) = match sidecar.spawn() {
        Ok(result) => result,
        Err(error) => {
            let message = format!("Could not start the packaged local service: {error}");
            record_launch_error(process, generation, message.clone());
            return Err(message);
        }
    };

    {
        let mut state = process
            .state
            .lock()
            .map_err(|_| "The local service state is unavailable.".to_owned())?;
        state.child = Some(child);
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            let process = app_handle.state::<BackendProcess>();
            match event {
                CommandEvent::Stdout(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    append_desktop_log(&process.log_path, &format!("backend stdout: {text}"));
                }
                CommandEvent::Stderr(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let message = format!("Backend reported a startup error: {text}");
                    append_desktop_log(&process.log_path, &message);
                    if let Ok(mut state) = process.state.lock() {
                        if state.generation == generation {
                            state.last_error = Some(message);
                        }
                    }
                }
                CommandEvent::Error(error) => {
                    let message = format!("Backend process error: {error}");
                    record_launch_error(process.inner(), generation, message);
                }
                CommandEvent::Terminated(payload) => {
                    let message = format!("Backend process terminated: {payload:?}");
                    append_desktop_log(&process.log_path, &message);
                    if let Ok(mut state) = process.state.lock() {
                        if state.generation == generation {
                            if state.last_error.is_none() {
                                state.last_error = Some(message);
                            }
                            state.child = None;
                        }
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            fs::create_dir_all(data_dir.join("logs"))?;

            if cfg!(debug_assertions) {
                if let Some(bootstrap) = development_bootstrap() {
                    app.manage(bootstrap);
                    app.manage(BackendProcess::new(data_dir, 0));
                    return Ok(());
                }
            }

            let port = reserve_loopback_port()?;
            let bootstrap = BackendBootstrap {
                base_url: format!("http://127.0.0.1:{port}"),
                session_token: create_session_token()?,
                managed: true,
            };
            app.manage(bootstrap.clone());
            app.manage(BackendProcess::new(data_dir, port));

            let process = app.state::<BackendProcess>();
            if let Err(error) = launch_sidecar(app.handle(), &bootstrap, process.inner()) {
                append_desktop_log(&process.log_path, &error);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_bootstrap,
            backend_runtime_status,
            restart_backend,
            report_frontend_ready
        ])
        .build(tauri::generate_context!())
        .expect("failed to build ProjectMind desktop application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let process = app_handle.state::<BackendProcess>();
            if let Ok(mut state) = process.state.lock() {
                if let Some(child) = state.child.take() {
                    let _ = child.kill();
                }
            }
        }
    });
}
