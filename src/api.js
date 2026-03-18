const COMFY_URL = "http://127.0.0.1:8000";

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

async function loadWorkflow() {
  const res = await fetch("/workflows/sdxlturbo_b64.json");
  if (!res.ok) {
    throw new Error("failed to load workflow");
  }
  return await res.json();
}

function canvasDataUrlToBase64(dataUrl) {
  if (!dataUrl) throw new Error("missing canvas dataUrl");
  const parts = dataUrl.split(",");
  if (parts.length < 2) throw new Error("invalid dataUrl");
  return parts[1];
}

async function waitForPrompt(promptId, timeoutMs = 30000) {
  const start = Date.now();

  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout while waiting for prompt ${promptId}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!res.ok) {
      throw new Error("failed to fetch history");
    }

    const json = await res.json();
    if (json[promptId]) return json[promptId];
  }
}

function findFirstImageOutput(outputs) {
  if (!outputs) return null;

  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId];

    if (nodeOutput?.images?.length) {
      return nodeOutput.images[0];
    }

    if (nodeOutput?.ui?.images?.length) {
      return nodeOutput.ui.images[0];
    }
  }

  return null;
}

async function comfyImageToDataUrl(img) {
  const params = new URLSearchParams({
    filename: img.filename,
    subfolder: img.subfolder || "",
    type: img.type || "output",
  });

  const res = await fetch(`${COMFY_URL}/view?${params.toString()}`);
  if (!res.ok) {
    throw new Error("failed to fetch comfy output image");
  }

  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function runComfy(
  dataUrl,
  promptText = "flowers",
  noiseSeed = Math.floor(Math.random() * 2 ** 32),
) {
  setStatus("loading workflow...");

  try {
    const workflow = await loadWorkflow();

    const base64 = canvasDataUrlToBase64(dataUrl);

    // injecte l'image mask/base64
    workflow["30"].inputs.data = base64;

    // injecte le prompt
    workflow["6"].inputs.text = promptText;

    // injecte le seed venant de sketch.js
    workflow["13"].inputs.noise_seed = noiseSeed;

    setStatus("queueing...");

    const promptRes = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!promptRes.ok) {
      const text = await promptRes.text();
      throw new Error(`prompt failed: ${text}`);
    }

    const promptJson = await promptRes.json();
    const promptId = promptJson.prompt_id;

    setStatus("running...");

    const history = await waitForPrompt(promptId);
    const img = findFirstImageOutput(history.outputs);

    if (!img) {
      console.log("history", history);
      throw new Error("no image output found");
    }

    const outputDataUrl = await comfyImageToDataUrl(img);

    setStatus("done");

    return {
      ok: true,
      promptId,
      firstImage: outputDataUrl,
    };
  } catch (error) {
    console.error(error);
    setStatus("error");

    return {
      ok: false,
      error: error.message || String(error),
    };
  }
}
