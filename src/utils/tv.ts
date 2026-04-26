/**
 * CRT noise ("TV static") animation.
 *
 * Draws random pixel noise on a <canvas> element on every animation frame to
 * simulate an old TV with no signal. Call toggle(true, ...) to start and
 * toggle(false, ...) to stop.
 *
 * Browser-only — this module reads document and window at the top level, so it
 * must never be imported at module scope in a Server Component.
 */

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const ww = window.innerWidth;
let enabled = true;
let frame: number;

// Set canvas size
canvas.width = ww / 3;
canvas.height = (window.innerHeight / window.innerWidth) * canvas.width;

/** Fills the canvas with a single frame of random grayscale noise. */
function snow(context: CanvasRenderingContext2D): void {
    const w = context.canvas.width;
    const h = context.canvas.height;
    const d = context.createImageData(w, h);
    const b = new Uint32Array(d.data.buffer);
    const len = b.length;

    for (let i = 0; i < len; i++) {
        b[i] = ((255 * Math.random()) | 0) << 24;
    }

    context.putImageData(d, 0, 0);
}

function animate(): void {
    snow(ctx);
    frame = requestAnimationFrame(animate);
}

/** Starts or stops the CRT noise animation and swaps CSS classes accordingly. */
function toggle(
    toggled: boolean,
    main: HTMLElement,
    context: CanvasRenderingContext2D,
    onClass: string,
    offClass: string
): void {
    console.log("tv.js", toggled ? "enabled" : "disabled");
    enabled = toggled;
    ctx = context;
    if (enabled) {
        main.classList.add(onClass);
        main.classList.remove(offClass);
        animate();
    } else {
        main.classList.add(offClass);
        main.classList.remove(onClass);
        if (frame) cancelAnimationFrame(frame);
    }
}

export default toggle;
