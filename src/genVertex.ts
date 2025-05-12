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
					buffer: {}
				},
				// sampler
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					sampler: {
						type: 'filtering',
					}
				},
				{
					// texture binding
					binding: 2,
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
		    bufferMux: BufferMux) {
		this.device = device;
		this.bufferMux = bufferMux;
		
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

		this.createBindGroups();
	}
	async pass(frame: number = 0, commandEncoder: GPUCommandEncoder){
		// console.log('Dispatching VertexGen pass', frame, 'with workgroup size', WORKGROUPSIZE, 'and grid size', this.grid, 'and mip level', this.mipLevel);
		const device = this.device;
		// generate vertex buffer
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(this.vertexPipeline);
		computePass.setBindGroup(0, this.bindGroups.write);
		computePass.setBindGroup(1, this.bindGroups.read);
		// TODO optimize with x,y,z ??
		const workgroupSize = this.bufferMux.config.workgroupSize;
		computePass.dispatchWorkgroups(workgroupSize, workgroupSize)
		computePass.end();
	}
	createBindGroups(){
		// Create texture for quadtree bindGroupQuad
		console.log(this.bufferMux)
		const bindGroupWrite = this.device.createBindGroup({
			layout: this.bindGroupLayouts.write,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.bufferMux.state,
						offset: 0,
						size: this.bufferMux.state.size,
					}
				},
				// write texture
				{
					binding: 1,
					resource: this.bufferMux.texture.createView()
				},
			],
		});
		const bindGroudRead = this.device.createBindGroup({
			layout: this.bindGroupLayouts.read, 
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.bufferMux.uniform,
						offset: 0,
						size: this.bufferMux.uniform.size,
					},
				},
				// sampler
				{
					binding: 1,
					resource: this.bufferMux.sampler,
				},
				{
					binding: 2,
					resource: this.bufferMux.mipTexture.createView()
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
