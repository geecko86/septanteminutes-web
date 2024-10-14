var canvas = document.getElementById('canvas'),
	ctx = canvas.getContext('2d'),
	ww = window.innerWidth,
	enabled = true,
	frame;

// Set canvas size
canvas.width = ww / 3;
canvas.height = (window.innerHeight / window.innerWidth) * canvas.width;

// Generate CRT noise
function snow(ctx) {
	var w = ctx.canvas.width,
	h = ctx.canvas.height,
	d = ctx.createImageData(w, h),
	b = new Uint32Array(d.data.buffer),
	len = b.length;
	
	for (var i = 0; i < len; i++) {
		b[i] = ((255 * Math.random()) | 0) << 24;
	}
	
	ctx.putImageData(d, 0, 0);
}

function animate() {
	snow(ctx);
	frame = requestAnimationFrame(animate);
};

function toggle(toggled, main, context, onClass, offClass) {
    console.log("tv.js", toggled ? "enabled" : "disabled")
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