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

// const DEFAULT_COORD = [0.5, 0.6];
// const DEFAULT_COORD = [0.51, 0.51];
// const DEFAULT_COORD = [0.59, 0.69];
const DEFAULT_COORD = [0.41, 0.35];
// const DEFAULT_COORD = [0.19, 0.14];
// const DEFAULT_COORD = [0.11, 0.07];

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


const canvasOrigSize = {
	width: Math.min(canvas.width, canvas.height),
	height: Math.min(canvas.width, canvas.height)
	// width: Math.min(canvas.width, canvas.height)*2.0,
	// height: Math.min(canvas.width, canvas.height)*2.0
}
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

// print byte size of image
// Upload image data to texture level 0
const imageBitmap = image;
// const imageCanvas = document.createElement('canvas');
const imageCanvas = document.createElement('canvas');
const ctx = imageCanvas.getContext('2d');
// imageCanvas.width = textureSize.width;
// imageCanvas.height = textureSize.height;

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
// console print file name
// const quadTreeData = await fetch(quadTreeList[0]);
console.log("Loading QuadTree from:", quadTreeList[1]);
const quadTreeData = await fetch(quadTreeList[1]);
const quadTreeJsonString = await quadTreeData.json();
let quadTreeJson = JSON.parse(quadTreeJsonString);
const quadTree = new QuadTree(device, quadTreeJson)
quadTreeJson = [quadTreeJson];

import QuadManager from "./quadManager";
// let quadManager = new QuadManager(device, canvasOrigSize, mipLevel);
let quadManager = new QuadManager(device, canvasOrigSize);
quadManager.init(quadTree, DEFAULT_COORD, quadTreeJson);

const textureSize = quadManager.bufferMux.config.textureSize;


import Eval from "./eval";

import Render from "./render";
let render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager.bufferMux);

await device.queue.onSubmittedWorkDone();

class Params {
	travelValues: number[];
	change: boolean = false;
	constructor(travelValues: number[]) {
		this.travelValues = travelValues;
	}
	updateTravelValues(travelValues: number[] = [this.travelValues[0], this.travelValues[1]]) {
		this.change = true;
		this.travelValues = [travelValues[0], travelValues[1]];
	}
}


let calls = 0;
function updateTravBufferCoord(uv: number[], commandEncoder?: GPUCommandEncoder, travBuffer) {
	// const mipLevel = travBuffer.length; 

	const values = new Float32Array([uv[0], uv[1], 0, 1]);
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
	device.queue.writeBuffer(quadManager.bufferMux.uniform, 0, floatArray);
	await device.queue.onSubmittedWorkDone();
}


// time intervall 10, 100, 1000 ms
const TIMEINTERVAL = [10, 100, 1000, 5000, 10000, 100000, 20000];
var timeInterval = TIMEINTERVAL;
const params = new Params(DEFAULT_COORD);
const gui = new GUI();
{
	// const folder = gui.addFolder("Mipmap");
	// folder.add({ value: mipLevel}, 'value', 0, mipLevel, 1).name("Mip Level").onChange(async (value: number) => {
	// const resolution = new Float32Array([canvasOrigSize.width, canvasOrigSize.height, value]);
	// await updateUniformBuffer(resolution);
	// });
	// folder.open();
	// Add folder for uv coordinates
	const uvFolder = gui.addFolder("UV Coordinates");
	uvFolder.add({ value: DEFAULT_COORD[0] }, 'value', 0, 1, 0.01).name("U").onChange(async (value: number) => {
		params.updateTravelValues([value, uvFolder.__controllers[1].object.value]);	
	})
	uvFolder.add({ value: DEFAULT_COORD[1] }, 'value', 0, 1, 0.01).name("V");
	uvFolder.open();
	// check box for output
	
	const debugFolder = gui.addFolder("Debug");
	debugFolder.add({ value: false }, 'value').name("Output to console").onChange((value: boolean) => {
		params.output = value;
		if (value) {
			// reset timeInterval
			timeInterval = TIMEINTERVAL;
			params.output = value;
			params.updateTravelValues();
		}
	})
	// switch between workgroup render and result dropdown
	debugFolder.add({ value: "result" }, 'value', ["result",  "result - lines", "traversal Workgroup", "vertex Workgroup"]).name("Mode").onChange((value: string) => {
		if (value === "traversal Workgroup") {
			const input = new Uint32Array([2, 0]);
			quadManager.bufferMux.updateInput(input);

		} else if (value === "result") {
			const input = new Uint32Array([0, 0]);
			quadManager.bufferMux.updateInput(input);
		
		} else if (value === "result - lines") {
			const input = new Uint32Array([1, 0]);
			quadManager.bufferMux.updateInput(input);
		} else if (value === "vertex Workgroup") {
			const input = new Uint32Array([3, 0]);
			quadManager.bufferMux.updateInput(input);
		}
	})
	debugFolder.open();
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


// TODO change when retrying
let startTime = 0; 
let nameIndex = 1;

async function frame() {
	if (startTime === 0) {
		startTime = Date.now();
	}
	stats.begin();
	const currentTime = Date.now();
	const commandEncoder = device.createCommandEncoder();
	// Update the stats panel
	if (params.change) {
		frameCount = 0;
		current_mipLevel = 0;
		params.change = false;
		reference = true

		await quadManager.unmap();
		// quadManager = new QuadManager(device, textureSize, mipLevel, params.travelValues);
		quadManager = new QuadManager(device, textureSize, params.travelValues);
		quadManager.init(quadTree, params.travelValues, quadTreeJson);
		render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager.bufferMux);
		const commandEncoderArg = device.createCommandEncoder();
		updateTravBufferCoord(params.travelValues, commandEncoderArg, quadManager.bufferMux.traversal);
		const commandBufferArg = commandEncoderArg.finish();
		// await device.queue.submit([commandBufferArg]);
		// await device.queue.onSubmittedWorkDone();
		requestAnimationFrame(frame);
		// clear browser console
		return;
		// }else if(16*2 > frameCount){
	}
	current_mipLevel++;
	await quadManager.eval.pass(frameCount, commandEncoder);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.result, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.traversal, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.traversal, 32, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.features[0], 0, 32);
	// mesure time 
	// await quadManager.quadTree.pass(frameCount / 2, commandEncoder);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.evalThreadIter, 0, 32);
	// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.result, 0, 32);
	// await dbug_mngr.u32fromBufferToLog(quadManager.bufferMux.uniform, 0, 32);
	quadManager.genVertex.pass(current_mipLevel, commandEncoder);
	device.queue.submit([commandEncoder.finish()]);

	// renderpass locked 30 fps
	if (currentTime - lastFrameTime > 1000 / 30) {
		const renderCommandEncoder = device.createCommandEncoder();
		render.pass(frameCount, renderCommandEncoder)
		device.queue.submit([renderCommandEncoder.finish()]);
		lastFrameTime = currentTime;
		let data = await quadManager.bufferMux.getTextureData();
		// console.log(data)
	}
	frameCount++;
	stats.end();
	if (timeInterval.length > 0 && params.output && currentTime - startTime >= timeInterval[0] ) {
		// save and download canvas
		const link = document.createElement('a');
		const commandEncoder = device.createCommandEncoder();
		quadManager.genVertex.pass(current_mipLevel, commandEncoder);
		device.queue.submit([commandEncoder.finish()]);
		// wait for commandEncoder to finish
		await device.queue.onSubmittedWorkDone();
		// wait for document to be ready
		await new Promise(resolve => setTimeout(resolve, 100));

		link.download = `snapshot_${nameIndex}_${currentTime - startTime}_${timeInterval[0]}.png`;
		nameIndex++;
		link.href = canvas.toDataURL('image/png');
		// link text/value
		link.textContent = `Download snapshot ${nameIndex} (${currentTime - startTime} ms)`;
		// link.click();
		linksContainer.appendChild(link);

		// make link visible
		// linksContainer.style.display = 'flex';
		link.style.display = 'block'
		// remove timeInterval[0]
		timeInterval.shift();
		params.updateTravelValues()
	}

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
	frameCount = 0;
	console.clear();
	let rect = canvas.getBoundingClientRect();
	const x = (event.clientX - rect.left);
	const y = (event.clientY - rect.top);
	// const pixRat = {
	// 	x: canvas.width / HEIGHT * devicePixelRatio,
	// 	y: canvas.height / WIDTH * devicePixelRatio 
	// }
	const uv = [x / canvas.width, y / canvas.height];
	// gui.__folders["Mipmap"].__controllers[0].setValue(mipLevel);
	gui.__folders["UV Coordinates"].__controllers[0].setValue(uv[0]);
	gui.__folders["UV Coordinates"].__controllers[1].setValue(uv[1]);
	params.updateTravelValues([uv[0], uv[1]]);
	// await updateTravBufferCoord(uv);
	// requestAnimationFrame(frame);
})

// On close unbind buffers
window.addEventListener('beforeunload', async () => {
	await device.queue.onSubmittedWorkDone();
	quadManager.unmap();
})


