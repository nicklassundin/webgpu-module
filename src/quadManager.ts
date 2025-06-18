import Eval from './traversal/eval';
import QuadTreeTraversal from './traversal/traversal';
import VertexGen from './genVertex';
import BufferMux from './traversal/BufferMux';

const LEVEL = 1;
class QuadManager {
	device: GPUDevice;
	originalCanvasSize: number;
	quadTree: QuadTreeTraversal;
	eval: Eval;
	bufferMux: BufferMux;
	constructor(device: GPUDevice, originalCanvasSize: number, mipLevel: number) {
		this.device = device;

		this.originalCanvasSize = originalCanvasSize;
		this.mipLevel = mipLevel;	
	}
	init(quadTree: QuadTree, uv: number[], data: array[]) {
		this.bufferMux = new BufferMux(this.device, this.originalCanvasSize, this.mipLevel, LEVEL, uv, data);

		this.quadTree = new QuadTreeTraversal(this.device, this.bufferMux)
		
		this.eval = new Eval(this.device, this.bufferMux, LEVEL);
		this.genVertex = new VertexGen(this.device, this.bufferMux)
	}
	pass(level, frame: number = 0){
		this.genVertex.pass(frame);
		this.eval.pass(level);
	}
	iterate(level, frame: number = 0){
		this.quadTree.pass(level);
		this.eval.pass(level);
		
		this.genVertex.pass(frame);
	}
	async unmap(){
		this.bufferMux.unmap();
	}
	get updatedCanvasSize() {
		return this.bufferMux.updatedCanvasSize;
	}
}
export default QuadManager;
