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
	constructor(device: GPUDevice, quadTreeJson: Array, textureSize, bindGroupUniform: GPUBindGroup, bindGroupLayoutUniform: GPUBindGroupLayout, mipLevelCount: number = 11) {
		// create textureSize from mipLevel
		// const mipLevel = 30;
		// const textureSizez = Math.pow(2, mipLevel);
		// console.log(textureSizez)

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
		const bufferLength = Math.pow(4, mipLevelCount) * 4;
		const resultArray = new Float32Array(bufferLength);
		const resultBuffer = device.createBuffer({
			size: resultArray.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
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
		console.log(travValues.byteLength)
		console.log(values.byteLength)
		console.log(nodes.byteLength)
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
						buffer: resultBuffer,
						offset: 0,
						size: resultArray.byteLength,
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
		this.result = resultBuffer;
	}
	async pass(mipLevel){
		// calculate workgroup based on mipmap
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;

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
						buffer: this.result,
						offset: 0,
						size: this.result.size,
					},
				},
			],
		});


		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroupUniform);
		computePass.setBindGroup(1, this.bindGroupQuadTree);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.onSubmittedWorkDone();
	}
}
export default QuadTree;
