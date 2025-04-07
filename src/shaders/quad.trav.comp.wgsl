
struct Node {
	valueAddress: f32, 
	children: vec4<f32>,	
	quad: f32,
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
@group(0) @binding(3) var<storage, read_write> nodes: array<Node>;

@group(0) @binding(4) var<storage, read_write> result: array<f32>;


@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let id = local_id.x + local_id.y * 4u;
	var trav = traversal[id]; 
	trav.depth = f32(id);
	nTrav[id] = trav;

	let address = u32(trav.address);
	
	if(address == 0u && trav.depth != 0.0){
		return;
	}

	let node = nodes[address];
	var boundBox = trav.boundBox;
	if (values[address] == 0.0) {
		return;
	}
	let quad = getQuadIndex(trav.coord.xy, boundBox);
	var child = -1.0;
	if (u32(nodes[u32(node.children[0u])].quad) == quad){
		child = node.children[0u];
	} else if (u32(nodes[u32(node.children[1u])].quad) == quad){
		child = node.children[1u];
	} else if (u32(nodes[u32(node.children[2u])].quad) == quad){
		child = node.children[2u];
	} else if (u32(nodes[u32(node.children[3u])].quad) == quad){
		child = node.children[3u];
	}
	var nextTrav = trav;
	nextTrav.address = child;

	trav.boundBox = getBoundBox(trav.coord.xy, boundBox);
	trav.address = child;
	if child == 0.0 {
		trav.address = 0.0;
		nTrav[id + 1] = trav;
		return;
	}
	result[u32(trav.depth)] = values[address] / values[0];
	nTrav[id + 1] = nextTrav;
}
