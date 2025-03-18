import quadEvaluationComputeShaderCode from './shaders/quad.eval.comp.wgsl?raw';

class Eval {
	pipeline: GPUComputePipeline;
	bindGroup: GPUBindGroup;
	bindGroupUniform: GPUBindGroup;
	bindGroupTexture: GPUBindGroup;
	layout: GPUPipelineLayout;
	texture: GPUTexture;
	device: GPUDevice;
	constructor(device: GPUDevice,
		    textureSize,
		    buffer: GPUBuffer,
		    sampler: GPUTextureSampler,
		    bindGroupUniform: GPUBindGroup,
		    bindGroupLayoutUniform: GPUBindGroupLayout,
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
		const uniformBuffer = device.createBuffer({
			size: ( 4 * 1 * // Current Mip Level
			       4 * 4 * // Bound Box
			       4 * 2 * // Target Coordinates
			       4 * 1 // Address
			      )  * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST ,
		});

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
					buffer: {}
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
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
						buffer: uniformBuffer,
						offset: 0,
						size: 4 * 1 * // Current Mip Level
						       4 * 4 * // Bound Box
						       4 * 2 // Target Coordinates
					},
				},
				{
					binding: 1,
					resource: {
						buffer: buffer,
						offset: 0,
						size: buffer.size,
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
			bindGroupLayouts: [bindGroupLayoutUniform, bindGroupLayoutTextureStorage, bindGroupLayoutQuadTree],
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
		this.bindGroupUniform = bindGroupUniform;
		this.bindGroupQuadTree = bindGroupQuadTree;
		this.bindGroupTexture = bindGroupQuadTreeTexture;
		this.bindGroupLayoutTextureStorage = bindGroupLayoutTextureStorage;
		this.layout = pipelineLayoutQuadTree;
		this.texture = frameTexture;
		this.device = device;
		this.sampler = sampler;
		this.mipmapLevel = mipLevelCount;
	}
	pass(mipLevel){
		// calculate workgroup based on mipmap
		// const workgroupSize = Math.pow(2, this.mipmapLevel - mipLevel);
		const device = this.device;
		const sampler = this.sampler;

		this.bindGroupTexture = device.createBindGroup({
			layout: this.bindGroupLayoutTextureStorage,
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
		const commandEncoderQuad = device.createCommandEncoder();
		const computePass = commandEncoderQuad.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroupUniform);
		computePass.setBindGroup(1, this.bindGroupTexture);
		computePass.setBindGroup(2, this.bindGroupQuadTree);
		computePass.dispatchWorkgroups(1)
		computePass.end();
		device.queue.submit([commandEncoderQuad.finish()]);
	}
}
export default Eval;
