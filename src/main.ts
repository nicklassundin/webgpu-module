/// <reference types="@webgpu/types" />

import fragmentShaderCode from "./shaders/fragment.wgsl?raw";
import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import { Triangle, Hexagon } from "./shape";

// import quadfragmentShaderCode from "./shaders/quad.frag.wgsl?raw";
import fixedvertexShaderCode from "./shaders/fixed.vert.wgsl?raw";


import depthFragmentShaderCode from "./shaders/depth.frag.wgsl?raw";

import { GUI } from 'dat.gui';
import Debugger from "./debug";

// import quadtestfragmentShaderCode from "./shaders/quad.test.frag.wgsl?raw";

// Make list of all .png files in public/data/obs
const response = await fetch('/data/obs/fileList.json');
const files = (await response.json()).files
const textureList = files.filter((file: string) => file.endsWith('.png'));
const quadTreeList = files.filter((file: string) => file.endsWith('.json'));

if (!navigator.gpu) {
	console.error("WebGPU is not supported in your browser.");
	throw new Error("WebGPU is not supported in your browser.");
}


// const canvas = document.createElement("canvas");
const canvas = document.querySelector('canvas') as HTMLCanvasElement;
if (!canvas) {
	console.error("Failed to get canvas element.");
	throw new Error("Failed to get canvas element.");
}
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
	console.error("Failed to get WebGPU device.");
	throw new Error("Failed to get WebGPU device.");
}
const dbug_mngr = new Debugger(device);


const context = canvas.getContext('webgpu') as GPUCanvasContext;


const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
	device,
	format: presentationFormat,
});
// Create view texture manually
const texture = device.createTexture({
	size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1  },
	format: presentationFormat,
	usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});
const textureView = texture.createView();
// Create depth texture manually
const frames = 3;
const depthTextures: GPUTexture[] = [];
for (let i = 0; i < frames; i++) {
	const depthTexture = device.createTexture({
		size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
		format: 'depth24plus',
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});
	depthTextures.push(depthTexture);
}

// Vertex Buffer
const Vertices = new Float32Array([
	-1.0, 1.0,   // Vertex 1 (x, y)
	-1.0, -1.0, // Vertex 2 (x, y)
	1.0, -1.0,  // Vertex 3 (x, y)
	-1.0, 1.0,   // Vertex 1 (x, y)
	1.0, -1.0,  // Vertex 2 (x, y)
	1.0, 1.0    // Vertex 3 (x, y)
])

const vertexBuffer = device.createBuffer({
	size: Vertices.byteLength,
	usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	mappedAtCreation: true,
});
const mapping = new Float32Array(vertexBuffer.getMappedRange());
mapping.set(Vertices);
vertexBuffer.unmap();

// Uniform Buffer
// containing the resolution of the canvas
// Resolution 4 * 2; Mipmap level 4 * 1
const uniformBufferSize = (4 * 2 + 4 * 2)*Float32Array.BYTES_PER_ELEMENT;
const uniformBuffer = device.createBuffer({
	size: uniformBufferSize,
	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const resolution = new Float32Array([canvas.width,
				    canvas.height,
3.0]);
device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);


// Mipmap pipeline
// load image
// Load Textures
const image = await loadImageBitmap(textureList[0]);
const mipLevel = Math.floor(Math.log2(Math.max(image.width, image.height))) + 1;
const textureSize = image.width; // Assume square texture 
// Create texture with mipmap levels
const textureMipmap = device.createTexture({
	size: [ textureSize, textureSize, 1 ],
	format: 'rgba8unorm',
	usage: 	GPUTextureUsage.TEXTURE_BINDING |
		GPUTextureUsage.COPY_DST |
		GPUTextureUsage.RENDER_ATTACHMENT |
		GPUTextureUsage.COPY_SRC |
		GPUTextureUsage.STORAGE |
		GPUTextureUsage.STORAGE_BINDING,
	mipLevelCount: mipLevel
});
// print byte size of image
// Upload image data to texture level 0
const imageBitmap = image;
// const imageCanvas = document.createElement('canvas');
const imageCanvas = document.createElement('canvas');
imageCanvas.width = textureSize; 
imageCanvas.height = textureSize;
const ctx = imageCanvas.getContext('2d');

// Read 
// ensure ctx is not null
if (!ctx) {
	console.error("Failed to get 2d context.");
	throw new Error("Failed to get 2d context.");
}

ctx.drawImage(imageBitmap, 0, 0);

const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
device.queue.writeTexture(
	{ texture: textureMipmap, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
	imageData.data,
	{ bytesPerRow: textureSize * 4 },
	[textureSize, textureSize, 1]
);
// sampler with mipmap enabled
const sampler = device.createSampler({
	magFilter: 'linear',
	minFilter: 'linear',
	mipmapFilter: 'linear',
});
// depth Sampler
const depthSampler = device.createSampler({
	compare: undefined,
});
// binding group layout for mipmap
const bindGroupLayoutUniform = device.createBindGroupLayout({
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: {}  }],
})
// Create binding group layout Used for mipmap and normal rendering
const bindGroupLayout = device.createBindGroupLayout({
	entries: [
		{
			// Read 
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {
				type: 'filtering',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: 'float',
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {
				type: 'non-filtering',
			},
		},
		{
			binding: 3,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: 'depth',
			},
		},
	],
});
// bindGroup for Navigate
const bindGroupLayoutNav = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
			buffer: {
				type: 'read-only-storage',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
			buffer: {
				type: 'read-only-storage',
			},
		},
	]
});
// Create bind group for uniform buffer
const bindGroupUniform = device.createBindGroup({
	layout: bindGroupLayoutUniform,
	entries: [
		{
			binding: 0,
			resource: {
				buffer: uniformBuffer,
				offset: 0,
				size: uniformBufferSize,
			},
		},
	],
});

import QuadTree from "./quadTree";

// TODO: QuadTree buffers
const quadTreeData = await fetch(quadTreeList[0]);
const quadTreeJsonString = await quadTreeData.json();
const quadTreeJson = JSON.parse(quadTreeJsonString);

const quadTree = new QuadTree(device, quadTreeJson, mipLevel, bindGroupUniform, bindGroupLayoutUniform)

import Eval from "./eval";
const evaluation = new Eval(device, textureSize, quadTree.buffers.travBuffers, quadTree.result, sampler, bindGroupUniform, bindGroupLayoutUniform);

await device.queue.onSubmittedWorkDone();
// Create Pipeline Layout
const pipelineLayout = device.createPipelineLayout({
	bindGroupLayouts: [bindGroupLayout, bindGroupLayoutUniform, bindGroupLayoutNav],
});
// Piprline
const pipeline = device.createRenderPipeline({
	layout: pipelineLayout, 
	vertex: {
		module: device.createShaderModule({
			code: vertexShaderCode,
		}),
		// buffers: [{
		// 	arrayStride: 4 * 2,
		// 	attributes: [
		// 		{
		// 			shaderLocation: 0,
		// 			offset: 0,
		// 			format: 'float32x2',
		// 		},
		// 	],
		// }]
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
		// topology: 'point-list',
		// topology: 'line-list',
		// cullMode: 'none',
	},
	depthStencil: {
		format: 'depth24plus',
		depthWriteEnabled: true,
		depthCompare: 'less',
	},
});

// Render Pass Descriptor
const renderPassDescriptor: GPURenderPassDescriptor = {
	colorAttachments: [
		{
			view: undefined,
			clearValue: [0, 0, 0, 0], // Clear to transparent
			loadOp: 'clear',
			storeOp: 'store',
		},
	],
	depthStencilAttachment: {
		view: undefined, 
		depthLoadOp: 'clear',
		depthStoreOp: 'store',
		depthClearValue: 1.0,
		clearDepth: 1.0,
	},
};


// Create Depth Texture TODO
class Params {
	travelValues: number[];
	change: boolean = false;
	constructor(travelValues: number[]) {
		this.travelValues = travelValues;
	}
	updateTravelValues(travelValues: number[]) {
		this.change = true;
		this.travelValues = travelValues;
	}

}
const params = new Params([0.6, 0.4]);


function updateTravBufferCoord(uv: number[], commandEncoder?: GPUCommandEncoder) {
	const travBuffers = quadTree.buffers.travBuffers;
	const mipLevel = travBuffers.length; 

	const allValues = new Float32Array([
		0, // Mip Level 
		0, 0, 1, 1, // bound box 
		uv[0], uv[1], // target coordinates
		0]); // addressArrayBuffer

	for (let i = 0; i < mipLevel; i++) {
		const values = new Float32Array([i, 0, 0, 1, 1, uv[0], uv[1], 0]);
		const stagingBuffer = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true
		});
		const arrayBuffer = stagingBuffer.getMappedRange();
		(new Float32Array(arrayBuffer)).set(values);
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, travBuffers[i], 0, values.byteLength);
		stagingBuffer.unmap();
	}
}


async function updateUniformBuffer(values: number[]) {
	const floatArray = new Float32Array(values);
	device.queue.writeBuffer(uniformBuffer, 0, floatArray);
	await device.queue.onSubmittedWorkDone();
}
// TODO GUI


const gui = new GUI();
{
	const folder = gui.addFolder("Mipmap");
	folder.add({ value: 11}, 'value', 0, mipLevel, 1).name("Mip Level").onChange(async (value: number) => {
		const resolution = new Float32Array([canvas.width,
						    canvas.height,
		value]);
		await updateUniformBuffer(resolution);
	});
	// Add folder for uv coordinates
	const uvFolder = gui.addFolder("UV Coordinates");
	uvFolder.add({ value: 0.6 }, 'value', 0, 1, 0.01).name("U").onChange(async (value: number) => {
		params.updateTravelValues([value, uvFolder.__controllers[1].object.value]);	
		quadTreePass();
	})
	uvFolder.add({ value: 0.4 }, 'value', 0, 1, 0.01).name("V");
	folder.open();
}


// Main loop
let frameCount = 0;
let lastFrameTime = Date.now()
// QuadTree compute pass
async function quadTreePass() {
	for (let i = 0; i < mipLevel; i++) {
		await dbug_mngr.fromBufferToLog(quadTree.buffers.travBuffers[i], 0, 64);
		// await dbug_mngr.fromBufferToLog(quadTree.buffers.valuesBuffer , 0, 32);
		// await dbug_mngr.fromBufferToLog(quadTree.result, 0, 32);
		// dbug_mngr.fromBufferToLog(quadTree.buffers.nodesBuffer, 0, 32);
		await quadTree.pass(i);
	}
	// Evaluation compute pass
	for (let i = 0; i < mipLevel; i++) {
		// await evaluation.pass(i);
	}
	// await dbug_mngr.fromBufferToLog(quadTree.buffers.valuesBuffer, 0, 32);
}
await quadTreePass();

const commandEncoderArg = device.createCommandEncoder();
updateTravBufferCoord([0.6, 0.4], commandEncoderArg);
const commandBufferArg = commandEncoderArg.finish();
device.queue.submit([commandBufferArg]);
await device.queue.onSubmittedWorkDone();


let renderPass 

const commandEncoder = device.createCommandEncoder();
updateTravBufferCoord([0.6, 0.4], commandEncoder);
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
await device.queue.onSubmittedWorkDone();
let current_mipLevel = 0;
let calls = 0;
async function frame() {
	if (params.change) {
		console.log("Change")
		current_mipLevel = 0;
		const commandEncoderArg = device.createCommandEncoder();
		updateTravBufferCoord(params.travelValues, commandEncoderArg);
		const commandBufferArg = commandEncoderArg.finish();
		device.queue.submit([commandBufferArg]);
		await device.queue.onSubmittedWorkDone();
		params.change = false;
		calls++;
	}
	// Render pass bindGroup
	const bindGroup = device.createBindGroup({
		layout: bindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: sampler,
			},
			{
				binding: 1,
				resource: evaluation.texture.createView(), 
			},
			{
				binding: 2,
				resource: depthSampler,
			},
			{
				binding: 3,
				resource: depthTextures[(calls) % frames].createView(),
			},
		],
	});
	// Navigate bindGroup


	// Render pass
	// if (lastFrameTime < Date.now()){
	if (lastFrameTime < Date.now() && mipLevel >= current_mipLevel) {
	const bindGroupNav = device.createBindGroup({
		layout: bindGroupLayoutNav, 
		entries: [
			{
				binding: 0,
				resource: {
					buffer: quadTree.result,
					offset: 0,
					size: quadTree.result.size,
				} 
			},
			{
				binding: 1,
				resource: {
					buffer: quadTree.buffers.travBuffers[current_mipLevel],
					// buffer: quadTree.buffers.travBuffers[frameCount % mipLevel],
					offset: 0,
					size: quadTree.buffers.travBuffers[current_mipLevel].size,
				}
			}
		],
	});
		// if (mipLevel >= current_mipLevel) {
		// 	current_mipLevel = 0;	
		// }

		const commandEncoder = device.createCommandEncoder();
		const currentTexture = context.getCurrentTexture();
		if (!currentTexture) {
			console.error("Failed to retrieve current texture.");
			return;
		}
		const textureView = currentTexture.createView();
		renderPassDescriptor.colorAttachments[0].view = textureView;
		const depthTextureView = depthTextures[(calls + 1) % frames].createView();
		renderPassDescriptor.depthStencilAttachment.view = depthTextureView;


		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(pipeline);
		// passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.setBindGroup(0, bindGroup);
		passEncoder.setBindGroup(1, bindGroupUniform);
		passEncoder.setBindGroup(2, bindGroupNav);
		// const numVer = Math.pow(2, current_mipLevel) * 3 * 2;
		// console.log(`Number of vertices: ${numVer}, Mip Level: ${current_mipLevel}`);
		passEncoder.draw(mipLevel*6);
		// passEncoder.draw(5*6);
		// passEncoder.draw(12288);
		passEncoder.end();

		device.queue.submit([commandEncoder.finish()]);
		current_mipLevel++;
	}

	frameCount++;
	// await new Promise((resolve) => setTimeout(resolve, 3000));
	// await new Promise((resolve) => setTimeout(resolve, 300));

	requestAnimationFrame(frame);
}

function resizeCanvas() {
	const devicePixelRatio = window.devicePixelRatio || 1;
	const newWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
	const newHeight = Math.floor(canvas.clientHeight * devicePixelRatio);

	if (canvas.width !== newWidth || canvas.height !== newHeight) {
		canvas.width = newWidth;
		canvas.height = newHeight;
		console.log(`Resized canvas to ${canvas.width}x${canvas.height}`);
		context.configure({ device, format: presentationFormat  });
	}

}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Ensure correct size on startup
requestAnimationFrame(frame);


async function loadImageBitmap(url: string) {
	const response = await fetch(url);
	const blob = await response.blob();
	return createImageBitmap(blob);

}
// listen and find uv coordinates of mouse on click
canvas.addEventListener('click', async (event) => {

	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	const uv = [x / canvas.width, y / canvas.height];
	current_mipLevel = 0;
	gui.__folders["Mipmap"].__controllers[0].setValue(mipLevel);
	gui.__folders["UV Coordinates"].__controllers[0].setValue(uv[0]);
	gui.__folders["UV Coordinates"].__controllers[1].setValue(uv[1]);
	params.updateTravelValues(uv);
	// await updateTravBufferCoord(uv);
});

// On close unbind buffers
window.addEventListener('beforeunload', async () => {
	await device.queue.onSubmittedWorkDone();
	for (let i = 0; i < mipLevel; i++) {
		quadTree.buffers.travBuffers[i].unmap();
	}
	quadTree.buffers.valuesBuffer.unmap();
	quadTree.buffers.nodesBuffer.unmap();
	quadTree.result.unmap();
	evaluation.texture.unmap();
});

