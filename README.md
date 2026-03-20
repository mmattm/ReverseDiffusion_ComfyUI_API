# ReverseDiffusion – ComfyUI API

## Install

npm install
npm run dev

## Setup

### 1. Start ComfyUI portable with CORS enabled

From the root of your `ComfyUI_windows_portable` folder, run:

.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --listen --enable-cors-header

This launches ComfyUI with:

- `--windows-standalone-build` for the portable Windows build
- `--listen` to expose the local server
- `--enable-cors-header` to allow requests from the browser

### 2. Add your workflows

Place your ComfyUI workflow JSON files in the `/workflows` folder of this project.

Example:

/workflows/my-workflow.json

### 3. Check the API URL

Default URL in `api.js`:

const COMFY_URL = "http://127.0.0.1:8188";

If ComfyUI is running on another port or address, update this value.

### 4. Workflow output

The workflow must output a **Base64 string**.

## Run

Once ComfyUI is running and your workflow is in place:

npm run dev

Then open the local Vite app in your browser.

## Notes

- ComfyUI must be started before the web app sends requests
- CORS must be enabled, otherwise browser requests will be blocked
- The workflow must output a Base64 string, not only save an image to disk
- The web app communicates with ComfyUI through its API at `http://127.0.0.1:8188`

---

Matthieu Minguet  
ECAL  
Mars 2026
