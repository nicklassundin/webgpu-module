import quadEvaluationComputeShaderCode from './shaders/quad.eval.comp.wgsl?raw';


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
		    sampler: GPUTextureSampler,
		    mipLevelCount: number = 11) {
		// create textureSize from mipLevel
		// const textureSize = Math.pow(2, mipLevelCount);
		const frameTexture = device.createTexture({
			size: [textureSize, textureSize, 1],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
			mipLevelCount: mipLevelCount,
		});

		// Create empty uniform buffer
		this.travBuffers = travBuffers;

		// create bindgrouopLayout for quadtree
		// Texture Storage Layout
		const bindGroupLayoutTextureStorage = device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					sampler: {
						type: 'filtering',
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: { access: "write-only", format: "rgba8unorm"  }
				},
			],
		});

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
						// type: 'storage',
						type: 'read-only-storage',
					}, 
				}
			],
		});
		// create bindGroup for quadTree
		const bindGroupQuadTree = device.createBindGroup({
			layout: bindGroupLayoutQuadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: travBuffers[0],
						offset: 0,
						size: travValues.byteLength, 
					},
				},
				{
					binding: 1,
					resource: {
						buffer: levelBuffer,
						offset: 0,
						size: levelBuffer.size,
					},
				},
			],
		});
		// Create texture for quadtree bindGroupQuad
		const bindGroupQuadTreeTexture = device.createBindGroup({
			layout: bindGroupLayoutTextureStorage,
			entries: [
				{
					binding: 0,
					resource: sampler,
				},
				{
					binding: 1,
					resource: frameTexture.createView({
						baseMipLevel: 3,
						mipLevelCount: 1,
					}),
				},
			],
		});
		// Create pipeline layout for quadTree
		const pipelineLayoutQuadTree = device.createPipelineLayout({
			bindGroupLayouts: [bindGroupLayoutTextureStorage, bindGroupLayoutQuadTree],
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
		this.bindGroup = bindGroupQuadTree;
		this.bindGroupQuadTree = bindGroupQuadTree;
		this.bindGroupTexture = bindGroupQuadTreeTexture;
		this.bindGroupLayoutTextureStorage = bindGroupLayoutTextureStorage;
		this.bindGroupLayouts = {
			quadTree: bindGroupLayoutQuadTree,
			textureStorage: bindGroupLayoutTextureStorage,
		}
		this.layout = pipelineLayoutQuadTree;
		this.texture = frameTexture;
		const levelWorkBuffers: GPUBuffer[] = [];
		for (let i = 0; i < 2; i++) {
			levelWorkBuffers.push(device.createBuffer({
				size: levelBuffer.size,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
			}));
		}
		this.levelWorkBuffers = levelWorkBuffers;
		this.device = device;
		this.sampler = sampler;
		this.mipmapLevel = mipLevelCount;
	}

	async pass(mipLevel){
		// calculate workgroup based on mipmap
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;
		const sampler = this.sampler;

		this.bindGroupTexture = device.createBindGroup({
			layout: this.bindGroupLayouts.textureStorage,
			entries: [
				{
					binding: 0,
					resource: sampler,
				},
				{
					binding: 1,
					resource: this.texture.createView({
						baseMipLevel: mipLevel,
						mipLevelCount: 1,
					}),
				},
			],
		});
		this.bindGroupQuadTree = device.createBindGroup({
			layout: this.bindGroupLayouts.quadTree,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.travBuffers[mipLevel],
						offset: 0,
						size: travValues.byteLength,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.levelWorkBuffers[mipLevel % 2],
						offset: 0,
						size: this.levelWorkBuffers[(mipLevel+1) % 2].size,
					},
				},
			],
		});

		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroupTexture);
		computePass.setBindGroup(1, this.bindGroupQuadTree);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.submit([commandEncoderQuad.finish()]);
	}
}
export default Eval;
