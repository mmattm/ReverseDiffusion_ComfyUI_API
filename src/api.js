const COMFY_URL = "http://127.0.0.1:8000";

let currentController = null;
let currentWorkflowPath = null;
let workflowDropdownInitialized = false;

const workflowModules = import.meta.glob("./workflows/*.json");

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function ensureWorkflowDropdown(selectId = "workflow-select") {
  if (workflowDropdownInitialized) return;

  const select = document.getElementById(selectId);
  if (!select) return;

  const workflows = Object.keys(workflowModules)
    .map((path) => {
      const fileName = path.split("/").pop();
      return {
        path,
        name: fileName.replace(".json", ""),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  select.innerHTML = "";

  workflows.forEach((workflow, index) => {
    const option = document.createElement("option");
    option.value = workflow.path;
    option.textContent = workflow.name;
    select.appendChild(option);

    if (index === 0) {
      currentWorkflowPath = workflow.path;
      select.value = workflow.path;
    }
  });

  select.addEventListener("change", () => {
    currentWorkflowPath = select.value;
    setStatus(
      `workflow: ${select.selectedOptions[0]?.textContent || "unknown"}`,
    );
  });

  workflowDropdownInitialized = true;

  if (workflows.length > 0) {
    setStatus(`workflow: ${workflows[0].name}`);
  } else {
    setStatus("no workflows found");
  }
}

initWorkflowDropdown();

export function initWorkflowDropdown(selectId = "workflow-select") {
  ensureWorkflowDropdown(selectId);
}

export function getCurrentWorkflowPath() {
  ensureWorkflowDropdown();
  return currentWorkflowPath;
}

export function cancelComfyRequest() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
}

async function loadWorkflow(workflowPath) {
  if (!workflowPath) {
    throw new Error("no workflow selected");
  }

  const importer = workflowModules[workflowPath];
  if (!importer) {
    throw new Error(`workflow not found: ${workflowPath}`);
  }

  const mod = await importer();
  return structuredClone(mod.default);
}

function extractBase64(dataUrl) {
  const parts = dataUrl.split(",");
  if (parts.length < 2) throw new Error("invalid dataUrl");
  return parts[1];
}

function ensureDataUrl(base64) {
  if (!base64 || typeof base64 !== "string") return null;
  if (base64.startsWith("data:image/")) return base64;
  return `data:image/png;base64,${base64}`;
}

function findBase64Output(history) {
  const outputs = history?.outputs || {};

  for (const nodeId of Object.keys(outputs)) {
    const text = outputs[nodeId]?.text?.[0];
    if (typeof text === "string" && text.length > 100) {
      return text;
    }
  }

  return null;
}

async function getBase64FromHistory(promptId, signal) {
  while (true) {
    if (signal.aborted) {
      throw new DOMException("Request aborted", "AbortError");
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const res = await fetch(`${COMFY_URL}/history/${promptId}`, { signal });
    if (!res.ok) throw new Error("failed to fetch history");

    const json = await res.json();
    const history = json[promptId];

    if (!history) continue;

    const textOutput = findBase64Output(history);
    if (textOutput) return ensureDataUrl(textOutput);

    if (history?.status?.completed) return null;
  }
}

export async function runComfy(dataUrl, promptText, seed) {
  ensureWorkflowDropdown();

  cancelComfyRequest();
  currentController = new AbortController();
  const { signal } = currentController;

  try {
    const workflow = await loadWorkflow(currentWorkflowPath);

    setStatus(
      `running: ${currentWorkflowPath.split("/").pop().replace(".json", "")}...`,
    );

    workflow["30"].inputs.data = extractBase64(dataUrl);
    workflow["6"].inputs.text = promptText;
    workflow["13"].inputs.noise_seed = seed;

    const promptRes = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: workflow }),
      signal,
    });

    if (!promptRes.ok) {
      const text = await promptRes.text();
      throw new Error(`prompt failed: ${text}`);
    }

    const promptJson = await promptRes.json();
    const promptId = promptJson.prompt_id;

    const firstImage = await getBase64FromHistory(promptId, signal);

    if (currentController?.signal === signal) {
      currentController = null;
    }

    if (!firstImage) {
      setStatus("no output");
      return {
        ok: false,
        skipped: true,
        error: "no output",
      };
    }

    setStatus("done");

    return {
      ok: true,
      firstImage,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        aborted: true,
        error: "aborted",
      };
    }

    setStatus("error");

    return {
      ok: false,
      error: error.message || String(error),
    };
  }
}
