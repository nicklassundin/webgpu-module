/// <reference types="@webgpu/types" />

import fragmentShaderCode from "./shaders/fragment.wgsl?raw";
import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import { Triangle, Hexagon } from "./shape";

import quadfragmentShaderCode from "./shaders/quad.frag.wgsl?raw";
import quadvertexShaderCode from "./shaders/quad.vert.wgsl?raw";

import quadTraversalComputeShaderCode from "./shaders/quad.trav.comp.wgsl?raw";

import depthFragmentShaderCode from "./shaders/depth.frag.wgsl?raw";

import { GUI } from 'dat.gui';

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
const mipLevelCount = Math.floor(Math.log2(Math.max(image.width, image.height))) + 1;
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
	mipLevelCount: mipLevelCount
});
// print byte size of image
// Upload image data to texture level 0
const imageBitmap = image;
// const imageCanvas = document.createElement('canvas');
const imageCanvas = document.createElement('canvas');
imageCanvas.width = textureSize; 
imageCanvas.height = textureSize;
const ctx = imageCanvas.getContext('2d');

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
// binding group layout for mipmap
const bindGroupLayoutUniform = device.createBindGroupLayout({
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: {}  }],
})
// Create binding group layout Used for mipmap and normal rendering
const bindGroupLayout = device.createBindGroupLayout({
	entries: [
		{
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
	],
});
// Create binding group depth layout
const bindGroupLayoutDepth = device.createBindGroupLayout({
	entries: [
		{
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
			texture: {
				sampleType: 'float',
			},
		},
	],
});
// Create pipeline layout for mipmap
const pipelineLayoutMipmap = device.createPipelineLayout({
	bindGroupLayouts: [bindGroupLayout],
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
// Pipeline for mipmap
const pipelineMipmap = device.createRenderPipeline({
	layout: pipelineLayoutMipmap,
	vertex: {
		module: device.createShaderModule({
			code: quadvertexShaderCode,
		}),
		buffers: [{
			arrayStride: 4 * 2,
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
			// TODO replace
			code: quadfragmentShaderCode,
			// code: quadtestfragmentShaderCode,
		}),
		targets: [{ format: 'rgba8unorm', }],
	},
	primitive: {
		topology: 'triangle-list',
	}
});
// Mipmap render pass
const commandEncoder = device.createCommandEncoder();
for (let i = 1; i < mipLevelCount; i++) {
	const prevLevelSize = textureSize.width >> (i - 1);
	const newLevelSize = Math.max(1, prevLevelSize >> 1);
	const view = textureMipmap.createView({ baseMipLevel: i, mipLevelCount: 1  });

	const renderPassDescriptorMipmap: GPURenderPassDescriptor = {
		colorAttachments: [
			{
				view,
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	};
	const bindGroupMip = device.createBindGroup({
		layout: bindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: sampler,
			},
			{
				binding: 1,
				resource: textureMipmap.createView({ baseMipLevel: i - 1, mipLevelCount: 1}),
			},
		],
	});

	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptorMipmap);
	passEncoder.setPipeline(pipelineMipmap);
	passEncoder.setBindGroup(0, bindGroupMip);
	passEncoder.setVertexBuffer(0, vertexBuffer);
	passEncoder.draw(6);
	passEncoder.end();

}
device.queue.submit([commandEncoder.finish()]);

import QuadTree from "./quadTree";

// TODO: QuadTree buffers
const quadTreeData = await fetch(quadTreeList[0]);
const quadTreeJsonString = await quadTreeData.json();
const quadTreeJson = JSON.parse(quadTreeJsonString);

const quadTree = new QuadTree(device, quadTreeJson, textureSize, bindGroupUniform, bindGroupLayoutUniform)

import Eval from "./eval";
const evaluation = new Eval(device, textureSize, quadTree.buffers.travBuffer, quadTree.result, sampler, bindGroupUniform, bindGroupLayoutUniform);

// Create Pipeline Layout
const pipelineLayout = device.createPipelineLayout({
	bindGroupLayouts: [bindGroupLayout, bindGroupLayoutUniform],
});
// Piprline
const pipeline = device.createRenderPipeline({
	layout: pipelineLayout, 
	vertex: {
		module: device.createShaderModule({
			code: vertexShaderCode,
		}),
		buffers: [{
			arrayStride: 4 * 2,
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
// Create Depth Pipeline Layout
const pipelineLayoutDepth = device.createPipelineLayout({
	bindGroupLayouts: [bindGroupLayoutDepth, bindGroupLayoutUniform],
});
// Depth pipeline
const pipelineDepth = device.createRenderPipeline({
	layout: pipelineLayoutDepth,
	vertex: {
		module: device.createShaderModule({
			code: quadvertexShaderCode,
		}),
		buffers: [{
			arrayStride: 4 * 2,
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
			code: depthFragmentShaderCode,
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
};
// Depth Render Pass Descriptor
const renderPassDescriptorDepth: GPURenderPassDescriptor = {
	colorAttachments: [
		{
			view: undefined,
			clearValue: [1, 1, 1, 1], // Clear to transparent
			loadOp: 'clear',
			storeOp: 'store',
		},
	],
};


// Create Depth Texture TODO
const depthTextures: GPUTexture[] = [];
const frames = 5;
for (let i = 0; i < frames; i++) {
	depthTextures.push(device.createTexture({
		// size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
		// format: 'depth24plus-stencil8',
		// usage: GPUTextureUsage.RENDER_ATTACHMENT,
	size: [ textureSize, textureSize, 1 ],
	format: 'bgra8unorm',
	// format: 'rgba8unorm',
	usage: 	GPUTextureUsage.TEXTURE_BINDING |
		GPUTextureUsage.RENDER_ATTACHMENT,
	}));
}


async function fromBufferToLog(storageBuffer: GPUbuffer,  offset: number = 0, size: number = 4) {
	// Create a readback buffer
	const readBuffer = device.createBuffer({
		size: size*Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});
	const commandEncoder = device.createCommandEncoder();
	commandEncoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, size*Float32Array.BYTES_PER_ELEMENT);
	const commands = commandEncoder.finish();
	device.queue.submit([commands]);
	await device.queue.onSubmittedWorkDone();

	// Map the readback buffer and read the integer
	await readBuffer.mapAsync(GPUMapMode.READ);
	const arrayBuffer = readBuffer.getMappedRange();
	const view = new Float32Array(arrayBuffer);
	
	console.log(view);
	readBuffer.unmap();
}
async function updateTravBufferCoord(uv: number[]) {
	const travBuffer = quadTree.buffers.travBuffer;
	let byteOffset = 0;
	const mipLevel = new Float32Array([0]);

	device.queue.writeBuffer(travBuffer, byteOffset, mipLevel, 0, 1);
	byteOffset += mipLevel.byteLength;
	
	const boundBox = new Float32Array([0.0, 0.0, 1.0, 1.0]);
	device.queue.writeBuffer(travBuffer, byteOffset, boundBox, 0, 4);
	byteOffset += boundBox.byteLength;

	const targetCoords = new Float32Array(uv);
	device.queue.writeBuffer(travBuffer, byteOffset, targetCoords, 0, 2);
	byteOffset += targetCoords.byteLength;

	const address = new Float32Array([42]);
	device.queue.writeBuffer(travBuffer, byteOffset, address, 0, 1);
	byteOffset += address.byteLength;
	
	await device.queue.onSubmittedWorkDone();
	await fromBufferToLog(travBuffer, 0, 4*4);
	await fromBufferToLog(travBuffer, 4 * 1 + 4 * 4, 4 * 2);
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
	folder.add({ value: 3}, 'value', 0, mipLevelCount, 1).name("Mip Level").onChange(async (value: number) => {
		const resolution = new Float32Array([canvas.width,
						    canvas.height,
		value]);
		await updateUniformBuffer(resolution);
	});
	// Add folder for uv coordinates
	const uvFolder = gui.addFolder("UV Coordinates");
	uvFolder.add({ value: 0.5 }, 'value', 0, 1, 0.01).name("U").onChange((value: number) => {
		updateTravBufferCoord([value, uvFolder.__controllers[1].object.value]);
	})
	uvFolder.add({ value: 0.5 }, 'value', 0, 1, 0.01).name("V");
	folder.open();
}


// listen and find uv coordinates of mouse on click
canvas.addEventListener('click', (event) => {
	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	const uv = [x / canvas.width, y / canvas.height];
	updateTravBufferCoord(uv);
});


// Main loop
let frameCount = 0;
let lastFrameTime = Date.now()
async function frame() {
	// QuadTree compute pass
	const mipLevel = 10; 
	quadTree.pass(mipLevel);
	// Evaluation compute pass
	evaluation.pass(mipLevel);
	// Depth pass bindgroup
	const bindGroupDepth = device.createBindGroup({
		layout: bindGroupLayoutDepth,
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
				// TODO need to use the evaluation texture instead and pass it through
				// resource: depthTextures[frameCount % frames].createView(),
				resource: depthTextures[frameCount % frames].createView(),
			},
		],
	});
	// Render Depth pass
	const mipLevelDepth = mipLevelCount - 1 - frameCount % mipLevelCount;
	// const mipLevelDepth = frameCount % mipLevelCount;
	const mipLevelDepthArray = [canvas.width, canvas.height, mipLevelDepth];
	await updateUniformBuffer(mipLevelDepthArray);
	const commandEncoderDepth = device.createCommandEncoder();
	// const currentDepthTexture = context.getCurrentTexture();
	const currentDepthTexture = depthTextures[(frameCount + 1) % frames]
	// console.log('mipLevel', mipLevelDepth);
	// console.log('index', (frameCount + 1) % frames);
	if (!currentDepthTexture) {
		console.error("Failed to retrieve current texture.");
		return;
	}
	const depthTextureView = currentDepthTexture.createView();
	renderPassDescriptorDepth.colorAttachments[0].view = depthTextureView;
	const passEncoderDepth = commandEncoderDepth.beginRenderPass(renderPassDescriptorDepth);
	passEncoderDepth.setPipeline(pipelineDepth);	
	passEncoderDepth.setVertexBuffer(0, vertexBuffer);
	passEncoderDepth.setBindGroup(0, bindGroupDepth);
	passEncoderDepth.setBindGroup(1, bindGroupUniform);
	passEncoderDepth.draw(6);
	passEncoderDepth.end();
	device.queue.submit([commandEncoderDepth.finish()]);


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
				// resource: evaluation.texture.createView(),
				resource: depthTextures[frameCount % frames].createView(), 
			},
		],
	});
	// Render pass
	if (lastFrameTime < Date.now()) {
		const commandEncoder = device.createCommandEncoder();
		const currentTexture = context.getCurrentTexture();
		if (!currentTexture) {
			console.error("Failed to retrieve current texture.");
			return;
		}
		const textureView = currentTexture.createView();
		renderPassDescriptor.colorAttachments[0].view = textureView;


		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(pipeline);
		passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.setBindGroup(0, bindGroup);
		passEncoder.setBindGroup(1, bindGroupUniform);
		passEncoder.draw(6);
		passEncoder.end();

		device.queue.submit([commandEncoder.finish()]);
		frameCount++;
	}
	// if (frameCount % 60*1000 === 0) {
	requestAnimationFrame(frame);
	// }
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
