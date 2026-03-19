import p5 from "p5";
import { runComfy } from "./api";

const SIZE = 512;
const DIAMETER = 120;
const DEFAULT_PROMPT = "Sun in sky simple landscape";

export function createSketch(container) {
  return new p5((p) => {
    let loading = false;
    let bgImg = null;
    let seed = Math.floor(Math.random() * 2 ** 32);
    let x = SIZE / 2,
      y = SIZE / 2;
    let dragging = false,
      moved = false,
      offsetX = 0,
      offsetY = 0;
    let loopEnabled = false;
    let mask, promptEl, loopEl, shuffleEl;

    const prompt = () => promptEl?.value?.trim() || DEFAULT_PROMPT;
    const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

    async function render() {
      if (loading) return;
      loading = true;

      mask.background(0);
      mask.noStroke();
      mask.fill(255);
      mask.ellipse(x, y, DIAMETER, DIAMETER);

      const result = await runComfy(
        mask.elt.toDataURL("image/png"),
        prompt(),
        seed,
      );

      if (result?.ok && result?.firstImage) {
        bgImg = await new Promise((resolve) => {
          p.loadImage(result.firstImage, resolve, () => resolve(null));
        });
      }

      loading = false;
      if (loopEnabled) setTimeout(render, 150);
    }

    const overCircle = () => {
      const dx = p.mouseX - x;
      const dy = p.mouseY - y;
      return dx * dx + dy * dy <= ((DIAMETER / 2) * DIAMETER) / 2;
    };

    p.setup = () => {
      p.createCanvas(SIZE, SIZE).parent(container);
      mask = p.createGraphics(SIZE, SIZE);

      promptEl = document.getElementById("prompt");
      loopEl = document.getElementById("loop-realtime");
      shuffleEl = document.getElementById("shuffle-seed");

      promptEl.placeholder = DEFAULT_PROMPT;

      promptEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !loading) render();
      });

      loopEl.addEventListener("change", () => {
        loopEnabled = loopEl.checked;
        if (loopEnabled && !loading) render();
      });

      shuffleEl.addEventListener("click", () => {
        seed = randomSeed();
        if (!loading) render();
      });
    };

    p.draw = () => {
      p.background(0);
      if (bgImg) p.image(bgImg, 0, 0, p.width, p.height);

      p.noStroke();
      p.fill(255, loading ? 180 + Math.sin(p.millis() * 0.005) * 75 : 255);
      p.ellipse(x, y, DIAMETER, DIAMETER);
    };

    p.mousePressed = () => {
      moved = false;
      if (!overCircle()) return;
      dragging = true;
      offsetX = p.mouseX - x;
      offsetY = p.mouseY - y;
    };

    p.mouseDragged = () => {
      if (!dragging) return;
      x = p.constrain(p.mouseX - offsetX, DIAMETER / 2, p.width - DIAMETER / 2);
      y = p.constrain(
        p.mouseY - offsetY,
        DIAMETER / 2,
        p.height - DIAMETER / 2,
      );
      moved = true;
    };

    p.mouseReleased = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) render();
    };
  });
}
