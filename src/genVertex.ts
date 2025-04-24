import vertGenerateComputeShaderCode from './shaders/vert.comp.wgsl?raw';
import indexGenerateComputeShaderCode from './shaders/ind.comp.wgsl?raw';

import QuadTreeTraversal from './traversal';
import Eval from './eval';

const WRITE_BGL = {
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
					}
				},
				{
					// texture binding
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: {
						access: 'write-only',
						format: 'rgba8unorm',
					}
				},
			],
}
const READ_BGL = {
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					}, 
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					}
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {}
				},
				// sampler
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					sampler: {
						type: 'filtering',
					}
				},
				{
					// texture binding
					binding: 4,
					visibility: GPUShaderStage.COMPUTE,
					texture: {
						viewDimension: '2d',
						sampleType: 'float',
					}
				},
			],
}

const travValues = new Float32Array(64);
const uniformBufferSize = (4 * 2 + 4 * 2)*Float32Array.BYTES_PER_ELEMENT;
class VertexGen {
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
	constructor(device: GPUDevice,
		    textureSize,
		    targetEval: Eval,
		    quadTreeTrav: QuadTreeTraversal, 
		    mipLevelCount: number) {
		this.device = device;
		this.mipLevel = mipLevelCount;
		const grid = Math.pow(2, this.mipLevel) +1 ;
		this.grid = grid;
		this.textureSize = textureSize;
		this.eval= targetEval;
		// 
		const verticeValues = new Float32Array([
			0, 0, 0, 1, 0, 0, 0, 1,
			1, 0, 0, 1, 0, 0, 0, 1,
			0, 1, 0, 1, 0, 0, 0, 1,
			1, 1, 0, 1, 0, 0, 0, 1,
		]);
		const vertice = device.createBuffer({
			// size: Math.pow(4, 8),
			size: verticeValues.byteLength, 
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
		});
		device.queue.writeBuffer(vertice, 0, verticeValues.buffer);
		const indicesValues = new Uint32Array([0, 1, 2, 1, 3, 2]);
		// const indicesValues = new Uint32Array([0, 1, 2, 0, 0, 0]);
		const indices = device.createBuffer({
			size: 6*Math.pow(4, mipLevelCount)*4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.INDEX,
		});
		device.queue.writeBuffer(indices, 0, indicesValues.buffer);
		// create index buffer
		const uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		const resolution = new Float32Array([canvas.width,
						    	canvas.height,
							this.mipLevel]);
		device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);
		// State buffer
		const stateBuffer = device.createBuffer({
			size: 4 * 4 * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		// Texture
		const texture = device.createTexture({
			size: textureSize, 
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
		});
		// Sampler
		this.sampler = device.createSampler({
			minFilter: 'nearest',
			magFilter: 'nearest',
			mipmapFilter: 'nearest',
		});
		this.buffers = {
			vertice,
			indices,
			uniform: uniformBuffer,
			state: stateBuffer,
			texture,
		}
		
		// create bindgrouopLayout for quadtree
		// Texture Storage Layout
		this.bindGroupLayouts = {
			read: device.createBindGroupLayout(READ_BGL),
			write: device.createBindGroupLayout(WRITE_BGL),
		}
		// Initialize bindGroups 
		// this.createBindGroups();
		// create bindGroup for quadTree
		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [this.bindGroupLayouts.write, this.bindGroupLayouts.read],
		});
		this.vertexPipeline = device.createComputePipeline({
			layout: pipelineLayout,
			compute: {
				module: device.createShaderModule({
					code: vertGenerateComputeShaderCode,
				}),
				entryPoint: 'main',
			},
		});

		this.layout = pipelineLayout;

	}
	async pass(frame: number = 0){
		const device = this.device;
		this.createBindGroups(frame);
		// generate vertex buffer
		const commandEncoder = device.createCommandEncoder();
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(this.vertexPipeline);
		computePass.setBindGroup(0, this.bindGroups.write);
		computePass.setBindGroup(1, this.bindGroups.read);
		// round up to next
		const xWorkGroupSize = Math.ceil(this.textureSize.width / 8);
		const yWorkGroupSize = Math.ceil(this.textureSize.height / 8);
		console.log(xWorkGroupSize, yWorkGroupSize) 
		console.log(xWorkGroupSize*8, yWorkGroupSize*8)
		console.log(this.textureSize.width, this.textureSize.height)
		computePass.dispatchWorkgroups(xWorkGroupSize, yWorkGroupSize);
		// computePass.dispatchWorkgroups(1)
		computePass.end();
		await device.queue.submit([commandEncoder.finish()]);
	}
	createBindGroups(frame: number = 0){
		frame = frame / 2;
		// Create texture for quadtree bindGroupQuad
		const bindGroupWrite = this.device.createBindGroup({
			layout: this.bindGroupLayouts.write,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.state,
						offset: 0,
						size: this.buffers.state.size,
					}
				},
				// write texture
				{
					binding: 1,
					resource: this.buffers.texture.createView(),
				},
			],
		});
		const bindGroudRead = this.device.createBindGroup({
			layout: this.bindGroupLayouts.read, 
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.eval.buffers.result[frame % 2],
						offset: 0,
						size: this.eval.buffers.result[frame % 2].size,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.eval.buffers.travBuffers[(frame+this.mipLevel) % this.eval.buffers.travBuffers.length],
						offset: 0,
						size: this.eval.buffers.travBuffers[0].size,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.uniform,
						offset: 0,
						size: this.buffers.uniform.size,
					},
				},
				// sampler
				{
					binding: 3,
					resource: this.sampler,
				},
				{
					binding: 4,
					resource: this.eval.buffers.texture.createView(),
				}
			],
		});
		this.bindGroups = {
			write: bindGroupWrite, 
			read: bindGroudRead, 
		}
	}
	async unmap(){
		await this.buffers.vertice.unmap();
		await this.buffers.indices.unmap();
		await this.buffers.uniform.unmap();
	}
}
export default VertexGen;
