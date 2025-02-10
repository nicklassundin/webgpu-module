async function initWebGPU() {
	if (!navigator.gpu) {
		console.error("WebGPU is not supported in your browser.");
		return;

	}

	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter?.requestDevice();

	if (!device) {
		console.error("Failed to get WebGPU device.");
		return;

	}

	const canvas = document.createElement("canvas");
	document.body.appendChild(canvas);
	const context = canvas.getContext("webgpu")!;

	const swapChainFormat = "bgra8unorm";
	context.configure({
		device,
		format: swapChainFormat,

	});

	// Add rendering logic here
	// 
}

initWebGPU();

