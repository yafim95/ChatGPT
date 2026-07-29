(function () {
  "use strict";

  if (window.__PROJECTMIND_BOOT__) {
    return;
  }

  var state = {
    mounted: false,
    ready: false,
    startedAt: Date.now(),
  };

  function describeError(value) {
    if (value instanceof Error) {
      return value.stack || value.name + ": " + value.message;
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return "Unknown renderer error";
    }
  }

  function invoke(command, args) {
    var internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") {
      return Promise.reject(new Error("The native IPC bridge is unavailable."));
    }
    return internals.invoke(command, args || {});
  }

  function report(event, detail) {
    var serialized;
    try {
      serialized = typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch (_error) {
      serialized = describeError(detail);
    }
    if (typeof serialized !== "string") {
      serialized = String(detail);
    }
    return invoke("report_frontend_diagnostic", {
      event: event,
      detail: serialized,
    }).catch(function () {
      return undefined;
    });
  }

  function ensureRecoveryStyles() {
    if (document.querySelector("[data-projectmind-recovery-styles]")) {
      return;
    }

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
      "overflow-wrap:anywhere}.native-shell__actions{display:flex;flex-wrap:wrap;" +
      "justify-content:center;gap:10px}.native-shell button{padding:9px 18px;" +
      "border:1px solid #858585;border-radius:6px;color:#fff;background:#333;" +
      "cursor:pointer;font:inherit}.native-shell button:first-child{" +
      "border-color:#0f6cbd;background:#0f6cbd}.native-shell button:disabled{" +
      "cursor:wait;opacity:.65}";
    (document.head || document.documentElement).appendChild(styles);
  }

  function bindRecoveryActions(surface) {
    var reload = surface.querySelector("[data-projectmind-reload]");
    var reset = surface.querySelector("[data-projectmind-reset]");
    var logs = surface.querySelector("[data-projectmind-open-logs]");

    if (reload) {
      reload.addEventListener("click", function () {
        window.location.reload();
      });
    }

    if (reset) {
      reset.addEventListener("click", function () {
        reset.disabled = true;
        reset.textContent = "Resetting interface…";
        invoke("reset_renderer")
          .catch(function (error) {
            reset.disabled = false;
            reset.textContent = "Reset interface cache";
            return report("renderer-reset-error", describeError(error));
          })
          .catch(function () {
            return undefined;
          });
      });
    }

    if (logs) {
      logs.addEventListener("click", function () {
        invoke("open_diagnostics_folder").catch(function (error) {
          return report("open-diagnostics-error", describeError(error));
        });
      });
    }
  }

  function showRecovery(reason) {
    if (state.mounted || state.ready) {
      return;
    }

    ensureRecoveryStyles();
    var root = document.getElementById("root");
    if (!root) {
      root = document.createElement("div");
      root.id = "root";
      document.body.appendChild(root);
    }

    root.innerHTML =
      '<main class="native-shell native-shell--error" ' +
      'data-projectmind-native-recovery data-projectmind-surface role="alert">' +
      '<div class="native-shell__mark" aria-hidden="true">!</div>' +
      "<h1>ProjectMind interface did not start</h1>" +
      "<p>The local project database was not changed. ProjectMind detected " +
      "that the Windows interface did not finish loading and saved a " +
      "diagnostic record automatically.</p>" +
      '<code class="native-shell__path">%LOCALAPPDATA%\\' +
      "com.projectmind.engineeringai\\logs</code>" +
      '<div class="native-shell__actions">' +
      '<button type="button" data-projectmind-reload>Reload interface</button>' +
      '<button type="button" data-projectmind-reset>Reset interface cache</button>' +
      '<button type="button" data-projectmind-open-logs>Open diagnostics folder</button>' +
      "</div>" +
      "<p data-projectmind-recovery-reason></p>" +
      "</main>";

    var surface = root.querySelector("[data-projectmind-native-recovery]");
    if (surface) {
      var reasonElement = surface.querySelector(
        "[data-projectmind-recovery-reason]",
      );
      if (reasonElement) {
        reasonElement.textContent = reason;
      }
      bindRecoveryActions(surface);
    }
  }

  function summarizeDocument() {
    var root = document.getElementById("root");
    var moduleScripts = Array.prototype.map.call(
      document.querySelectorAll('script[type="module"]'),
      function (script) {
        return script.src || "inline";
      },
    );
    return {
      elapsedMs: Date.now() - state.startedAt,
      location: window.location.href,
      moduleScripts: moduleScripts,
      readyState: document.readyState,
      rootChildren: root ? root.childElementCount : -1,
      rootTextLength: root && root.textContent ? root.textContent.length : 0,
    };
  }

  window.__PROJECTMIND_BOOT__ = {
    markMounted: function (evidence) {
      return invoke("report_renderer_mounted", { evidence: evidence }).then(
        function () {
          state.mounted = true;
        },
      );
    },
    markReady: function () {
      state.ready = true;
    },
    report: report,
    showRecovery: showRecovery,
  };

  invoke("report_document_started", {
    location: window.location.href,
  }).catch(function () {
    return undefined;
  });

  window.addEventListener(
    "error",
    function (event) {
      var location = event.filename
        ? " at " +
          event.filename +
          ":" +
          String(event.lineno) +
          ":" +
          String(event.colno)
        : "";
      report(
        "document-start-error",
        describeError(event.error || event.message) + location,
      );
    },
    true,
  );

  window.addEventListener("unhandledrejection", function (event) {
    report("document-start-rejection", describeError(event.reason));
  });

  function onDocumentReady() {
    report("document-ready", summarizeDocument());
    window.setTimeout(function () {
      if (!state.mounted) {
        report("renderer-mount-timeout", summarizeDocument());
        showRecovery(
          "The application bundle did not mount within 12 seconds. You can " +
            "reload it or reset only the WebView interface cache.",
        );
      }
    }, 12000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDocumentReady, {
      once: true,
    });
  } else {
    onDocumentReady();
  }
})();
