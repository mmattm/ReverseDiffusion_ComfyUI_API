const COMFY_URL = "http://127.0.0.1:8188";

let currentController = null;

export function cancelComfyRequest() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
}

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

async function loadWorkflow(signal) {
  const res = await fetch("/workflows/sdxlturbo_b64_V3.json", { signal });
  if (!res.ok) throw new Error("failed to load workflow");
  return res.json();
}

function extractBase64(dataUrl) {
  const parts = dataUrl.split(",");
  if (parts.length < 2) throw new Error("invalid dataUrl");
  return parts[1];
}

function ensureDataUrl(base64) {
  if (!base64 || typeof base64 !== "string") return null;
  if (base64.startsWith("data:image/")) return base64;
  return `data:image/jpeg;base64,${base64}`;
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

    const completed = history?.status?.completed;
    const textOutput = findBase64Output(history);

    if (textOutput) {
      return ensureDataUrl(textOutput);
    }

    if (completed) {
      return null;
    }
  }
}

export async function runComfy(dataUrl, promptText, seed) {
  cancelComfyRequest();
  currentController = new AbortController();
  const { signal } = currentController;

  try {
    setStatus("running...");

    const workflow = await loadWorkflow(signal);

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
