
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};


fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 5u],
		vec4<f32>(nodes[index * 5u + 1u], nodes[index * 5u + 2u], nodes[index * 5u + 3u], nodes[index * 5u + 4u]),
		nodes[index * 5u + 5u]
	);
	return node;
}

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	calls: u32,
	_pad: vec3<u32>,
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


//@compute @workgroup_size(1)
@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let id = local_id.x + local_id.y * 4u;
	//let id = global_id.x;
	var trav = traversal[id]; 
	trav.depth = f32(id);
	
	if(trav.coord.x != nTrav[id].coord.x && trav.coord.y != nTrav[id].coord.y){
		trav.calls = trav.calls + 1u;
	}

	nTrav[id] = trav;

	let address = i32(trav.address);
	if (address == -1) {
		return;
	}
	if(address == 0 && trav.depth != 0.0){
		return;
	}

	var node = getNode(u32(address)); 
	var boundBox = trav.boundBox;
	let quad = getQuadIndex(trav.coord.xy, boundBox);
	let child = node.children[quad];
	var nextTrav = trav;
	nextTrav.address = child;
	nextTrav.depth = trav.depth + 1.0;
	nextTrav.boundBox = boundBox;


	trav.boundBox = getBoundBox(trav.coord.xy, boundBox);
	trav.address = child;
	if child == 0.0 {
		trav.address = 0.0;
		nTrav[id + 1] = trav;
		return;
	}
	//result[u32(trav.depth)] = values[address] / values[0];
	//result[u32(trav.depth)] = f32(quad);
	result[u32(trav.depth)] = f32(address);
	nTrav[id + 1] = nextTrav;
}
