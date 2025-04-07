import Eval from './traversal/eval';
import QuadTreeTraversal from './traversal/traversal';
import VertexGen from './genVertex';

class QuadManager {
	device: GPUDevice;
	textureSize: number;
	quadTree: QuadTreeTraversal;
	eval: Eval;
	buffers = {};
	constructor(device: GPUDevice, textureSize: number, mipLevel: number) {
		this.device = device;
		this.textureSize = textureSize;
		this.mipLevel = mipLevel;	
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
		this.quadTree.pass(level);
		this.genVertex.pass(frame);
		this.eval.pass(level);
	}
	reset(){
		this.eval.unmap();
		this.quadTree.unmap();
		this.genVertex.unmap();
	}
	unmap(){
		this.eval.unmap();
		this.quadTree.unmap();
		this.genVertex.unmap();
	}
}
export default QuadManager;
