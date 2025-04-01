/// <reference types="@webgpu/types" />

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

import QuadTree from './data'
const quadTreeData = await fetch(quadTreeList[0]);
const quadTreeJsonString = await quadTreeData.json();
const quadTreeJson = JSON.parse(quadTreeJsonString);
const quadTree = new QuadTree(device, quadTreeJson)


import QuadManager from "./quadManager";
const quadManager = new QuadManager(device, textureSize);
quadManager.init(quadTree, mipLevel);

import Eval from "./eval";

import Render from "./render";
const render = new Render(device, context, canvas, presentationFormat, sampler, depthSampler, quadManager, mipLevel);

await device.queue.onSubmittedWorkDone();

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


function updateTravBufferCoord(uv: number[], commandEncoder?: GPUCommandEncoder, travBuffers) {
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
	device.queue.writeBuffer(render.buffers.uniform, 0, floatArray);
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
		quadManager.iterate(i);
	}
	// await dbug_mngr.fromBufferToLog(quadManager.quadTree.buffers.travBuffers[0], 0, 64);
	// await dbug_mngr.fromBufferToLog(quadManager.target.buffers.travBuffers[0], 0, 64);
	// await dbug_mngr.fromBufferToLog(quadManager.quadTree.buffers.valuesBuffer, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.quadTree.result, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.quadTree.buffers.vertexBuffer, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.quadTree.buffers.vertexBuffer, 32, 64);
	// await dbug_mngr.fromBufferToLog(quadManager.target.result, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.eval.result[1], 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.target.result, 0, 32);
}
await quadTreePass();

const commandEncoderArg = device.createCommandEncoder();
// updateTravBufferCoord([0.6, 0.4], commandEncoderArg);
const commandBufferArg = commandEncoderArg.finish();
await device.queue.submit([commandBufferArg]);
await device.queue.onSubmittedWorkDone();


const commandEncoder = device.createCommandEncoder();
// updateTravBufferCoord([0.6, 0.4], commandEncoder);
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
		if(firstClick) {
			updateTravBufferCoord(params.travelValues, commandEncoderArg, quadManager.quadTree.buffers.travBuffers);
			firstClick = false;
		}else{
			updateTravBufferCoord(params.travelValues, commandEncoderArg, quadManager.target.buffers.travBuffers);
		}
		const commandBufferArg = commandEncoderArg.finish();
		device.queue.submit([commandBufferArg]);
		await device.queue.onSubmittedWorkDone();
		params.change = false;
		calls++;
		quadTreePass()
	}

	// Render pass
	// if (lastFrameTime < Date.now()){
	if (lastFrameTime < Date.now() && mipLevel > current_mipLevel) {
		render.pass(calls, current_mipLevel);
		current_mipLevel++;
	}

	frameCount++;
	if ( frameCount < frames) {
		calls++;
	}
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
var firstClick = true;
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
		quadManager.quadTree.buffers.travBuffers[i].unmap();
	}
	quadManager.quadTree.buffers.valuesBuffer.unmap();
	quadManager.quadTree.buffers.nodesBuffer.unmap();
	quadManager.quadTree.result.unmap();
	quadManger.eval.texture.unmap();
});

