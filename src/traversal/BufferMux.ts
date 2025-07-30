
const WORKGROUPSIZE = 8;
// const WORKGROUPSIZE = 12;
class QuadTree {
	nodes: GPUBuffer;
	values: GPUBuffer;
	constructor(device: GPUDevice, json: Array){
		const values = new Float32Array(json.values);
		this.values = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(this.values, 0, values.buffer);

		const nodes = new Float32Array(json.nodes);
		this.nodes = device.createBuffer({
			size: nodes.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(this.nodes, 0, nodes.buffer);
	};
	unbind() {
		this.nodes.destroy();
		this.values.destroy();
	}
}

class BufferMux {
	// DATA
	config: {
		textureSize: number;
		mipLevel: number;
	};
	quadTrees: QuadTree[];
	
	// Dataset Traversal
	travThreadIter: GPUBuffer;
	traversal: GPUBuffer;
	features: GPUBuffer[];
	
	// Evaluation
	quadTreeMap: GPUBuffer;
	evalThreadIter: GPUBuffer;
	// Result Texture
	mipTexture: GPUTexture;
	// Result Buffer
	result: GPUBuffer; 

	// Render
	texture: GPUTexture;
	sampler: GPUSampler;
	vertices: GPUBuffer;
	indices: GPUBuffer;
	uniform: GPUBuffer;
	state: GPUBuffer;
	uniformSize: {
		resolution: number;
		workgroupSize: number;
		input: number;
	}
		
	constructor(device: GPUDevice, 
		    canvasSize: number, 
		    // mipLevel: number,
		   level: number,
		   uv: number[],
		   data: array[]) {
		let number_threads = Math.pow(2, level);
		this.device = device;
		const divisibleBy = 2*32 * WORKGROUPSIZE;
		const textureSize = { 
			width: Math.floor(canvasSize.width / divisibleBy) * divisibleBy,
			height: Math.floor(canvasSize.height / divisibleBy) * divisibleBy,
		};
		const mipTextureSize = {
			width: textureSize.width * 2,
			// width: textureSize.width * 8,
			// width: textureSize.width,
			// height: textureSize.height * 8,
			height: textureSize.height * 2,
			// height: textureSize.height,
		};
		// calculate mipLevel from mipTextureSize
		// const mipLevel = Math.log2(Math.max(mipTextureSize.width, mipTextureSize.height));
		const mipLevel = Math.floor(Math.log2(Math.max(mipTextureSize.width, mipTextureSize.height))) + 1;
		// console.log('TmipLevel', TmipLevel);
		// const mipLevel = 10;


		this.config = {
			textureSize: textureSize,
			mipTextureSize: mipTextureSize,
			mipLevel: mipLevel,
			workgroupSize: WORKGROUPSIZE,
		};
		this.features = [];
		this.quadTrees = [];
		// Data Initialization and Traversal of data
		for (let i = 0; i < data.length; i++) {
			const quadTree = new QuadTree(device, data[i]);
			this.quadTrees.push(quadTree);
			const features = device.createBuffer({
				// TODO Large not in use
				// size: Float32Array.BYTES_PER_ELEMENT*Math.pow(4, mipLevel), // TODO remove
				size: 4, 
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			});
			this.features.push(features);
			const travThreadIter = device.createBuffer({
				size: Float32Array.BYTES_PER_ELEMENT*Math.pow(4, mipLevel),
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			})
		}
		// TODO move mipLevel to travThreadIter
		const traversal_values = new Float32Array([uv[0], uv[1], 0, 1, mipLevel]);
		this.traversal = device.createBuffer({
			size: traversal_values.byteLength * Math.pow(4, mipLevel-level)*number_threads,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		})
		let groups = Math.pow(level+1,2);
		for (let i = 0; i < groups; i++) {
			let offset = i*traversal_values.byteLength*(mipLevel-level);
			device.queue.writeBuffer(this.traversal, offset, traversal_values.buffer);
		}

		this.travThreadIter = device.createBuffer({
			size: 4*16 + number_threads*4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		})


		// Evaluation Initialization
		this.quadTreeMap = device.createBuffer({
			size: Math.pow(2, 2*mipLevel),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		})
		this.mipTexture = device.createTexture({
			// size: [textureSize.width, textureSize.height],
			size: [mipTextureSize.width, mipTextureSize.height],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
			mipLevelCount: mipLevel,
		})
		this.evalThreadIter = device.createBuffer({
			size: 4*16 + number_threads*4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		})
		this.result = device.createBuffer({
			size: this.features[0].size*4*4,
			offset: 0,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	
		})
		// Render Initialization
		this.texture = device.createTexture({
			size: [textureSize.width, textureSize.height],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
		});
		// readback buffer for texture
		this.textureReadback = device.createBuffer({
			size: textureSize.width * textureSize.height * 4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		this.sampler = device.createSampler({
			minFilter: 'nearest',
			magFilter: 'nearest',
			mipmapFilter: 'nearest',
		});
		const verticeValues = new Float32Array([
			0, 0, 0, 1, 0, 0, 0, 1,
			1, 0, 0, 1, 0, 0, 0, 1,
			0, 1, 0, 1, 0, 0, 0, 1,
			1, 1, 0, 1, 0, 0, 0, 1,
		]);
		this.vertices = device.createBuffer({
			// size: Math.pow(4, 8),
			size: verticeValues.byteLength, 
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
		});
		device.queue.writeBuffer(this.vertices, 0, verticeValues.buffer);
		const indicesValues = new Uint32Array([0, 1, 2, 1, 3, 2]);
		this.indices = device.createBuffer({
			size: 6*4*4, 
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.INDEX,
		});
		device.queue.writeBuffer(this.indices, 0, indicesValues.buffer);
		// State Buffer
		this.state = device.createBuffer({
			size: 4*WORKGROUPSIZE*WORKGROUPSIZE + 8*8,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		// TODO check if textureSize works
		const resolution = new Float32Array([textureSize.width, textureSize.height]);
		const workgroupSize = new Uint32Array([WORKGROUPSIZE, WORKGROUPSIZE]); 
		const input = new Float32Array([0, 0, 0, 0]);
		this.uniform = device.createBuffer({
			size: 4*WORKGROUPSIZE*WORKGROUPSIZE + 8*8 + 4*4*4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
		device.queue.writeBuffer(this.uniform, 0, resolution.buffer);
		device.queue.writeBuffer(this.uniform, 4*4, workgroupSize.buffer);
		device.queue.writeBuffer(this.uniform, 4*4 + 4*8, input.buffer);
		this.uniformSize = {
			resolution: 4*4,
			workgroupSize: 4*4 + 4*8,
			input: 4*4 + 4*8 + 4*4,
		}
		// Console log all size of buffers
		console.log('BufferMux initialized with:');
		console.log('textureSize:', textureSize);
		console.log('mipTextureSize:', mipTextureSize);
		console.log('mipLevel:', mipLevel);
		console.log('quadTreeMap size:', this.quadTreeMap.size);
		console.log('evalThreadIter size:', this.evalThreadIter.size);
		console.log('result size:', this.result.size);
		console.log('texture size:', this.texture.size);
		console.log('vertices size:', this.vertices.size);
		console.log('indices size:', this.indices.size);
		console.log('uniform size:', this.uniform.size);
		console.log('state size:', this.state.size);
		console.log('traversal size:', this.traversal.size);
		console.log('travThreadIter size:', this.travThreadIter.size);
		console.log('quadTrees:', this.quadTrees.length);

	}
	updateInput(input: Float32Array) {
		this.device.queue.writeBuffer(this.uniform, this.uniformSize.resolution + this.uniformSize.workgroupSize, input.buffer);
	}
	// copy texture to readback buffer
	async copyTextureToReadback() {
		const textureSize = this.config.textureSize;
		// command encoder
		const commandEncoder = this.device.createCommandEncoder();
		commandEncoder.copyTextureToBuffer(
			{
				texture: this.texture,
			},
			{
				buffer: this.textureReadback,
				bytesPerRow: textureSize.width * 4,
			},
			{
				width: textureSize.width,
				height: textureSize.height,
			});
		// submit command
		this.device.queue.submit([commandEncoder.finish()]);
		// await for the command to finish
		return this.device.queue.onSubmittedWorkDone();
	}
	// get texture data
	async getTextureData() {
		this.textureReadback.unmap();
		await this.copyTextureToReadback();
		await this.textureReadback.mapAsync(GPUMapMode.READ);
		const arrayBuffer = this.textureReadback.getMappedRange();
		const data = new Uint8Array(arrayBuffer);
		// return data;
		// console.log(data)	
		return data;
	}
	unmap() {
		// unmap and destroy
		this.quadTreeMap.unmap();
		this.quadTreeMap.destroy();
		this.mipTexture.destroy();
		this.evalThreadIter.destroy();
		this.result.destroy();
		this.texture.destroy();
		for (let i = 0; i < this.features.length; i++) {
			this.features[i].destroy();
			this.quadTrees[i].nodes.destroy();
			this.quadTrees[i].values.destroy();
			this.quadTrees[i].unbind();
		}
		this.travThreadIter.destroy();
	}
}
export default BufferMux;
