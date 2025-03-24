import quadTraversalComputeShaderCode from './shaders/quad.trav.comp.wgsl?raw';

/* 1: miplevel; 4: boundbox; 2; coord; 1 address*/
const travValues = new Float32Array(64);


class QuadTree {
	pipeline: GPUComputePipeline;
	bindGroup: GPUBindGroup;
	bindGroupUniform: GPUBindGroup;
	bindGroupTexture: GPUBindGroup;
	layout: GPUPipelineLayout;
	texture: GPUTexture;
	device: GPUDevice;
	bindGroupLayouts: {};
	buffers: {};
	results: GPUBuffer[];
	constructor(device: GPUDevice, quadTreeJson: Array, textureSize, bindGroupUniform: GPUBindGroup, bindGroupLayoutUniform: GPUBindGroupLayout) {

		// Create empty uniform buffer
		// const travVal= new Float32Array([0, 0, 0, 1, 1, 0.5, 0.5]);
		const travBuffer = device.createBuffer({
			size: travValues.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		// device.queue.writeBuffer(travBuffer, 0, travVal, 0);

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
		const mipLevelCount = Math.floor(Math.log2(textureSize));
		const resultArray = new Float32Array(mipLevelCount);
	
		this.results = [];
		let numBuffers = 2;
		for (let i = 0; i < numBuffers; i++) {
			this.results.push(device.createBuffer({
				size: Float32Array.BYTES_PER_ELEMENT * mipLevelCount, 
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			}));
		}
		device.queue.writeBuffer(this.results[0], 0, new Float32Array([0, 1, 2, 3, 4]));

		this.buffers = {
			travBuffer,
			valuesBuffer,
			nodesBuffer,
		};

		// Quad Tree bindGroupLayout
		const bindGroupLayoutQuadTree = device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage'
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
				}
			],
		});
		// console.log(travValues.byteLength)
		// console.log(values.byteLength)
		// console.log(nodes.byteLength)
		console.log(resultArray.byteLength)
		// create bindGroup for quadTree
		const bindGroupQuadTree = device.createBindGroup({
			layout: bindGroupLayoutQuadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: travBuffer,
						offset: 0,
						size: travValues.byteLength, 
					},
				},
				{
					binding: 1,
					resource: {
						buffer: valuesBuffer,
						offset: 0,
						size: values.byteLength,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: nodesBuffer,
						offset: 0,
						size: nodes.byteLength,
					},
				},
				{
					binding: 3,
					resource: {
						buffer: this.results[0],
						offset: 0,
						size: Float32Array.BYTES_PER_ELEMENT * mipLevelCount, 
					},
				},
			],
		});
		// Create pipeline layout for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			// bindGroupLayouts: [bindGroupLayoutUniform],
			bindGroupLayouts: [bindGroupLayoutUniform, bindGroupLayoutQuadTree],
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
		this.bindGroupUniform = bindGroupUniform;
		this.bindGroupQuadTree = bindGroupQuadTree;
		this.layout = pipelineLayoutQuadTree;
		this.bindGroupLayouts = {
			quadTree: bindGroupLayoutQuadTree,
		};
		// this.texture = frameTexture;
		this.device = device;
		this.mipmapLevel = mipLevelCount;
	}
	async pass(mipLevel){
		
		// calculate workgroup based on mipmap
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;
		await device.queue.onSubmittedWorkDone();

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();

		this.bindGroupQuadTree = device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.travBuffer,
						offset: 0,
						size: travValues.byteLength,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.valuesBuffer,
						offset: 0,
						size: this.buffers.valuesBuffer.size,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.nodesBuffer,
						offset: 0,
						size: this.buffers.nodesBuffer.size,
					},
				},
				{
					binding: 3,
					resource: {
						buffer: this.results[mipLevel % 2],
						offset: 0,
						size: this.mipmapLevel * Float32Array.BYTES_PER_ELEMENT,
					},
				},
			],
		});


		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroupUniform);
		computePass.setBindGroup(1, this.bindGroupQuadTree);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		device.queue.submit([commandEncoderQuad.finish()]);
		await device.queue.onSubmittedWorkDone();
		// update buffers
		const commandEncoder = device.createCommandEncoder();
		commandEncoder.copyBufferToBuffer(this.results[0], 0, this.results[1], 0, this.results[0].size);
		await device.queue.submit([commandEncoder.finish()]);
	}
}
export default QuadTree;
