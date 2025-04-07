
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
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
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
// function that return boundBox for quadrant
fn getBoundBox(coord: vec2<f32>, boundBox: vec4<f32>) -> vec4<f32> {
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	var newBoundBox = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	if coord.x < center.x {
		newBoundBox.x = boundBox.x;
		newBoundBox.z = center.x;
	} else {
		newBoundBox.x = center.x;
		newBoundBox.z = boundBox.z;
	}
	if coord.y < center.y {
		newBoundBox.y = boundBox.y;
		newBoundBox.w = center.y;
	} else {
		newBoundBox.y = center.y;
		newBoundBox.w = boundBox.w;
	}
	return newBoundBox;
};


@group(0) @binding(0) var<storage, read> traversal: array<Traversal>;
@group(0) @binding(1) var<storage, read_write> nTrav: array<Traversal>;
@group(0) @binding(2) var<storage, read_write> values: array<f32>;
@group(0) @binding(3) var<storage, read_write> nodes: array<f32>;

@group(0) @binding(4) var<storage, read_write> result: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	//let id = global_id.x;
	// TODO : use offset value in future instead of global_id.x;
	let id = global_id.x; 
	var trav = traversal[id]; 
	var nextTrav = traversal[id];
	nTrav[id] = trav;
	nTrav[id].depth = f32(id);

	let address = u32(trav.address);
	
	if(address == 0u && trav.depth != 0.0){
		return;
	}

	let node = getNode(address);
	var boundBox = trav.boundBox;
	if (values[address] == 0.0) {
		nextTrav.address = f32(address);
		nextTrav.boundBox = boundBox; 
		return;
	}
	let quad = getQuadIndex(trav.coord.xy, boundBox);

	let child = node.children[quad];

	nextTrav.boundBox = getBoundBox(trav.coord.xy, boundBox);
	nextTrav.address = child;
	if child == 0.0 {
		nextTrav.address = 0.0;
		nTrav[id + 1] = nextTrav;
		return;
	}
	result[u32(trav.depth)] = values[address] / values[0];
	nTrav[id + 1] = nextTrav;
}
