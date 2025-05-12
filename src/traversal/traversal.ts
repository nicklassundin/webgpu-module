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
	constructor(device: GPUDevice, buffers: BufferMux) {
		this.device = device;
		this.bufferMux = buffers;
		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(QUADTREE_BGL_CONFIG), 
			iter: device.createBindGroupLayout(ITERATIONS_BGL),
		};
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
	async pass(frame, commandEncoder: GPUCommandEncoder){
		// calculate workgroup based on mipmap
		const device = this.device;
		const computePass = commandEncoder.beginComputePass();

		// this.createBindGroup(mipLevel);
		this.createBindGroup(frame);

		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroup.quadTree);
		computePass.setBindGroup(1, this.bindGroup.iter);
		computePass.dispatchWorkgroups(1)
		computePass.end();
	}
	createBindGroup(level = this.bufferMux.config.mipLevel){
		level = level / 2;
		this.bindGroup = {
			quadTree: this.device.createBindGroup({
				layout: this.bindGroupLayouts.quadTree,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.bufferMux.traversal,
							offset: 0,
							size: this.bufferMux.traversal.size,
						},
					},
					{
						binding: 1,
						resource: {
							buffer: this.bufferMux.quadTrees[0].values,
							offset: 0,
							size: this.bufferMux.quadTrees[0].values.size,
						},
					},
					{
						binding: 2,
						resource: {
							buffer: this.bufferMux.quadTrees[0].nodes,
							offset: 0,
							size: this.bufferMux.quadTrees[0].nodes.size,
						},
					},
					{
						binding: 3,
						resource: {
							buffer: this.bufferMux.features[0],
							offset: 0,
							size: this.bufferMux.features[0].size,
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
							buffer: this.bufferMux.travThreadIter,
							offset: 0,
							size: this.bufferMux.travThreadIter.size,
						},
					},
				],
			}),
		};
	}
}
export default QuadTreeTraversal;
