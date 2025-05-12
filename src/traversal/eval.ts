import quadEvaluationComputeShaderCode from '../shaders/quad.eval.comp.wgsl?raw';

import QuadTreeTraversal from './traversal';

const NUM_THREADS = 1;
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
				type: 'storage'
			}
		},{
			binding: 3,
			visibility: GPUShaderStage.COMPUTE,
			storageTexture: {
				format: 'rgba8unorm',
				viewDimension: '2d',
				accessMode: 'write-only',
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
				type: 'storage'
			}
		},
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
	bindGroupLayouts: {
		quadTree: GPUBindGroupLayout,
		texture: GPUBindGroupLayout,
	};
	get result() {
		return this.bufferMux.result;
	}
	constructor(device: GPUDevice,
		    bufferMux: BufferMux) {
			    this.device = device;
			    this.bufferMux = bufferMux;

			    this.bindGroupLayouts = {
				    quadTree: device.createBindGroupLayout(READ_BGL),
				    texture: device.createBindGroupLayout(WRITE_BGL),
			    }
			    // create bindGroup for quadTree
			    const pipelineLayoutQuadTree = device.createPipelineLayout({
				    bindGroupLayouts: [this.bindGroupLayouts.texture, this.bindGroupLayouts.quadTree],
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

		    async pass(mipLevel, commandEncoder: GPUCommandEncoder){
			    const device = this.device;
			    // update bindGroup
			    this.createBindGroups(mipLevel);
			    const computePass = commandEncoder.beginComputePass();
			    computePass.setPipeline(this.pipeline);
			    computePass.setBindGroup(0, this.bindGroups.texture);
			    computePass.setBindGroup(1, this.bindGroups.quadTree);
			    computePass.dispatchWorkgroups(1)
			    computePass.end();
		    }
		    createBindGroups(level = 0){
			    // Create texture for quadtree bindGroupQuad
			    const mipLevel = this.bufferMux.config.mipLevel;

			    let currentMipLevel = (mipLevel - 1) - level % mipLevel;
			    const bindGroupQuadTreeTexture = this.device.createBindGroup({
				    layout: this.bindGroupLayouts.texture,
				    entries: [
					    {
						    binding: 0,
						    resource: {
							    buffer: this.bufferMux.result,
							    offset: 0,
							    size: this.bufferMux.result.size,
						    }
					    },
					    {
						    binding: 1,
						    resource: {
							    buffer: this.bufferMux.traversal,
							    offset: 0,
							    size: this.bufferMux.traversal.size,
						    }
					    },
					    {
						    binding: 2,
						    resource: {
							    buffer: this.bufferMux.quadTreeMap,
							    offset: 0,
							    size: this.bufferMux.quadTreeMap.size,
						    }
					    },
					    {
						    binding: 3,
						    resource: this.bufferMux.mipTexture.createView({
							    baseMipLevel: currentMipLevel, 
							    mipLevelCount: 1,
						    }),
					    }
				    ],
			    });
			    const bindGroupQuadTree = this.device.createBindGroup({
				    layout: this.bindGroupLayouts.quadTree, 
				    entries: [
					    {
						    binding: 0,	
						    resource: {
							    buffer: this.bufferMux.features[0],
							    offset: 0,
							    size: this.bufferMux.features[0].size,
						    },
					    },
					    {
						    binding: 1,
						    resource: {
							    buffer: this.bufferMux.evalThreadIter,
							    offset: 0,
							    size: this.bufferMux.evalThreadIter.size,
						    }
					    },
				    ],
			    });
			    this.bindGroups = {
				    texture: bindGroupQuadTreeTexture,
				    quadTree: bindGroupQuadTree,
			    }
		    }
}
export default Eval;
