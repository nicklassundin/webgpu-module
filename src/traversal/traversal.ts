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
				// type: 'read-only-storage' 
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
}
const ITERATIONS_BGL = {
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage' 
			}
		},
	]
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
			const travVal = new Float32Array([0, 0, uv[0], uv[1], 0, 0, 1, 1]);
			const travBuffer = device.createBuffer({
				size: travVal.byteLength*Math.pow(4, mipLevel),
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			});
			device.queue.writeBuffer(travBuffer, 0, travVal, 0);

		// Create empty buffer for quadtree
		// Create array length of depth
		// create mipLevelCount from textureSize as int
		const resultArray = new Float32Array(mipLevel);
		this.result = device.createBuffer({
			size: Float32Array.BYTES_PER_ELEMENT * Math.pow(4, this.mipLevel),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});

		// Iterations buffer
		const iterationsBuffer = device.createBuffer({
			size: Float32Array.BYTES_PER_ELEMENT * Math.pow(4, this.mipLevel),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});

		this.buffers = {
			travBuffer,
			valuesBuffer: quadTree.buffers.values,
			nodesBuffer: quadTree.buffers.nodes,
			iter: iterationsBuffer,
		};

		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(QUADTREE_BGL_CONFIG), 
			iter: device.createBindGroupLayout(ITERATIONS_BGL),
		};
		// Quad Tree bindGroupLayout
		// console.log(travValues.byteLength)
		// console.log(values.byteLength)
		// console.log(nodes.byteLength)
		// console.log(resultArray.byteLength)
		// create bindGroup for quadTree
		const bindGroupQuadTree = this.createBindGroup();
		// Create pipeline layout for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.quadTree, this.bindGroupLayouts.iter],
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
	async pass(frame){
		// calculate workgroup based on mipmap
		const device = this.device;
		await device.queue.onSubmittedWorkDone();

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();

		// this.createBindGroup(mipLevel);
		this.createBindGroup(frame);

		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroup.quadTree);
		computePass.setBindGroup(1, this.bindGroup.iter);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroup(level = this.mipLevel){
		level = level / 2;
		this.bindGroup = {
			quadTree: this.device.createBindGroup({
				layout: this.bindGroupLayouts.quadTree,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.buffers.travBuffer,
							offset: 0,
							size: this.buffers.travBuffer.size, 
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
							// TODO chould only access the current call
							// offset: level * Float32Array.BYTES_PER_ELEMENT,
							size: this.mipLevel * Float32Array.BYTES_PER_ELEMENT,
						},
					},
				],
			}),
			iter: this.device.createBindGroup({
				layout: this.bindGroupLayouts.iter,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.buffers.iter,
							offset: 0,
							size: this.buffers.iter.size,
						},
					},
				],
			}),
		};
	}
	unmap(){
		this.buffers.travBuffer.unmap();
		// this.buffers.valuesBuffer.unmap();
		// this.buffers.nodesBuffer.unmap();
	}
}
export default QuadTreeTraversal;
