use std::{
    fs::{self, OpenOptions},
    io::Write,
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{
    Engine as _,
    engine::general_purpose::URL_SAFE_NO_PAD,
};
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, State, WebviewWindow,
    webview::PageLoadEvent,
};
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

const DESKTOP_LOG_MAX_BYTES: u64 = 2 * 1024 * 1024;
const RENDERER_BOOTSTRAP_SCRIPT: &str = include_str!("renderer_bootstrap.js");
const RENDERER_MOUNT_TIMEOUT: Duration = Duration::from_secs(15);
const RENDERER_PAGE_PROBE_SCRIPT: &str = r#"
(function () {
  if (window.__PROJECTMIND_BOOT__ &&
      typeof window.__PROJECTMIND_BOOT__.report === "function") {
    window.__PROJECTMIND_BOOT__.report("native-page-load-finished", {
      location: window.location.href,
      readyState: document.readyState,
      rootChildren: document.getElementById("root")
        ? document.getElementById("root").childElementCount
        : -1
    });
  }
})();
"#;
const RENDERER_RECOVERY_SCRIPT: &str = r#"
(function () {
  if (window.__PROJECTMIND_BOOT__ &&
      typeof window.__PROJECTMIND_BOOT__.showRecovery === "function") {
    window.__PROJECTMIND_BOOT__.showRecovery(
      "The native startup watchdog did not observe a rendered interface."
    );
    return;
  }
  if (!document.querySelector("[data-projectmind-recovery-styles]")) {
    var styles = document.createElement("style");
    styles.setAttribute("data-projectmind-recovery-styles", "");
    styles.textContent =
      "html,body,#root{width:100%;height:100%;margin:0}" +
      "body{font-family:'Segoe UI Variable','Segoe UI',Arial,sans-serif;" +
      "background:#1f1f1f;color:#f5f5f5}" +
      ".native-shell{display:flex;width:100%;height:100%;box-sizing:border-box;" +
      "align-items:center;justify-content:center;flex-direction:column;gap:16px;" +
      "padding:40px;text-align:center;background:#1f1f1f;color:#f5f5f5}" +
      ".native-shell__mark{display:grid;width:64px;height:64px;place-items:center;" +
      "border-radius:16px;background:#4f1118;color:#ff99a4;font-size:28px;" +
      "font-weight:700}.native-shell h1,.native-shell p{margin:0}" +
      ".native-shell p{max-width:680px;color:#c7c7c7;line-height:1.5}" +
      ".native-shell__path{max-width:min(760px,100%);color:#c7c7c7;" +
      "overflow-wrap:anywhere}";
    (document.head || document.documentElement).appendChild(styles);
  }
  var root = document.getElementById("root");
  if (!root) {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  }
  root.innerHTML =
    '<main class="native-shell native-shell--error" ' +
    'data-projectmind-surface role="alert">' +
    '<div class="native-shell__mark" aria-hidden="true">!</div>' +
    '<h1>ProjectMind interface did not start</h1>' +
    '<p>The native startup watchdog detected that the Windows interface ' +
    'did not mount. Your local project database was not changed.</p>' +
    '<code class="native-shell__path">%LOCALAPPDATA%\\' +
    'com.projectmind.engineeringai\\logs</code></main>';
})();
"#;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendBootstrap {
    base_url: String,
    renderer_launch_id: String,
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

struct RendererProcess {
    launch_id: String,
    state: Mutex<RendererProcessState>,
}

#[derive(Default)]
struct RendererProcessState {
    mounted: bool,
    ready: bool,
    watchdog_fired: bool,
}

impl RendererProcess {
    fn new(launch_id: String) -> Self {
        Self {
            launch_id,
            state: Mutex::new(RendererProcessState::default()),
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RendererEvidence {
    location: String,
    ready_state: String,
    root_height: f64,
    root_width: f64,
    top_element: String,
    visible: bool,
    visible_text_length: usize,
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
fn report_renderer_mounted(
    evidence: RendererEvidence,
    process: State<'_, BackendProcess>,
    renderer: State<'_, RendererProcess>,
) -> Result<(), String> {
    validate_renderer_evidence(&evidence)?;
    let mut state = renderer
        .state
        .lock()
        .map_err(|_| "The renderer state is unavailable.".to_owned())?;
    if !state.mounted {
        append_desktop_log(
            &process.log_path,
            &format!(
                "renderer mounted [launch={}] {}",
                renderer.launch_id,
                format_renderer_evidence(&evidence)
            ),
        );
    }
    state.mounted = true;
    Ok(())
}

#[tauri::command]
fn report_frontend_ready(
    evidence: RendererEvidence,
    process: State<'_, BackendProcess>,
    renderer: State<'_, RendererProcess>,
) -> Result<(), String> {
    validate_renderer_evidence(&evidence)?;
    let mut state = renderer
        .state
        .lock()
        .map_err(|_| "The renderer state is unavailable.".to_owned())?;
    if !state.ready {
        append_desktop_log(
            &process.log_path,
            &format!(
                "renderer ready [launch={}] interface_visible=true {}",
                renderer.launch_id,
                format_renderer_evidence(&evidence)
            ),
        );
    }
    state.mounted = true;
    state.ready = true;
    if let Ok(mut state) = process.state.lock() {
        state.last_error = None;
    }
    Ok(())
}

#[tauri::command]
fn report_document_started(
    app: AppHandle,
    process: State<'_, BackendProcess>,
    renderer: State<'_, RendererProcess>,
    location: String,
) {
    if let Ok(mut state) = renderer.state.lock() {
        state.mounted = false;
        state.ready = false;
        state.watchdog_fired = false;
    }
    let location: String = location
        .chars()
        .filter(|character| !character.is_control())
        .take(240)
        .collect();
    append_desktop_log(
        &process.log_path,
        &format!(
            "renderer document started [launch={}] location={location}",
            renderer.launch_id
        ),
    );
    start_renderer_watchdog(app);
}

#[tauri::command]
fn report_frontend_diagnostic(
    process: State<'_, BackendProcess>,
    renderer: State<'_, RendererProcess>,
    event: String,
    detail: String,
) {
    let event: String = event
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .take(80)
        .collect();
    let detail: String = detail.chars().take(4_000).collect();
    append_desktop_log(
        &process.log_path,
        &format!(
            "frontend diagnostic [launch={} event={event}]: {detail}",
            renderer.launch_id
        ),
    );
}

#[tauri::command]
async fn reset_renderer(
    process: State<'_, BackendProcess>,
    renderer: State<'_, RendererProcess>,
    window: WebviewWindow,
) -> Result<(), String> {
    append_desktop_log(
        &process.log_path,
        &format!(
            "resetting WebView browsing data [launch={}]",
            renderer.launch_id
        ),
    );
    if let Ok(mut state) = renderer.state.lock() {
        state.mounted = false;
        state.ready = false;
        state.watchdog_fired = false;
    }
    window
        .clear_all_browsing_data()
        .map_err(|error| format!("Could not reset the interface cache: {error}"))?;
    window
        .reload()
        .map_err(|error| format!("Could not reload the interface: {error}"))
}

#[tauri::command]
fn open_diagnostics_folder(process: State<'_, BackendProcess>) -> Result<String, String> {
    let directory = process
        .log_path
        .parent()
        .ok_or_else(|| "The diagnostics directory is unavailable.".to_owned())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer.exe")
        .arg(directory)
        .spawn()
        .map_err(|error| format!("Could not open the diagnostics directory: {error}"))?;

    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn select_project_folder(initial_path: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            use std::os::windows::process::CommandExt;

            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            let script = r#"
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose the ProjectMind project folder'
$dialog.ShowNewFolderButton = $true
if ($env:PROJECTMIND_INITIAL_FOLDER -and (Test-Path -LiteralPath $env:PROJECTMIND_INITIAL_FOLDER)) {
  $dialog.SelectedPath = $env:PROJECTMIND_INITIAL_FOLDER
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
}
"#;
            let powershell = std::env::var_os("SystemRoot")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
                .join("System32")
                .join("WindowsPowerShell")
                .join("v1.0")
                .join("powershell.exe");
            let output = std::process::Command::new(powershell)
                .args([
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-STA",
                    "-Command",
                    script,
                ])
                .env(
                    "PROJECTMIND_INITIAL_FOLDER",
                    initial_path.unwrap_or_default(),
                )
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|error| format!("Could not open the folder chooser: {error}"))?;
            if !output.status.success() {
                return Err("The Windows folder chooser could not be opened.".to_owned());
            }
            let selected = String::from_utf8_lossy(&output.stdout)
                .trim_matches(|character: char| {
                    matches!(character, '\u{feff}' | '\r' | '\n' | ' ')
                })
                .to_owned();
            Ok(if selected.is_empty() {
                None
            } else {
                Some(selected)
            })
        })
        .await
        .map_err(|error| format!("The folder chooser stopped unexpectedly: {error}"))?
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = initial_path;
        Ok(None)
    }
}

#[tauri::command]
fn reveal_local_path(path: String) -> Result<(), String> {
    let selected = PathBuf::from(path);
    if !selected.exists() {
        return Err("The selected local path no longer exists.".to_owned());
    }

    #[cfg(target_os = "windows")]
    {
        let mut command = std::process::Command::new("explorer.exe");
        if selected.is_file() {
            command.arg(format!("/select,{}", selected.to_string_lossy()));
        } else {
            command.arg(&selected);
        }
        command
            .spawn()
            .map_err(|error| format!("Could not open File Explorer: {error}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = selected;
        return Err("Opening local paths is available in the Windows application.".to_owned());
    }

    Ok(())
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

fn create_renderer_launch_id() -> Result<String, Box<dyn std::error::Error>> {
    let mut bytes = [0_u8; 12];
    getrandom::fill(&mut bytes).map_err(|error| {
        std::io::Error::other(format!("failed to generate renderer launch identifier: {error}"))
    })?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn validate_renderer_evidence(evidence: &RendererEvidence) -> Result<(), String> {
    if !evidence.visible
        || evidence.root_width < 300.0
        || evidence.root_height < 200.0
        || evidence.visible_text_length < 10
    {
        return Err(format!(
            "The renderer did not provide visible interface evidence: {}",
            format_renderer_evidence(evidence)
        ));
    }
    Ok(())
}

fn format_renderer_evidence(evidence: &RendererEvidence) -> String {
    let ready_state: String = evidence
        .ready_state
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .take(24)
        .collect();
    let top_element: String = evidence
        .top_element
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '#' | '.')
        })
        .take(120)
        .collect();
    let location: String = evidence
        .location
        .chars()
        .filter(|character| !character.is_control())
        .take(240)
        .collect();
    format!(
        "root={}x{} text={} ready_state={} top={} location={}",
        evidence.root_width.round(),
        evidence.root_height.round(),
        evidence.visible_text_length,
        ready_state,
        top_element,
        location
    )
}

fn development_bootstrap(renderer_launch_id: String) -> Option<BackendBootstrap> {
    let base_url = std::env::var("PROJECTMIND_BACKEND_URL").ok()?;
    let session_token = std::env::var("PROJECTMIND_SESSION_TOKEN").ok()?;
    Some(BackendBootstrap {
        base_url,
        renderer_launch_id,
        session_token,
        managed: false,
    })
}

fn rotate_desktop_log(path: &Path) {
    let should_rotate = fs::metadata(path)
        .map(|metadata| metadata.len() >= DESKTOP_LOG_MAX_BYTES)
        .unwrap_or(false);
    if !should_rotate {
        return;
    }

    let previous_path = path.with_extension("log.previous");
    let _ = fs::remove_file(&previous_path);
    let _ = fs::rename(path, previous_path);
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

fn start_renderer_watchdog(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(RENDERER_MOUNT_TIMEOUT);

        let renderer = app.state::<RendererProcess>();
        let should_recover = match renderer.state.lock() {
            Ok(mut state) if !state.mounted && !state.watchdog_fired => {
                state.watchdog_fired = true;
                true
            }
            _ => false,
        };
        if !should_recover {
            return;
        }

        let process = app.state::<BackendProcess>();
        append_desktop_log(
            &process.log_path,
            &format!(
                "renderer watchdog timeout [launch={}] mounted=false; showing native recovery",
                renderer.launch_id
            ),
        );
        if let Some(window) = app.get_webview_window("main") {
            if let Err(error) = window.eval(RENDERER_RECOVERY_SCRIPT) {
                append_desktop_log(
                    &process.log_path,
                    &format!("renderer recovery injection failed: {error}"),
                );
            }
        } else {
            append_desktop_log(
                &process.log_path,
                "renderer recovery injection failed: main window was not found",
            );
        }
    });
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
                    append_desktop_log(&process.log_path, &format!("backend stderr: {text}"));
                }
                CommandEvent::Error(error) => {
                    let message = format!("Backend process error: {error}");
                    record_launch_error(process.inner(), generation, message);
                }
                CommandEvent::Terminated(payload) => {
                    let message = format!(
                        "The local backend stopped unexpectedly ({payload:?}). \
                         See application.log in the diagnostic folder."
                    );
                    append_desktop_log(&process.log_path, &message);
                    if let Ok(mut state) = process.state.lock() {
                        if state.generation == generation {
                            state.last_error = Some(message);
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
    let page_log_path = Arc::new(Mutex::new(None::<PathBuf>));
    let setup_log_path = Arc::clone(&page_log_path);
    let hook_log_path = Arc::clone(&page_log_path);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .append_invoke_initialization_script(RENDERER_BOOTSTRAP_SCRIPT)
        .on_page_load(move |webview, payload| {
            let event = match payload.event() {
                PageLoadEvent::Started => "started",
                PageLoadEvent::Finished => "finished",
            };
            let log_path = hook_log_path
                .lock()
                .ok()
                .and_then(|path| path.as_ref().cloned());
            if let Some(log_path) = log_path {
                append_desktop_log(
                    &log_path,
                    &format!("native page load {event}: {}", payload.url()),
                );
                if matches!(payload.event(), PageLoadEvent::Finished) {
                    if let Err(error) = webview.eval(RENDERER_PAGE_PROBE_SCRIPT) {
                        append_desktop_log(
                            &log_path,
                            &format!("native page-load probe failed: {error}"),
                        );
                    }
                }
            }
        })
        .setup(move |app| {
            let data_dir = app.path().app_local_data_dir()?;
            fs::create_dir_all(data_dir.join("logs"))?;
            let log_path = data_dir.join("logs").join("desktop.log");
            rotate_desktop_log(&log_path);
            if let Ok(mut path) = setup_log_path.lock() {
                *path = Some(log_path.clone());
            }

            let renderer_launch_id = create_renderer_launch_id()?;
            append_desktop_log(
                &log_path,
                &format!(
                    "desktop launch [version={} launch={renderer_launch_id}] \
                     frontend=self-contained renderer_profile=webview-v0.3.0",
                    env!("CARGO_PKG_VERSION")
                ),
            );
            match tauri::webview_version() {
                Ok(version) => append_desktop_log(
                    &log_path,
                    &format!("WebView runtime version: {version}"),
                ),
                Err(error) => append_desktop_log(
                    &log_path,
                    &format!("WebView runtime version unavailable: {error}"),
                ),
            }
            app.manage(RendererProcess::new(renderer_launch_id.clone()));

            if cfg!(debug_assertions) {
                if let Some(bootstrap) = development_bootstrap(renderer_launch_id.clone()) {
                    app.manage(bootstrap);
                    app.manage(BackendProcess::new(data_dir, 0));
                    start_renderer_watchdog(app.handle().clone());
                    return Ok(());
                }
            }

            let port = reserve_loopback_port()?;
            let bootstrap = BackendBootstrap {
                base_url: format!("http://127.0.0.1:{port}"),
                renderer_launch_id,
                session_token: create_session_token()?,
                managed: true,
            };
            app.manage(bootstrap.clone());
            app.manage(BackendProcess::new(data_dir, port));

            let process = app.state::<BackendProcess>();
            if let Err(error) = launch_sidecar(app.handle(), &bootstrap, process.inner()) {
                append_desktop_log(&process.log_path, &error);
            }
            start_renderer_watchdog(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_bootstrap,
            backend_runtime_status,
            restart_backend,
            report_document_started,
            report_renderer_mounted,
            report_frontend_ready,
            report_frontend_diagnostic,
            reset_renderer,
            open_diagnostics_folder,
            select_project_folder,
            reveal_local_path
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
