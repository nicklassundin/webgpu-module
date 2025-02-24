import fragmentShaderCode from "./shaders/fragment.wgsl?raw";
import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import { Triangle, Hexagon } from "./shape";

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
	0.0, 0.5,   // Vertex 1 (x, y)
	-0.5, -0.5, // Vertex 2 (x, y)
	0.5, -0.5  // Vertex 3 (x, y)
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
			arrayStride: 2 * 4,
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

