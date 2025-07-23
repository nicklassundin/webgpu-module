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
		},
		{
			binding: 3,
			visibility: GPUShaderStage.COMPUTE,
			buffer: {
				type: 'storage',
			}
		}
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
	wgS = {
		x: 1,
		y: 1,
		z: 1,
	};
	get result() {
		return this.bufferMux.result;
	}
	constructor(device: GPUDevice,
		    bufferMux: BufferMux,
		    level: number) {

			    this.device = device;
			    this.bufferMux = bufferMux;
			    this.startLevel = level;

			    // let workgroupSize = Math.pow(2, level);
			    // TODO should be integrated with BufferMux constant
			    let workgroupSize = 8;
			    this.wgS = {
				    x: workgroupSize,
				    y: workgroupSize,
				    z: 1,
			    };
			    console.log(this.wgS)

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
			    await this.device.queue.onSubmittedWorkDone();
			    const device = this.device;
			    // update bindGroup
			    this.createBindGroups(mipLevel);
			    const computePass = commandEncoder.beginComputePass();
			    computePass.setPipeline(this.pipeline);
			    computePass.setBindGroup(0, this.bindGroups.texture);
			    computePass.setBindGroup(1, this.bindGroups.quadTree);
			    // computePass.dispatchWorkgroups(1)
			    //
			    computePass.dispatchWorkgroups(this.wgS.x, this.wgS.y, this.wgS.z)
			    computePass.end();
		    }
		    createBindGroups(level = 0){
			    // Create texture for quadtree bindGroupQuad
			    const mipLevel = this.bufferMux.config.mipLevel;
			    // console.log(mipLevel, level % mipLevel, this.startLevel, level)
			    let currentMipLevel = (mipLevel) - level % (mipLevel - this.startLevel) - this.startLevel;
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
					    {
						    binding: 2,
						    resource: {
							    buffer: this.bufferMux.quadTrees[0].values,
							    offset: 0,
							    size: this.bufferMux.quadTrees[0].values.size,
						    }
					    },
					    {
						    binding: 3,
						    resource: {
							    buffer: this.bufferMux.quadTrees[0].nodes,
							    offset: 0,
							    size: this.bufferMux.quadTrees[0].nodes.size,
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
