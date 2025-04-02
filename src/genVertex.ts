import vertGenerateComputeShaderCode from './shaders/vert.comp.wgsl?raw';

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
				}
			],
}
const READ_BGL = {
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
						type: 'read-only-storage',
					}, 
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					}
				},
				{
					binding: 3,
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
		    mipLevelCount: number = 11) {
		this.device = device;
		this.mipmapLevel = mipLevelCount;
		this.target = targetEval;
		// 
		const frames = 2;
		const vertices = [];
		const indices = [];
		for (let i = 0; i < frames; i++) {
			vertices.push(device.createBuffer({
				size: 6*Math.pow((mipLevelCount + 2), 2)*4,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
			}));
			indices.push(device.createBuffer({
				size: textureSize * textureSize * 4 * 4,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.INDEX,
			}));

		}
		const uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		const resolution = new Float32Array([canvas.width,
						    canvas.height,3.0]);
		device.queue.writeBuffer(uniformBuffer, 0, resolution.buffer);

		this.buffers = {
			vertices,
			indices,
			uniform: uniformBuffer,
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
		// create compute pipeline for quad traversal
		const pipeline = device.createComputePipeline({
			layout: pipelineLayout,
			compute: {
				module: device.createShaderModule({
					code: vertGenerateComputeShaderCode,
				}),
				entryPoint: 'main',
			},
		});
		this.pipeline = pipeline;
		this.layout = pipelineLayout;
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
		computePass.setBindGroup(0, this.bindGroups.write);
		computePass.setBindGroup(1, this.bindGroups.read);
		// computePass.dispatchWorkgroups(1);
		computePass.dispatchWorkgroups(6, this.mipmapLevel);
		// computePass.dispatchWorkgroups(6, 2);
		computePass.end();
		await device.queue.submit([commandEncoderQuad.finish()]);
	}
	createBindGroups(level = 0){
		// Create texture for quadtree bindGroupQuad
		const bindGroupWrite = this.device.createBindGroup({
			layout: this.bindGroupLayouts.write,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.buffers.vertices[(level + 1)% 2],
						offset: 0,
						size: this.buffers.vertices[(level + 1) % 2].size,
					}
				},
				{
					binding: 1,
					resource: {
						buffer: this.buffers.indices[(level + 1) % 2],
						offset: 0,
						size: this.buffers.indices[(level + 1) % 2].size,
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
						buffer: this.target.buffers.result[(level+1) % 2],
						offset: 0,
						size: this.target.buffers.result[(level+1) % 2].size,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.target.buffers.level,
						offset: 0,
						size: this.target.buffers.level.size,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.target.buffers.travBuffers[level],
						offset: 0,
						size: this.target.buffers.travBuffers[level].size,
					},
				},
				{
					binding: 3,
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
}
export default VertexGen;
