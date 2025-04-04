import Eval from './eval';
import QuadTreeTraversal from './traversal';
import VertexGen from './genVertex';

class QuadManager {
	device: GPUDevice;
	textureSize: number;
	quadTree: QuadTreeTraversal;
	eval: Eval;
	constructor(device: GPUDevice, textureSize: number) {
		this.device = device;
		this.textureSize = textureSize;
	}
	init(quadTree: QuadTree, mipLevel: number, uv: number[]) {
		this.target = new QuadTreeTraversal(this.device, quadTree, mipLevel, uv);
		this.quadTree = new QuadTreeTraversal(this.device, quadTree, mipLevel, uv);
		this.eval = new Eval(this.device, this.textureSize, this.target, this.quadTree);
		this.genVertex = new VertexGen(this.device, this.textureSize, this.eval, this.quadTree, mipLevel);
		// this.genVertex.pass(mipLevel);
	}
	pass(level){
		this.target.pass(level)
		this.genVertex.pass(level);
		this.eval.pass(level);
	}
	iterate(level){
		this.target.pass(level);
		this.quadTree.pass(level);
		this.genVertex.pass(level);
		this.eval.pass(level);
		
	}
}
export default QuadManager;
