import fragmentShaderCode from "./shaders/fragment.wgsl?raw";
import vertexShaderCode from "./shaders/vertex.wgsl?raw";


if (!navigator.gpu) {
	console.error("WebGPU is not supported in your browser.");
	throw new Error("WebGPU is not supported in your browser.");
}


// const canvas = document.createElement("canvas");
const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();


const context = canvas.getContext('webgpu') as GPUCanvasContext;

if (!device) {
	console.error("Failed to get WebGPU device.");
	throw new Error("Failed to get WebGPU device.");
}

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
	device,
	format: presentationFormat,
});

// Vertex Buffer
const triangleVertices = new Float32Array([
	0.0, 0.5, 0.0, 0.0,   // Vertex 1 (x, y)
	-0.5, -0.5, 0.0, 0.0, // Vertex 2 (x, y)
	0.5, -0.5, 0.0, 0.0  // Vertex 3 (x, y)
]);
const vertexBuffer = device.createBuffer({
	size: triangleVertices.byteLength,
	usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	mappedAtCreation: true,
});
const mapping = new Float32Array(vertexBuffer.getMappedRange());
mapping.set(triangleVertices);
vertexBuffer.unmap();

// Piprline
const pipeline = device.createRenderPipeline({
	layout: 'auto',
	vertex: {
		module: device.createShaderModule({
			code: vertexShaderCode,
		}),
		buffers: [{
			arrayStride: 4 * 4,
			attributes: [
				{
					shaderLocation: 0,
					offset: 0,
					format: 'float32x2',
				},
			],
		}]
	},
	fragment: {
		module: device.createShaderModule({
			code: fragmentShaderCode,
		}),
		targets: [
			{
				format: presentationFormat,

			},
		],
	},
	primitive: {
		topology: 'triangle-list',
	}
});

function frame() {
	const commandEncoder = device.createCommandEncoder();
	const textureView = context.getCurrentTexture().createView();

	const renderPassDescriptor: GPURenderPassDescriptor = {
		colorAttachments: [
			{
				view: textureView,
				clearValue: [0, 0, 0, 0], // Clear to transparent
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	};

	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
	passEncoder.setPipeline(pipeline);
	passEncoder.setVertexBuffer(0, vertexBuffer);
	passEncoder.draw(3);
	passEncoder.end();

	device.queue.submit([commandEncoder.finish()]);
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);



// 	const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
// 	// const swapChainFormat = "bgra8unorm";
// 	context.configure({
// 		device,
// 		format: swapChainFormat,
// 		alphaMode: 'premultiplied',
// 	});
// 	// console.log("Canvas size:", canvas.width, canvas.height);
// 	// console.log("SwapChain format:", swapChainFormat);
// 	// console.log("Current Texture:", context.getCurrentTexture());
// 	// console.log("Canvas size:", canvas.width, canvas.height);
// 	// console.log("Expected texture size:", canvas.width * canvas.height * 3); // Assuming RGBA8 format


// 	device.queue.writeBuffer(vertexBuffer, 0, triangleVertices);


// 	// Render Pipeline
// 	const renderPipelineBindGroupLayout = device.createBindGroupLayout({
// 		entries: [{
// 			binding: 0,
// 			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
// 			buffer: {
// 				type: "uniform"
// 			}
// 		}],
// 	})
// 	const pipelineLayout = device.createPipelineLayout({
// 		bindGroupLayouts: [],
// 	});

// 	// Render PipelineDescriptor
// 	const renderPipelineDescriptor = {
// 		layout: 'auto',
// 		vertex: {
// 			module: device.createShaderModule({ code: vertexShaderCode }),
// 			entryPoint: "main",
// 			buffers: [vertexBufferLayout], // Pass vertex buffer layout
// 		},
// 		fragment: {
// 			module: device.createShaderModule({ code: fragmentShaderCode }),
// 			entryPoint: "main",
// 			targets: [{ format: swapChainFormat }],
// 		},
// 		primitive: {
// 			topology: "triangle-list",
// 		},
// 	};
// 	const pipeline = device.createRenderPipeline(renderPipelineDescriptor);

// 	const textureDescriptor = {
// 		size: [canvas.width, canvas.height, 1], // Ensure correct size
// 		format: swapChainFormat,
// 		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
// 	};
// 	const texture = device.createTexture(textureDescriptor);

// 	function frame() {
// 		const commandEncoder = device.createCommandEncoder();
// 		const textureView = context.getCurrentTexture().createView();

// 		const renderPassDescriptor: GPURenderPassDescriptor = {
// 			colorAttachments: [
// 				{
// 					view: textureView,
// 					clearValue: [0, 0, 0, 0], // Clear to transparent
// 					loadOp: 'clear',
// 					storeOp: 'store',
// 				},
// 			],
// 		};

// 		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
// 		passEncoder.setPipeline(pipeline);
// 		passEncoder.draw(3);
// 		passEncoder.end();

// 		device.queue.submit([commandEncoder.finish()]);
// 		requestAnimationFrame(frame);
// 	}

// 	let lastFrameTime = 0;
// 	const targetFrameRate = 3; // Lower FPS target (30 FPS)
// 	const frameInterval = 1000 / targetFrameRate;
// 	function frame(now) {
// 		const commandEncoder = device.createCommandEncoder();
// 		const textureView = context.getCurrentTexture().createView();

// 		const renderPassDescriptor: GPURenderPassDescriptor = {
// 			colorAttachments: [
// 				{
// 					view: textureView,
// 					clearValue: [0, 0, 0, 0], // Clear to transparent
// 					loadOp: 'clear',
// 					storeOp: 'store',
// 				},
// 			],
// 		};

// 		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
// 		passEncoder.setPipeline(pipeline);
// 		passEncoder.draw(3);
// 		passEncoder.end();

// 		device.queue.submit([commandEncoder.finish()]);
// 		requestAnimationFrame(frame);
// 	}
// 	frame()



