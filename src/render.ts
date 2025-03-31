
import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import fragmentShaderCode from "./shaders/fragment.wgsl?raw";

const BGL = {
	entries: [
		{
			// Read 
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {
				type: 'filtering',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: 'float',
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {
				type: 'non-filtering',
			},
		},
		{
			binding: 3,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: 'depth',
			},
		},
	],
}
const BGL_NAV = {
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
			buffer: {
				type: 'read-only-storage',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
			buffer: {
				type: 'read-only-storage',
			},
		},
	]
}
// binding group layout for mipmap
const BGL_UNIFORM = {
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: {}  }],
}
const uniformBufferSize = (4 * 2 + 4 * 2)*Float32Array.BYTES_PER_ELEMENT;
// Create bind group for uniform buffer
class Render {
	constructor(device: GPUDevice, context: GPUCanvasContext, canvas: HTMLCanvasElement, presentationFormat: GPUTextureFormat, sampler, depthSampler, manager, mipLevel: number) { 
		// Create binding group layout Used for mipmap and normal rendering
		this.device = device;
		this.context = context
		this.canvas = canvas;
		this.sampler = sampler;
		this.depthSampler = depthSampler;
		this.manager = manager;
		this.quadTree = manager.quadTree; 
		this.eval = manager.eval; 
		this.mipLevel = mipLevel;
		// Uniform Buffer
		// containing the resolution of the canvas
		// Resolution 4 * 2; Mipmap level 4 * 1
		const uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		const resolution = new Float32Array([canvas.width,
						    canvas.height,
		3.0]);
		// Create view texture manually
		this.texture = device.createTexture({
			size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1  },
			format: presentationFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});
		this.textureView = this.texture.createView();
		device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);
		this.buffers = {
			uniform: uniformBuffer,
		}
		// Create depth texture manually
		this.frames = 3;
		let depthTextures: GPUTexture[] = [];
		for (let i = 0; i < this.frames; i++) {
			const depthTexture = device.createTexture({
				size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
				format: 'depth24plus',
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			});
			depthTextures.push(depthTexture);
		}
		this.depthTextures = depthTextures;


		this.bindGroupLayouts = {
			traversal: device.createBindGroupLayout(BGL),
			uniform: device.createBindGroupLayout(BGL_UNIFORM),
			nav: device.createBindGroupLayout(BGL_NAV),
		}
		this.createBindGroups();
		// Create Pipeline Layout
		this.pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.traversal, this.bindGroupLayouts.uniform, this.bindGroupLayouts.nav],
		});
		// Pipeline
		this.pipeline = device.createRenderPipeline({
			layout: this.pipelineLayout, 
			vertex: {
				module: device.createShaderModule({
					code: vertexShaderCode,
				}),
			},
			fragment: {
				module: device.createShaderModule({
					code: fragmentShaderCode,
				}),
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
				// topology: 'point-list',
				// topology: 'line-list',
				// cullMode: 'none',
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				// depthCompare: 'less',
				depthCompare: 'less-equal',
			},
		});
		// Render Pass Descriptor
		this.renderPassDescriptor = {
			colorAttachments: [
				{
					view: undefined,
					clearValue: [0, 0, 0, 0], // Clear to transparent
					loadOp: 'load',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: undefined, 
				// depthLoadOp: 'load',
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
				depthClearValue: 1.0,
			},
		};
	}
	pass(calls, mipLevel) {

		const commandEncoder = this.device.createCommandEncoder();
		const currentTexture = this.context.getCurrentTexture();
		if (!currentTexture) {
			console.error("Failed to retrieve current texture.");
			return;
		}
		const textureView = currentTexture.createView();
		this.renderPassDescriptor.colorAttachments[0].view = textureView;
		const depthTextureView = this.depthTextures[(calls + 1) % this.frames].createView();
		this.renderPassDescriptor.depthStencilAttachment.view = depthTextureView;
		// update bindGroups
		this.createBindGroups(calls, mipLevel);


		const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		// passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.setBindGroup(0, this.bindGroups.traversal); 
		passEncoder.setBindGroup(1, this.bindGroups.uniform);
		passEncoder.setBindGroup(2, this.bindGroups.nav);
		// const numVer = Math.pow(2, current_mipLevel) * 3 * 2;
		// console.log(`Number of vertices: ${numVer}, Mip Level: ${current_mipLevel}`);
		// passEncoder.draw(6, mipLevel);
		passEncoder.draw(6*this.mipLevel);
		// passEncoder.draw(6);
		// passEncoder.draw(5*6);
		// passEncoder.draw(12288);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}
	createBindGroups(calls = 0, mipLevel = 0) {
		// console.log('mipLevel', mipLevel)
		// console.log('travBuffer size', this.quadTree.buffers.travBuffers.length)
		this.bindGroups = {
			traversal: this.device.createBindGroup({
				layout: this.bindGroupLayouts.traversal,
				entries: [
					{
						binding: 0,
						resource: this.sampler,
					},
					{
						binding: 1,
						resource: this.eval.texture.createView(),
					},
					{
						binding: 2,
						resource: this.depthSampler,
					},
					{
						binding: 3,
						resource: this.depthTextures[calls % this.frames].createView(),
					},
				],
			}),
			uniform: this.device.createBindGroup({
				layout: this.bindGroupLayouts.uniform,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.buffers.uniform, 
							offset: 0,
							size: uniformBufferSize,
						},
					},
				],
			}),
			nav: this.device.createBindGroup({
				layout: this.bindGroupLayouts.nav,
				entries: [
					{
						binding: 0,
						resource: {
							// buffer: this.quadTree.result,
							buffer: this.eval.result[(mipLevel+1) % 2],
							offset: 0,
							// size: this.quadTree.result.size,
							size: this.eval.result[(mipLevel+1) % 2].size,
						} 
					},
					{
						binding: 1,
						resource: {
							buffer: this.manager.target.buffers.travBuffers[mipLevel],
							// buffer: this.quadTree.buffers.travBuffers[mipLevel],
							offset: 0,
							size: this.manager.target.buffers.travBuffers[mipLevel].size,
							// size: this.quadTree.buffers.travBuffers[mipLevel].size,
						}
					}
				],
			})
		}
	}
}
export default Render;
