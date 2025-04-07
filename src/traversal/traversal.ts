import quadTraversalComputeShaderCode from '../shaders/quad.trav.comp.wgsl?raw';
import QuadTree from './data';


const READ_BGL = {
	entries: [
		// TODO seed address buffer used for where to start traversal
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'read-only-storage' 
			}
		},
	]
}


const QUADTREE_BGL_CONFIG = {
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'read-only-storage' 
			}
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage'
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage'
			},
		},
		{
			binding: 3,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage'
			},
		},
		{
			binding: 4,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage'
			},
		}
	],
}

class QuadTreeTraversal {
	pipeline: GPUComputePipeline;
	bindGroup: GPUBindGroup;
	bindGroupTexture: GPUBindGroup;
	layout: GPUPipelineLayout;
	texture: GPUTexture;
	device: GPUDevice;
	bindGroupLayouts: {};
	buffers: {};
	results: GPUBuffer[];
	constructor(device: GPUDevice, quadTree: QuadTree, mipLevel, uv: number[] = [0, 0]) {
		this.device = device;
		this.mipLevel = mipLevel;
		this.quadTree = quadTree;
		let travBuffers: GPUBuffer[] = [];
		for (let i = 0; i < mipLevel; i++) {
			const travVal = new Float32Array([i, 0, uv[0], uv[1], 0, 0, 1, 1]);
			const buffer = device.createBuffer({
				size: Float32Array.BYTES_PER_ELEMENT * 64, 
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			});
			device.queue.writeBuffer(buffer, 0, travVal, 0);
			travBuffers.push(buffer);
		}
		device.queue.onSubmittedWorkDone();

		// Create empty buffer for quadtree
		// Create array length of depth
		// create mipLevelCount from textureSize as int
		const resultArray = new Float32Array(mipLevel);
		this.result = device.createBuffer({
			size: Float32Array.BYTES_PER_ELEMENT * mipLevel,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});

		this.buffers = {
			travBuffers,
			valuesBuffer: quadTree.buffers.values,
			nodesBuffer: quadTree.buffers.nodes,
		};
		
		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(QUADTREE_BGL_CONFIG), 
		};
		// Quad Tree bindGroupLayout
		// console.log(travValues.byteLength)
		// console.log(values.byteLength)
		// console.log(nodes.byteLength)
		console.log(resultArray.byteLength)
		// create bindGroup for quadTree
		const bindGroupQuadTree = this.createBindGroup();
		// Create pipeline layout for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.quadTree],
		});
		// create compute pipeline for quad traversal
		const pipeline = device.createComputePipeline({
			layout: pipelineLayoutQuadTree,
			compute: {
				module: device.createShaderModule({
					code: quadTraversalComputeShaderCode,
				}),
				entryPoint: 'main',
			},
		});

		this.pipeline = pipeline;
		this.bindGroupQuadTree = bindGroupQuadTree;
		this.layout = pipelineLayoutQuadTree;
		// this.texture = frameTexture;
	}
	async pass(mipLevel){
		// calculate workgroup based on mipmap
		const device = this.device;
		await device.queue.onSubmittedWorkDone();

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();

		this.createBindGroup(mipLevel);


		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroup.quadTree);
		// computePass.dispatchWorkgroups(1);
		computePass.dispatchWorkgroups(mipLevel+1);
		computePass.end();
		device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroup(level = 0){
		this.bindGroup = {
			quadTree: this.device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.travBuffers[level % this.mipLevel],
						offset: 0,
						size: this.buffers.travBuffers[level % this.mipLevel].size, 
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.travBuffers[(level+1) % this.mipLevel],
						offset: 0,
						size: this.buffers.travBuffers[(level+1) % this.mipLevel].size,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.valuesBuffer,
						offset: 0,
						size: this.buffers.valuesBuffer.size,
					},
				},
				{
					binding: 3,
					resource: {
						buffer: this.buffers.nodesBuffer,
						offset: 0,
						size: this.buffers.nodesBuffer.size,
					},
				},
				{
					binding: 4,
					resource: {
						buffer: this.result,
						offset: 0,
						// TODO chould only access the current call
						// offset: level * Float32Array.BYTES_PER_ELEMENT,
						size: this.mipLevel * Float32Array.BYTES_PER_ELEMENT,
					},
				},
			],
			}),
		}
	}
}
export default QuadTreeTraversal;
