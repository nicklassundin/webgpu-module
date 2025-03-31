import Eval from './eval';
import QuadTreeTraversal from './traversal';

class QuadManager {
	device: GPUDevice;
	textureSize: number;
	quadTree: QuadTreeTraversal;
	eval: Eval;
	constructor(device: GPUDevice, textureSize: number) {
		this.device = device;
		this.textureSize = textureSize;
	}
	init(quadTree: QuadTree, mipLevel: number) {
		this.target = new QuadTreeTraversal(this.device, quadTree, mipLevel);
		this.quadTree = new QuadTreeTraversal(this.device, quadTree, mipLevel);
		this.eval = new Eval(this.device, this.textureSize, this.target, this.quadTree);
	}
	pass(level){
		this.target.pass(level)
	}
	iterate(level){
		this.target.pass(level);
		this.quadTree.pass(level);
		this.eval.pass(level);
	}
}
export default QuadManager;
