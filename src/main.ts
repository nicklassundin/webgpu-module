/// <reference types="@webgpu/types" />

import fragmentShaderCode from "./shaders/fragment.wgsl?raw";
import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import { Triangle, Hexagon } from "./shape";

import quadfragmentShaderCode from "./shaders/quad.frag.wgsl?raw";
import quadvertexShaderCode from "./shaders/quad.vert.wgsl?raw";

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
const uniformBufferSize = 4 * 2 + 4 * 2;
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
		GPUTextureUsage.COPY_SRC,
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
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {}  }],
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

// TODO: QuadTree buffers
const quadTree = await fetch(quadTreeList[0]);
const quadTreeJson = await quadTree.json();
const values = new Float32Array(quadTreeJson.values);
const valuesBuffer = device.createBuffer({
	size: values.byteLength,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(valuesBuffer, 0, values.buffer);

const nodes = new Float32Array(quadTreeJson.nodes);
const nodesBuffer = device.createBuffer({
	size: nodes.byteLength,
	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(nodesBuffer, 0, nodes.buffer);
// create bindgrouopLayout for quadtree
const bindGroupLayoutQuadTree = device.createBindGroupLayout({
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage',
			},
		},
	],
});
// create bindGroup for quadTree
const bindGroupQuadTree = device.createBindGroup({
	layout: bindGroupLayoutQuadTree,
	entries: [
		{
			binding: 0,
			resource: {
				buffer: valuesBuffer,
				offset: 0,
				size: values.byteLength,
			},
		},
		{
			binding: 1,
			resource: {
				buffer: nodesBuffer,
				offset: 0,
				size: nodes.byteLength,
			},
		},
	],
});
// Create texture for quadtree bindGroupQuad
const bindGroupQuadTreeTexture = device.createBindGroup({
	layout: bindGroupLayout,
	entries: [
		{
			binding: 0,
			resource: sampler,
		},
		{
			binding: 1,
			resource: textureMipmap.createView(),
		},
	],
});
// Create pipeline layout for quadTree
const pipelineLayoutQuadTree = device.createPipelineLayout({
	bindGroupLayouts: [bindGroupLayout, bindGroupLayoutQuadTree],
});
// create compute pipeline for quad traversal
const quad_pipeline = device.createComputePipeline({
	layout: pipelineLayoutQuadTree,
	compute: {
		module: device.createShaderModule({
			code: quadfragmentShaderCode,
		}),
		entryPoint: 'main',
	},
});
// QuadTree compute pass
const commandEncoderQuad = device.createCommandEncoder();
const computePass = commandEncoderQuad.beginComputePass();
computePass.setPipeline(quad_pipeline);
computePass.setBindGroup(0, bindGroupQuadTreeTexture);
computePass.setBindGroup(1, bindGroupQuadTree);
computePass.dispatchWorkgroups(1)
computePass.end();
device.queue.submit([commandEncoderQuad.finish()]);



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


let frameCount = 0;
let lastFrameTime = Date.now()
function frame() {
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
				resource: textureMipmap.createView(),
			},
		],
	});
	if (lastFrameTime + 1000 < Date.now()) {
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

// TODO GUI
const gui = new GUI();
{
	const folder = gui.addFolder("Mipmap");
	folder.add({ value: 3}, 'value', 1, mipLevelCount, 1).name("Mip Level").onChange((value: number) => {
		const resolution = new Float32Array([canvas.width,
						    canvas.height,
		value]);
		device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);
	});
	folder.open();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Ensure correct size on startup
requestAnimationFrame(frame);


async function loadImageBitmap(url: string) {
	const response = await fetch(url);
	const blob = await response.blob();
	return createImageBitmap(blob);

}
