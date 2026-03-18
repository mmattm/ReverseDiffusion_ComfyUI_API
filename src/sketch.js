import p5 from "p5";
import { runComfy } from "./api";

const DEFAULT_PROMPT = "Sun in sky simple landscape";

export function createSketch(container) {
  return new p5((p) => {
    let isLoading = false;
    let backgroundImg = null;
    let currentSeed = Math.floor(Math.random() * 2 ** 32);

    let shapeX = 256;
    let shapeY = 256;
    const shapeSize = 120;

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let movedDuringDrag = false;

    let maskLayer;
    let promptInputEl = null;
    let loopToggleEl = null;
    let shuffleSeedEl = null;

    p.setup = () => {
      p.createCanvas(512, 512).parent(container);
      maskLayer = p.createGraphics(512, 512);

      promptInputEl = document.getElementById("prompt");
      loopToggleEl = document.getElementById("loop-realtime");
      shuffleSeedEl = document.getElementById("shuffle-seed");

      if (promptInputEl) {
        promptInputEl.placeholder = DEFAULT_PROMPT;

        promptInputEl.addEventListener("keydown", async (e) => {
          if (e.key === "Enter" && !isLoading) {
            await renderComfy();
          }
        });
      }

      if (loopToggleEl) {
        loopToggleEl.addEventListener("change", () => {
          if (loopToggleEl.checked && !isLoading) {
            void renderComfy();
          }
        });
      }

      if (shuffleSeedEl) {
        shuffleSeedEl.addEventListener("click", () => {
          currentSeed = Math.floor(Math.random() * 2 ** 32);

          if (!isLoading) {
            void renderComfy();
          }
        });
      }
    };

    function getPrompt() {
      return promptInputEl?.value?.trim() || DEFAULT_PROMPT;
    }

    function isLoopRealtimeEnabled() {
      return Boolean(loopToggleEl?.checked);
    }

    function isMouseOverShape() {
      const dx = p.mouseX - shapeX;
      const dy = p.mouseY - shapeY;
      const radius = shapeSize / 2;
      return dx * dx + dy * dy <= radius * radius;
    }

    function drawMaskLayer() {
      maskLayer.background(0);
      maskLayer.noStroke();
      maskLayer.fill(255);
      maskLayer.ellipseMode(p.CENTER);
      maskLayer.ellipse(shapeX, shapeY, shapeSize, shapeSize);
    }

    async function renderComfy() {
      if (isLoading) return;

      isLoading = true;
      let didSucceed = false;

      try {
        drawMaskLayer();

        const dataUrl = maskLayer.elt.toDataURL("image/png");
        const result = await runComfy(dataUrl, getPrompt(), currentSeed);
        const imageData = result.image || result.firstImage;

        if (!result.ok || !imageData) {
          console.log("API result:", result);
          throw new Error(result.error || "No image returned");
        }

        backgroundImg = await new Promise((resolve, reject) => {
          p.loadImage(imageData, resolve, reject);
        });

        didSucceed = true;
      } catch (error) {
        console.error("Generation failed:", error);
      } finally {
        isLoading = false;
      }

      if (didSucceed && isLoopRealtimeEnabled()) {
        void renderComfy();
      }
    }

    p.draw = () => {
      p.background(0);

      if (backgroundImg) {
        p.image(backgroundImg, 0, 0, p.width, p.height);
      }

      p.noStroke();
      p.ellipseMode(p.CENTER);

      if (isLoading) {
        const alpha = 100 + Math.sin(p.millis() * 0.005) * 80;
        p.fill(255, alpha);
      } else {
        p.fill(255);
      }

      p.ellipse(shapeX, shapeY, shapeSize, shapeSize);

      if (isDragging) {
        p.noFill();
        p.stroke(255);
        p.ellipse(shapeX, shapeY, shapeSize + 8, shapeSize + 8);
      }
    };

    p.mousePressed = () => {
      movedDuringDrag = false;

      if (isMouseOverShape()) {
        isDragging = true;
        dragOffsetX = p.mouseX - shapeX;
        dragOffsetY = p.mouseY - shapeY;
      }
    };

    p.mouseDragged = () => {
      if (!isDragging) return;

      shapeX = p.constrain(
        p.mouseX - dragOffsetX,
        shapeSize / 2,
        p.width - shapeSize / 2,
      );
      shapeY = p.constrain(
        p.mouseY - dragOffsetY,
        shapeSize / 2,
        p.height - shapeSize / 2,
      );

      movedDuringDrag = true;
    };

    p.mouseReleased = async () => {
      if (!isDragging) return;

      isDragging = false;

      if (movedDuringDrag) {
        await renderComfy();
      }
    };
  });
}
