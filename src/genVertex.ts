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
						type: 'storage',
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
				}
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
		this.eval= targetEval;
		// 
		const vertice = device.createBuffer({
			// size: Math.pow(4, 8),
			size: 4*4*Math.pow(4, this.mipLevel)*Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
		});
		// const indicesValues = new Uint32Array([0, 1, grid, 1, grid+1, grid]);
		// const indicesValues = new Uint32Array([0, 1, 2, 1, 3, 2]);
		// const indicesValues = new Uint32Array([0, 1, 2, 0, 0, 0]);
		const indices = device.createBuffer({
			size: 6*Math.pow(4, mipLevelCount)*4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.INDEX,
		});
		// device.queue.writeBuffer(indices, 0, indicesValues.buffer);
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
		this.buffers = {
			vertice,
			indices,
			uniform: uniformBuffer,
			state: stateBuffer,
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
		// computePass.dispatchWorkgroups(1, 1, this.mipLevel+1)
		computePass.dispatchWorkgroups(1);
		computePass.end();
		await device.queue.submit([commandEncoder.finish()]);
	}
	createBindGroups(frame: number = 0){
		// Create texture for quadtree bindGroupQuad
		const bindGroupWrite = this.device.createBindGroup({
			layout: this.bindGroupLayouts.write,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.vertice,
						// TODO adjust offset inside or outisde shader
						// purpose is to fill the buffer with each new call
						offset: 0, 
						// size: this.buffers.vertice.size,
						size: Math.pow(4, this.mipLevel),
					}
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.indices,
						offset: 0,
						size: this.buffers.indices.size,
					}
				},
				{
					binding: 2,
					resource: {
						buffer: this.buffers.state,
						offset: 0,
						size: this.buffers.state.size,
					}
				}
			],
		});
		const bindGroudRead = this.device.createBindGroup({
			layout: this.bindGroupLayouts.read, 
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.eval.buffers.path,
						offset: 0,
						size: this.eval.buffers.path.size,
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
