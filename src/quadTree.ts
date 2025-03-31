import quadTraversalComputeShaderCode from './shaders/quad.trav.comp.wgsl?raw';

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

class QuadTree {
	pipeline: GPUComputePipeline;
	bindGroup: GPUBindGroup;
	bindGroupTexture: GPUBindGroup;
	layout: GPUPipelineLayout;
	texture: GPUTexture;
	device: GPUDevice;
	bindGroupLayouts: {};
	buffers: {};
	results: GPUBuffer[];
	constructor(device: GPUDevice, quadTreeJson: Array, mipLevel) {
		this.device = device;
		this.mipmapLevel = mipLevel;
		let travBuffers: GPUBuffer[] = [];
		for (let i = 0; i <= mipLevel; i++) {
			const travVal = new Float32Array([i, 0, 0, 1, 1, 0.6, 0.4, 0]);
			const buffer = device.createBuffer({
				size: Float32Array.BYTES_PER_ELEMENT * 64, 
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			});
			device.queue.writeBuffer(buffer, 0, travVal, 0);
			travBuffers.push(buffer);
		}
		device.queue.onSubmittedWorkDone();


		const values = new Float32Array(quadTreeJson.values);
		const valuesBuffer = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(valuesBuffer, 0, values.buffer);

		const nodes = new Float32Array(quadTreeJson.nodes);
		const nodesBuffer = device.createBuffer({
			size: nodes.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(nodesBuffer, 0, nodes.buffer);
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
			valuesBuffer,
			nodesBuffer,
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
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;
		await device.queue.onSubmittedWorkDone();

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();

		const bindGroupQuadTree = this.createBindGroup(mipLevel);


		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, bindGroupQuadTree);
		computePass.dispatchWorkgroups(1);
		computePass.end();
		device.queue.submit([commandEncoderQuad.finish()]);
		// stop wait for input
		// device.queue.onSubmittedWorkDone();
		// update buffers
		// const commandEncoder = device.createCommandEncoder();
		// commandEncoder.copyBufferToBuffer(this.results[0], 0, this.results[1], 0, this.results[0].size);
		// await device.queue.submit([commandEncoder.finish()]);
	}
	createBindGroup(level = 0){
		return this.device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.travBuffers[level % this.buffers.travBuffers.length],
						offset: 0,
						size: this.buffers.travBuffers[level % this.buffers.travBuffers.length].size, 
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.travBuffers[(level + 1) % this.buffers.travBuffers.length],
						offset: 0,
						size: this.buffers.travBuffers[(level + 1) % this.buffers.travBuffers.length].size,
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
						size: this.mipmapLevel * Float32Array.BYTES_PER_ELEMENT,
					},
				},
			],
		});
	}
}
export default QuadTree;
