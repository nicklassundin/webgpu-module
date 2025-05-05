/// <reference types="@webgpu/types" />

import { Triangle, Hexagon } from "./shape";

// import quadfragmentShaderCode from "./shaders/quad.frag.wgsl?raw";
import fixedvertexShaderCode from "./shaders/fixed.vert.wgsl?raw";


import depthFragmentShaderCode from "./shaders/depth.frag.wgsl?raw";

import { GUI } from 'dat.gui';
import Debugger from "./debug";
import Stats from 'stats.js'
const stats = new Stats();
stats.showPanel(0)
document.body.appendChild(stats.dom);

const DEFAULT_COORD = [0.5, 0.6];

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
const divisibleBy = 32 * 16;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
canvas.width = Math.floor(canvas.width / divisibleBy) * divisibleBy;
canvas.height = Math.floor(canvas.height / divisibleBy) * divisibleBy;


const textureSize = {
	width: canvas.width,
	height: canvas.height,
	depthOrArrayLayers: 1
};
console.log(textureSize.width, textureSize.height)

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


// TODO fix so mipLevel trasfers into structure
const mipLevel = Math.floor(Math.log2(Math.max(image.width, image.height)));
// print byte size of image
// Upload image data to texture level 0
const imageBitmap = image;
// const imageCanvas = document.createElement('canvas');
const imageCanvas = document.createElement('canvas');
imageCanvas.width = textureSize.width;
imageCanvas.height = textureSize.height;
const ctx = imageCanvas.getContext('2d');

// Read 
// ensure ctx is not null
if (!ctx) {
	console.error("Failed to get 2d context.");
	throw new Error("Failed to get 2d context.");
}

ctx.drawImage(imageBitmap, 0, 0);
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
let quadManager = new QuadManager(device, textureSize, mipLevel, DEFAULT_COORD);
quadManager.init(quadTree, DEFAULT_COORD);

import Eval from "./eval";

import Render from "./render";
let render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager, mipLevel);

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
		this.travelValues = [travelValues[0], travelValues[1]];
	}
}


let calls = 0;
function updateTravBufferCoord(uv: number[], commandEncoder?: GPUCommandEncoder, travBuffer) {
	const mipLevel = travBuffer.length; 

	const values = new Float32Array([0, 0, uv[0], uv[1], 0, 0, 1, 1]);
		const stagingBuffer = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true
		});
		const arrayBuffer = stagingBuffer.getMappedRange();
		(new Float32Array(arrayBuffer)).set(values);
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, travBuffer, 0, values.byteLength);
		stagingBuffer.unmap();
}


async function updateUniformBuffer(values: number[]) {
	const floatArray = new Float32Array(values);
	device.queue.writeBuffer(render.buffers.uniform, 0, floatArray);
	await device.queue.onSubmittedWorkDone();
}
// TODO GUe

const params = new Params(DEFAULT_COORD);
const gui = new GUI();
{
	const folder = gui.addFolder("Mipmap");
	folder.add({ value: mipLevel}, 'value', 0, mipLevel, 1).name("Mip Level").onChange(async (value: number) => {
		const resolution = new Float32Array([canvas.width,
						    canvas.height,
		value]);
		await updateUniformBuffer(resolution);
	});
	// Add folder for uv coordinates
	const uvFolder = gui.addFolder("UV Coordinates");
	uvFolder.add({ value: DEFAULT_COORD[0] }, 'value', 0, 1, 0.01).name("U").onChange(async (value: number) => {
		params.updateTravelValues([value, uvFolder.__controllers[1].object.value]);	
	})
	uvFolder.add({ value: DEFAULT_COORD[1] }, 'value', 0, 1, 0.01).name("V");
	folder.open();
}

// Main loop
let frameCount = 0;
let lastFrameTime = Date.now()

const commandEncoderArg = device.createCommandEncoder();
const commandBufferArg = commandEncoderArg.finish();
await device.queue.submit([commandBufferArg]);
await device.queue.onSubmittedWorkDone();


let current_mipLevel = 0;
var reference = true;


async function frame() {
	stats.begin();
	const currentTime = Date.now();
	const commandEncoder = device.createCommandEncoder();
	// console.log(frameCount)
	// Update the stats panel
	if (params.change) {
		frameCount = 0;
		current_mipLevel = 0;
		params.change = false;
		reference = true

		await quadManager.unmap();
		quadManager = new QuadManager(device, textureSize, mipLevel, params.travelValues);
		quadManager.init(quadTree, params.travelValues);
		render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager, mipLevel);
		const commandEncoderArg = device.createCommandEncoder();
		updateTravBufferCoord(params.travelValues, commandEncoderArg, quadManager.quadTree.buffers.travBuffer);
		const commandBufferArg = commandEncoderArg.finish();
		// await device.queue.submit([commandBufferArg]);
		// await device.queue.onSubmittedWorkDone();
		requestAnimationFrame(frame);
		// clear browser console
		return;
	}else{
		if (frameCount % 2 == 0){
			await quadManager.eval.pass(current_mipLevel, commandEncoder);
			// console.log("Eval iterations (", frameCount, "):")
			// await dbug_mngr.fromBufferToLog(quadManager.eval.buffers.threadIterations, 0, 32);
		}else{
			// mesure time 
			await quadManager.quadTree.pass(current_mipLevel, commandEncoder);
			// console.log("QuadTree result (", frameCount, "):")
			// await dbug_mngr.fromBufferToLog(quadManager.quadTree.result, 0, 32);
		}
		// TODO Optimization
		current_mipLevel++;
	}
	quadManager.genVertex.pass(current_mipLevel, commandEncoder);
	device.queue.submit([commandEncoder.finish()]);
	
	// renderpass locked 30 fps
	if (currentTime - lastFrameTime > 1000 / 30) {
		const renderCommandEncoder = device.createCommandEncoder();
		render.pass(frameCount, renderCommandEncoder)
		device.queue.submit([renderCommandEncoder.finish()]);
		lastFrameTime = currentTime;
	}
	current_mipLevel++;
	frameCount++;
	stats.end();

	// console.log('Frame: ', frameCount, 'Time: ', currentTime - lastFrameTime, 'ms');
		// return;
	// wait 500 ms
	// await new Promise(resolve => setTimeout(resolve, 200));
	requestAnimationFrame(frame);

}

function resizeCanvas() {
	const newWidth = Math.floor(canvas.clientWidth / devicePixelRatio);
	const newHeight = Math.floor(canvas.clientHeight / devicePixelRatio);

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
	console.clear();
	let rect = canvas.getBoundingClientRect();
	const x = (event.clientX - rect.left);
	const y = (event.clientY - rect.top);
	console.log(`Mouse click at (${event.clientX}, ${event.clientY})`);
	console.log(`Mouse coordinates: (${x}, ${y})`);
	console.log(canvas.width, canvas.height)
	const pixRat = {
		x: canvas.width / HEIGHT * devicePixelRatio,
		y: canvas.height / WIDTH * devicePixelRatio 
	}
	const uv = [x / canvas.width * pixRat.x, y / canvas.height * pixRat.y];
	console.log(`UV coordinates: (${uv[0]}, ${uv[1]})`);
	gui.__folders["Mipmap"].__controllers[0].setValue(mipLevel);
	gui.__folders["UV Coordinates"].__controllers[0].setValue(uv[0]);
	gui.__folders["UV Coordinates"].__controllers[1].setValue(uv[1]);
	params.updateTravelValues([uv[0], uv[1]]);
	// await updateTravBufferCoord(uv);
})

// On close unbind buffers
window.addEventListener('beforeunload', async () => {
	await device.queue.onSubmittedWorkDone();
	quadManager.unmap();
});


