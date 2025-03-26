
struct Uniforms {
	resolution: vec2<f32>,
	mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 


struct Node {
	valueAddress: f32, 
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

fn getNode(address: u32) -> Node {
	let index = address*8;
	var node: Node;
	node.valueAddress = nodes[index];
	node.offset = nodes[index + 1];
	node.size = nodes[index + 2];
	node.children = vec4<f32>(nodes[index + 3], nodes[index + 4], nodes[index + 5], nodes[index + 6]);
	node.quad = nodes[index + 7];
	return node;
};


struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};

fn getNextTraversal(address: u32) -> Traversal {
	var nextTrav: Traversal;
	let index = address*10;
	nextTrav.depth = nextTraversal[index]; 
	nextTrav.boundBox = vec4<f32>(nextTraversal[index + 1], nextTraversal[index + 2], nextTraversal[index + 3], nextTraversal[index + 4]);
	nextTrav.coord = vec4<f32>(nextTraversal[index + 5], nextTraversal[index + 6], nextTraversal[index + 7], nextTraversal[index + 8]);
	nextTrav.address = nextTraversal[index + 9];
	return nextTrav;
};
fn getTraversal(address: u32) -> Traversal {
	var trav: Traversal;
	let index = address*10;
	trav.depth = traversal[index]; 
	trav.boundBox = vec4<f32>(traversal[index + 1], traversal[index + 2], traversal[index + 3], traversal[index + 4]);
	trav.coord = vec4<f32>(traversal[index + 5], traversal[index + 6], traversal[index + 7], traversal[index + 8]);
	trav.address = traversal[index + 9];
	return trav;
};


// function to get quad index from cordinates and boundbox
fn getQuadIndex(coord: vec2<f32>, boundBox: vec4<f32>) -> u32 {
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	if coord.x < center.x {
		if coord.y < center.y {
			return 0u;
		} else {
			return 1u;
		}
	} else {
		if coord.y < center.y {
			return 2u;
		} else {
			return 3u;
		}
	}
};
fn setTraversal(address: u32, trav: Traversal) {
	let index = address*10;
	nextTraversal[index] = trav.depth;
	nextTraversal[index + 1] = trav.boundBox.x;
	nextTraversal[index + 2] = trav.boundBox.y;
	nextTraversal[index + 3] = trav.boundBox.z;
	nextTraversal[index + 4] = trav.boundBox.w;
	nextTraversal[index + 5] = trav.coord.x;
	nextTraversal[index + 6] = trav.coord.y;
	nextTraversal[index + 7] = trav.coord.z;
	nextTraversal[index + 8] = trav.coord.w;
	nextTraversal[index + 9] = trav.address;

};


@group(1) @binding(0) var<storage, read> traversal: array<f32>;
@group(1) @binding(1) var<storage, read_write> nextTraversal: array<f32>;
@group(1) @binding(2) var<storage, read_write> values: array<f32>;
@group(1) @binding(3) var<storage, read_write> nodes: array<f32>;

@group(1) @binding(4) var<storage, read_write> result: array<f32>;




@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	var trav = getTraversal(0);
	var nextTrav = getNextTraversal(0);
	
	if(trav.address < 0.0) {
		return;
	}
	let address = u32(trav.address);
	let node = getNode(address);
	var boundBox = trav.boundBox;
	if (values[address] == 0.0) {
		nextTrav.address = f32(address);
		
		nextTrav.boundBox = boundBox; 
		return;
	}
	let quad = getQuadIndex(trav.coord.xy, boundBox);
	let child = node.children[quad];

	if child == 0.0 {
		nextTrav.address = 0.0;
		setTraversal(global_id.x, nextTrav);
		return;
	}
	
	nextTrav.address = child;
	//result[u32(trav.depth)] = f32(address); 
	result[u32(trav.depth)] = values[address] / values[0u];
	//result[u32(trav.depth)] = trav.depth; 
	//result[u32(trav.depth)] = values[u32(node.children[0])];
	//result[u32(trav.depth)] = values[u32(node.children[1])];
	//result[u32(trav.depth)] = values[u32(node.children[2])];
	//result[u32(trav.depth)] = values[u32(node.children[3])];


	setTraversal(global_id.x, nextTrav);
}
