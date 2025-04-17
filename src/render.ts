
// import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import baseVertexShaderCode from "./shaders/base.vertex.wgsl?raw";
import fragmentShaderCode from "./shaders/fragment.wgsl?raw";

const BGL = {
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {
				type: 'non-filtering',
			},
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: 'depth',
			},
		},
	],
}
// binding group layout for mipmap
const BGL_UNIFORM = {
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: {}  }],
}
const uniformBufferSize = (4 * 2 + 4 * 2)*Float32Array.BYTES_PER_ELEMENT;
// Create bind group for uniform buffer
class Render {
	constructor(device: GPUDevice, context: GPUCanvasContext, canvas: HTMLCanvasElement, presentationFormat: GPUTextureFormat, depthSampler, manager, mipLevel: number) { 
		// Create binding group layout Used for mipmap and normal rendering
		this.device = device;
		this.context = context
		this.canvas = canvas;
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
		mipLevel]);
		device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);
		this.buffers = {
			uniform: uniformBuffer,
		}
		// Create depth texture manually
		this.frames = 2;
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

		this.frameBuffer = []
		for (let i = 0; i < this.frames; i++) {
			this.frameBuffer.push(device.createTexture({
				size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
				format: presentationFormat,
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			}));
		}


		this.bindGroupLayouts = {
			traversal: device.createBindGroupLayout(BGL),
			uniform: device.createBindGroupLayout(BGL_UNIFORM),
		}
		this.createBindGroups();
		// Create Pipeline Layout
		this.pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.traversal, this.bindGroupLayouts.uniform, this.bindGroupLayouts.nav],
		});
		// Pipeline
		this.createPipeline(mipLevel);
		// Render Pass Descriptor
		this.renderPassDescriptor = {
			colorAttachments: [
				{
					view: undefined,
					clearValue: [0, 0, 0, 1], // Clear to transparent
					// loadOp: 'clear',
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
	createPipeline(level, presentationFormat = 'bgra8unorm'){
		this.pipeline = this.device.createRenderPipeline({
			layout: this.pipelineLayout, 
			vertex: {
				module: this.device.createShaderModule({
					// code: vertexShaderCode,
					code: baseVertexShaderCode,
				}),
				buffers: [{
				arrayStride: 32, 
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: 'float32x4',
					},
					{
						shaderLocation: 1,
						offset: 4 * 4,
						format: 'float32x4',
					}
				],
				}]
			},
			fragment: {
				module: this.device.createShaderModule({
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

	}
	pass(calls) {

		const commandEncoder = this.device.createCommandEncoder();
		const currentTexture = this.context.getCurrentTexture();
		if (!currentTexture) {
			console.error("Failed to retrieve current texture.");
			return;
		}
		// TODO render to framebuffer and create second pipeline for canvas
		const textureView = currentTexture.createView();
		this.renderPassDescriptor.colorAttachments[0].view = textureView;
		const depthTextureView = this.depthTextures[(calls + 1) % this.frames].createView();
		this.renderPassDescriptor.depthStencilAttachment.view = depthTextureView;
		// update bindGroups
		this.createBindGroups(calls)


		const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		// passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.setBindGroup(0, this.bindGroups.traversal); 
		passEncoder.setBindGroup(1, this.bindGroups.uniform);
		passEncoder.setBindGroup(2, this.bindGroups.nav);
		passEncoder.setVertexBuffer(0, this.manager.genVertex.buffers.vertice);
		passEncoder.setIndexBuffer(this.manager.genVertex.buffers.indices, 'uint32');
		const maxLevel = this.mipLevel;
		passEncoder.drawIndexed(6*Math.pow(4,this.mipLevel), 1, 0);
		// passEncoder.drawIndexed(6, 1, 0);
		// passEncoder.drawIndexed(6, 1, 6);
		// passEncoder.drawIndexed(6, 1, 6*5);
		// passEncoder.drawIndexed(6, 1, 6*21);

		passEncoder.drawIndexed(6, 1, 6*2);



		// passEncoder.drawIndexed(6*Math.pow(4, this.mipLevel), 1, 0);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}
	createBindGroups(call = 0) {
		this.bindGroups = {
			traversal: this.device.createBindGroup({
				layout: this.bindGroupLayouts.traversal,
				entries: [
					{
						binding: 0,
						resource: this.depthSampler,
					},
					{
						binding: 1,
						resource: this.depthTextures[call % this.frames].createView(),
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
		}
	}
	unmap() {
		this.manager.quadTree.unmap();
		this.manager.eval.unmap();
		this.manager.genVertex.unmap();
		this.device.queue.writeBuffer(this.buffers.uniform, 0, new Float32Array([this.canvas.width, this.canvas.height, this.mipLevel]).buffer);
	}
}
export default Render;
