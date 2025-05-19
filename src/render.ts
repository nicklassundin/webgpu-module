
// import vertexShaderCode from "./shaders/vertex.wgsl?raw";
import baseVertexShaderCode from "./shaders/base.vertex.wgsl?raw";
import fragmentShaderCode from "./shaders/fragment.wgsl?raw";

// binding group layout for mipmap
const BGL_UNIFORM = {
	entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: {}  },
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX,
			sampler: {
				type: 'filtering',
			},
		},
		{
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX,
			texture: {
				viewDimension: '2d',
				sampleType: 'float',
			},
		}],
}
const uniformBufferSize = (4 * 2 + 4 * 2)*Float32Array.BYTES_PER_ELEMENT;
// Create bind group for uniform buffer
class Render {
	constructor(device: GPUDevice, context: GPUCanvasContext, canvas: HTMLCanvasElement, presentationFormat: GPUTextureFormat, depthSampler, bufferMux: BUfferMux) { 
		// Create binding group layout Used for mipmap and normal rendering
		this.device = device;
		this.context = context
		this.canvas = canvas;
		this.depthSampler = depthSampler;
		this.bufferMux = bufferMux;
		this.frameBuffer = [];
		const mipLevel = bufferMux.config.mipLevel;
		// Uniform Buffer
		// containing the resolution of the canvas
		// Resolution 4 * 2; Mipmap level 4 * 1
		// Sampler
		const sampler = device.createSampler({ 
			minFilter: 'linear',
			magFilter: 'linear',
			mipmapFilter: 'linear',
			// minFilter: 'nearest',
			// magFilter: 'nearest',
			// mipmapFilter: 'nearest',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge',
			addressModeW: 'clamp-to-edge',
			// compare: 'less-equal',
			// maxAnisotropy: 16,
		});
		this.buffers = {
			sampler: sampler,
		}
		this.frames = 2;
		this.frameViews = [];
		this.frameBuffer = []
		for (let i = 0; i < this.frames; i++) {
			this.frameBuffer.push(device.createTexture({
				size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
				format: presentationFormat,
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			}));
			this.frameViews.push(this.frameBuffer[i].createView());
		}


		this.bindGroupLayouts = {
			uniform: device.createBindGroupLayout(BGL_UNIFORM),
		}
		this.createBindGroups();
		// Create Pipeline Layout
		this.pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.uniform, this.bindGroupLayouts.nav],
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
				cullMode: 'none',
			},
		});

	}
	pass(calls, commandEncoder) {

		const currentTexture = this.context.getCurrentTexture();
		if (!currentTexture) {
			console.error("Failed to retrieve current texture.");
			return;
		}
		// TODO render to framebuffer and create second pipeline for canvas
		const textureView = currentTexture.createView();
		this.renderPassDescriptor.colorAttachments[0].view = textureView;
		// update bindGroups
		this.createBindGroups(calls)


		const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		// passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.setBindGroup(0, this.bindGroups.uniform);
		passEncoder.setBindGroup(1, this.bindGroups.nav);
		passEncoder.setVertexBuffer(0, this.bufferMux.vertices);
		passEncoder.setIndexBuffer(this.bufferMux.indices, 'uint32');
		const maxLevel = this.mipLevel;
		passEncoder.drawIndexed(6, 1, 0);

		passEncoder.end();
	}
	createBindGroups(call = 0) {
		this.bindGroups = {
			uniform: this.device.createBindGroup({
				layout: this.bindGroupLayouts.uniform,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.bufferMux.uniform,
							offset: 0,
							size: this.bufferMux.uniform.size
						},
					},
					// Sampler from buffers.sampler
					{
						binding: 1,
						resource: this.buffers.sampler,
					},
					{
						binding: 2,
						resource: this.bufferMux.texture.createView(),
					},
				],
			}),
		}
	}
}
export default Render;
