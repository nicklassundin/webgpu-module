import quadEvaluationComputeShaderCode from './shaders/quad.eval.comp.wgsl?raw';

import QuadTreeTraversal from './traversal';

const TEXT_STRG_BGL = {
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: { access: "write-only", format: "rgba8unorm"  }
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
				}
			],
}
const QUADTREE_BGL = {
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
						// type: 'storage',
						type: 'read-only-storage',
					}, 
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					}
				}
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
		    quadTreeTravRef: QuadTreeTraversal,
		    quadTreeTrav: QuadTreeTraversal, 
		    mipLevelCount: number = 11) {
		this.device = device;
		this.mipmapLevel = mipLevelCount;
		this.target = quadTreeTravRef;
		const frameTexture = device.createTexture({
			size: [textureSize, textureSize, 1],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
			mipLevelCount: mipLevelCount,
		});
		this.texture = frameTexture;
		let frames = 2;
		
		// 
		const result = [];
		for (let i = 0; i < frames; i++) {
			result.push(device.createBuffer({
				size: quadTreeTrav.result.size,
				offset: 0,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			}));
		}

		this.buffers = {
			level: quadTreeTrav.result,
			travBuffers: quadTreeTrav.buffers.travBuffers,
			travValues: travValues,
			result,
		}
		
		// create bindgrouopLayout for quadtree
		// Texture Storage Layout

		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(QUADTREE_BGL),
			texture: device.createBindGroupLayout(TEXT_STRG_BGL),
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
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;
		// update bindGroup
		this.createBindGroups(mipLevel);
		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroups.texture);
		computePass.setBindGroup(1, this.bindGroups.quadTree);
		// computePass.dispatchWorkgroups(this.mipmapLevel)
		computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroups(level = 0){
		// Create texture for quadtree bindGroupQuad
		const bindGroupQuadTreeTexture = this.device.createBindGroup({
			layout: this.bindGroupLayouts.texture,
			entries: [
				{
					binding: 0,
					resource: this.texture.createView({
						baseMipLevel: level,
						mipLevelCount: 1,
					}),
				},
				{
					binding: 1,
					resource: {
						buffer: this.result[(level + 1)% 2],
						offset: 0,
						size: this.result[(level + 1) % 2].size,
					}
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.travBuffers[(level) % this.mipmapLevel],
						offset: 0,
						size: this.buffers.travBuffers[(level) % this.mipmapLevel].size,
					}
				}
			],
		});
		const bindGroupQuadTree = this.device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree, 
			entries: [
				{
					binding: 0,	
					resource: {
						buffer: this.buffers.level,
						offset: 0,
						size: this.buffers.level.size
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.target.result,
						offset: 0,
						size: this.target.result.size
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.result[level % 2],
					}
				}
			],
		});
		this.bindGroups = {
			texture: bindGroupQuadTreeTexture,
			quadTree: bindGroupQuadTree,
		}
	}
}
export default Eval;
