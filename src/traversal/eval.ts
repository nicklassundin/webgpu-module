import quadEvaluationComputeShaderCode from '../shaders/quad.eval.comp.wgsl?raw';

import QuadTreeTraversal from './traversal';

const NUM_THREADS = 1;
const WRITE_BGL = {
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
					}
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage'
					}
				},{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: {
						format: 'rgba8unorm',
						viewDimension: '2d',
						accessMode: 'write-only',
					}
				}
			],
}
const READ_BGL = {
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
					}
				},
			],
}

const travValues = new Float32Array(64);
class Eval {
	pipeline: GPUComputePipeline;
	bindGroup: GPUBindGroup;
	bindGroupTexture: GPUBindGroup;
	layout: GPUPipelineLayout;
	texture: GPUTexture;
	device: GPUDevice;
	bindGroupLayouts: {
		quadTree: GPUBindGroupLayout,
		texture: GPUBindGroupLayout,
	};
	get result() {
		return this.buffers.result;
	}
	constructor(device: GPUDevice,
		    textureSize,
		    quadTreeTrav: QuadTreeTraversal, 
		    mipLevelCount: number = 11) {
		this.device = device;
		this.mipLevel = mipLevelCount;
		let frames = 2;
		
		// 
		const result = [];
		for (let i = 0; i < 2; i++) {
			result.push(device.createBuffer({
				size: quadTreeTrav.result.size*4*4,
				offset: 0,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			}));
		}

		// quad tree traversal buffer
		const quadTreeBuffer = device.createBuffer({
			size: Math.pow(2, 2 * mipLevelCount) * 4 * 4, 
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		// Mipmap texture
		const mipmapTexture = device.createTexture({
			size: textureSize,
			format: 'rgba8unorm',
			usage: GPUTextureUsage.STORAGE | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING,
			mipLevelCount: mipLevelCount,
		});
		// Uniform buffer storing current mipmap level u32 bit
		const threadIterationsBuffer = device.createBuffer({
			// 16 is fixed max mipmap level
			size: NUM_THREADS * 4 + Float32Array.BYTES_PER_ELEMENT * 16,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 
		});

		this.buffers = {
			path: quadTreeTrav.result,
			travBuffer: quadTreeTrav.buffers.travBuffer,
			values: quadTreeTrav.buffers.valuesBuffer,
			result,
			nodes: quadTreeTrav.buffers.nodesBuffer,
			quadTreeMap: quadTreeBuffer,
			texture: mipmapTexture,
			threadIterations: threadIterationsBuffer,
		}
		
		// create bindgrouopLayout for quadtree
		// Texture Storage Layout

		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(READ_BGL),
			texture: device.createBindGroupLayout(WRITE_BGL),
		}
		// Initialize bindGroups 
		// this.createBindGroups();
		// create bindGroup for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.texture, this.bindGroupLayouts.quadTree],
		});
		// create compute pipeline for quad traversal
		const pipeline = device.createComputePipeline({
			layout: pipelineLayoutQuadTree,
			compute: {
				module: device.createShaderModule({
					code: quadEvaluationComputeShaderCode,
				}),
				entryPoint: 'main',
			},
		});
		this.pipeline = pipeline;
		this.layout = pipelineLayoutQuadTree;
	}

	async pass(mipLevel){
		// calculate workgroup based on mipmap
		// const workgroupSize = Math.pow(2, this.mipLevel - mipLevel);
		const device = this.device;
		// update bindGroup
		this.createBindGroups(mipLevel);
		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroups.texture);
		computePass.setBindGroup(1, this.bindGroups.quadTree);
		// computePass.dispatchWorkgroups(this.mipLevel)
		// computePass.dispatchWorkgroups(1,1,4)
		computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroups(level = 0){
		// Create texture for quadtree bindGroupQuad
		level = level / 2;
		let currentMipLevel = (this.mipLevel - 1) - level % this.mipLevel;
		const bindGroupQuadTreeTexture = this.device.createBindGroup({
			layout: this.bindGroupLayouts.texture,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.result[(level+1)% 2],
						offset: 0,
						size: this.result[(level+1) % 2].size,
					}
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.travBuffer,
						offset: 0,
						size: this.buffers.travBuffer.size,
					}
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.quadTreeMap,
						offset: 0,
						size: this.buffers.quadTreeMap.size,
					}
				},
				{
					binding: 3,
					resource: this.buffers.texture.createView({
						baseMipLevel: currentMipLevel, 
						mipLevelCount: 1,
					}),
				}
			],
		});
		const bindGroupQuadTree = this.device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree, 
			entries: [
				{
					binding: 0,	
					resource: {
						buffer: this.buffers.path,
						offset: 0,
						size: this.buffers.path.size
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.threadIterations,
						offset: 0,
						size: this.buffers.threadIterations.size,
					}
				},
			],
		});
		this.bindGroups = {
			texture: bindGroupQuadTreeTexture,
			quadTree: bindGroupQuadTree,
		}
	}
	unmap(){
		this.buffers.result.forEach(buffer => {
			buffer.unmap();
		});
		this.buffers.travBuffer.unmap()
		this.device.queue.onSubmittedWorkDone();
	}
}
export default Eval;
