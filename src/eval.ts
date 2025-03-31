import quadEvaluationComputeShaderCode from './shaders/quad.eval.comp.wgsl?raw';

const TEXT_STRG_BGL = {
			entries: [
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: { access: "write-only", format: "rgba8unorm"  }
				},
			],
}
const QUADTREE_BGL = {
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
						// type: 'storage',
						type: 'read-only-storage',
					}, 
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
	levelBuffer: GPUBuffer;
	bindGroupLayouts: {
		quadTree: GPUBindGroupLayout,
		textureStorage: GPUBindGroupLayout,
	};
	constructor(device: GPUDevice,
		    textureSize,
		    travBuffers: GPUBuffer[],
		    levelBuffer: GPUBuffer,
		    mipLevelCount: number = 11) {
		this.device = device;
		this.mipmapLevel = mipLevelCount;
		const frameTexture = device.createTexture({
			size: [textureSize, textureSize, 1],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
			mipLevelCount: mipLevelCount,
		});
		this.texture = frameTexture;
		const levelWorkBuffers: GPUBuffer[] = [];
		for (let i = 0; i < 2; i++) {
			levelWorkBuffers.push(device.createBuffer({
				size: levelBuffer.size,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
			}));
		}
		this.buffers = {
			levelWorkBuffers: levelWorkBuffers,
			travBuffers: travBuffers,
			travValues: travValues,
		}

		// create bindgrouopLayout for quadtree
		// Texture Storage Layout

		this.bindGroupLayouts = {
			quadTree: device.createBindGroupLayout(QUADTREE_BGL),
			textureStorage: device.createBindGroupLayout(TEXT_STRG_BGL),
		}
		// Initialize bindGroups 
		this.createBindGroups();
		// create bindGroup for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.textureStorage, this.bindGroupLayouts.quadTree],
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

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroups.textureStorage);
		computePass.setBindGroup(1, this.bindGroups.quadTree);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroups(level = 0){
		console.log('level', level)
		console.log('length', this.buffers.travBuffers.length)
		const bindGroupQuadTree = this.device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree, 
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.travBuffers[level],
						offset: 0,
						size: this.buffers.travValues.byteLength, 
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.levelWorkBuffers[level % 2],
						offset: 0,
						size: this.buffers.levelWorkBuffers[level % 2].size,
					},
				},
			],
		});
		// Create texture for quadtree bindGroupQuad
		const bindGroupQuadTreeTexture = this.device.createBindGroup({
			layout: this.bindGroupLayouts.textureStorage,
			entries: [
				{
					binding: 1,
					resource: this.texture.createView({
						baseMipLevel: level,
						mipLevelCount: 1,
					}),
				},
			],
		});
		this.bindGroups = {
			quadTree: bindGroupQuadTree,
			texture: bindGroupQuadTreeTexture,
		}
	}
}
export default Eval;
