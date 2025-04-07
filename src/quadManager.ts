import Eval from './traversal/eval';
import QuadTreeTraversal from './traversal/traversal';
import VertexGen from './genVertex';

class QuadManager {
	device: GPUDevice;
	textureSize: number;
	quadTree: QuadTreeTraversal;
	eval: Eval;
	buffers = {};
	constructor(device: GPUDevice, textureSize: number, mipLevel: number, uv: number[]) {
		this.device = device;
		this.textureSize = textureSize;
		this.mipLevel = mipLevel;	
		
		// Traversal Buffers TODO move here?
		// this.buffers.traversal = [];
		// for (let i = 0; i < mipLevel; i++) {
		// 	const travVal = new Float32Array([i, 0, 0, 1, 1, uv[0], uv[1], 0]);
		// 	const buffer = device.createBuffer({
		// 		size: Float32Array.BYTES_PER_ELEMENT * 64,
		// 		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		// 	});
		// 	device.queue.writeBuffer(buffer, 0, travVal, 0);
		// 	this.buffers.traversal.push(buffer);
		// }
		// Path buffers
		// const paths = new Float32Array(mipLevel);
		// this.buffers.path = device.createBuffer({
		// 	size: Float32Array.BYTES_PER_ELEMENT * mipLevel,
		// 	usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		// });
		// device.queue.onSubmittedWorkDone()
	}
	init(quadTree: QuadTree, uv: number[]) {
		this.target = new QuadTreeTraversal(this.device, quadTree, this.mipLevel, uv);
		this.quadTree = new QuadTreeTraversal(this.device, quadTree, this.mipLevel, uv);
		this.eval = new Eval(this.device, this.textureSize, this.target, this.quadTree);
		this.genVertex = new VertexGen(this.device, this.textureSize, this.eval, this.quadTree, this.mipLevel);
		// this.genVertex.pass(mipLevel);
	}
	pass(level, frame: number = 0){
		this.target.pass(level)
		this.genVertex.pass(frame);
		this.eval.pass(level);
	}
	iterate(level, frame: number = 0){
		// this.target.pass(level);
		this.quadTree.pass(level);
		this.genVertex.pass(frame);
		this.eval.pass(level);
	}
	unmap(){
		this.quadTree.unmap();
		this.eval.unmap();
		this.genVertex.unmap();
		this.target.unmap();
	}
}
export default QuadManager;
