# ReverseDiffusion – ComfyUI API

# Matthieu Minguet

## Install

npm install  
npm run dev

## Setup

- Put your ComfyUI workflows in `/workflows`
- Enable **CORS (\*)** in ComfyUI settings
- Make sure your ComfyUI server is running

Default URL:
http://127.0.0.1:8000

Change it in `api.js` if needed:

const COMFY_URL = "http://127.0.0.1:8000";

## Notes

- Workflow must output an image (e.g. PreviewImage)
